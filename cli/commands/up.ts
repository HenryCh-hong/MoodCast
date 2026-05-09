// `moodcast up` — start the dev server (if needed), wait for it to be ready,
// open the browser, then print a friendly status panel. Daily-driver entry
// point that turns the developer-y `npm run dev -- -p 3001` into a one-shot.
//
// Behaviour:
//   1. Ping the configured origin (default 127.0.0.1:3001, or --port).
//   2. If already online → print "Moodcast server already online" and just
//      open the browser at the requested path.
//   3. If not online → check whether the port is held by a foreign process
//      (clear error, no auto-kill, suggest `lsof -i :<port>` and
//      `moodcast up --port <other>`); otherwise spawn `next dev -p <port>`
//      detached so the server keeps running after the CLI exits.
//   4. Poll the origin until ready (or timeout). Print "Moodcast is ready".
//   5. Open the browser (unless --no-open).
//
// Custom port caveat: changing the port at runtime ONLY affects this dev
// server's bind. Spotify auth depends on SPOTIFY_REDIRECT_URI matching the
// app you registered with Spotify, so authorisation flows will still need
// the env-configured port. `--port` is meant for "3001 is taken right now,
// boot Moodcast on 3002 anyway", not as a permanent reconfiguration.
//
// Privacy: never prints token values, secrets, or env contents.

import chalk from 'chalk';
import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pingServer, getServerOrigin } from '../utils/serverPing.js';
import { getValidToken } from '../auth.js';
import { isShellMode } from '../utils/shellContext.js';
import {
  header,
  panel,
  panelLine,
  recovery,
  error as logError,
} from '../display.js';

const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 500;

export interface EnsureServerResult {
  /** True when the server is responding by the time the call returns. */
  online: boolean;
  /** Whether this call started a new dev server (vs reusing an existing one). */
  startedNew: boolean;
  origin: string;
  port: number;
  /** Path to the dev-server log file, when one was opened. */
  logFile?: string;
  /** Set when ensure failed — port held by foreign process, spawn error, ready timeout. */
  error?: 'port-occupied' | 'spawn-failed' | 'not-ready';
  /** Free-text detail for callers that want to surface the error themselves. */
  errorMessage?: string;
}

export interface EnsureServerOptions {
  /** Port override; otherwise derived from SPOTIFY_REDIRECT_URI. */
  port?: number;
  /**
   * When true, suppress `console.log` chatter from this helper — the bare
   * `moodcast` launcher does its own minimal output and doesn't want the
   * standalone `moodcast up` panels stepping on it.
   */
  quiet?: boolean;
}

interface UpOptions {
  /** When true, skip opening the browser. */
  noOpen?: boolean;
  /** Subpath to open in the browser, e.g. "/saved" or "/builder". Default "/". */
  openPath?: string;
  /** Override the default port (from SPOTIFY_REDIRECT_URI). */
  port?: number;
}

function repoRoot(): string {
  // cli/commands/up.ts → repo root is two parents up.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

function resolveOrigin(portOverride?: number): string {
  if (typeof portOverride === 'number' && Number.isFinite(portOverride)) {
    return `http://127.0.0.1:${portOverride}`;
  }
  return getServerOrigin();
}

function portFromOrigin(origin: string): number {
  const u = new URL(origin);
  return parseInt(u.port || '80', 10);
}

function checkPortOwner(port: number): Promise<'free' | 'occupied'> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') resolve('occupied');
      else resolve('occupied');
    });
    tester.once('listening', () => {
      tester.close(() => resolve('free'));
    });
    tester.listen(port, '127.0.0.1');
  });
}

async function waitForReady(origin: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await pingServer({ origin, timeoutMs: 800 });
    if (status.online) return true;
    await new Promise((r) => setTimeout(r, READY_POLL_MS));
  }
  return false;
}

function spawnDevServer(port: number): { pid: number | undefined; logFile: string } {
  const root = repoRoot();
  // Per-day log so output goes somewhere we can find on failure but doesn't
  // bloat the repo.
  const logDir = path.join(root, '.next');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'moodcast-dev.log');
  const out = fs.openSync(logFile, 'a');
  const child = spawn(
    process.execPath,
    [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(port)],
    {
      cwd: root,
      detached: true,
      stdio: ['ignore', out, out],
      env: process.env,
    },
  );
  child.unref();
  return { pid: child.pid, logFile };
}

/**
 * Reusable server-bring-up helper. The standalone `moodcast up` command and
 * the bare `moodcast` launcher both go through this so there's exactly one
 * code path for "make sure 127.0.0.1:<port> is alive". When `quiet: true`,
 * stays silent on success — caller is expected to render its own status.
 */
export async function ensureServerOnline(
  opts: EnsureServerOptions = {},
): Promise<EnsureServerResult> {
  const origin = resolveOrigin(opts.port);
  const port = portFromOrigin(origin);
  const quiet = !!opts.quiet;

  const initial = await pingServer({ origin });
  if (initial.online) {
    return { online: true, startedNew: false, origin, port };
  }

  const owner = await checkPortOwner(port);
  if (owner === 'occupied') {
    return {
      online: false,
      startedNew: false,
      origin,
      port,
      error: 'port-occupied',
      errorMessage: `Port ${port} is already in use by another process.`,
    };
  }

  if (!quiet) {
    console.log('');
    console.log(`  ${chalk.dim('starting dev server…')}`);
  }
  let spawned: { pid?: number; logFile: string };
  try {
    spawned = spawnDevServer(port);
  } catch (e) {
    return {
      online: false,
      startedNew: false,
      origin,
      port,
      error: 'spawn-failed',
      errorMessage: (e as Error).message,
    };
  }

  const ready = await waitForReady(origin, READY_TIMEOUT_MS);
  if (!ready) {
    return {
      online: false,
      startedNew: true,
      origin,
      port,
      logFile: spawned.logFile,
      error: 'not-ready',
      errorMessage: `Dev server did not respond on ${origin} within ${READY_TIMEOUT_MS / 1000}s.`,
    };
  }

  return { online: true, startedNew: true, origin, port, logFile: spawned.logFile };
}

function joinUrl(origin: string, subpath?: string): string {
  if (!subpath || subpath === '/' || subpath === '') return origin;
  const clean = subpath.startsWith('/') ? subpath : `/${subpath}`;
  return `${origin}${clean}`;
}

export async function openMoodcastInBrowser(url: string): Promise<void> {
  return openInBrowser(url);
}

async function openInBrowser(url: string): Promise<void> {
  try {
    const open = (await import('open')).default;
    await open(url);
  } catch {
    // Browser open failed (no $DISPLAY, sandboxed environment, etc.).
    // Don't crash — just print the URL the user can paste themselves.
    console.log('');
    console.log(`  ${chalk.dim('Open Moodcast here:')} ${chalk.bold(url)}`);
  }
}

function printNextSteps(): void {
  console.log('');
  console.log(
    '  ' +
      chalk.dim('next: ') +
      chalk.bold('moodcast') +
      chalk.dim('  ·  ') +
      chalk.bold('moodcast start --auto') +
      chalk.dim('  ·  ') +
      chalk.bold('moodcast sessions'),
  );
  console.log('');
}

export async function upCommand(opts: UpOptions = {}): Promise<void> {
  header();

  const result = await ensureServerOnline({ port: opts.port });
  const targetUrl = joinUrl(result.origin, opts.openPath);

  if (result.error === 'port-occupied') {
    logError(result.errorMessage ?? `Port ${result.port} is already in use by another process.`);
    const otherPort = result.port + 1;
    recovery([
      `inspect what's holding it: ${chalk.bold(`lsof -i :${result.port}`)}`,
      `or boot on a different port: ${chalk.bold(`moodcast up --port ${otherPort}`)}`,
      `note: ${chalk.dim('--port only changes the bind. Spotify auth still uses the SPOTIFY_REDIRECT_URI in .env.local.')}`,
    ]);
    return;
  }
  if (result.error === 'spawn-failed') {
    logError(`Could not spawn dev server: ${result.errorMessage ?? 'unknown error'}`);
    recovery([
      `try the manual command: ${chalk.bold('npm run dev -- -p ' + result.port)}`,
      'check that node_modules is installed (npm install)',
    ]);
    return;
  }
  if (result.error === 'not-ready') {
    logError(result.errorMessage ?? 'Dev server did not become ready in time.');
    recovery([
      result.logFile ? `tail the log: ${chalk.bold(result.logFile)}` : 'check the log under .next/moodcast-dev.log',
      `try the manual command in another terminal: ${chalk.bold('npm run dev -- -p ' + result.port)}`,
    ]);
    return;
  }

  if (!result.startedNew) {
    console.log(`  ${chalk.bold.hex('#c4b5fd')('●')} ${chalk.bold('Moodcast server already online')}`);
    panel('Moodcast', [
      panelLine('server', `online :${result.port}`, 'on'),
      panelLine('url', targetUrl),
    ]);
  } else {
    console.log('');
    console.log(`  ${chalk.bold.hex('#c4b5fd')('●')} ${chalk.bold('Moodcast is ready')}`);
    panel('Moodcast', [
      panelLine('server', `online :${result.port}`, 'on'),
      panelLine('url', targetUrl),
      ...(result.logFile ? [panelLine('log', result.logFile)] : []),
    ]);
  }

  // Stage 5: spotify status (best effort, never blocks). Token VALUES are
  // never printed — only the binary connected/disconnected state.
  let spotifyState: { value: string; bullet: 'on' | 'off' | 'warn' } = { value: 'unknown', bullet: 'warn' };
  try {
    const tok = await getValidToken();
    spotifyState = tok ? { value: 'connected', bullet: 'on' } : { value: 'disconnected', bullet: 'off' };
  } catch {
    /* keep unknown */
  }
  panel('Status', [
    panelLine('spotify', spotifyState.value, spotifyState.bullet),
    panelLine('next', isShellMode() ? 'type `start --auto` to broadcast' : 'run `moodcast` to drop into the shell'),
  ]);

  // Stage 6: open the browser.
  if (!opts.noOpen) {
    await openInBrowser(targetUrl);
  } else {
    console.log('');
    console.log(`  ${chalk.dim('--no-open given. URL:')} ${chalk.bold(targetUrl)}`);
  }

  printNextSteps();
}
