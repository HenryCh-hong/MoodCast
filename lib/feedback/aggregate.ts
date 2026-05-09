// Aggregation layer over FeedbackRecord[]. Produces:
//   • prompt-safe summary text for the LLM
//   • structured signals the URI-resolution layer can use to filter / boost
//
// The summary intentionally avoids leaking exact disliked track titles into
// the prompt — the LLM doesn't need to "know" the dislike list, only the
// shape of the user's preference. Exact-track avoidance is enforced
// downstream by `getDislikedUriSet()` (consumed by the resolver).

import type {
  FeedbackRecord,
  FeedbackVerdict,
} from './feedbackStore';
import type {
  TrackSourceIntent,
} from '@/lib/types/moodcast';

export interface FeedbackSummary {
  /** True when the user has at least one record of either verdict. */
  hasFeedback: boolean;

  likedArtists: string[];
  dislikedArtists: string[];

  /** sourceIntent values the user has liked at least once. */
  likedSourceIntents: TrackSourceIntent[];
  /** sourceIntent values the user has disliked at least once. */
  dislikedSourceIntents: TrackSourceIntent[];

  /** Spotify URIs of disliked tracks — exact-track avoidance keyset. */
  dislikedTrackUris: string[];

  /** "title|artist" keys for disliked rows that have no Spotify URI. */
  dislikedNonSpotifyKeys: string[];

  totals: {
    likes: number;
    dislikes: number;
  };

  /** A short multi-line summary safe to embed in the prompt. */
  promptSummary: string;
}

const ARTIST_REPEAT_DISLIKE_THRESHOLD = 2;

function bucketArtists(records: FeedbackRecord[], verdict: FeedbackVerdict): string[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.feedback !== verdict) continue;
    const a = (r.artist || '').trim();
    if (!a) continue;
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.map(([artist]) => artist);
}

function uniqueIntents(records: FeedbackRecord[], verdict: FeedbackVerdict): TrackSourceIntent[] {
  const seen = new Set<TrackSourceIntent>();
  for (const r of records) {
    if (r.feedback !== verdict) continue;
    if (r.sourceIntent) seen.add(r.sourceIntent);
  }
  return [...seen];
}

function recentSummaryLine(records: FeedbackRecord[]): string {
  const sorted = [...records].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  if (sorted.length === 0) return '';
  const tally = sorted.reduce(
    (acc, r) => {
      if (r.feedback === 'like') acc.likes += 1;
      else acc.dislikes += 1;
      return acc;
    },
    { likes: 0, dislikes: 0 },
  );
  return `Last ${sorted.length} marks: ${tally.likes} like / ${tally.dislikes} dislike`;
}

export function summarizeFeedback(records: FeedbackRecord[]): FeedbackSummary {
  const likedArtists = bucketArtists(records, 'like');
  const dislikedArtists = bucketArtists(records, 'dislike');

  // "Repeated dislike" — only artists with ≥2 dislikes are surfaced as a
  // soft signal in the prompt. One dislike on a single track is not enough
  // to ban an artist (per the spec).
  const dislikedArtistCounts = new Map<string, number>();
  for (const r of records) {
    if (r.feedback !== 'dislike') continue;
    const a = (r.artist || '').trim();
    if (!a) continue;
    dislikedArtistCounts.set(a, (dislikedArtistCounts.get(a) ?? 0) + 1);
  }
  const repeatedDislikedArtists = [...dislikedArtistCounts.entries()]
    .filter(([, n]) => n >= ARTIST_REPEAT_DISLIKE_THRESHOLD)
    .map(([a]) => a);

  const likedIntents = uniqueIntents(records, 'like');
  const dislikedIntents = uniqueIntents(records, 'dislike');

  const dislikedTrackUris = [
    ...new Set(
      records
        .filter((r) => r.feedback === 'dislike' && r.trackUri && r.trackUri.startsWith('spotify:track:'))
        .map((r) => r.trackUri as string),
    ),
  ];
  const dislikedNonSpotifyKeys = [
    ...new Set(
      records
        .filter((r) => r.feedback === 'dislike' && !r.trackUri)
        .map((r) => `${(r.title || '').toLowerCase().trim()}|${(r.artist || '').toLowerCase().trim()}`)
        .filter((k) => k !== '|'),
    ),
  ];

  const likes = records.filter((r) => r.feedback === 'like').length;
  const dislikes = records.length - likes;

  const summaryLines: string[] = [];
  if (likedArtists.length) {
    summaryLines.push(`Tends to like: ${likedArtists.slice(0, 6).join(', ')}`);
  }
  if (repeatedDislikedArtists.length) {
    summaryLines.push(`Repeated avoid: ${repeatedDislikedArtists.slice(0, 4).join(', ')}`);
  }
  if (likedIntents.length) {
    summaryLines.push(`Liked source intents: ${likedIntents.join(', ')}`);
  }
  if (dislikedIntents.length) {
    summaryLines.push(`Avoided source intents: ${dislikedIntents.join(', ')}`);
  }
  if (dislikedTrackUris.length) {
    summaryLines.push(`Do not repeat exact disliked tracks (count: ${dislikedTrackUris.length}).`);
  }
  const recent = recentSummaryLine(records);
  if (recent) summaryLines.push(recent);

  const promptSummary = summaryLines.length === 0 ? '' : summaryLines.join('\n');

  return {
    hasFeedback: records.length > 0,
    likedArtists,
    dislikedArtists,
    likedSourceIntents: likedIntents,
    dislikedSourceIntents: dislikedIntents,
    dislikedTrackUris,
    dislikedNonSpotifyKeys,
    totals: { likes, dislikes },
    promptSummary,
  };
}

/** Convenience: build the summary directly from disk. */
export async function loadFeedbackSummary(): Promise<FeedbackSummary> {
  // Imported lazily so client-only bundles don't pull in fs — feedbackStore
  // is a server module; aggregate.ts itself is pure and is re-exported via
  // the API route layer for the browser.
  const { readFeedback } = await import('./feedbackStore');
  return summarizeFeedback(readFeedback());
}

/** Hot-path helper for the resolver — set membership, no allocation. */
export function getDislikedUriSet(records: FeedbackRecord[]): Set<string> {
  return new Set(
    records
      .filter((r) => r.feedback === 'dislike' && r.trackUri && r.trackUri.startsWith('spotify:track:'))
      .map((r) => r.trackUri as string),
  );
}
