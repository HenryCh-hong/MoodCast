// `moodcast track <n>` — play the Nth track of the currently active session.
// 1-indexed for users (so `track 1` = the first track).
//
// Reads the active session from ~/.moodcast/active-session.json so this
// works whether the session was generated in the web app or the terminal.
// No AI call, no regeneration — just playback handoff to the existing
// session's URI list with an explicit start index.

import chalk from 'chalk';
import { getValidToken } from '../auth.js';
import { readActiveSession } from '../../lib/sessions/activeSession.js';
import { startSessionPlayback } from '../utils/playback.js';
import { header, error, success, recovery } from '../display.js';
import { authRecoveryHint } from '../utils/shellContext.js';
import { sanitizeSpotifyTrackUris, isValidSpotifyTrackUri } from '../../lib/spotify/uris.js';

export async function trackCommand(numberRaw: string | number | undefined): Promise<void> {
  header();

  const n = typeof numberRaw === 'string' ? parseInt(numberRaw, 10) : numberRaw;
  if (!Number.isFinite(n) || (n as number) < 1) {
    error('Usage: track <n>  (1-indexed; e.g. `track 1` plays the first track)');
    return;
  }

  const active = readActiveSession();
  if (!active) {
    error('No active session.');
    recovery([
      'generate one first — try `start --auto` or pick from `sessions`',
    ]);
    return;
  }
  const tracks = active.session.tracks;
  if (!tracks || tracks.length === 0) {
    error('Active session has no tracks.');
    return;
  }

  const rowIndex = (n as number) - 1;
  if (rowIndex >= tracks.length) {
    error(`Track ${n} is out of range — this session has ${tracks.length} track${tracks.length === 1 ? '' : 's'}.`);
    return;
  }

  const target = tracks[rowIndex];
  const allRowUris = tracks.map((t) => t.uri ?? '');
  if (!isValidSpotifyTrackUri(allRowUris[rowIndex])) {
    error(`Track ${n} (${target.title} — ${target.artist}) has no Spotify URI yet.`);
    recovery(['try a neighbouring track, or regenerate the session with Spotify connected']);
    return;
  }

  // Translate row index → playable index, since startSessionPlayback only
  // sees the sanitized list.
  let playableIndex = 0;
  for (let i = 0; i < rowIndex; i += 1) {
    if (isValidSpotifyTrackUri(allRowUris[i])) playableIndex += 1;
  }
  const playable = sanitizeSpotifyTrackUris(allRowUris);

  const token = await getValidToken();
  if (!token) {
    error('Not authenticated.');
    recovery([authRecoveryHint()]);
    return;
  }

  console.log(`  ${chalk.dim('cueing')}  ${chalk.bold(target.title)} ${chalk.dim('—')} ${chalk.hex('#c4b5fd')(target.artist)}  ${chalk.dim(`(track ${n}/${tracks.length})`)}`);

  const result = await startSessionPlayback(token, playable, {
    retryHint: `track ${n}`,
    startIndex: playableIndex,
  });
  if (!result.ok) return;

  success(`Playing track ${n}: ${target.title}`);
  console.log('');
}
