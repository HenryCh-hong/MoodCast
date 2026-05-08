// Best-effort URI resolution for tracks the AI returned with empty URIs.
// Used by app/api/generate-session and cli/commands/start. Never fabricates a
// URI: an unresolvable track stays empty (and will be filtered out at playback).

import { spotifySearch } from './client';
import type { MoodcastSession, Track } from '@/lib/types/moodcast';

const SPOTIFY_TRACK_URI_RE = /^spotify:track:[A-Za-z0-9]+$/;

function isResolved(t: Track): boolean {
  return typeof t.uri === 'string' && SPOTIFY_TRACK_URI_RE.test(t.uri);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function resolveOne(track: Track, token: string): Promise<Track> {
  if (isResolved(track)) return track;
  if (!track.title || !track.artist) return track;
  const q = `track:${track.title} artist:${track.artist}`;
  let results: Awaited<ReturnType<typeof spotifySearch>>;
  try {
    results = await spotifySearch(q, token);
  } catch {
    return track;
  }
  const wantArtist = normalize(track.artist);
  const wantTitle = normalize(track.title);
  // Prefer a match where artists contains the requested artist substring AND
  // the titles share a normalised prefix. This rules out covers / wrong albums.
  const match =
    results.find(
      (r) =>
        normalize(r.artists).includes(wantArtist) &&
        normalize(r.name).startsWith(wantTitle.slice(0, Math.min(wantTitle.length, 18))),
    ) ?? results.find((r) => normalize(r.artists).includes(wantArtist));
  if (!match) return track;
  const id = match.uri.replace(/^spotify:track:/, '');
  return { ...track, uri: match.uri, id };
}

export interface ResolveResult {
  session: MoodcastSession;
  resolved: number;     // tracks newly given a real URI
  unresolved: number;   // tracks the AI left empty AND search couldn't find
}

/**
 * Walks the session tracks and fills missing URIs in parallel via Spotify search.
 * Order is preserved. Tracks that remain unresolvable keep their empty URI; the
 * caller may choose to drop them before sending to /me/player/play.
 */
export async function resolveSessionTracks(
  session: MoodcastSession,
  token: string,
): Promise<ResolveResult> {
  const needs = session.tracks.filter((t) => !isResolved(t)).length;
  if (needs === 0) {
    return { session, resolved: 0, unresolved: 0 };
  }
  const next = await Promise.all(session.tracks.map((t) => resolveOne(t, token)));
  let resolved = 0;
  let unresolved = 0;
  for (let i = 0; i < session.tracks.length; i += 1) {
    const before = session.tracks[i];
    const after = next[i];
    if (!isResolved(before) && isResolved(after)) resolved += 1;
    if (!isResolved(after)) unresolved += 1;
  }
  return { session: { ...session, tracks: next }, resolved, unresolved };
}
