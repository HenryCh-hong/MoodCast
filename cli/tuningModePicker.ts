// Phase 4 — Auto Tune vs Manual Tune picker.
//
// Two-option chooser shown by `moodcast start` when prefs.tuningMode === 'ask'
// and neither --auto nor --manual was passed. Returns 'auto' | 'manual', or
// null on Esc / Ctrl+C.

import chalk from 'chalk';
import { enterAltScreen, leaveAltScreen, clearAndHome } from './utils/altScreen.js';
import { parseSequence } from './utils/keyboardArrows.js';

export type TuningChoice = 'auto' | 'manual';

interface Option {
  id: TuningChoice;
  title: string;
  body: string[];
}

const OPTIONS: Option[] = [
  {
    id: 'auto',
    title: 'Auto Tune',
    body: [
      'MooC reads the room and tunes the signal for you.',
      'calendar · weather · time · taste · recent sessions',
    ],
  },
  {
    id: 'manual',
    title: 'Manual Tune',
    body: [
      'Choose your own tags — mood, activity, texture, signal, familiarity.',
      'overrides auto suggestions',
    ],
  },
];

export async function pickTuningMode(): Promise<TuningChoice | null> {
  let cursor = 0;
  let confirmed: TuningChoice | 'cancel' | null = null;

  function render(): void {
    clearAndHome();
    const out: string[] = [];
    out.push('');
    out.push(`  ${chalk.bold.hex('#c4b5fd')('▓▒░ MOODCAST ░▒▓')}  ${chalk.dim('How do you want to tune this?')}`);
    out.push('');
    OPTIONS.forEach((opt, i) => {
      const isCur = i === cursor;
      const head = isCur
        ? chalk.bgHex('#2a1f3d').bold.hex('#c4b5fd')(`  ◉ ${opt.title}  `)
        : chalk.dim(`  ○ ${opt.title}  `);
      out.push(`  ${head}`);
      for (const line of opt.body) {
        out.push(`     ${chalk.dim(line)}`);
      }
      out.push('');
    });
    out.push(`  ${chalk.dim('↑↓ select · enter confirm · esc cancel')}`);
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
      const { key } = parseSequence(data);
      if (key === 'enter') {
        confirmed = OPTIONS[cursor].id;
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
      if (key === 'up') cursor = Math.max(0, cursor - 1);
      if (key === 'down') cursor = Math.min(OPTIONS.length - 1, cursor + 1);
      render();
    }
    process.stdin.on('data', handler);
  });

  leaveAltScreen();
  if (confirmed === 'cancel' || confirmed === null) return null;
  return confirmed;
}
