'use client';

import { useState, useCallback, useEffect } from 'react';
import { useMoodcast, autoTheme, type ThemeName } from '@/lib/context/MoodcastContext';
import { useAskDJ } from '@/lib/hooks/useAskDJ';
import { useDraggableCompanion } from '@/lib/hooks/useDraggableCompanion';
import { useTrackTransition } from '@/lib/hooks/useTrackTransition';
import { useMoocVoice } from '@/lib/hooks/useMoocVoice';
import { updateSession } from '@/lib/storage/localSessions';
import { SpeakingIndicator } from '@/components/companion/SpeakingIndicator';
import { MoocSettingsPanel } from '@/components/companion/MoocSettingsPanel';
import type { AskDJResponseRetune, MoodcastSession } from '@/lib/types/moodcast';

const QUICK_ACTIONS = [
  { label: 'softer', q: 'Shift the energy down — what track fits next?' },
  { label: 'more energy', q: 'I need more energy right now. What do you recommend?' },
  { label: 'instrumental', q: 'Give me something more instrumental.' },
  { label: 'why this track?', q: 'Why did you choose the current track for this moment?' },
  { label: 'skip the vibe', q: 'I want to move on from this feeling. What comes next?' },
  { label: "what's playing?", q: 'Tell me about what is playing right now.' },
];

const THEMES: Array<{ key: ThemeName; glyph: string }> = [
  { key: 'morning', glyph: '☀' },
  { key: 'daylight', glyph: '◯' },
  { key: 'evening', glyph: '◑' },
  { key: 'midnight', glyph: '●' },
  { key: 'terminal', glyph: '▮' },
];

type ControlAction = 'pause' | 'resume' | 'next' | 'previous';

async function sendControl(
  action: ControlAction,
  opts?: { uris?: string[]; currentUri?: string; deviceId?: string }
): Promise<string | null> {
  try {
    const res = await fetch('/api/playback/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...opts }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as Record<string, unknown>)) as { error?: string };
      return body.error ?? `Control failed (${res.status})`;
    }
    return null;
  } catch {
    return 'Connection lost';
  }
}

export function FloatingDJCompanion() {
  const {
    currentSession, setCurrentSession,
    playerState, spotifyProfile,
    companionOpen, setCompanionOpen,
    djStatus, theme, setTheme,
    deviceId,
    djCue, setDjCue,
    isMoocSpeaking,
  } = useMoodcast();
  const { ask, loading, response, pendingRetune, clearResponse, clearPendingRetune } = useAskDJ(currentSession);
  const { pos, onHeaderMouseDown } = useDraggableCompanion();
  useTrackTransition();
  // Drives browser TTS when a cue arrives. Reads gating from preferences.
  useMoocVoice();
  const [inputValue, setInputValue] = useState('');
  const [controlPending, setControlPending] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);

  // Correct: isPlaying only true when there's a playerState and it's not paused
  const isPlaying = playerState ? !playerState.paused : false;
  const track = playerState?.track_window?.current_track;
  const trackIndex = currentSession && track
    ? currentSession.tracks.findIndex((t) => t.uri === track.uri) + 1
    : 0;
  const trackTotal = currentSession?.tracks.length ?? 0;
  const albumArt = track?.album?.images?.[0]?.url;

  const isConnected = Boolean(spotifyProfile?.connected);
  const isPremium = isConnected && Boolean(spotifyProfile?.isPremium);
  const isDemo = Boolean((currentSession as { isDemo?: boolean } | null)?.isDemo);
  const deviceReady = Boolean(deviceId);

  // Auto-clear control error after 4 seconds
  useEffect(() => {
    if (!controlError) return;
    const t = setTimeout(() => setControlError(null), 4000);
    return () => clearTimeout(t);
  }, [controlError]);

  const control = useCallback(async (action: ControlAction) => {
    if (controlPending) return;
    setControlPending(true);
    setControlError(null);

    let opts: { uris?: string[]; currentUri?: string; deviceId?: string } | undefined;
    if ((action === 'next' || action === 'previous') && currentSession && track && deviceId) {
      opts = {
        uris: currentSession.tracks
          .map((t) => t.uri ?? '')
          .filter((u) => u.startsWith('spotify:track:')),
        currentUri: track.uri ?? '',
        deviceId,
      };
    }

    const err = await sendControl(action, opts);
    if (err) setControlError(err);
    setControlPending(false);
  }, [controlPending, currentSession, track, deviceId]);

  const applyRetune = useCallback(async (retune: AskDJResponseRetune) => {
    if (!currentSession) return;

    const updatedSession = { ...currentSession, tracks: retune.updatedTracks };
    setCurrentSession(updatedSession as MoodcastSession);

    const sessionId = (currentSession as { id?: string }).id;
    const isDemo = (currentSession as { isDemo?: boolean }).isDemo;
    if (sessionId && !isDemo) {
      updateSession(sessionId, { tracks: retune.updatedTracks });
    }

    clearPendingRetune();

    if (retune.playbackRecommendation === 'restart' && deviceId) {
      const validUris = retune.updatedTracks
        .map((t) => t.uri ?? '')
        .filter((u) => u.startsWith('spotify:track:'));
      if (validUris.length > 0) {
        await fetch('/api/playback/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, uris: validUris }),
        }).catch(() => {});
      }
    }
  }, [currentSession, setCurrentSession, deviceId, clearPendingRetune]);

  const submitAsk = useCallback(() => {
    if (inputValue.trim()) { ask(inputValue); setInputValue(''); }
  }, [inputValue, ask]);

  // ── Collapsed pill ──────────────────────────────────────────────────────────
  if (!companionOpen) {
    return (
      <button
        onClick={() => setCompanionOpen(true)}
        style={{ right: 16, bottom: 16 }}
        className="fixed z-[60] flex items-center gap-2 bg-mc-elevated border border-mc-border rounded-full px-3 py-2 text-[11px] font-bold tracking-tight text-mc-mid hover:border-mc-lav hover:text-mc-hi transition-colors shadow-lg"
        aria-label="Open DJ companion"
      >
        {currentSession ? (
          <>
            <span className={`w-1.5 h-1.5 rounded-full bg-mc-onair flex-shrink-0 ${djStatus !== 'idle' ? 'animate-breathe' : 'opacity-40'}`} />
            <span className="max-w-[160px] truncate text-mc-hi">{currentSession.sessionTitle}</span>
            {track && <span className="text-mc-lo truncate max-w-[100px] hidden sm:inline">· {track.name}</span>}
          </>
        ) : (
          <>
            <span className="text-mc-mid">◈</span>
            <span className="text-mc-lo text-[10px] font-mono tracking-widest">MOOC</span>
          </>
        )}
      </button>
    );
  }

  // ── Expanded panel ──────────────────────────────────────────────────────────
  const posStyle = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 16, bottom: 16 };

  return (
    <div
      style={posStyle}
      className="fixed z-[60] w-80 bg-mc-elevated border border-mc-border rounded-lg shadow-2xl flex flex-col text-[11px] font-bold tracking-tight overflow-hidden"
    >

      {/* Drag handle / header — select-none only here */}
      <div
        onMouseDown={onHeaderMouseDown}
        className="select-none flex items-center justify-between px-4 py-2.5 border-b border-mc-border cursor-grab active:cursor-grabbing bg-mc-surface"
      >
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full bg-mc-onair flex-shrink-0 ${djStatus !== 'idle' ? 'animate-breathe' : 'opacity-40'}`} />
          <span className="text-[9px] font-mono tracking-[0.18em] uppercase text-mc-mid">
            ▓▒░ Moodcast  FM 88.7
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-mc-lo tracking-widest">
            {djStatus === 'idle' ? 'STANDBY' : djStatus === 'retuning' ? 'RETUNING···' : djStatus === 'listening' ? 'LISTENING' : 'ON AIR'}
          </span>
          {/* stopPropagation prevents close click from starting a drag */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setCompanionOpen(false)}
            className="text-mc-lo hover:text-mc-hi transition-colors text-[16px] leading-none ml-1"
            aria-label="Collapse"
          >
            ×
          </button>
        </div>
      </div>

      {/* Now playing / album art strip */}
      <div className="px-4 py-3 border-b border-mc-border">
        <div className="flex items-start gap-3">
          {/* Album art or orb */}
          <div className="w-14 h-14 rounded flex-shrink-0 overflow-hidden border border-mc-border bg-mc-surface flex items-center justify-center">
            {albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={albumArt} alt="Album art" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[22px] text-mc-lo leading-none">
                {currentSession ? '◈' : '○'}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {currentSession ? (
              <>
                <p className="text-mc-hi text-[12px] truncate leading-snug">{currentSession.sessionTitle}</p>
                <p className="text-mc-mid text-[10px] truncate">{currentSession.sessionSubtitle}</p>
              </>
            ) : (
              <p className="text-mc-mid text-[11px]">No session loaded.</p>
            )}

            {track ? (
              <div className="mt-1.5">
                <p className="text-mc-hi text-[11px] truncate font-bold">{track.name}</p>
                <p className="text-mc-lo text-[10px] truncate">
                  {track.artists.map((a) => a.name).join(', ')}
                </p>
                {trackTotal > 0 && (
                  <p className="text-mc-mid text-[9px] mt-0.5 font-mono">
                    {trackIndex > 0 ? trackIndex : '?'} / {trackTotal}
                  </p>
                )}
              </div>
            ) : currentSession ? (
              <p className="text-mc-lo text-[10px] mt-1.5">
                {isPremium ? 'No track playing — start playback on the session page.' : null}
              </p>
            ) : null}
          </div>
        </div>

        {/* Playback controls — tiered by auth state */}
        {currentSession && (
          <div className="mt-3 pt-2.5 border-t border-mc-border">
            {isPremium ? (
              /* Premium: full controls — gated on deviceReady */
              <>
                {controlError && (
                  <p className="text-[9px] text-mc-onair font-mono mb-1.5 truncate">{controlError}</p>
                )}
                {!deviceReady && (
                  <p className="text-[9px] text-mc-lo font-mono text-center mb-1.5">
                    Spotify player is still connecting···
                  </p>
                )}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => control('previous')}
                    disabled={controlPending || !deviceReady}
                    className="text-mc-mid hover:text-mc-hi transition-colors disabled:opacity-40 text-[18px] leading-none"
                    title={!deviceReady ? 'Spotify player is still connecting' : 'Previous'}
                  >
                    ⏮
                  </button>
                  <button
                    onClick={() => control(isPlaying ? 'pause' : 'resume')}
                    disabled={controlPending || !deviceReady}
                    className="w-9 h-9 rounded-full border-2 border-mc-lav text-mc-lav hover:bg-mc-lav hover:text-mc-bg transition-colors disabled:opacity-40 flex items-center justify-center text-[15px]"
                    title={!deviceReady ? 'Spotify player is still connecting' : isPlaying ? 'Pause' : 'Resume'}
                  >
                    {controlPending ? '·' : isPlaying ? '⏸' : '▶'}
                  </button>
                  <button
                    onClick={() => control('next')}
                    disabled={controlPending || !deviceReady}
                    className="text-mc-mid hover:text-mc-hi transition-colors disabled:opacity-40 text-[18px] leading-none"
                    title={!deviceReady ? 'Spotify player is still connecting' : 'Next'}
                  >
                    ⏭
                  </button>
                </div>
              </>
            ) : isConnected ? (
              /* Connected but not Premium */
              <div className="flex items-center justify-center gap-4">
                <button disabled className="text-mc-lo opacity-30 text-[18px] leading-none" title="Requires Spotify Premium">⏮</button>
                <button disabled className="w-9 h-9 rounded-full border-2 border-mc-border text-mc-lo flex items-center justify-center text-[15px] opacity-30" title="Requires Spotify Premium">▶</button>
                <button disabled className="text-mc-lo opacity-30 text-[18px] leading-none" title="Requires Spotify Premium">⏭</button>
              </div>
            ) : null}

            {/* Spotify connection prompts */}
            {isDemo && !isConnected && (
              <p className="mt-1.5 text-center text-[9px] text-mc-lo font-mono">
                Demo mode · <a href="/api/auth/spotify" className="underline hover:text-mc-mid">Connect Spotify</a> to play
              </p>
            )}
            {!isConnected && !isDemo && currentSession && (
              <a href="/api/auth/spotify" className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-mc-mid hover:text-mc-hi transition-colors">
                <span className="text-[#1DB954]">♪</span> Connect Spotify to control playback
              </a>
            )}
            {isConnected && !isPremium && (
              <p className="mt-1.5 text-center text-[9px] text-mc-lo font-mono">
                Spotify Premium required for playback controls
              </p>
            )}
          </div>
        )}

        {/* No session: just show connect link */}
        {!currentSession && !isConnected && (
          <a href="/api/auth/spotify" className="mt-2 inline-flex items-center gap-1 text-[10px] text-mc-mid hover:text-mc-hi transition-colors">
            <span className="text-[#1DB954]">♪</span> Connect Spotify
          </a>
        )}
      </div>

      {/* MOOC CUE card — appears when track changes, auto-clears after 10s.
          Stays mounted while MooC is still speaking so the waveform indicator
          syncs with the audible cue. */}
      {(djCue || isMoocSpeaking) && (
        <div className="px-4 py-2.5 border-b border-mc-border bg-mc-surface">
          <div className="flex items-start justify-between gap-2 mb-1">
            <SpeakingIndicator active={isMoocSpeaking} />
            <button
              onClick={() => setDjCue(null)}
              className="text-mc-lo hover:text-mc-mid transition-colors text-[13px] leading-none -mt-0.5 flex-shrink-0"
              aria-label="Dismiss cue"
            >
              ×
            </button>
          </div>
          {djCue && (
            <p className="text-[11px] font-sans italic text-mc-mid leading-relaxed">{djCue}</p>
          )}
        </div>
      )}

      {/* Quick actions */}
      {currentSession && (
        <div className="px-4 py-2.5 border-b border-mc-border flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => ask(action.q)}
              disabled={loading}
              className="text-[9px] border border-mc-border rounded px-2 py-1 text-mc-lo hover:text-mc-hi hover:border-mc-mid transition-colors disabled:opacity-40"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Ask DJ — response text is selectable */}
      {currentSession && (
        <div className="px-4 py-3 border-b border-mc-border">
          {response && (
            <div className="mb-2 p-2 border border-mc-border rounded bg-mc-surface select-text">
              <p className="text-[11px] font-sans italic text-mc-hi leading-relaxed">{response}</p>
              <button
                onClick={clearResponse}
                className="mt-1 text-[9px] text-mc-lo hover:text-mc-mid transition-colors"
              >
                clear
              </button>
            </div>
          )}
          {pendingRetune && (
            <div className="mb-2 p-2 border border-mc-lav/30 rounded bg-mc-surface">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-mono tracking-[0.18em] uppercase text-mc-lo">Queue Update Ready</span>
                <button
                  onClick={clearPendingRetune}
                  className="text-mc-lo hover:text-mc-mid transition-colors text-[13px] leading-none"
                  aria-label="Dismiss retune"
                >×</button>
              </div>
              {pendingRetune.changedTrackTitles?.length > 0 && (
                <p className="text-[9px] text-mc-lo mb-2 leading-relaxed">
                  Changed: {pendingRetune.changedTrackTitles.slice(0, 3).join(', ')}
                  {pendingRetune.changedTrackTitles.length > 3 && ` +${pendingRetune.changedTrackTitles.length - 3} more`}
                </p>
              )}
              <button
                onClick={() => applyRetune(pendingRetune)}
                className="text-[10px] font-bold text-mc-lav border border-mc-lav/40 rounded px-2.5 py-1 hover:bg-mc-lav hover:text-mc-bg transition-colors"
              >
                ▶ Apply Retune
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitAsk(); }}
              placeholder="Ask DJ MOOC..."
              className="flex-1 bg-mc-surface border border-mc-border rounded px-2 py-1.5 text-[11px] text-mc-hi placeholder:text-mc-mid focus:outline-none focus:border-mc-lav transition-colors"
            />
            <button
              onClick={submitAsk}
              disabled={loading || !inputValue.trim()}
              className="px-2 py-1.5 border border-mc-border rounded text-mc-lo hover:text-mc-hi hover:border-mc-mid transition-colors disabled:opacity-35"
            >
              {loading ? '···' : '→'}
            </button>
          </div>
        </div>
      )}

      {/* Theme picker */}
      <div className="px-4 py-2 flex items-center gap-3 select-none">
        <span className="text-[9px] text-mc-mid font-mono tracking-[0.1em] uppercase">Theme</span>
        <div className="flex gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key, true)}
              title={t.key}
              className={`w-6 h-6 rounded border text-[10px] transition-colors ${
                theme === t.key
                  ? 'border-mc-lav text-mc-lav bg-mc-surface'
                  : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-hi'
              }`}
            >
              {t.glyph}
            </button>
          ))}
          <button
            onClick={() => setTheme(autoTheme(), false)}
            title="auto (time-of-day)"
            className="w-6 h-6 rounded border border-mc-border text-[9px] text-mc-lo hover:border-mc-mid hover:text-mc-hi transition-colors font-mono"
          >
            A
          </button>
        </div>
      </div>

      {/* Voice + ambient settings tray (collapsed by default). */}
      <MoocSettingsPanel />
    </div>
  );
}
