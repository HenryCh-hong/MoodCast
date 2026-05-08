// Phase 3 — Interactive tag picker.
//
// Renders five rows (mood / activity / texture / signal / familiarity) with
// arrow-key navigation and space-to-toggle. Pre-fills from the suggested set.
// Returns the user's SelectedTagSet on Enter, or null on Esc / Ctrl+C.

import chalk from 'chalk';
import { TAG_GROUPS } from '../lib/types/tags.js';
import type { SelectedTagSet, SuggestedTagSet, TagGroup } from '../lib/types/tags.js';
import { enterAltScreen, leaveAltScreen, clearAndHome } from './utils/altScreen.js';
import { parseSequence } from './utils/keyboardArrows.js';

const GROUP_ORDER: TagGroup[] = [
  'mood',
  'activity',
  'texture',
  'signal',
  'familiarity',
];

const GROUP_LABEL: Record<TagGroup, string> = {
  mood: 'mood',
  activity: 'activity',
  texture: 'texture',
  signal: 'signal',
  familiarity: 'discover',
};

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const visibleLength = (s: string) => s.replace(ANSI_RE, '').length;

export async function pickTags(
  suggested: SuggestedTagSet
): Promise<SelectedTagSet | null> {
  // Selection state, pre-filled from suggestions.
  const selected: Record<TagGroup, Set<string>> = {
    mood: new Set(suggested.mood),
    activity: new Set(suggested.activity),
    texture: new Set(suggested.texture),
    signal: new Set(suggested.signal),
    familiarity: new Set([suggested.familiarity || 'balanced']),
  };

  let cursorRow = 0;
  let cursorCol = 0;

  enterAltScreen();
  let confirmed: 'ok' | 'cancel' | null = null;

  function render(): void {
    clearAndHome();
    const out: string[] = [];
    out.push('');
    out.push(`  ${chalk.bold.hex('#c4b5fd')('▓▒░ MOODCAST ░▒▓')}  ${chalk.dim('Tune the Signal')}`);
    out.push('');

    GROUP_ORDER.forEach((group, gi) => {
      const tags = TAG_GROUPS[group];
      const isMulti = group !== 'familiarity';
      const selSet = selected[group];

      const row = tags
        .map((tag, ti) => {
          const isSel = selSet.has(tag.id);
          const isCur = gi === cursorRow && ti === cursorCol;
          const checkbox = isSel ? chalk.bold.hex('#c4b5fd')('✓') : chalk.dim('·');
          const label = isSel ? chalk.bold(tag.label) : chalk.dim(tag.label);
          const pill = `${checkbox} ${label}`;
          if (isCur) {
            return chalk.bgHex('#2a1f3d')(`[ ${pill} ]`);
          }
          return `[ ${pill} ]`;
        })
        .join('  ');

      const head = chalk.dim(GROUP_LABEL[group].padEnd(10));
      const single = isMulti ? '' : chalk.dim('  (single)');
      out.push(`  ${head}${row}${single}`);
      out.push('');
    });

    out.push('');
    out.push(
      `  ${chalk.dim('↑↓ row · ←→ tag · space toggle · enter confirm · esc cancel')}`
    );
    out.push('');
    process.stdout.write(out.join('\n'));
  }

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
        confirmed = 'ok';
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
      if (key === 'up') cursorRow = Math.max(0, cursorRow - 1);
      if (key === 'down') cursorRow = Math.min(GROUP_ORDER.length - 1, cursorRow + 1);
      if (key === 'left') cursorCol = Math.max(0, cursorCol - 1);
      if (key === 'right') {
        const max = TAG_GROUPS[GROUP_ORDER[cursorRow]].length;
        cursorCol = Math.min(max - 1, cursorCol + 1);
      }
      // Bound cursorCol on row change
      cursorCol = Math.min(
        cursorCol,
        TAG_GROUPS[GROUP_ORDER[cursorRow]].length - 1
      );

      if (key === 'space') {
        const g = GROUP_ORDER[cursorRow];
        const tagId = TAG_GROUPS[g][cursorCol].id;
        if (g === 'familiarity') {
          // Single-select
          selected[g].clear();
          selected[g].add(tagId);
        } else if (selected[g].has(tagId)) {
          selected[g].delete(tagId);
        } else {
          selected[g].add(tagId);
        }
      }
      render();
    }
    process.stdin.on('data', handler);
  });

  leaveAltScreen();

  if (confirmed === 'cancel') return null;

  return {
    mood: Array.from(selected.mood),
    activity: Array.from(selected.activity),
    texture: Array.from(selected.texture),
    signal: Array.from(selected.signal),
    familiarity: Array.from(selected.familiarity)[0] ?? 'balanced',
  };
}
