'use client';

import {
  createContext, useContext, useState, useEffect, useMemo, useCallback,
  type ReactNode,
} from 'react';
import type { MoodcastSession } from '@/lib/types/moodcast';

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
    }}>
      {children}
    </MoodcastContext.Provider>
  );
}
