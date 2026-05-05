'use client';

import { useMoodcast } from '@/lib/context/MoodcastContext';

export function NavDJController() {
  const { currentSession, playerState, djStatus, setCompanionOpen } = useMoodcast();

  if (!currentSession) return null;

  const track = playerState?.track_window?.current_track;

  return (
    <button
      onClick={() => setCompanionOpen(true)}
      className="hidden md:flex items-center gap-2.5 text-[10px] font-bold tracking-tight text-mc-dim hover:text-mc-mid transition-colors border-l border-mc-border pl-4"
      aria-label="Open DJ companion"
    >
      <span className={`w-1 h-1 rounded-full bg-mc-onair flex-shrink-0 ${djStatus !== 'idle' ? 'animate-breathe' : 'opacity-30'}`} />
      <span className="max-w-[120px] truncate text-mc-lo">{currentSession.sessionTitle}</span>
      {track && (
        <>
          <span className="text-mc-dim">·</span>
          <span className="max-w-[140px] truncate">{track.name}</span>
        </>
      )}
    </button>
  );
}
