// Shared CLI helper: play a specific row of a Moodcast session.
//
// Used by:
//   - `moodcast track <n>` (one-shot)
//   - the shell `tracks` picker
//   - the dashboard's `t` key picker
//
// Owns: URI sanitisation, raw → playable index translation, token fetch,
// startSessionPlayback handoff. Prints the canonical "cueing …" line and
// delegates the Playback Target panel + recovery to startSessionPlayback,
// so all three surfaces look the same on success and on failure.

import chalk from 'chalk';
import { getValidToken } from '../auth.js';
import { startSessionPlayback } from './playback.js';
import {
  sanitizeSpotifyTrackUris,
  isValidSpotifyTrackUri,
} from '../../lib/spotify/uris.js';
import { error, recovery } from '../display.js';
import { authRecoveryHint } from './shellContext.js';
import type { MoodcastSession, Track } from '../../lib/types/moodcast.js';

export interface PlayTrackResult {
  ok: boolean;
  track?: Track;
  /** Playable index (into the sanitized URI list) — set when ok or after URI map. */
  playableIndex?: number;
  /** True when the row exists but has no Spotify URI. */
  unplayable?: boolean;
}

export interface PlaySessionTrackInput {
  session: MoodcastSession;
  /** 0-indexed row in `session.tracks`. */
  rawIndex: number;
  /** Used by recovery hints. Defaults to `track <n>`. */
  retryHint?: string;
}

export async function playSessionTrackAt(
  opts: PlaySessionTrackInput,
): Promise<PlayTrackResult> {
  const { session, rawIndex } = opts;
  const tracks = session.tracks;

  if (rawIndex < 0 || rawIndex >= tracks.length) {
    error(
      `Track ${rawIndex + 1} is out of range — this session has ${tracks.length} track${tracks.length === 1 ? '' : 's'}.`,
    );
    return { ok: false };
  }

  const target = tracks[rawIndex];
  const allRowUris = tracks.map((t) => t.uri ?? '');
  if (!isValidSpotifyTrackUri(allRowUris[rawIndex])) {
    error('This track is not playable on Spotify.');
    return { ok: false, track: target, unplayable: true };
  }

  // Translate raw → playable index using the same rule the canonical mapping
  // uses (every preceding row with a valid URI bumps the playable index).
  let playableIndex = 0;
  for (let i = 0; i < rawIndex; i += 1) {
    if (isValidSpotifyTrackUri(allRowUris[i])) playableIndex += 1;
  }
  const playable = sanitizeSpotifyTrackUris(allRowUris);

  const token = await getValidToken();
  if (!token) {
    error('Not authenticated.');
    recovery([authRecoveryHint()]);
    return { ok: false, track: target };
  }

  console.log(
    `  ${chalk.dim('cueing')}  ${chalk.bold(target.title)} ${chalk.dim('—')} ${chalk.hex('#c4b5fd')(target.artist)}  ${chalk.dim(`(track ${rawIndex + 1}/${tracks.length})`)}`,
  );

  const result = await startSessionPlayback(token, playable, {
    retryHint: opts.retryHint ?? `track ${rawIndex + 1}`,
    startIndex: playableIndex,
  });
  if (!result.ok) return { ok: false, track: target, playableIndex };
  return { ok: true, track: target, playableIndex };
}
