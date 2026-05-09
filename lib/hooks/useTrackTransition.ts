'use client';

import { useEffect, useRef } from 'react';
import { useMoodcast } from '@/lib/context/MoodcastContext';
import type { MoodcastSession } from '@/lib/types/moodcast';

const CUE_DURATION_MS = 10_000;

function resolveTransitionLine(
  trackUri: string,
  trackName: string,
  artistName: string,
  session: MoodcastSession,
): string {
  // Primary: URI match (both non-empty)
  let match = session.tracks.find(
    (t) => t.uri && trackUri && t.uri === trackUri
  );
  // Fallback: case-insensitive title + first artist
  if (!match) {
    const normName = trackName.toLowerCase();
    const normArtist = artistName.toLowerCase();
    match = session.tracks.find(
      (t) =>
        t.title.toLowerCase() === normName &&
        t.artist.toLowerCase() === normArtist
    );
  }
  // No match or empty transitionLine — silence (no filler text)
  return match?.transitionLine ?? '';
}

export function useTrackTransition(): void {
  const { currentSession, playerState, setDjCue } = useMoodcast();
  const lastUriRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear state when session identity changes
  useEffect(() => {
    lastUriRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    setDjCue(null);
  }, [currentSession?.sessionTitle, setDjCue]);

  // Watch for track URI changes
  useEffect(() => {
    const track = playerState?.track_window?.current_track;
    if (!track || !currentSession) return;

    const uri = track.uri ?? '';
    if (!uri || uri === lastUriRef.current) return;
    lastUriRef.current = uri;

    const cueText = resolveTransitionLine(
      uri,
      track.name,
      track.artists?.[0]?.name ?? '',
      currentSession,
    );
    if (!cueText) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setDjCue(cueText);
    timerRef.current = setTimeout(() => setDjCue(null), CUE_DURATION_MS);
    // Depending on the deeply-nested .uri (a string) is intentional: the SDK
    // re-creates the track object on every state tick, so depending on the
    // object would re-run this effect on every progress update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState?.track_window?.current_track?.uri, currentSession, setDjCue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
