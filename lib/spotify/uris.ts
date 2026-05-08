// Strict Spotify track URI validation + sanitization.
//
// Used everywhere we hand a uri list to Spotify (PUT /me/player/play,
// playlist add-tracks, playback control routes, CLI playback). Empty
// strings, nulls, malformed ids, and non-track URIs (playlist/album/etc.)
// must be filtered BEFORE we make the network call — Spotify rejects the
// whole request with `Invalid track uri: ""` otherwise, which is the bug
// users see as "Start Playback errored, but session A is still playing".
//
// Track ids are 22-character base62 in practice. The regex is permissive
// on length (`+`) to match the existing `resolveTracks.ts` pattern, but
// the prefix and character class are strict.

const TRACK_URI_RE = /^spotify:track:[A-Za-z0-9]+$/;

export function isValidSpotifyTrackUri(uri: unknown): uri is string {
  return typeof uri === 'string' && TRACK_URI_RE.test(uri.trim()) && uri === uri.trim();
}

/**
 * Filter an arbitrary input to the subset of valid `spotify:track:…` URIs.
 * Tolerates `null`, `undefined`, non-array input, and entries that aren't
 * strings — never throws.
 *
 * Returns an array of strings that are safe to pass to Spotify.
 */
export function sanitizeSpotifyTrackUris(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (isValidSpotifyTrackUri(v)) out.push(v);
  }
  return out;
}

/**
 * Diagnostic counterpart — returns how many entries were dropped, useful
 * for `[playback] dropped invalid uris count=N` log lines without leaking
 * the raw values themselves (which could include track ids the user did
 * not intend to share).
 */
export function countDroppedUris(input: unknown): number {
  if (!Array.isArray(input)) return 0;
  let dropped = 0;
  for (const v of input) {
    if (!isValidSpotifyTrackUri(v)) dropped += 1;
  }
  return dropped;
}
