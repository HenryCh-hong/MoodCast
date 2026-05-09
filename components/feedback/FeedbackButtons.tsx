'use client';

import { cn } from '@/lib/utils';
import type { Track } from '@/lib/types/moodcast';
import type { FeedbackVerdict } from '@/lib/feedback/feedbackStore';

type FeedbackTrack = Pick<
  Track,
  'uri' | 'title' | 'artist' | 'sourceIntent' | 'familiarityLevel'
>;

interface FeedbackButtonsProps {
  track: FeedbackTrack;
  verdict: FeedbackVerdict | null;
  onToggle: (verdict: FeedbackVerdict) => void;
  /** Visual size — `sm` is the default queue-row size, `md` is for the now-playing strip. */
  size?: 'sm' | 'md';
  /** Disable while a parent action is pending. */
  disabled?: boolean;
}

/**
 * Two-state pair: 👍 / 👎. Clicking the active state again clears it (undo).
 *
 * The buttons stop click propagation so they can sit inside a play-on-row
 * <button> in TrackQueue without triggering playback.
 */
export function FeedbackButtons({
  track,
  verdict,
  onToggle,
  size = 'sm',
  disabled,
}: FeedbackButtonsProps) {
  const liked = verdict === 'like';
  const disliked = verdict === 'dislike';

  const dim = size === 'sm' ? 'h-5 w-5 text-[11px]' : 'h-6 w-6 text-[13px]';
  const labelPrefix = `Feedback for ${track.title} by ${track.artist}`;

  function press(v: FeedbackVerdict) {
    if (disabled) return;
    onToggle(v);
  }

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={liked}
        aria-label={liked ? `${labelPrefix}: clear like` : `${labelPrefix}: like`}
        title={liked ? 'Liked — click to undo' : 'Like'}
        onClick={() => press('like')}
        className={cn(
          'rounded border flex items-center justify-center transition-colors',
          dim,
          liked
            ? 'border-mc-lav/70 text-mc-lav bg-mc-surface'
            : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-hi',
        )}
      >
        ♥
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={disliked}
        aria-label={disliked ? `${labelPrefix}: clear dislike` : `${labelPrefix}: dislike`}
        title={disliked ? 'Disliked — click to undo' : 'Dislike'}
        onClick={() => press('dislike')}
        className={cn(
          'rounded border flex items-center justify-center transition-colors',
          dim,
          disliked
            ? 'border-mc-onair/70 text-mc-onair bg-mc-surface'
            : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-hi',
        )}
      >
        ⊘
      </button>
    </div>
  );
}
