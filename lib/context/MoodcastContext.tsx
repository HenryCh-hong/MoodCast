'use client';

import {
  createContext, useContext, useState, useEffect, useMemo, useCallback,
  type ReactNode,
} from 'react';
import type { MoodcastSession } from '@/lib/types/moodcast';
import {
  buildSessionQueueMapping,
  findPlayableIndex,
} from '@/lib/session/queueMapping';

// ── Types ────────────────────────────────────────────────────────────────────

export type ThemeName = 'midnight' | 'morning' | 'daylight' | 'evening' | 'terminal';
export type DJStatus = 'idle' | 'on-air' | 'listening' | 'retuning' | 'error';

export interface SpotifyProfile {
  connected: boolean;
  userId?: string;
  name?: string;
  isPremium?: boolean;
  avatar?: string | null;
}

export interface PlayerTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
}

export interface PlayerState {
  paused: boolean;
  track_window: {
    current_track: PlayerTrack;
    next_tracks: Array<PlayerTrack>;
  };
}

interface MoodcastCtx {
  currentSession: MoodcastSession | null;
  setCurrentSession: (s: MoodcastSession | null) => void;
  playerState: PlayerState | null;
  setPlayerState: (s: PlayerState | null) => void;
  deviceId: string | null;
  setDeviceId: (id: string | null) => void;
  spotifyProfile: SpotifyProfile | null;
  setSpotifyProfile: (p: SpotifyProfile | null) => void;
  theme: ThemeName;
  setTheme: (t: ThemeName, manual?: boolean) => void;
  companionOpen: boolean;
  setCompanionOpen: (v: boolean) => void;
  djStatus: DJStatus;
  djCue: string | null;
  setDjCue: (cue: string | null) => void;
  /** True while DJ MOOC's TTS voice is actively speaking a cue. */
  isMoocSpeaking: boolean;
  setIsMoocSpeaking: (v: boolean) => void;
  /**
   * 0-indexed position in the current session's **playable** URI list — the
   * sanitized subset of `currentSession.tracks` that has valid
   * `spotify:track:…` URIs. This is the same indexing the server uses, so
   * sending it to /api/playback/control / /api/playback/start needs no
   * translation. Null when no session is active or the session has no
   * playable tracks.
   *
   * Source of truth for next/previous navigation — set explicitly when the
   * user presses Start Playback / Next / Previous / clicks a track row,
   * and reconciled against `playerState.track_window.current_track.uri`
   * when Spotify auto-advances.
   *
   * Avoid using `tracks.findIndex(t => t.uri === currentUri)` directly: a
   * session can contain duplicate URIs, and `current_track.uri` lags or
   * leads the actual track during transitions.
   */
  sessionIndex: number | null;
  setSessionIndex: (idx: number | null) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const MoodcastContext = createContext<MoodcastCtx | null>(null);

export function useMoodcast(): MoodcastCtx {
  const ctx = useContext(MoodcastContext);
  if (!ctx) throw new Error('useMoodcast must be used inside MoodcastProvider');
  return ctx;
}

// ── Theme auto-detection ─────────────────────────────────────────────────────

const THEME_KEY = 'moodcast:theme';

export function autoTheme(): ThemeName {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'daylight';
  if (h >= 17 && h < 21) return 'evening';
  return 'midnight';
}

function initTheme(): ThemeName {
  if (typeof window === 'undefined') return 'midnight';
  const stored = localStorage.getItem(THEME_KEY) as ThemeName | null;
  if (stored && ['midnight', 'morning', 'daylight', 'evening', 'terminal'].includes(stored)) {
    return stored;
  }
  return autoTheme();
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function MoodcastProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<MoodcastSession | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [theme, setThemeState] = useState<ThemeName>(initTheme);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [djCue, setDjCue] = useState<string | null>(null);
  const [isMoocSpeaking, setIsMoocSpeaking] = useState(false);
  const [sessionIndex, setSessionIndex] = useState<number | null>(null);
  // Track session identity + last reconciled URI so we can detect changes
  // during render and update state synchronously (React's "store info from
  // previous renders" pattern). This avoids the React 19 lint against
  // calling setState inside an effect, while still mirroring the external
  // Spotify player state into our index source-of-truth.
  const [prevSessionTitle, setPrevSessionTitle] = useState<string | null>(null);
  const [prevReconciledUri, setPrevReconciledUri] = useState<string | null>(null);

  // ── Session identity reset ──────────────────────────────────────────────────
  // When the session itself changes, reset the index. A stale index from a
  // previous session would silently corrupt next/prev navigation.
  const sessionTitle = currentSession?.sessionTitle ?? null;
  if (sessionTitle !== prevSessionTitle) {
    setPrevSessionTitle(sessionTitle);
    setPrevReconciledUri(null);
    setSessionIndex(currentSession ? 0 : null);
  }

  // ── Player-state reconciliation ─────────────────────────────────────────────
  // When Spotify reports a track URI change (auto-advance, native skip, or
  // our own play call settling), use the canonical queue mapping +
  // duplicate-aware findPlayableIndex to update sessionIndex. Indexing is
  // over the playable list, the same the server uses.
  const currentUri = playerState?.track_window?.current_track?.uri ?? null;
  if (currentSession && currentUri && currentUri !== prevReconciledUri) {
    const mapping = buildSessionQueueMapping(currentSession.tracks);
    const previousIndex = sessionIndex ?? 0;
    const next = findPlayableIndex(mapping, currentUri, previousIndex);
    setPrevReconciledUri(currentUri);

    if (process.env.NODE_ENV === 'development') {
      console.log('[queue] reconcile', {
        previousIndex,
        resolvedPlayableIndex: next,
        rawIndex: next === -1 ? null : mapping.playableIndexToRaw[next],
        playableTotal: mapping.playableUris.length,
      });
    }

    if (next !== -1 && next !== sessionIndex) {
      setSessionIndex(next);
    }
  }

  // djStatus is derived from session + playback. Keeping it as memoised
  // derived state avoids the React 19 lint against synchronous setState
  // inside an effect, and removes a redundant render cycle.
  const djStatus: DJStatus = useMemo(() => {
    if (!currentSession) return 'idle';
    if (!playerState) return 'on-air';
    return playerState.paused ? 'on-air' : 'listening';
  }, [currentSession, playerState]);

  // Apply theme to <html> data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Fetch Spotify profile once on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) return null;
        return r.json() as Promise<SpotifyProfile>;
      })
      .then((data) => setSpotifyProfile(data ?? { connected: false }))
      .catch(() => setSpotifyProfile({ connected: false }));
  }, []);

  const setTheme = useCallback((t: ThemeName, manual = false) => {
    setThemeState(t);
    if (manual) {
      localStorage.setItem(THEME_KEY, t);
    } else {
      localStorage.removeItem(THEME_KEY);
    }
  }, []);

  return (
    <MoodcastContext.Provider value={{
      currentSession, setCurrentSession,
      playerState, setPlayerState,
      deviceId, setDeviceId,
      spotifyProfile, setSpotifyProfile,
      theme, setTheme,
      companionOpen, setCompanionOpen,
      djStatus,
      djCue, setDjCue,
      isMoocSpeaking, setIsMoocSpeaking,
      sessionIndex, setSessionIndex,
    }}>
      {children}
    </MoodcastContext.Provider>
  );
}
