'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getDemoSession } from '@/lib/demo/demoSessions';
import { getSession } from '@/lib/storage/localSessions';
import { SessionHero } from '@/components/session/SessionHero';
import { DJMonologueCard } from '@/components/session/DJMonologueCard';
import { TrackQueue } from '@/components/session/TrackQueue';
import { SessionArcPanel } from '@/components/session/SessionArcPanel';
import { AskDJPanel } from '@/components/session/AskDJPanel';
import { SessionActionBar } from '@/components/session/SessionActionBar';
import type { MoodcastSession, SavedSession } from '@/lib/types/moodcast';
import { useMoodcast } from '@/lib/context/MoodcastContext';
import { isValidSpotifyTrackUri } from '@/lib/spotify/uris';
import {
  buildSessionQueueMapping,
  rawToPlayableIndex,
} from '@/lib/session/queueMapping';

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const {
    spotifyProfile,
    deviceId, setDeviceId,
    setCurrentSession,
    sessionIndex, setSessionIndex,
  } = useMoodcast();

  const [session, setSession] = useState<(MoodcastSession & { id?: string; isDemo?: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);

  useEffect(() => {
    // Resolution order:
    //   1) demo registry          (built-in prewritten sessions)
    //   2) browser localStorage   (legacy web saves)
    //   3) shared session library (terminal- and web-generated, the source of truth)
    let cancelled = false;
    (async () => {
      const demo = getDemoSession(id);
      if (demo) {
        if (!cancelled) setSession({ ...demo, isDemo: true });
        if (!cancelled) setLoading(false);
        return;
      }
      const saved = getSession(id);
      if (saved) {
        if (!cancelled) setSession(saved);
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/sessions/library/${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const body = (await res.json()) as { session?: { id: string; session: MoodcastSession } };
          if (body.session?.session && !cancelled) {
            setSession({ ...body.session.session, id: body.session.id });
          }
        }
      } catch {
        // network/server unavailable — fall through to "not found" state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (session) {
      setCurrentSession(session as MoodcastSession);
      // Sync to the cross-process active-session store so the CLI dashboard
      // (and any future client) can pick up MooC cue lines + track order.
      // Fire-and-forget; non-blocking on failure.
      fetch('/api/sessions/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, source: 'web', session }),
      }).catch(() => { /* silent — store is best-effort */ });
    }
    // NOTE: we deliberately do NOT clear deviceId / playerState here. Those
    // are owned by SpotifyPlayerHost (mounted once at the layout level) and
    // must survive navigation between sessions. The previous version cleared
    // them on every session-id change, which forced a 1-2s SDK reconnect
    // and produced the confusing "reopen Spotify or reconnect the web
    // player" message. setCurrentSession(null) is fine to clear because it
    // is per-page state.
    return () => {
      setCurrentSession(null);
    };
  }, [session, id, setCurrentSession]);

  const [playbackPending, setPlaybackPending] = useState(false);

  // playFromRowIndex: the canonical "start playing this session at track row
  // N" path. The argument is the row index in the visible TrackQueue (which
  // can include rows with no Spotify URI). The function:
  //   1. Builds the canonical queue mapping (raw rows → playable indices).
  //   2. Translates the row index into the corresponding *playable* index.
  //   3. Sends the sanitized list + sessionId to /api/playback/start. Empty
  //      strings are NEVER sent — Spotify rejects the whole call otherwise
  //      (the "Invalid track uri: \"\"" bug).
  // - "Start Playback" button calls playFromRowIndex(firstPlayableRow).
  // - TrackQueue rows call playFromRowIndex(rowIndex). Unplayable rows are
  //   not clickable in the first place.
  const playFromRowIndex = useCallback(async (rowIndex: number) => {
    if (!deviceId || !session) return;

    const mapping = buildSessionQueueMapping(session.tracks);
    if (mapping.playableUris.length === 0) {
      setPlayerError(
        'This session has no playable Spotify track URIs. Regenerate with Spotify connected.',
      );
      return;
    }

    const playableIndex = rawToPlayableIndex(mapping, rowIndex);
    if (playableIndex === -1) {
      setPlayerError(
        `Track ${rowIndex + 1} has no Spotify URI yet. Pick another track or regenerate the session.`,
      );
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[queue] start', {
        sessionId: id,
        rawTracks: session.tracks.length,
        playable: mapping.playableUris.length,
        dropped: session.tracks.length - mapping.playableUris.length,
        startPlayableIndex: playableIndex,
        firstUri: '(present)',
      });
    }

    setPlaybackPending(true);
    setPlayerError(null);
    try {
      const res = await fetch('/api/playback/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          uris: mapping.playableUris,
          startIndex: playableIndex,
          sessionId: id,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
          error?: string;
        };
        const raw = body.error ?? `Playback failed (${res.status})`;
        const lower = raw.toLowerCase();
        if (lower.includes('device not found') || lower.includes('device_not_found')) {
          // Device error — DO NOT phrase this as "reconnect Spotify". The
          // user is still authenticated; the Web Playback SDK just hasn't
          // (re)attached yet. Clear deviceId so the SDK can re-emit
          // `ready`, but keep the auth banner away.
          setDeviceId(null);
          setPlayerError(
            'Moodcast Web Playback isn’t ready yet — give it a moment, or reload this tab. (You don’t need to reconnect Spotify.)',
          );
        } else if (res.status === 401 || lower.includes('not authenticated')) {
          // Genuine auth failure — refresh token missing/invalid, or Spotify
          // revoked access. Surface the connect link.
          setPlayerError('Spotify session expired — reconnect Spotify to continue.');
        } else if (lower.includes('no playable spotify track uris')) {
          // Empty / malformed URI list — the session has no playable tracks.
          setPlayerError(
            'This session has no playable Spotify tracks. Regenerate with Spotify connected to get real URIs.',
          );
        } else {
          setPlayerError(raw);
        }
      } else {
        // Sync the local index to the playable position we asked Spotify to
        // start at. The reconciliation effect in MoodcastContext will refine
        // this once the SDK echoes the actual current_track URI back.
        setSessionIndex(playableIndex);
      }
    } catch {
      setPlayerError('Playback failed — check your network connection');
    } finally {
      setPlaybackPending(false);
    }
  }, [deviceId, session, id, setDeviceId, setSessionIndex]);

  // Whether this session has any rows the SDK can actually play. Used to
  // disable Start Playback up-front instead of letting the user click and
  // get a backend error a second later. Recomputes when the track list
  // changes (e.g. after Ask DJ rewrites the queue).
  const hasPlayableRow = useMemo(
    () => (session?.tracks ?? []).some((t) => isValidSpotifyTrackUri(t.uri ?? '')),
    [session?.tracks],
  );

  // "Start Playback" — find the first playable row and play from there.
  // The button is disabled when no playable row exists, so this should
  // only run when there is at least one playable URI.
  const startPlayback = useCallback(() => {
    if (!session) return;
    const firstPlayableRow = session.tracks.findIndex((t) =>
      isValidSpotifyTrackUri(t.uri ?? ''),
    );
    if (firstPlayableRow === -1) {
      setPlayerError(
        'This session has no playable Spotify tracks. Regenerate with Spotify connected.',
      );
      return;
    }
    void playFromRowIndex(firstPlayableRow);
  }, [session, playFromRowIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-mc-lav opacity-60 animate-pulse" />
        <span className="text-[12px] font-bold tracking-tight text-mc-lo">Loading session</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo mb-3">Session not found</p>
        <p className="text-sm font-bold tracking-tight text-mc-mid mb-6">This session may have been cleared from storage.</p>
        <button
          onClick={() => router.push('/builder')}
          className="px-4 py-2 rounded bg-mc-lav text-[#1a1228] text-[12px] font-bold tracking-tight hover:opacity-90 transition-opacity"
        >
          Start a new session
        </button>
      </div>
    );
  }

  const isPremiumWithPlayer = spotifyProfile?.connected && spotifyProfile.isPremium;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 pb-24">
      {/* SpotifyPlayer is now mounted once in app/layout.tsx via
          SpotifyPlayerHost — see the comment there for why. */}

      {playerError && (
        <div className="mb-5 p-3 border border-mc-onair/30 rounded text-[12px] font-bold tracking-tight text-mc-mid bg-mc-elevated">
          {playerError}
        </div>
      )}

      <SessionHero session={session} />

      <DJMonologueCard monologue={session.openingMonologue} />

      <TrackQueue
        tracks={session.tracks}
        sessionIndex={sessionIndex}
        onPlayTrack={isPremiumWithPlayer && deviceId ? (i) => void playFromRowIndex(i) : undefined}
        playbackPending={playbackPending}
        sessionId={id}
      />

      {isPremiumWithPlayer && deviceId && (
        <div className="mt-4 mb-6 flex flex-col gap-2">
          <button
            onClick={startPlayback}
            disabled={playbackPending || !hasPlayableRow}
            aria-disabled={playbackPending || !hasPlayableRow}
            className="self-start px-4 py-2 rounded bg-mc-lav text-[#1a1228] text-[12px] font-bold tracking-tight hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {playbackPending ? 'Starting···' : '▶ Start Playback'}
          </button>
          {hasPlayableRow ? (
            <p className="text-[9px] font-mono text-mc-dim tracking-[0.12em]">
              Moodcast appears as a Spotify Connect device, not a playlist.
            </p>
          ) : (
            <p className="text-[11px] font-bold tracking-tight text-mc-onair">
              This session has no playable Spotify tracks. Regenerate with Spotify connected.
            </p>
          )}
        </div>
      )}

      {isPremiumWithPlayer && !deviceId && (
        <div className="mt-4 mb-6 p-3 border border-mc-border rounded text-[12px] font-bold tracking-tight text-mc-lo">
          Moodcast device connecting··· <span className="font-mono text-mc-dim">(Spotify is connected — just waiting for the Web Playback SDK)</span>
        </div>
      )}

      {!spotifyProfile?.connected && !session.isDemo && (
        <div className="mt-4 mb-6 p-3 border border-mc-border rounded text-[12px] font-bold tracking-tight text-mc-lo">
          <span className="text-[#1DB954]">♪</span>{' '}
          <a href="/api/auth/spotify" className="underline hover:text-mc-mid transition-colors">Connect Spotify</a>
          {' '}to play this session.
        </div>
      )}

      {spotifyProfile?.connected && !spotifyProfile.isPremium && (
        <div className="mt-4 mb-6 p-3 border border-mc-border rounded text-[12px] font-bold tracking-tight text-mc-lo">
          Spotify Premium is required for playback. Showing track list only.
        </div>
      )}

      {session.sessionArc && session.sessionArc.length > 0 && (
        <SessionArcPanel arc={session.sessionArc} />
      )}

      {session.endingMessage && (
        <div className="mt-6 p-5 border border-mc-border rounded bg-mc-elevated">
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-2">Ending transmission</p>
          <p className="text-sm font-sans italic text-mc-mid leading-relaxed">{session.endingMessage}</p>
        </div>
      )}

      <AskDJPanel session={session as MoodcastSession} />

      <SessionActionBar
        sessionId={id}
        isDemo={Boolean((session as SavedSession & { isDemo?: boolean }).isDemo)}
        session={session}
        spotifyConnected={Boolean(spotifyProfile?.connected)}
      />
    </div>
  );
}
