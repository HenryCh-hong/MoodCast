// Interactive track-queue picker for the active Moodcast session.
//
// Used by:
//   - the dashboard's `t` key
//   - the shell `tracks` command
//   - `moodcast tracks` (one-shot)
//
// UX summary:
//   ↑↓        move cursor
//   enter     return { action: 'play', rawIndex } (caller does playback)
//   l/d/u     like / dislike / clear feedback for the cursor row, in place
//   q / esc   return null (cancel)
//
// Visual cues:
//   - "NOW" label on the currently playing raw row (red, matches ON AIR).
//   - "NEXT" label on the next playable raw row after NOW (purple).
//   - Cursor row gets a leading ▸ marker.
//   - Unplayable rows (no Spotify URI) render dim and reject Enter with an
//     inline message rather than calling the caller. Feedback shortcuts
//     still work on unplayable rows — feedback isn't gated on URI presence.
//
// Reuses lib/session/queueMapping for raw ↔ playable translation (same
// source of truth the web TrackQueue + Spotify handoff already use).

import chalk from 'chalk';
import { enterAltScreen, leaveAltScreen, clearAndHome } from './utils/altScreen.js';
import { parseSequence } from './utils/keyboardArrows.js';
import {
  buildSessionQueueMapping,
  rawToPlayableIndex,
} from '../lib/session/queueMapping.js';
import {
  applyFeedbackForTrack,
  getVerdictForTrack,
  type FeedbackAction,
} from './feedback.js';
import type { MoodcastSession } from '../lib/types/moodcast.js';

export type TrackPickerResult =
  | { action: 'play'; rawIndex: number }
  | null;

export interface TrackPickerOpts {
  session: MoodcastSession;
  /** Raw index of the currently-playing row, or null if nothing's playing. */
  currentRawIndex: number | null;
  /** Optional session id stamped onto feedback rows. */
  sessionId?: string;
}

const TITLE_WIDTH = 32;
const ARTIST_WIDTH = 18;
const VISIBLE_ROW_BUDGET = 18; // scrolling window

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

export async function pickTrack(opts: TrackPickerOpts): Promise<TrackPickerResult> {
  const { session, currentRawIndex, sessionId } = opts;
  const tracks = session.tracks;
  const mapping = buildSessionQueueMapping(tracks);

  // Resolve the NEXT row (next playable raw row after the current playable).
  let nextRawIndex: number | null = null;
  if (mapping.playableUris.length > 0) {
    const currentPlayable =
      currentRawIndex !== null ? rawToPlayableIndex(mapping, currentRawIndex) : -1;
    const nextPlayable =
      currentPlayable >= 0 && currentPlayable + 1 < mapping.playableIndexToRaw.length
        ? currentPlayable + 1
        : -1;
    if (nextPlayable >= 0) nextRawIndex = mapping.playableIndexToRaw[nextPlayable];
  }

  let cursor =
    currentRawIndex !== null
      ? Math.max(0, Math.min(currentRawIndex, Math.max(0, tracks.length - 1)))
      : 0;
  let inlineMessage: string | null = null;
  let confirmed: TrackPickerResult | 'cancel' = 'cancel';

  function render(): void {
    clearAndHome();
    const out: string[] = [];
    out.push('');
    out.push(`  ${chalk.bold.hex('#c4b5fd')('▓▒░ MOODCAST ░▒▓')}  ${chalk.dim('Track Queue')}`);
    out.push('');
    out.push(
      `  ${chalk.bold(truncate(session.sessionTitle || '(untitled)', 48))}  ${chalk.dim('·')}  ${chalk.dim(`${tracks.length} track${tracks.length === 1 ? '' : 's'}`)}`,
    );
    out.push('');

    if (tracks.length === 0) {
      out.push(`  ${chalk.dim('this session has no tracks.')}`);
      out.push('');
      out.push(`  ${chalk.dim('press q to go back')}`);
      out.push('');
      process.stdout.write(out.join('\n'));
      return;
    }

    // Scrolling window so very long sessions still fit.
    const half = Math.floor(VISIBLE_ROW_BUDGET / 2);
    let start = Math.max(0, cursor - half);
    const end = Math.min(tracks.length, start + VISIBLE_ROW_BUDGET);
    if (end - start < VISIBLE_ROW_BUDGET) {
      start = Math.max(0, end - VISIBLE_ROW_BUDGET);
    }

    if (start > 0) out.push(`  ${chalk.dim(`… ${start} earlier`)}`);

    const numWidth = String(tracks.length).length;
    for (let i = start; i < end; i += 1) {
      const t = tracks[i];
      const isCursor = i === cursor;
      const isNow = i === currentRawIndex;
      const isNext = i === nextRawIndex;
      const isPlayable = mapping.rawIndexToPlayable[i] !== -1;

      const cursorMark = isCursor
        ? chalk.bold.hex('#c4b5fd')('▸')
        : ' ';

      const labelText = isNow ? 'NOW ' : isNext ? 'NEXT' : '    ';
      const labelChip = isNow
        ? chalk.bold.hex('#ff6b6b')(labelText)
        : isNext
          ? chalk.bold.hex('#c4b5fd')(labelText)
          : chalk.dim(labelText);

      const num = String(i + 1).padStart(numWidth, ' ');
      const titleRaw = truncate(t.title || '(untitled)', TITLE_WIDTH);
      const artistRaw = truncate(t.artist || '', ARTIST_WIDTH);

      const titleStr = isPlayable ? chalk.bold(titleRaw) : chalk.dim(titleRaw);
      const artistStr = isPlayable
        ? chalk.hex('#c4b5fd')(artistRaw)
        : chalk.dim(artistRaw);

      const verdict = getVerdictForTrack(t);
      const feedbackChip =
        verdict === 'like'
          ? `  ${chalk.green('♥ liked')}`
          : verdict === 'dislike'
            ? `  ${chalk.red('✗ disliked')}`
            : '';
      const playabilityChip = isPlayable ? '' : `  ${chalk.dim('(no Spotify URI)')}`;

      // Pad the title and artist to fixed visible widths so feedback chips
      // align in a column.
      const titlePadded = titleStr + ' '.repeat(Math.max(0, TITLE_WIDTH - titleRaw.length));
      const artistPadded =
        artistStr + ' '.repeat(Math.max(0, ARTIST_WIDTH - artistRaw.length));

      out.push(
        `  ${cursorMark} ${labelChip}  ${chalk.dim(num + '.')} ${titlePadded}  ${chalk.dim('—')}  ${artistPadded}${feedbackChip}${playabilityChip}`,
      );
    }

    if (end < tracks.length) {
      out.push(`  ${chalk.dim(`… ${tracks.length - end} more`)}`);
    }

    out.push('');
    if (inlineMessage) {
      out.push(`  ${chalk.yellow('!')} ${inlineMessage}`);
      out.push('');
    }
    out.push(
      `  ${chalk.dim('↑↓ select · enter play · l like · d dislike · u clear · q back')}`,
    );
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

    function applyFeedback(action: FeedbackAction): void {
      if (tracks.length === 0) return;
      const result = applyFeedbackForTrack({
        track: tracks[cursor],
        verdict: action,
        sessionId,
      });
      inlineMessage = result.message;
      render();
    }

    function handler(data: string): void {
      const { key } = parseSequence(data);

      if (tracks.length === 0) {
        if (key === 'esc' || key === 'ctrl-c' || data === 'q' || data === 'Q') {
          confirmed = 'cancel';
          cleanup();
          resolve();
        }
        return;
      }

      // Any keypress clears the previous one-shot inline message.
      const hadMessage = inlineMessage !== null;
      if (hadMessage) inlineMessage = null;

      if (key === 'up') {
        cursor = Math.max(0, cursor - 1);
        render();
        return;
      }
      if (key === 'down') {
        cursor = Math.min(tracks.length - 1, cursor + 1);
        render();
        return;
      }
      if (key === 'enter') {
        if (mapping.rawIndexToPlayable[cursor] === -1) {
          inlineMessage = 'This track is not playable on Spotify.';
          render();
          return;
        }
        confirmed = { action: 'play', rawIndex: cursor };
        cleanup();
        resolve();
        return;
      }
      if (key === 'esc' || key === 'ctrl-c' || data === 'q' || data === 'Q') {
        confirmed = 'cancel';
        cleanup();
        resolve();
        return;
      }
      if (data === 'l' || data === 'L') { applyFeedback('like'); return; }
      if (data === 'd' || data === 'D') { applyFeedback('dislike'); return; }
      if (data === 'u' || data === 'U') { applyFeedback('clear'); return; }

      // Unknown key — re-render once to clear any stale message.
      if (hadMessage) render();
    }
    process.stdin.on('data', handler);
  });

  leaveAltScreen();
  if (confirmed === 'cancel') return null;
  return confirmed;
}
