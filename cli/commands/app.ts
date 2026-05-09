// Bare `moodcast` — the daily app launcher.
//
// What it does, in order:
//   1. Setup check. If `.env.local` or `node_modules` is missing, print a
//      compact one-line nudge to run `moodcast setup` and exit. We do NOT
//      dump the full setup wizard from here — that's the dedicated
//      `moodcast setup` flow's job.
//   2. Server ensure. Re-uses the helper that backs `moodcast up`, in
//      `quiet` mode. Errors (port-occupied, spawn fail) get the same
//      friendly recovery output the standalone command emits.
//   3. Compact 3-line status panel — "web online", "shell ready", "MooC online".
//   4. Best-effort browser open (always non-fatal — the URL is printed if
//      open() can't find a default browser).
//   5. Hand off to the existing `shellCommand` (banner suppressed, since
//      we just printed our own header).
//
// Privacy: never prints token values, secrets, or env contents.

import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureServerOnline, openMoodcastInBrowser } from './up.js';
import { shellCommand } from './shell.js';
import { checkSetup } from '../../lib/storage/setupCheck.js';
import { getMoodcastHome } from '../../lib/storage/moodcastHome.js';
import { getValidToken } from '../auth.js';
import {
  recovery,
  error as logError,
} from '../display.js';

interface AppOptions {
  /** When true, skip opening the browser. */
  noOpen?: boolean;
  /** Subpath to open, default "/". */
  openPath?: string;
  /** Custom port; otherwise from SPOTIFY_REDIRECT_URI. */
  port?: number;
}

function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

function joinUrl(origin: string, subpath?: string): string {
  if (!subpath || subpath === '/' || subpath === '') return origin;
  const clean = subpath.startsWith('/') ? subpath : `/${subpath}`;
  return `${origin}${clean}`;
}

function compactHeader(): void {
  // A trimmed one-line variant of the cli/display header — the daily
  // launcher only needs the brand strip, not the full panel ceremony.
  console.log('');
  console.log(`  ${chalk.bold.hex('#c4b5fd')('▓▒░ MOODCAST ░▒▓')}  ${chalk.dim('FM 88.7')}`);
  console.log('');
}

function statusLine(label: string, value: string, dot: 'on' | 'off' | 'warn'): void {
  const colour = dot === 'on' ? chalk.green : dot === 'warn' ? chalk.yellow : chalk.dim;
  const bullet = colour('●');
  console.log(`  ${bullet}  ${chalk.dim(label.padEnd(8))} ${value}`);
}

export async function appCommand(opts: AppOptions = {}): Promise<void> {
  // Stage 1 — setup check.
  const root = repoRoot();
  const home = getMoodcastHome();
  const check = checkSetup(root, home);
  if (!check.ok) {
    compactHeader();
    const missingLabel = check.missing
      .map((m) => (m === 'deps' ? '`npm install`' : '.env.local'))
      .join(' + ');
    logError(`Moodcast needs setup first (missing: ${missingLabel}).`);
    recovery([
      `run: ${chalk.bold('npm run moodcast:setup')}`,
      'this seeds .env.local from .env.example and installs the shell aliases',
      `details: ${chalk.bold('docs/command-setup.md')}`,
    ]);
    return;
  }

  compactHeader();

  // Stage 2 — server ensure.
  const result = await ensureServerOnline({ port: opts.port, quiet: true });
  if (result.error === 'port-occupied') {
    logError(result.errorMessage ?? `Port ${result.port} is already in use by another process.`);
    recovery([
      `inspect what's holding it: ${chalk.bold(`lsof -i :${result.port}`)}`,
      `or boot on a different port: ${chalk.bold(`moodcast --port ${result.port + 1}`)}`,
    ]);
    return;
  }
  if (result.error === 'spawn-failed') {
    logError(`Could not spawn dev server: ${result.errorMessage ?? 'unknown error'}`);
    recovery([
      `try the manual command: ${chalk.bold('npm run dev -- -p ' + result.port)}`,
      `or run: ${chalk.bold('moodcast setup')}`,
    ]);
    return;
  }
  if (result.error === 'not-ready') {
    logError(result.errorMessage ?? 'Dev server did not become ready in time.');
    recovery([
      result.logFile ? `tail the log: ${chalk.bold(result.logFile)}` : 'check the log under .next/moodcast-dev.log',
      `or run: ${chalk.bold('moodcast up')} ${chalk.dim('to see the verbose flow')}`,
    ]);
    return;
  }

  // Stage 3 — compact status. Spotify check is best-effort — never blocks.
  const targetUrl = joinUrl(result.origin, opts.openPath);
  let spotifyOnline = false;
  try {
    const tok = await getValidToken();
    spotifyOnline = !!tok;
  } catch { /* tolerate */ }

  statusLine('web', `online  ${targetUrl}`, 'on');
  statusLine('shell', 'ready', 'on');
  statusLine('MooC', spotifyOnline ? 'online' : 'standby (spotify disconnected)', spotifyOnline ? 'on' : 'warn');

  // Stage 4 — browser open. open() failures fall through to a printed URL.
  if (!opts.noOpen) {
    await openMoodcastInBrowser(targetUrl);
  }

  // Stage 5 — hand off to the shell. Banner suppressed: we already showed
  // the brand strip + the 3-line status. The shell prints its own prompt
  // and listens for input from there.
  // First-time hint: if the user hasn't run a session yet, drop a single
  // "type `start --auto` to broadcast" line above the prompt so they have
  // a clear next move. Returning users go straight to the bare prompt —
  // they don't need the hand-holding.
  if (!check.hasRunBefore) {
    console.log('');
    console.log(`  ${chalk.dim('first run? type')} ${chalk.bold('start --auto')} ${chalk.dim('to broadcast.')}`);
  }
  console.log('');
  await shellCommand({ skipBanner: true });
}
