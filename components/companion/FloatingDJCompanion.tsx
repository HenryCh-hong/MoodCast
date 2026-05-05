'use client';

import { useState } from 'react';
import { useMoodcast, type ThemeName } from '@/lib/context/MoodcastContext';
import { useAskDJ } from '@/lib/hooks/useAskDJ';

const QUICK_ACTIONS = [
  { label: 'make it softer', q: 'Shift the energy down — what track fits next?' },
  { label: 'more energy', q: 'I need more energy right now. What do you recommend?' },
  { label: 'less vocals', q: 'Give me something more instrumental.' },
  { label: 'explain track', q: 'Why did you choose the current track for this moment?' },
  { label: 'skip this vibe', q: 'I want to move on from this feeling. What comes next?' },
  { label: 'what are we listening to?', q: 'Tell me about what is playing right now.' },
];

const THEMES: Array<{ key: ThemeName; label: string }> = [
  { key: 'morning', label: '☀' },
  { key: 'daylight', label: '◯' },
  { key: 'evening', label: '◑' },
  { key: 'midnight', label: '●' },
  { key: 'terminal', label: '▮' },
];

function autoTheme(): ThemeName {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'daylight';
  if (h >= 17 && h < 21) return 'evening';
  return 'midnight';
}

export function FloatingDJCompanion() {
  const {
    currentSession, playerState, spotifyProfile,
    companionOpen, setCompanionOpen,
    djStatus, theme, setTheme,
  } = useMoodcast();
  const { ask, loading, response, clearResponse } = useAskDJ(currentSession);
  const [inputValue, setInputValue] = useState('');

  const track = playerState?.track_window?.current_track;
  const trackIndex = currentSession && track
    ? currentSession.tracks.findIndex((t) => t.uri === track.uri) + 1
    : 0;
  const trackTotal = currentSession?.tracks.length ?? 0;

  // ── Collapsed pill ────────────────────────────────────────────────────────
  if (!companionOpen) {
    return (
      <button
        onClick={() => setCompanionOpen(true)}
        className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 bg-mc-elevated border border-mc-border rounded-full px-3 py-2 text-[11px] font-bold tracking-tight text-mc-mid hover:border-mc-lav hover:text-mc-hi transition-colors shadow-lg"
        aria-label="Open DJ companion"
      >
        {currentSession ? (
          <>
            <span className={`w-1.5 h-1.5 rounded-full bg-mc-onair flex-shrink-0 ${djStatus !== 'idle' ? 'animate-breathe' : ''}`} />
            <span className="max-w-[140px] truncate">{currentSession.sessionTitle}</span>
          </>
        ) : (
          <>
            <span className="text-mc-lo">◈</span>
            <span className="text-mc-dim text-[10px]">DJ</span>
          </>
        )}
      </button>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-4 right-4 z-[60] w-80 bg-mc-elevated border border-mc-border rounded shadow-2xl flex flex-col text-[11px] font-bold tracking-tight overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mc-border">
        <span className="text-[9px] font-mono tracking-[0.18em] uppercase text-mc-lav">
          ▓▒░ Moodcast  FM 88.7
        </span>
        <button
          onClick={() => setCompanionOpen(false)}
          className="text-mc-dim hover:text-mc-mid transition-colors text-[14px] leading-none"
          aria-label="Collapse"
        >
          ×
        </button>
      </div>

      {/* Status + Now Playing */}
      <div className="px-4 py-3 border-b border-mc-border">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-1.5 h-1.5 rounded-full bg-mc-onair flex-shrink-0 ${djStatus !== 'idle' ? 'animate-breathe' : 'opacity-30'}`} />
          <span className="text-[9px] font-mono tracking-[0.18em] uppercase text-mc-onair">
            {djStatus === 'idle' ? 'STANDBY' : djStatus === 'retuning' ? 'RETUNING···' : 'ON AIR'}
          </span>
        </div>

        {currentSession ? (
          <>
            <p className="text-mc-hi text-[12px] truncate">{currentSession.sessionTitle}</p>
            <p className="text-mc-lo text-[10px] truncate">{currentSession.sessionSubtitle}</p>
          </>
        ) : (
          <p className="text-mc-dim text-[10px]">No session loaded — scan a signal in the builder.</p>
        )}

        {track && (
          <div className="mt-2 pt-2 border-t border-mc-border">
            <p className="text-mc-mid text-[11px] truncate">{track.name}</p>
            <p className="text-mc-dim text-[10px] truncate">
              {track.artists.map((a) => a.name).join(', ')}
            </p>
            {trackTotal > 0 && (
              <p className="text-mc-dim text-[9px] mt-0.5 font-mono">
                track {trackIndex > 0 ? trackIndex : '?'} of {trackTotal}
              </p>
            )}
          </div>
        )}

        {!spotifyProfile?.connected && (
          <a
            href="/api/auth/spotify"
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-mc-lo hover:text-mc-mid transition-colors"
          >
            <span className="text-[#1DB954]">♪</span> Connect Spotify
          </a>
        )}
      </div>

      {/* Quick actions */}
      {currentSession && (
        <div className="px-4 py-3 border-b border-mc-border flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => ask(action.q)}
              disabled={loading}
              className="text-[9px] border border-mc-border rounded px-2 py-1 text-mc-dim hover:text-mc-lo hover:border-mc-mid transition-colors disabled:opacity-40"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Ask DJ input */}
      {currentSession && (
        <div className="px-4 py-3 border-b border-mc-border">
          {response && (
            <div className="mb-2 p-2 border border-mc-border rounded bg-mc-surface">
              <p className="text-[11px] font-sans italic text-mc-mid leading-relaxed">{response}</p>
              <button
                onClick={clearResponse}
                className="mt-1 text-[9px] text-mc-dim hover:text-mc-lo transition-colors"
              >
                clear
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  ask(inputValue);
                  setInputValue('');
                }
              }}
              placeholder="Ask the DJ..."
              className="flex-1 bg-mc-surface border border-mc-border rounded px-2 py-1.5 text-[11px] text-mc-hi placeholder:text-mc-dim focus:outline-none focus:border-mc-lav transition-colors"
            />
            <button
              onClick={() => {
                if (inputValue.trim()) {
                  ask(inputValue);
                  setInputValue('');
                }
              }}
              disabled={loading || !inputValue.trim()}
              className="px-2 py-1.5 border border-mc-border rounded text-mc-dim hover:text-mc-mid hover:border-mc-mid transition-colors disabled:opacity-35"
            >
              {loading ? '···' : '→'}
            </button>
          </div>
        </div>
      )}

      {/* Theme picker */}
      <div className="px-4 py-2.5 flex items-center gap-3">
        <span className="text-[9px] text-mc-dim font-mono tracking-[0.1em] uppercase">Theme</span>
        <div className="flex gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key, true)}
              title={t.key}
              className={`w-6 h-6 rounded border text-[10px] transition-colors ${
                theme === t.key
                  ? 'border-mc-lav text-mc-lav'
                  : 'border-mc-border text-mc-dim hover:border-mc-mid hover:text-mc-lo'
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setTheme(autoTheme(), false)}
            title="auto"
            className="w-6 h-6 rounded border border-mc-border text-[9px] text-mc-dim hover:border-mc-mid hover:text-mc-lo transition-colors font-mono"
          >
            A
          </button>
        </div>
      </div>
    </div>
  );
}
