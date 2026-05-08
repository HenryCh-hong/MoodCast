// Canonical session queue mapping.
//
// A Moodcast session has *visible* rows (what the user sees in TrackQueue)
// and *playable* URIs (what Spotify can actually play). When a row has no
// Spotify URI (`uri === ''`) or has a malformed URI, it shows in the UI but
// the playback queue silently skips it. Without a shared mapping, UI and
// playback drift apart:
//
//   - TrackQueue could label visible row 1 as "NEXT" while Spotify (playing
//     from the sanitized queue) is about to play visible row 2's URI.
//   - The companion's "track N of M" display calls findIndex on raw URIs,
//     which returns the first occurrence on duplicates and lights up the
//     wrong row.
//
// `buildSessionQueueMapping` is the single source of truth used by:
//   - TrackQueue (NOW + NEXT labels)
//   - FloatingDJCompanion (track index display)
//   - MoodcastContext (reconciling Spotify's currentUri → sessionIndex)
//   - The session page (Start Playback / row click → API request)
//   - Tests (tests/queueMapping.test.ts)
//
// `sessionIndex` everywhere else in the app is in PLAYABLE terms — the same
// indexing the server uses when calling Spotify with `offset.position`.

import { isValidSpotifyTrackUri } from '@/lib/spotify/uris';
import type { Track } from '@/lib/types/moodcast';

export interface SessionQueueMapping {
  /** The original session.tracks array, in display order. */
  rawTracks: Track[];
  /** Sanitized URIs in display order — same content the server gets. */
  playableUris: string[];
  /**
   * For each raw row, the index in `playableUris`, or -1 if unplayable.
   * `rawIndexToPlayable.length === rawTracks.length`.
   */
  rawIndexToPlayable: number[];
  /**
   * For each playable index, the row index in `rawTracks`.
   * `playableIndexToRaw.length === playableUris.length`.
   */
  playableIndexToRaw: number[];
}

export function buildSessionQueueMapping(
  tracks: ReadonlyArray<Track>,
): SessionQueueMapping {
  const playableUris: string[] = [];
  const rawIndexToPlayable: number[] = [];
  const playableIndexToRaw: number[] = [];

  for (let i = 0; i < tracks.length; i += 1) {
    const uri = tracks[i].uri ?? '';
    if (isValidSpotifyTrackUri(uri)) {
      rawIndexToPlayable.push(playableUris.length);
      playableIndexToRaw.push(i);
      playableUris.push(uri);
    } else {
      rawIndexToPlayable.push(-1);
    }
  }

  return {
    rawTracks: [...tracks],
    playableUris,
    rawIndexToPlayable,
    playableIndexToRaw,
  };
}

/**
 * Resolve a Spotify-reported `current_track.uri` to a playable index,
 * preferring matches at or after `hint` so duplicate URIs in a session
 * don't snap us backward.
 *
 * Returns -1 when the URI doesn't appear in the playable list at all
 * (caller should treat this as "external playback" and not infer a
 * Moodcast index from it).
 */
export function findPlayableIndex(
  mapping: SessionQueueMapping,
  currentUri: string,
  hint: number,
): number {
  if (!currentUri) return -1;
  const start = Math.max(0, Math.min(hint, mapping.playableUris.length - 1));
  for (let i = start; i < mapping.playableUris.length; i += 1) {
    if (mapping.playableUris[i] === currentUri) return i;
  }
  for (let i = start - 1; i >= 0; i -= 1) {
    if (mapping.playableUris[i] === currentUri) return i;
  }
  return -1;
}

/**
 * Translate a raw row index into a playable index. Returns -1 if the row
 * has no Spotify URI; callers should not start playback from it.
 */
export function rawToPlayableIndex(
  mapping: SessionQueueMapping,
  rawIndex: number,
): number {
  if (rawIndex < 0 || rawIndex >= mapping.rawIndexToPlayable.length) return -1;
  return mapping.rawIndexToPlayable[rawIndex];
}

/**
 * Translate a playable index back to a raw row index, or null if out of
 * range. Used for UI rendering (NOW/NEXT labels, "track N of M").
 */
export function playableToRawIndex(
  mapping: SessionQueueMapping,
  playableIndex: number,
): number | null {
  if (playableIndex < 0 || playableIndex >= mapping.playableIndexToRaw.length) {
    return null;
  }
  return mapping.playableIndexToRaw[playableIndex];
}
