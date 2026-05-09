// Soft post-resolution filter: if a generated session ended up containing
// the exact URI of a disliked track, blank that row's URI so the playback
// queue won't include it. We don't drop the row entirely — that would shift
// the canonical queue mapping mid-flight and the spec requires this be a
// "do not repeat exact disliked tracks" rule, not "remove the slot from the
// session arc". The next regeneration / retune is responsible for actually
// replacing the slot.
//
// The aim is gentle. We never:
//   • ban an entire artist
//   • drop tracks based on the LLM's own claims about them
//   • mutate the user's session library (the live queue is always
//     reconstructed from the playable URI list, not from disk)

import type { MoodcastSession } from '@/lib/types/moodcast';
import type { FeedbackRecord } from './feedbackStore';
import { getDislikedUriSet } from './aggregate';

export interface FeedbackFilterResult {
  session: MoodcastSession;
  blocked: number;
}

export function filterDislikedExactTracks(
  session: MoodcastSession,
  records: FeedbackRecord[],
): FeedbackFilterResult {
  if (!records.length) return { session, blocked: 0 };
  const blockedSet = getDislikedUriSet(records);
  if (blockedSet.size === 0) return { session, blocked: 0 };

  let blocked = 0;
  const tracks = session.tracks.map((t) => {
    if (t.uri && blockedSet.has(t.uri)) {
      blocked += 1;
      return { ...t, uri: '' };
    }
    return t;
  });
  if (blocked === 0) return { session, blocked: 0 };
  return { session: { ...session, tracks }, blocked };
}
