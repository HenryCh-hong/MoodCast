// Moodcast interactive shell.
//
// Replaces the long `npm run moodcast --silent -- …` flow with a persistent
// REPL. Reuses every existing command handler — the shell is a thin
// dispatcher, never a copy of playback / generation / library logic.
//
// Behavior:
//   • Banner on entry.
//   • prompt `moodcast> `.
//   • Sub-commands that take over the terminal (start, sessions play, resume)
//     pause readline before running, then redraw the prompt afterwards.
//   • `quit` / `exit` / Ctrl+D close cleanly.
//   • Ctrl+C at the prompt clears the line and hints `quit`. Inside an
//     alt-screen sub-command the existing altScreen SIGINT path applies.
//
// Privacy: the shell never logs tokens, passwords, or raw calendar/event
// titles — every handler it dispatches is the same code already audited.

import readline from 'readline';
import chalk from 'chalk';

import { startCommand } from './start.js';
import { statusCommand } from './status.js';
import { playCommand } from './play.js';
import { authCommand } from './auth.js';
import { trackCommand } from './track.js';
import {
  calendarConnect,
  calendarDisconnect,
  calendarStatus,
} from './calendar.js';
import {
  listCmd as sessionsListCmd,
  showCmd as sessionsShowCmd,
  playCmd as sessionsPlayCmd,
  resumeCmd as sessionsResumeCmd,
  deleteCmd as sessionsDeleteCmd,
} from './sessions.js';
import { pickSession } from '../sessionPicker.js';
import { setShellMode } from '../utils/shellContext.js';

interface ShellState {
  rl: readline.Interface;
  shouldExit: boolean;
}

const PROMPT = `${chalk.hex('#c4b5fd')('moodcast')}${chalk.dim('>')} `;

const HELP_LINES: Array<[string, string]> = [
  ['help', 'show this list'],
  ['auth', 'connect Spotify (PKCE in browser)'],
  ['spotify auth', 'connect Spotify (alias)'],
  ['status', 'spotify connection / device / now-playing'],
  ['start', 'tune a new session (respects saved tuningMode)'],
  ['start --auto', 'auto tune (skip tag picker)'],
  ['start --manual', 'manual tune (show tag picker)'],
  ['resume', 'resume the most recently saved session'],
  ['play', 'resume playback'],
  ['pause', 'pause playback'],
  ['next', 'skip to next track'],
  ['previous', 'go to previous track'],
  ['sessions', 'open the interactive session picker'],
  ['sessions list', 'print the saved-session list'],
  ['sessions show [id]', 'show details (no id → picker)'],
  ['sessions play  [id]', 'play a session (no id → picker)'],
  ['sessions delete <id>', 'delete a session by id (confirm)'],
  ['track <n>', 'play track N of the current active session (1-indexed)'],
  ['calendar status', 'apple calendar connection state'],
  ['calendar connect', 'connect apple calendar'],
  ['calendar disconnect', 'disconnect apple calendar'],
  ['quit / exit', 'leave the shell'],
];

const ALIAS_LINES: Array<[string, string]> = [
  ['ls', 'sessions list'],
  ['s', 'sessions (picker)'],
  ['r', 'resume'],
  ['n', 'next'],
  ['p', 'previous'],
  ['q', 'quit'],
];

function printBanner(): void {
  console.log('');
  console.log(`  ${chalk.bold.hex('#c4b5fd')('▓▒░ MOODCAST ░▒▓')}  ${chalk.dim('FM 88.7')}`);
  console.log('');
  console.log(`  ${chalk.dim('MooC online.')}`);
  console.log(`  ${chalk.dim('Type')} ${chalk.bold('help')} ${chalk.dim('for commands.')}`);
  console.log('');
}

function printHelp(): void {
  console.log('');
  console.log(`  ${chalk.bold.hex('#c4b5fd')('Commands')}`);
  for (const [cmd, desc] of HELP_LINES) {
    console.log(`    ${chalk.bold(cmd.padEnd(22))} ${chalk.dim(desc)}`);
  }
  console.log('');
  console.log(`  ${chalk.bold.hex('#c4b5fd')('Aliases')}`);
  for (const [alias, mapped] of ALIAS_LINES) {
    console.log(`    ${chalk.bold(alias.padEnd(6))} ${chalk.dim('→')} ${chalk.dim(mapped)}`);
  }
  console.log('');
}

function tokenize(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

async function confirmYesNo(rl: readline.Interface, question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(`${question} `, (answer) => {
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

// ─── Shell command dispatchers ────────────────────────────────────────────

async function runSessionsAction(rl: readline.Interface, args: string[]): Promise<void> {
  const sub = args[0];
  // `sessions` (no args)               → picker
  // `sessions list`                    → list
  // `sessions show` / `sessions show <id>`   → picker (then show) | show by id
  // `sessions play` / `sessions play <id>`   → picker (then play) | play by id
  // `sessions delete <id>`             → confirm + delete
  // `sessions resume`                  → resume
  if (!sub || sub === 'pick') {
    await runPicker(rl);
    return;
  }
  if (sub === 'list') {
    await sessionsListCmd();
    return;
  }
  if (sub === 'show') {
    if (args[1]) {
      await sessionsShowCmd(args[1]);
    } else {
      const result = await pickSession();
      if (!result) return;
      await sessionsShowCmd(result.entry.id);
    }
    return;
  }
  if (sub === 'play') {
    if (args[1]) {
      await sessionsPlayCmd(args[1]);
    } else {
      const result = await pickSession();
      if (!result) return;
      if (result.action === 'show') {
        await sessionsShowCmd(result.entry.id);
      } else if (result.action === 'delete') {
        await runDeleteWithConfirm(rl, result.entry.id, result.entry.title);
      } else {
        await sessionsPlayCmd(result.entry.id);
      }
    }
    return;
  }
  if (sub === 'resume') {
    await sessionsResumeCmd();
    return;
  }
  if (sub === 'delete') {
    if (!args[1]) {
      console.log(`  ${chalk.dim('usage: sessions delete <id>')}`);
      return;
    }
    await runDeleteWithConfirm(rl, args[1]);
    return;
  }
  console.log(`  ${chalk.dim('unknown sessions sub-command:')} ${chalk.bold(sub)}`);
  console.log(`  ${chalk.dim('try')} ${chalk.bold('sessions')} ${chalk.dim('or')} ${chalk.bold('help')}`);
}

async function runPicker(rl: readline.Interface): Promise<void> {
  const result = await pickSession();
  if (!result) return;
  if (result.action === 'play') {
    await sessionsPlayCmd(result.entry.id);
    return;
  }
  if (result.action === 'show') {
    await sessionsShowCmd(result.entry.id);
    return;
  }
  if (result.action === 'delete') {
    await runDeleteWithConfirm(rl, result.entry.id, result.entry.title);
  }
}

async function runDeleteWithConfirm(
  rl: readline.Interface,
  idOrPrefix: string,
  title?: string,
): Promise<void> {
  const label = title ? `${chalk.bold(title)} ${chalk.dim(`(${idOrPrefix})`)}` : chalk.bold(idOrPrefix);
  console.log('');
  console.log(`  ${chalk.yellow('!')} delete ${label}?`);
  const ok = await confirmYesNo(rl, `  ${chalk.dim('confirm? [y/N]')}`);
  if (!ok) {
    console.log(`  ${chalk.dim('cancelled.')}`);
    return;
  }
  // sessionsDeleteCmd resolves the prefix and prints success/error itself.
  await sessionsDeleteCmd(idOrPrefix);
}

async function runStartWithFlags(args: string[]): Promise<void> {
  const auto = args.includes('--auto');
  const manual = args.includes('--manual');
  await startCommand({
    tuningOverride: auto ? 'auto' : manual ? 'manual' : undefined,
  });
}

async function runCalendar(args: string[]): Promise<void> {
  const sub = args[0];
  if (sub === 'status' || sub === undefined) {
    await calendarStatus();
    return;
  }
  if (sub === 'connect') {
    await calendarConnect();
    return;
  }
  if (sub === 'disconnect') {
    await calendarDisconnect();
    return;
  }
  console.log(`  ${chalk.dim('unknown calendar sub-command:')} ${chalk.bold(sub)}`);
}

async function dispatch(state: ShellState, line: string): Promise<void> {
  const tokens = tokenize(line);
  if (tokens.length === 0) return;

  // Resolve aliases first.
  const aliasMap: Record<string, string[]> = {
    ls: ['sessions', 'list'],
    s: ['sessions'],
    r: ['resume'],
    n: ['next'],
    p: ['previous'],
    q: ['quit'],
  };
  const headRaw = tokens[0].toLowerCase();
  const secondRaw = (tokens[1] ?? '').toLowerCase();

  // Two-word shortcuts:
  //   `spotify auth`     → auth
  //   `connect spotify`  → auth
  //   `spotify login`    → auth
  if (
    (headRaw === 'spotify' && (secondRaw === 'auth' || secondRaw === 'login' || secondRaw === 'connect')) ||
    (headRaw === 'connect' && secondRaw === 'spotify')
  ) {
    await authCommand();
    return;
  }

  const expanded = aliasMap[headRaw]
    ? [...aliasMap[headRaw], ...tokens.slice(1)]
    : [headRaw, ...tokens.slice(1)];
  const head = expanded[0];
  const rest = expanded.slice(1);

  switch (head) {
    case 'help':
    case '?':
      printHelp();
      return;
    case 'quit':
    case 'exit':
      state.shouldExit = true;
      return;
    case 'auth':
    case 'login':
      await authCommand();
      return;
    case 'track':
      if (!rest[0]) {
        console.log(`  ${chalk.dim('usage:')} ${chalk.bold('track <n>')}  ${chalk.dim('(1-indexed)')}`);
        return;
      }
      await trackCommand(rest[0]);
      return;
    case 'status':
      await statusCommand();
      return;
    case 'start':
      await runStartWithFlags(rest);
      return;
    case 'resume':
      await sessionsResumeCmd();
      return;
    case 'play':
      await playCommand('play');
      return;
    case 'pause':
      await playCommand('pause');
      return;
    case 'next':
      await playCommand('next');
      return;
    case 'previous':
    case 'prev':
      await playCommand('prev');
      return;
    case 'sessions':
      await runSessionsAction(state.rl, rest);
      return;
    case 'calendar':
      await runCalendar(rest);
      return;
    default:
      console.log(`  ${chalk.dim('unknown command:')} ${chalk.bold(head)}`);
      console.log(`  ${chalk.dim('type')} ${chalk.bold('help')} ${chalk.dim('for the list.')}`);
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────

export interface ShellCommandOptions {
  /** When true, skip the entry banner — used when the bare `moodcast`
   *  launcher has already printed a compact "online" panel and is handing
   *  off to the shell. */
  skipBanner?: boolean;
}

export async function shellCommand(opts: ShellCommandOptions = {}): Promise<void> {
  setShellMode(true);
  if (!opts.skipBanner) printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: PROMPT,
  });

  const state: ShellState = { rl, shouldExit: false };

  // Ctrl+C at the prompt: clear the line and hint, do NOT exit. Once the
  // user has signalled twice in a row (no command run in between), exit.
  let lastSigintAt = 0;
  rl.on('SIGINT', () => {
    const now = Date.now();
    if (now - lastSigintAt < 1500) {
      state.shouldExit = true;
      rl.close();
      return;
    }
    lastSigintAt = now;
    console.log('');
    console.log(`  ${chalk.dim("(use 'quit' or press Ctrl+C again to exit)")}`);
    rl.prompt();
  });

  rl.prompt();

  // Serialize dispatches via a promise chain. Piped stdin (`printf 'a\nb\n'`)
  // can deliver multiple `line` events before any one finishes, and stdin EOF
  // can fire `close` while a command is still running. Chaining ensures every
  // dispatch and the sign-off all run in order.
  let chain: Promise<void> = Promise.resolve();
  let rlClosed = false;
  rl.on('close', () => {
    rlClosed = true;
  });

  rl.on('line', (line) => {
    // Pause readline so sub-commands that grab raw stdin (e.g. tag picker)
    // don't race with the next line we already received.
    rl.pause();
    chain = chain.then(async () => {
      try {
        await dispatch(state, line);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ${chalk.red('!')} ${msg}`);
      }
      if (state.shouldExit) {
        if (!rlClosed) rl.close();
        return;
      }
      // If a prior dispatch (e.g. `quit`) closed the shell while this one was
      // queued behind it on the chain, don't try to resume / re-prompt.
      if (rlClosed) return;
      rl.resume();
      rl.prompt();
    });
  });

  await new Promise<void>((resolve) => {
    rl.on('close', () => {
      // Wait for the full dispatch chain before printing sign-off so any
      // still-running command can render its output (and read isShellMode())
      // before the shell tears down.
      void chain.then(() => {
        console.log('');
        console.log(`  ${chalk.dim('signing off.')}`);
        console.log('');
        resolve();
      });
    });
  });

  setShellMode(false);
}
