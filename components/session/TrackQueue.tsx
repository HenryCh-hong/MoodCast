'use client';

import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
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
   * When provided, each playable row becomes a "play from this track"
   * action. The session page wires this up to playFromRowIndex(i), which
   * translates the raw row index to a playable index and POSTs to
   * /api/playback/start. Omit on session pages where the user can't play
   * (free tier, no device) — playable rows fall back to a static display.
   * Unplayable rows stay interactive in either mode so the user can still
   * see the "why" + open the track in another service.
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

const UNPLAYABLE_TOOLTIP =
  'This track could not be matched to a playable Spotify track.';
const UNPLAYABLE_EXPLANATION =
  'This track is not playable on Spotify. Try regenerating with Spotify connected, or open it in another service.';

// Pure URL builders for "search this track on …". These mirror
// lib/music/providers/{spotify,qqmusic,netease}.ts so the chip actions stay
// honest about what each link does (search/open, never playback).
function spotifySearchUrl(title: string, artist: string): string {
  const q = `${title} ${artist}`.trim();
  return `https://open.spotify.com/search/${encodeURIComponent(q)}`;
}
function qqMusicSearchUrl(title: string, artist: string): string {
  const q = `${title} ${artist}`.trim();
  return `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(q)}`;
}
function neteaseSearchUrl(title: string, artist: string): string {
  const q = `${title} ${artist}`.trim();
  return `https://music.163.com/#/search/m/?s=${encodeURIComponent(q)}`;
}

interface UnplayableActionsProps {
  title: string;
  artist: string;
}

function UnplayableActions({ title, artist }: UnplayableActionsProps) {
  const [copied, setCopied] = useState(false);

  async function copyTitleArtist(): Promise<void> {
    const text = `${title} — ${artist}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Older browser fallback — best effort, don't error on read-only.
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore — UI just doesn't flash "copied" */
    }
  }

  const linkClass =
    'inline-block px-2 py-1 rounded border border-mc-border text-[10px] font-bold tracking-tight text-mc-mid hover:text-mc-hi hover:border-mc-lav/40 transition-colors';

  return (
    <div
      role="region"
      aria-label="Unplayable track actions"
      className="mt-2 ml-12 mr-2 border-l-2 border-mc-onair/40 pl-3 py-2"
    >
      <p className="text-[11px] font-bold tracking-tight text-mc-mid mb-2">
        {UNPLAYABLE_EXPLANATION}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyTitleArtist()}
          className={linkClass}
          aria-live="polite"
        >
          {copied ? 'Copied' : 'Copy title + artist'}
        </button>
        <a
          href={spotifySearchUrl(title, artist)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Search on Spotify
        </a>
        <a
          href={qqMusicSearchUrl(title, artist)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Search on QQ Music
        </a>
        <a
          href={neteaseSearchUrl(title, artist)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Search on NetEase Cloud Music
        </a>
      </div>
      <p className="mt-2 text-[9px] font-mono tracking-[0.12em] text-mc-dim">
        QQ Music / NetEase links open the provider site for search — Moodcast
        does not play those services in-app.
      </p>
    </div>
  );
}

export function TrackQueue({
  tracks,
  sessionIndex,
  onPlayTrack,
  playbackPending,
  sessionId,
}: TrackQueueProps) {
  const mapping = useMemo(() => buildSessionQueueMapping(tracks), [tracks]);
  const { verdictFor, toggle: toggleFeedback } = useFeedback();
  const [unplayableExpanded, setUnplayableExpanded] = useState<number | null>(null);

  // NOW row is the raw index of the current playable position. NEXT row is
  // the raw index of (sessionIndex + 1). Both come from the canonical
  // mapping so the visible labels always agree with what Spotify will
  // actually play next from the sanitized queue. Crucially: NEXT will never
  // land on an unplayable row because it's derived from the playable index.
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
          const isPlayable = isValidSpotifyTrackUri(track.uri ?? '');
          const canPlayHere = typeof onPlayTrack === 'function' && isPlayable;
          const verdict = verdictFor(track);
          const isExpanded = unplayableExpanded === i;

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
              <p
                className={cn(
                  'text-[13px] font-bold tracking-tight truncate',
                  isPlayable ? 'text-mc-hi' : 'text-mc-mid line-through decoration-mc-dim/50',
                )}
              >
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
                {!isPlayable && (
                  <>
                    <span className="text-[9px] text-mc-dim/40">·</span>
                    <span
                      className="text-[9px] font-bold tracking-[0.12em] uppercase text-mc-onair/90 border border-mc-onair/30 rounded px-1.5 py-0.5"
                      title={UNPLAYABLE_TOOLTIP}
                    >
                      Not playable
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

          // Row container — always a div so the feedback buttons can be real
          // <button>s without nesting (invalid HTML and a screen-reader trap).
          // The clickable region depends on play vs unplayable:
          //   - playable + onPlayTrack defined → button calls onPlayTrack(i)
          //   - playable + no onPlayTrack       → static text (free tier)
          //   - unplayable                      → button toggles inline expansion
          //                                       (works regardless of onPlayTrack
          //                                        so free tier still gets the
          //                                        explanation + search actions)
          const rowInteractiveClass = canPlayHere
            ? 'hover:bg-mc-elevated/40'
            : !isPlayable
              ? 'hover:bg-mc-elevated/20'
              : '';

          return (
            <div
              key={i}
              className={cn(
                'group rounded transition-colors',
                opacity,
                rowInteractiveClass,
              )}
            >
              <div className="flex items-start gap-4 w-full text-left px-1 -mx-1 py-0.5">
                <span
                  className={cn(
                    'text-[9px] font-bold tracking-[0.15em] w-12 shrink-0 pt-0.5',
                    isNow ? 'text-mc-lav' : 'text-mc-lo',
                  )}
                >
                  {label}
                </span>
                {canPlayHere ? (
                  <button
                    type="button"
                    onClick={() => onPlayTrack!(i)}
                    disabled={playbackPending}
                    aria-label={`Play track ${i + 1}: ${track.title} by ${track.artist}`}
                    className="flex-1 min-w-0 text-left focus:outline-none focus:ring-1 focus:ring-mc-lav rounded disabled:cursor-progress"
                  >
                    {meta}
                  </button>
                ) : !isPlayable ? (
                  <button
                    type="button"
                    onClick={() => setUnplayableExpanded(isExpanded ? null : i)}
                    aria-expanded={isExpanded}
                    aria-label={`Track ${i + 1} is not playable on Spotify — click for options`}
                    title={UNPLAYABLE_TOOLTIP}
                    className="flex-1 min-w-0 text-left focus:outline-none focus:ring-1 focus:ring-mc-onair/60 rounded cursor-help"
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
                  {isPlayable ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'text-[14px] leading-none transition-opacity',
                        isNow ? 'text-mc-lav opacity-100' : 'text-mc-mid opacity-0 group-hover:opacity-100',
                      )}
                    >
                      ▶
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="text-[14px] leading-none text-mc-onair/60 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {isExpanded ? '▾' : '▸'}
                    </span>
                  )}
                </div>
              </div>
              {!isPlayable && isExpanded && (
                <UnplayableActions title={track.title} artist={track.artist} />
              )}
            </div>
          );
        })}
      </div>
      {onPlayTrack && (
        <p className="mt-3 text-[9px] font-mono text-mc-dim tracking-[0.12em]">
          Click any track to play from there. Greyed-out rows aren’t available on Spotify.
        </p>
      )}
    </div>
  );
}
