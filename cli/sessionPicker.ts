// Interactive session picker.
//
// Used by the shell when the user types `sessions` or `sessions play` with no
// id. Lists entries from the shared library (newest first), lets the user
// move with ↑↓, and returns one of:
//   { action: 'play',   id }   on Enter
//   { action: 'show',   id }   on `s`
//   { action: 'delete', id }   on `d` (caller is responsible for confirmation)
// or null on `q` / Esc / Ctrl+C.

import chalk from 'chalk';
import { listSessions, type SessionIndexEntry } from '../lib/sessions/sessionLibrary.js';
import { enterAltScreen, leaveAltScreen, clearAndHome } from './utils/altScreen.js';
import { parseSequence } from './utils/keyboardArrows.js';

export type SessionPickerAction = 'play' | 'show' | 'delete';

export interface SessionPickerResult {
  action: SessionPickerAction;
  entry: SessionIndexEntry;
}

function relativeAge(ts: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - ts);
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 36) return `${hr}h`;
  const days = Math.round(hr / 24);
  if (days < 14) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks}w`;
  return new Date(ts).toISOString().slice(0, 10);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

export async function pickSession(opts: { limit?: number } = {}): Promise<SessionPickerResult | null> {
  const entries = listSessions({ limit: opts.limit ?? 20 });
  let cursor = 0;
  let confirmed: SessionPickerResult | 'cancel' | null = null;

  function render(): void {
    clearAndHome();
    const out: string[] = [];
    out.push('');
    out.push(`  ${chalk.bold.hex('#c4b5fd')('▓▒░ MOODCAST ░▒▓')}  ${chalk.dim('Sessions')}`);
    out.push('');

    if (entries.length === 0) {
      out.push(`  ${chalk.dim('no saved sessions yet.')}`);
      out.push('');
      out.push(`  ${chalk.dim('press q to go back')}`);
      out.push('');
      process.stdout.write(out.join('\n'));
      return;
    }

    entries.forEach((e, i) => {
      const isCur = i === cursor;
      const titleRaw = e.title || '(untitled)';
      const title = truncate(titleRaw, 36);
      const src = e.source === 'cli' ? 'terminal' : 'web    ';
      const tracks = `${String(e.trackCount).padStart(2, ' ')} tracks`;
      const age = relativeAge(e.createdAt);
      const head = isCur
        ? chalk.bgHex('#2a1f3d').bold.hex('#c4b5fd')(`  ▸ ${title.padEnd(36)} `)
        : `  ${chalk.dim('·')} ${chalk.bold(title.padEnd(36))} `;
      const meta = chalk.dim(`${src}  ${tracks}  ${age}`);
      out.push(`${head}${meta}`);
    });

    const sel = entries[cursor];
    out.push('');
    out.push(`  ${chalk.dim('id')}  ${chalk.dim(sel.id)}`);
    out.push('');
    out.push(`  ${chalk.dim('↑↓ select · enter play · s show · d delete · q back')}`);
    out.push('');
    process.stdout.write(out.join('\n'));
  }

  enterAltScreen();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  render();

  await new Promise<void>((resolve) => {
    function cleanup(): void {
      process.stdin.off('data', handler);
      try {
        process.stdin.setRawMode(false);
      } catch {
        /* ignore */
      }
      process.stdin.pause();
    }
    function handler(data: string): void {
      if (entries.length === 0) {
        // Only q / esc / ctrl-c are meaningful in the empty state.
        const { key } = parseSequence(data);
        if (key === 'esc' || key === 'ctrl-c' || data === 'q' || data === 'Q') {
          confirmed = 'cancel';
          cleanup();
          resolve();
        }
        return;
      }
      const { key } = parseSequence(data);
      if (key === 'enter') {
        confirmed = { action: 'play', entry: entries[cursor] };
        cleanup();
        resolve();
        return;
      }
      if (key === 'esc' || key === 'ctrl-c') {
        confirmed = 'cancel';
        cleanup();
        resolve();
        return;
      }
      if (key === 'up') {
        cursor = Math.max(0, cursor - 1);
        render();
        return;
      }
      if (key === 'down') {
        cursor = Math.min(entries.length - 1, cursor + 1);
        render();
        return;
      }
      if (data === 'q' || data === 'Q') {
        confirmed = 'cancel';
        cleanup();
        resolve();
        return;
      }
      if (data === 's' || data === 'S') {
        confirmed = { action: 'show', entry: entries[cursor] };
        cleanup();
        resolve();
        return;
      }
      if (data === 'd' || data === 'D') {
        confirmed = { action: 'delete', entry: entries[cursor] };
        cleanup();
        resolve();
        return;
      }
    }
    process.stdin.on('data', handler);
  });

  leaveAltScreen();
  if (confirmed === 'cancel' || confirmed === null) return null;
  return confirmed;
}
