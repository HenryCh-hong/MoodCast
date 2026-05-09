// Phase 3 — moodcast calendar {connect, disconnect, status}
//
// PRIVACY: The app-specific password is read with masked input (the user sees
// only `·` characters as they type). It is not echoed, logged, or copied
// anywhere except into the credential file via `verifyAndDiscover()`.

import chalk from 'chalk';
import readline from 'readline';
import {
  verifyAndDiscover,
  fetchEventsRaw,
} from '../../lib/calendar/appleCalDAV.js';
import {
  clearAppleCredentials,
  readAppleStatus,
} from '../../lib/calendar/appleCredentialStore.js';
import { summarize } from '../../lib/calendar/icsSummarize.js';
import {
  readPreferences,
  writePreferences,
} from '../../lib/storage/preferencesServer.js';
import {
  header,
  panel,
  panelLine,
  error,
  success,
  recovery,
} from '../display.js';
import { isShellMode } from '../utils/shellContext.js';

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Hidden-input prompt. Writes the question, reads stdin in raw mode, masks
 * each printable keystroke with `·`. Restores cooked mode on exit.
 *
 * Returns `null` if the user pressed Ctrl+C — callers should treat that as
 * "user cancelled this flow" and unwind without killing the parent shell.
 */
function promptHidden(question: string): Promise<string | null> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      // Non-TTY: just read a line normally (e.g. piped input in tests).
      promptLine('').then(resolve);
      return;
    }
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let buf = '';
    function onData(chunk: string): void {
      for (const c of chunk) {
        if (c === '\n' || c === '\r') {
          stdin.off('data', onData);
          stdin.setRawMode(wasRaw);
          stdin.pause();
          process.stdout.write('\n');
          resolve(buf);
          return;
        }
        if (c === '\x03') {
          // Ctrl+C — cancel this prompt only. The previous implementation
          // called process.exit(130), which inside the interactive
          // `moodcast` shell would kill the entire shell session. Instead
          // we resolve with `null` so the caller can unwind the calendar
          // flow and return to the shell prompt cleanly.
          stdin.off('data', onData);
          stdin.setRawMode(wasRaw);
          stdin.pause();
          process.stdout.write('\n');
          resolve(null);
          return;
        }
        if (c === '\x7f' || c === '\b') {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (c >= ' ' && c <= '~') {
          buf += c;
          process.stdout.write('·');
        }
      }
    }
    stdin.on('data', onData);
  });
}

// ─── connect ────────────────────────────────────────────────────────────

export async function calendarConnect(): Promise<void> {
  header();
  console.log(`  ${chalk.bold('Apple Calendar — connect')}`);
  console.log('');
  console.log(`  ${chalk.dim('Steps to generate an app-specific password:')}`);
  console.log(`  ${chalk.dim('1. Visit')} ${chalk.bold('account.apple.com')}`);
  console.log(`  ${chalk.dim('2. Sign in → Sign-In and Security → App-Specific Passwords')}`);
  console.log(`  ${chalk.dim('3. Generate one labelled')} ${chalk.bold('Moodcast')}`);
  console.log(`  ${chalk.dim('4. Copy the 16-character password and paste below')}`);
  console.log('');

  const appleId = await promptLine('  Apple ID email: ');
  if (!appleId) {
    error('Apple ID required.');
    console.log('');
    return;
  }
  const password = await promptHidden('  App-specific password: ');
  if (password === null) {
    // User pressed Ctrl+C inside the masked prompt. Bail out of the
    // calendar-connect flow without crashing the shell.
    console.log(`  ${chalk.dim('cancelled')}`);
    console.log('');
    return;
  }
  if (!password) {
    error('Password required.');
    console.log('');
    return;
  }

  console.log('');
  console.log(`  ${chalk.dim('connecting…')}`);

  const result = await verifyAndDiscover(appleId, password);
  if (!result.ok) {
    error(`Connect failed: ${result.error}`);
    recovery([
      'verify the app-specific password is correct (16 characters, dashes are part of it)',
      'ensure your Apple ID email is exact',
      'check internet connection',
    ]);
    return;
  }
  success(`Connected. ${result.calendars.length} event calendar(s) discovered.`);
  for (const cal of result.calendars) {
    console.log(`  ${chalk.dim('·')} ${cal.displayName}`);
  }

  // Auto-enable calendar context. Without this, buildMomentContext() would
  // still skip calendar (the gate is `prefs.calendarEnabled`).
  try {
    const prefs = readPreferences();
    if (!prefs.calendarEnabled) {
      writePreferences({ calendarEnabled: true });
      console.log(`  ${chalk.dim('preference enabled:')} ${chalk.bold('calendarEnabled = true')}`);
    }
  } catch {
    /* prefs write is non-fatal; calendar will still work if user enables manually */
  }
  console.log('');

  // Quick smoke test: fetch + summarize today's events.
  console.log(`  ${chalk.dim('reading today…')}`);
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  end.setHours(end.getHours() + 12);
  const events = await fetchEventsRaw(start, end);
  const sum = summarize(events);
  panel('Today', [
    panelLine('intensity', sum.dayIntensity),
    panelLine('events', String(sum.eventCount)),
    panelLine(
      'next event',
      sum.nextEventInMinutes !== undefined
        ? `${sum.nextEventInMinutes}m (${sum.nextEventTypeHint ?? 'unknown'})`
        : '—'
    ),
    panelLine('suggested length', sum.suggestedSessionLength ?? '—'),
  ]);
  console.log('');
}

// ─── disconnect ─────────────────────────────────────────────────────────

export async function calendarDisconnect(): Promise<void> {
  header();
  const status = readAppleStatus();
  if (!status.connected) {
    console.log(`  ${chalk.dim('Apple Calendar:')} ${chalk.yellow('not connected — nothing to remove')}`);
    console.log('');
    return;
  }
  const removed = clearAppleCredentials();
  if (removed) {
    success(`Apple Calendar disconnected. Credentials removed from ~/.moodcast/apple-calendar.json`);
  } else {
    error('Disconnect attempted but the credential file could not be removed.');
  }
  // Disable calendar context so MomentContext stops trying to fetch.
  try {
    const prefs = readPreferences();
    if (prefs.calendarEnabled) {
      writePreferences({ calendarEnabled: false });
      console.log(`  ${chalk.dim('preference disabled:')} ${chalk.bold('calendarEnabled = false')}`);
    }
  } catch {
    /* non-fatal */
  }
  console.log('');
}

// ─── status ─────────────────────────────────────────────────────────────

export async function calendarStatus(): Promise<void> {
  header();
  const status = readAppleStatus();
  if (!status.connected) {
    console.log(`  ${chalk.dim('Apple Calendar:')} ${chalk.red('not connected')}`);
    console.log('');
    const verb = isShellMode() ? 'calendar connect' : 'npm run moodcast --silent -- calendar connect';
    console.log(
      `  ${chalk.dim('Run')} ${chalk.bold(verb)} ${chalk.dim('to set up.')}`
    );
    console.log('');
    return;
  }
  const prefs = readPreferences();
  const enabled = prefs.calendarEnabled;
  panel('Apple Calendar', [
    panelLine('account', status.appleId ?? '—'),
    panelLine('connected', new Date(status.connectedAt!).toLocaleString()),
    panelLine(
      'last verified',
      status.lastVerifiedAt ? new Date(status.lastVerifiedAt).toLocaleString() : '—'
    ),
    panelLine(
      'context',
      enabled ? 'enabled (used by moodcast start)' : 'disabled in preferences',
      enabled ? 'on' : 'warn'
    ),
  ]);
  if (!enabled) {
    console.log('');
    console.log(
      `  ${chalk.dim('To enable: edit ~/.moodcast/preferences.json and set ')}${chalk.bold('"calendarEnabled": true')}`
    );
  }
  console.log('');
}
