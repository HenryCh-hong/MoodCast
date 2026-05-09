import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import type { Track } from '@/lib/types/moodcast';
import {
  buildSessionQueueMapping,
  playableToRawIndex,
} from '@/lib/session/queueMapping';
import { isValidSpotifyTrackUri } from '@/lib/spotify/uris';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { FeedbackButtons } from '@/components/feedback/FeedbackButtons';

interface TrackQueueProps {
  tracks: Track[];
  /**
   * Current playable-index in the session queue. Source of truth for which
   * row is NOW and which is NEXT — supplied by MoodcastContext, not
   * inferred from `track.uri === currentUri` (which is wrong on duplicate
   * URIs and unreliable when a row has no URI).
   */
  sessionIndex?: number | null;
  /**
   * When provided, each row becomes a "play from this track" action.
   * The session page wires this up to playFromRowIndex(i), which translates
   * the raw row index to a playable index and POSTs to /api/playback/start.
   * Omit on session pages where the user can't play — rows fall back to a
   * static display.
   */
  onPlayTrack?: (index: number) => void;
  playbackPending?: boolean;
  /** Optional id of the playing session — recorded with each feedback entry. */
  sessionId?: string;
}

const FAMILIARITY_LABEL: Record<NonNullable<Track['familiarityLevel']>, string> = {
  familiar: 'familiar',
  fresh: 'fresh',
  discovery: 'discovery',
};

export function TrackQueue({ tracks, sessionIndex, onPlayTrack, playbackPending, sessionId }: TrackQueueProps) {
  const mapping = useMemo(() => buildSessionQueueMapping(tracks), [tracks]);
  const { verdictFor, toggle: toggleFeedback } = useFeedback();

  // NOW row is the raw index of the current playable position. NEXT row is
  // the raw index of (sessionIndex + 1). Both come from the canonical
  // mapping so the visible labels always agree with what Spotify will
  // actually play next from the sanitized queue.
  //
  // When sessionIndex is null (no playback yet), we default NOW to the
  // first playable row so the queue still has a sensible head. NEXT is
  // simply the next playable row after NOW.
  const nowPlayableIndex = typeof sessionIndex === 'number' ? sessionIndex : 0;
  const nowRawIndex = playableToRawIndex(mapping, nowPlayableIndex);
  const nextRawIndex = playableToRawIndex(mapping, nowPlayableIndex + 1);

  return (
    <div className="mb-6">
      <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo mb-4">Track Queue</p>
      <div className="space-y-3">
        {tracks.map((track, i) => {
          const isNow = i === nowRawIndex;
          const isNext = !isNow && i === nextRawIndex;
          const label = isNow ? 'NOW' : isNext ? 'NEXT' : `CUE ${i + 1}`;
          const opacity = isNow ? '' : isNext ? 'opacity-65' : 'opacity-40';
          const playable =
            typeof onPlayTrack === 'function' && isValidSpotifyTrackUri(track.uri ?? '');
          const verdict = verdictFor(track);

          const meta = (
            <>
              {track.transitionLine && i > 0 && (
                <p
                  className={cn(
                    'text-[10px] font-bold tracking-tight mb-1',
                    isNow ? 'text-mc-lo' : 'text-mc-dim',
                  )}
                >
                  ↳ {track.transitionLine}
                </p>
              )}
              <p className="text-[13px] font-bold tracking-tight text-mc-hi truncate">
                {track.title}
              </p>
              <p className="text-[11px] font-bold tracking-tight text-mc-lo">{track.artist}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {track.moodTag && (
                  <span className="text-[9px] font-bold tracking-tight text-mc-dim">
                    {track.moodTag}
                  </span>
                )}
                {track.familiarityLevel && (
                  <>
                    <span className="text-[9px] text-mc-dim/40">·</span>
                    <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-mc-lav/80 border border-mc-border rounded px-1.5 py-0.5">
                      {FAMILIARITY_LABEL[track.familiarityLevel]}
                    </span>
                  </>
                )}
              </div>
              {track.whyThisSourceFits && (
                <p
                  className={cn(
                    'text-[10px] font-bold tracking-tight mt-1 italic text-mc-dim',
                  )}
                >
                  {track.whyThisSourceFits}
                </p>
              )}
            </>
          );

          // Use a div as the row container so the feedback buttons can be
          // real <button>s without being nested inside another <button>
          // (invalid HTML and a screen-reader trap). Play-on-click sits on
          // an inner button covering the text column only.
          return (
            <div
              key={i}
              className={cn(
                'group flex items-start gap-4 w-full text-left rounded px-1 -mx-1 py-0.5 transition-colors',
                opacity,
                playable && 'hover:bg-mc-elevated/40',
              )}
            >
              <span
                className={cn(
                  'text-[9px] font-bold tracking-[0.15em] w-12 shrink-0 pt-0.5',
                  isNow ? 'text-mc-lav' : 'text-mc-lo',
                )}
              >
                {label}
              </span>
              {playable ? (
                <button
                  type="button"
                  onClick={() => onPlayTrack!(i)}
                  disabled={playbackPending}
                  aria-label={`Play track ${i + 1}: ${track.title} by ${track.artist}`}
                  className="flex-1 min-w-0 text-left focus:outline-none focus:ring-1 focus:ring-mc-lav rounded disabled:cursor-progress"
                >
                  {meta}
                </button>
              ) : (
                <div className="flex-1 min-w-0">{meta}</div>
              )}
              <div className="shrink-0 flex items-center gap-2 pt-0.5">
                <FeedbackButtons
                  track={track}
                  verdict={verdict}
                  onToggle={(v) => toggleFeedback(track, v, sessionId)}
                />
                {playable && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'text-[14px] leading-none transition-opacity',
                      isNow ? 'text-mc-lav opacity-100' : 'text-mc-mid opacity-0 group-hover:opacity-100',
                    )}
                  >
                    ▶
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {onPlayTrack && (
        <p className="mt-3 text-[9px] font-mono text-mc-dim tracking-[0.12em]">
          Click any track to play from there.
        </p>
      )}
    </div>
  );
}
