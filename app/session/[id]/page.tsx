'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getDemoSession } from '@/lib/demo/demoSessions';
import { getSession } from '@/lib/storage/localSessions';
import { SpotifyPlayer } from '@/components/player/SpotifyPlayer';
import { SessionHero } from '@/components/session/SessionHero';
import { DJMonologueCard } from '@/components/session/DJMonologueCard';
import { TrackQueue } from '@/components/session/TrackQueue';
import { SessionArcPanel } from '@/components/session/SessionArcPanel';
import { AskDJPanel } from '@/components/session/AskDJPanel';
import { SessionActionBar } from '@/components/session/SessionActionBar';
import type { MoodcastSession, SavedSession } from '@/lib/types/moodcast';
import { useMoodcast, type PlayerState } from '@/lib/context/MoodcastContext';

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const {
    spotifyProfile,
    playerState, setPlayerState,
    deviceId, setDeviceId,
    setCurrentSession,
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
    return () => {
      setCurrentSession(null);
      setPlayerState(null);
      setDeviceId(null);
    };
  }, [session, id, setCurrentSession, setPlayerState, setDeviceId]);

  const handlePlayerReady = useCallback((dId: string) => {
    setDeviceId(dId || null);
  }, [setDeviceId]);

  const handlePlayerNotReady = useCallback(() => {
    setDeviceId(null);
  }, [setDeviceId]);

  const handleStateChange = useCallback((state: PlayerState | null) => {
    setPlayerState(state);
  }, [setPlayerState]);

  const handlePlayerError = useCallback((msg: string) => {
    setPlayerError(msg);
  }, []);

  const [playbackPending, setPlaybackPending] = useState(false);

  const startPlayback = useCallback(async () => {
    if (!deviceId || !session) return;

    // Only pass valid spotify:track: URIs
    const uris = session.tracks
      .map((t) => t.uri ?? '')
      .filter((u) => u.startsWith('spotify:track:'));

    if (uris.length === 0) {
      setPlayerError('No playable Spotify tracks found in this session. Regenerate with Spotify connected to get real URIs.');
      return;
    }

    setPlaybackPending(true);
    setPlayerError(null);
    try {
      const res = await fetch('/api/playback/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, uris }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as Record<string, unknown>)) as { error?: string };
        const raw = body.error ?? `Playback failed (${res.status})`;
        if (raw.toLowerCase().includes('device not found') || raw.toLowerCase().includes('device_not_found')) {
          // Stale device_id — clear it so the button hides and user knows to wait for reconnect
          setDeviceId(null);
          setPlayerError('Spotify device was not found. Reopen Spotify or reconnect the web player, then try again.');
        } else {
          setPlayerError(raw);
        }
      }
    } catch {
      setPlayerError('Playback failed — check your network connection');
    } finally {
      setPlaybackPending(false);
    }
  }, [deviceId, session, setDeviceId]);

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
      {/* Spotify SDK player (invisible) */}
      {isPremiumWithPlayer && (
        <SpotifyPlayer
          onReady={handlePlayerReady}
          onNotReady={handlePlayerNotReady}
          onStateChange={handleStateChange}
          onError={handlePlayerError}
        />
      )}

      {playerError && (
        <div className="mb-5 p-3 border border-mc-onair/30 rounded text-[12px] font-bold tracking-tight text-mc-mid bg-mc-elevated">
          {playerError}
        </div>
      )}

      <SessionHero session={session} />

      <DJMonologueCard monologue={session.openingMonologue} />

      <TrackQueue
        tracks={session.tracks}
        playerState={playerState}
      />

      {isPremiumWithPlayer && deviceId && (
        <div className="mt-4 mb-6 flex flex-col gap-2">
          <button
            onClick={startPlayback}
            disabled={playbackPending}
            className="self-start px-4 py-2 rounded bg-mc-lav text-[#1a1228] text-[12px] font-bold tracking-tight hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {playbackPending ? 'Starting···' : '▶ Start Playback'}
          </button>
          <p className="text-[9px] font-mono text-mc-dim tracking-[0.12em]">
            Moodcast appears as a Spotify Connect device, not a playlist.
          </p>
        </div>
      )}

      {isPremiumWithPlayer && !deviceId && (
        <div className="mt-4 mb-6 p-3 border border-mc-border rounded text-[12px] font-bold tracking-tight text-mc-lo">
          Moodcast device connecting···
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
