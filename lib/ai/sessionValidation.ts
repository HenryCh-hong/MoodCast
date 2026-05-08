// Post-generation diagnostics for a MoodcastSession.
// Pure functions — no I/O. Callers (CLI + web API route) decide what to log
// and whether to regenerate once.

import type { MoodcastSession, TrackSourceIntent } from '@/lib/types/moodcast';
import type { DiscoveryDial } from '@/lib/types/momentContext';

export interface SourceIntentSummary {
  total: number;
  byIntent: Record<TrackSourceIntent | 'unknown', number>;
  familiarAnchorRatio: number;     // 0..1
  missingSourceIntent: number;     // tracks where the AI omitted sourceIntent
  missingFamiliarityLevel: number;
}

const ALL_INTENTS: TrackSourceIntent[] = [
  'familiar_anchor',
  'same_artist_fresh',
  'adjacent_artist',
  'contextual_discovery',
  'user_seed',
];

export function summarizeSourceIntent(session: MoodcastSession): SourceIntentSummary {
  const byIntent: Record<string, number> = { unknown: 0 };
  for (const i of ALL_INTENTS) byIntent[i] = 0;

  let missingSourceIntent = 0;
  let missingFamiliarityLevel = 0;

  for (const t of session.tracks) {
    if (!t.sourceIntent) {
      missingSourceIntent += 1;
      byIntent.unknown += 1;
    } else {
      byIntent[t.sourceIntent] = (byIntent[t.sourceIntent] ?? 0) + 1;
    }
    if (!t.familiarityLevel) missingFamiliarityLevel += 1;
  }

  const total = session.tracks.length;
  const familiarAnchorRatio = total > 0 ? byIntent.familiar_anchor / total : 0;

  return {
    total,
    byIntent: byIntent as SourceIntentSummary['byIntent'],
    familiarAnchorRatio,
    missingSourceIntent,
    missingFamiliarityLevel,
  };
}

/**
 * Decide whether the first generation leaned too hard on familiar_anchor for the
 * user's chosen dial. Used to trigger a single regenerate-with-stronger-discovery
 * pass. Never recommends regenerating on the 'familiar' dial — there 60%+ anchors
 * is the user's stated intent.
 */
export function shouldRegenerate(
  summary: SourceIntentSummary,
  dial: DiscoveryDial,
): boolean {
  if (summary.total < 4) return false;       // too short to evaluate fairly
  if (dial === 'familiar') return false;     // user asked for it
  return summary.familiarAnchorRatio > 0.6;
}

/**
 * Short human-readable line for dev logging. No PII, no LLM output included.
 */
export function describeIntentSummary(s: SourceIntentSummary): string {
  const pct = (n: number) => `${Math.round((n / Math.max(1, s.total)) * 100)}%`;
  const parts = [
    `anchor ${pct(s.byIntent.familiar_anchor)}`,
    `same_fresh ${pct(s.byIntent.same_artist_fresh)}`,
    `adjacent ${pct(s.byIntent.adjacent_artist)}`,
    `discovery ${pct(s.byIntent.contextual_discovery)}`,
  ];
  if (s.missingSourceIntent > 0) parts.push(`missingIntent=${s.missingSourceIntent}`);
  return `[sourceIntent] total=${s.total} ${parts.join(' / ')}`;
}

/** Stronger regenerate-time directive for buildUserPrompt({ extraInstruction }). */
export function regenerateInstruction(dial: DiscoveryDial): string {
  if (dial === 'discover') {
    return [
      'REGENERATION NOTE:',
      'The previous session was overweighted on familiar_anchor. Cut the anchors to no more than',
      '15% of tracks. Lead with adjacent_artist and contextual_discovery. The user explicitly chose discover.',
    ].join(' ');
  }
  return [
    'REGENERATION NOTE:',
    'The previous attempt was too close to a top-tracks replay. Drop familiar_anchor to about 25–35% and',
    'rebalance toward same_artist_fresh, adjacent_artist, and contextual_discovery so the session feels',
    'like an AI radio show, not a saved playlist.',
  ].join(' ');
}
