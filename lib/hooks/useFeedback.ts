'use client';

// Browser-side feedback state. Hits /api/feedback so the file at
// <MOODCAST_HOME>/feedback.json stays the single source of truth between
// CLI and web. We keep an in-memory verdict map keyed by trackUri (or
// title|artist for non-Spotify rows) so the UI renders without waiting on
// each round-trip.
//
// Two lookup keys live in the verdict map:
//   1. The Spotify URI (when present and well-formed).
//   2. "title|artist" lowercase — fallback for tracks the AI hasn't
//      resolved a URI for yet, and also the row the server actually stores
//      under in that case.

import { useCallback, useEffect, useState } from 'react';
import type { Track } from '@/lib/types/moodcast';
import type { FeedbackRecord, FeedbackVerdict } from '@/lib/feedback/feedbackStore';

function fallbackKey(title: string, artist: string): string {
  return `${(title || '').toLowerCase().trim()}|${(artist || '').toLowerCase().trim()}`;
}

function trackKeys(track: Pick<Track, 'uri' | 'title' | 'artist'>): string[] {
  const out: string[] = [];
  if (track.uri && track.uri.startsWith('spotify:track:')) out.push(track.uri);
  out.push(fallbackKey(track.title, track.artist));
  return out;
}

function indexRecords(records: FeedbackRecord[]): Map<string, FeedbackVerdict> {
  const out = new Map<string, FeedbackVerdict>();
  for (const r of records) {
    const k = r.trackUri && r.trackUri.startsWith('spotify:track:')
      ? r.trackUri
      : fallbackKey(r.title, r.artist);
    out.set(k, r.feedback);
  }
  return out;
}

export interface UseFeedback {
  loaded: boolean;
  /** Verdict for a given track, if any. */
  verdictFor: (track: Pick<Track, 'uri' | 'title' | 'artist'>) => FeedbackVerdict | null;
  /** Toggle a verdict. Calling with the same verdict clears it (undo). */
  toggle: (
    track: Pick<Track, 'uri' | 'title' | 'artist' | 'sourceIntent' | 'familiarityLevel'>,
    verdict: FeedbackVerdict,
    sessionId?: string,
  ) => Promise<void>;
}

export function useFeedback(): UseFeedback {
  const [verdicts, setVerdicts] = useState<Map<string, FeedbackVerdict>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // Initial load — best effort. Failure is silent so playback never blocks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/feedback', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { records?: FeedbackRecord[] };
        if (cancelled) return;
        if (Array.isArray(data.records)) {
          setVerdicts(indexRecords(data.records));
        }
      } catch {
        /* offline — keep empty map */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const verdictFor = useCallback(
    (track: Pick<Track, 'uri' | 'title' | 'artist'>): FeedbackVerdict | null => {
      for (const k of trackKeys(track)) {
        const v = verdicts.get(k);
        if (v) return v;
      }
      return null;
    },
    [verdicts],
  );

  const toggle = useCallback(
    async (
      track: Pick<Track, 'uri' | 'title' | 'artist' | 'sourceIntent' | 'familiarityLevel'>,
      verdict: FeedbackVerdict,
      sessionId?: string,
    ) => {
      const current = (() => {
        for (const k of trackKeys(track)) {
          const v = verdicts.get(k);
          if (v) return v;
        }
        return null;
      })();

      // Same verdict → undo.
      if (current === verdict) {
        const optimistic = new Map(verdicts);
        for (const k of trackKeys(track)) optimistic.delete(k);
        setVerdicts(optimistic);
        try {
          await fetch('/api/feedback', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackUri: track.uri && track.uri.startsWith('spotify:track:') ? track.uri : undefined,
              title: track.title,
              artist: track.artist,
            }),
          });
        } catch { /* stay optimistic */ }
        return;
      }

      const optimistic = new Map(verdicts);
      // Remove any prior verdict under either key, then set under the
      // canonical key the server will use.
      for (const k of trackKeys(track)) optimistic.delete(k);
      const canonical =
        track.uri && track.uri.startsWith('spotify:track:')
          ? track.uri
          : fallbackKey(track.title, track.artist);
      optimistic.set(canonical, verdict);
      setVerdicts(optimistic);

      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackUri: track.uri && track.uri.startsWith('spotify:track:') ? track.uri : undefined,
            title: track.title,
            artist: track.artist,
            feedback: verdict,
            sourceIntent: track.sourceIntent,
            familiarityLevel: track.familiarityLevel,
            sessionId,
          }),
        });
      } catch { /* stay optimistic */ }
    },
    [verdicts],
  );

  return { loaded, verdictFor, toggle };
}
