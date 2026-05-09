// CLI-side feedback bridge.
//
// Wraps lib/feedback/feedbackStore so the dashboard, shell commands, and
// one-shot CLI commands all share one code path and one on-disk file.
// Web and CLI write through the SAME ~/.moodcast/feedback.json file —
// there is no terminal-only feedback store.

import {
  upsertFeedback,
  clearFeedback,
  readFeedback,
  type FeedbackVerdict,
  type FeedbackRecord,
} from '../lib/feedback/feedbackStore.js';
import type { Track } from '../lib/types/moodcast.js';

export type FeedbackAction = FeedbackVerdict | 'clear';

export interface FeedbackResult {
  ok: boolean;
  /** Human-readable line for toast / shell output. */
  message: string;
  /** Whether disk state changed. (clear-on-empty is a successful no-op.) */
  changed: boolean;
  record?: FeedbackRecord;
}

/**
 * Map a Track from a MoodcastSession to a feedback verdict already on disk,
 * if any. Match policy mirrors feedbackStore.trackKey: prefer Spotify URI,
 * fall back to title|artist.
 */
export function getVerdictForTrack(track: Track): FeedbackVerdict | 'none' {
  const uri = track.uri;
  const titleKey = `${track.title.toLowerCase().trim()}|${track.artist.toLowerCase().trim()}`;
  for (const r of readFeedback()) {
    if (uri && r.trackUri && r.trackUri === uri) return r.feedback;
    if (!r.trackUri) {
      const k = `${r.title.toLowerCase().trim()}|${r.artist.toLowerCase().trim()}`;
      if (k === titleKey) return r.feedback;
    } else if (!uri) {
      // Track has no URI — fall back to title|artist match against all rows.
      const k = `${r.title.toLowerCase().trim()}|${r.artist.toLowerCase().trim()}`;
      if (k === titleKey) return r.feedback;
    }
  }
  return 'none';
}

/**
 * Apply a verdict (or clear) to a known Moodcast Track. Pure wrapper around
 * feedbackStore — no Spotify calls, no active-session reads.
 */
export function applyFeedbackForTrack(opts: {
  track: Track;
  verdict: FeedbackAction;
  sessionId?: string;
}): FeedbackResult {
  const { track, verdict, sessionId } = opts;

  if (!track.title || !track.artist) {
    return { ok: false, message: 'Track is missing title or artist.', changed: false };
  }

  if (verdict === 'clear') {
    const removed = clearFeedback({
      trackUri: track.uri,
      title: track.title,
      artist: track.artist,
    });
    return {
      ok: true,
      changed: removed,
      message: removed ? 'Feedback cleared' : 'No feedback to clear',
    };
  }

  const record = upsertFeedback({
    trackUri: track.uri,
    title: track.title,
    artist: track.artist,
    feedback: verdict,
    sourceIntent: track.sourceIntent,
    familiarityLevel: track.familiarityLevel,
    sessionId,
  });
  return {
    ok: true,
    changed: true,
    record,
    message: verdict === 'like' ? 'Liked this track' : 'Disliked this track',
  };
}
