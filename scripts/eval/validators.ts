// Validators for the eval harness. Pure functions: take a scenario + a
// generated session, return a list of pass/fail findings. The runner
// aggregates results and reports them.
//
// Each validator is independent — failures in one don't short-circuit others,
// so a single eval run surfaces every issue at once.

import type { MoodcastSession, Track, TrackSourceIntent } from '../../lib/types/moodcast';
import type { DiscoveryDial } from '../../lib/types/momentContext';
import {
  type EvalScenario,
  type SourceIntentBounds,
  DIAL_DEFAULT_BOUNDS,
} from './scenarios';

export type FindingSeverity = 'pass' | 'fail' | 'warn';

export interface Finding {
  validator: string;
  severity: FindingSeverity;
  message: string;
}

const VALID_INTENTS: TrackSourceIntent[] = [
  'familiar_anchor',
  'same_artist_fresh',
  'adjacent_artist',
  'contextual_discovery',
  'user_seed',
];

const VALID_ENERGY = new Set(['low', 'medium', 'high']);
const VALID_FAMILIARITY = new Set(['familiar', 'fresh', 'discovery']);

// ─── Schema ───────────────────────────────────────────────────────────────

export function validateSchema(session: MoodcastSession): Finding[] {
  const findings: Finding[] = [];
  const required: Array<keyof MoodcastSession> = [
    'sessionTitle', 'mood', 'activity', 'energyArc',
    'openingMonologue', 'endingMessage',
  ];
  for (const key of required) {
    const value = session[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      findings.push({
        validator: 'schema',
        severity: 'fail',
        message: `top-level "${String(key)}" missing or empty`,
      });
    }
  }
  if (!Array.isArray(session.tracks) || session.tracks.length === 0) {
    findings.push({ validator: 'schema', severity: 'fail', message: 'tracks array empty' });
    return findings;
  }

  session.tracks.forEach((t, i) => {
    if (!t.title || !t.artist) {
      findings.push({
        validator: 'schema',
        severity: 'fail',
        message: `track[${i}] missing title or artist`,
      });
    }
    if (!VALID_ENERGY.has(t.energy)) {
      findings.push({
        validator: 'schema',
        severity: 'fail',
        message: `track[${i}] invalid energy "${t.energy}"`,
      });
    }
    if (t.sourceIntent && !VALID_INTENTS.includes(t.sourceIntent)) {
      findings.push({
        validator: 'schema',
        severity: 'fail',
        message: `track[${i}] invalid sourceIntent "${t.sourceIntent}"`,
      });
    }
    if (t.familiarityLevel && !VALID_FAMILIARITY.has(t.familiarityLevel)) {
      findings.push({
        validator: 'schema',
        severity: 'fail',
        message: `track[${i}] invalid familiarityLevel "${t.familiarityLevel}"`,
      });
    }
  });

  // Source intent must be present on every track for distribution checks to be meaningful.
  const missing = session.tracks.filter((t) => !t.sourceIntent).length;
  if (missing > 0) {
    findings.push({
      validator: 'schema',
      severity: missing === session.tracks.length ? 'fail' : 'warn',
      message: `${missing}/${session.tracks.length} tracks missing sourceIntent`,
    });
  }

  if (findings.length === 0) {
    findings.push({ validator: 'schema', severity: 'pass', message: 'schema OK' });
  }
  return findings;
}

// ─── Track count ──────────────────────────────────────────────────────────

export function validateTrackCount(scenario: EvalScenario, session: MoodcastSession): Finding[] {
  const expected = scenario.expectations.trackCount;
  if (!expected) return [];
  const got = session.tracks.length;
  if (got < expected.min || got > expected.max) {
    return [{
      validator: 'track-count',
      severity: 'fail',
      message: `expected ${expected.min}–${expected.max} tracks, got ${got}`,
    }];
  }
  return [{
    validator: 'track-count',
    severity: 'pass',
    message: `${got} tracks (in [${expected.min}, ${expected.max}])`,
  }];
}

// ─── Source-intent distribution ───────────────────────────────────────────

export function validateSourceIntentDistribution(
  scenario: EvalScenario,
  session: MoodcastSession,
): Finding[] {
  if (scenario.expectations.skipDistribution) return [];
  const dial: DiscoveryDial =
    scenario.input.discoveryDial
    ?? scenario.input.momentContext?.discoveryRecommendation
    ?? 'balanced';

  const defaultBounds = DIAL_DEFAULT_BOUNDS[dial];
  const bounds: SourceIntentBounds = {
    ...defaultBounds,
    ...scenario.expectations.sourceIntentBounds,
  };

  const tracks = session.tracks.filter((t) => !!t.sourceIntent);
  if (tracks.length === 0) {
    return [{
      validator: 'distribution',
      severity: 'fail',
      message: 'no tracks have sourceIntent — cannot check distribution',
    }];
  }

  const counts: Record<string, number> = {};
  for (const t of tracks) {
    counts[t.sourceIntent!] = (counts[t.sourceIntent!] ?? 0) + 1;
  }

  const findings: Finding[] = [];
  const total = tracks.length;

  for (const intent of VALID_INTENTS) {
    const bound = bounds[intent];
    if (!bound) continue;
    const proportion = (counts[intent] ?? 0) / total;
    const [lo, hi] = bound;
    if (proportion < lo || proportion > hi) {
      findings.push({
        validator: 'distribution',
        severity: 'fail',
        message: `${intent}=${(proportion * 100).toFixed(0)}% outside [${(lo * 100).toFixed(0)}, ${(hi * 100).toFixed(0)}]% (dial=${dial})`,
      });
    }
  }

  // Hard rule from prompt: "even on familiar, at least 2 non-anchor tracks".
  if (dial === 'familiar') {
    const nonAnchor = total - (counts['familiar_anchor'] ?? 0);
    if (nonAnchor < 2) {
      findings.push({
        validator: 'distribution',
        severity: 'fail',
        message: `familiar dial returned only ${nonAnchor} non-anchor track(s); prompt requires ≥2`,
      });
    }
  }

  if (findings.length === 0) {
    const summary = VALID_INTENTS
      .map((i) => `${i.split('_')[0]}=${counts[i] ?? 0}`)
      .join(' ');
    findings.push({
      validator: 'distribution',
      severity: 'pass',
      message: `${dial}: ${summary}`,
    });
  }
  return findings;
}

// ─── Replay leakage ───────────────────────────────────────────────────────

function trackKey(t: Pick<Track, 'title' | 'artist'>): string {
  return `${t.title.toLowerCase().trim()}|${t.artist.toLowerCase().trim()}`;
}

export function validateReplayLeakage(scenario: EvalScenario, session: MoodcastSession): Finding[] {
  const tasteProfile = scenario.input.tasteProfile;
  const max = scenario.expectations.maxReplayLeakage;
  if (!tasteProfile || max === undefined) return [];

  const knownKeys = new Set([
    ...tasteProfile.topTracks.map(trackKey),
    ...tasteProfile.recentTracks.map(trackKey),
  ]);
  const knownUris = new Set([
    ...tasteProfile.topTracks.map((t) => t.uri),
    ...tasteProfile.recentTracks.map((t) => t.uri),
  ].filter(Boolean));

  // A "leak" is a track that exactly matches a known top/recent track but is
  // NOT marked as familiar_anchor or user_seed — meaning the AI replayed
  // taste while claiming the track is fresh/discovery.
  const leaks: string[] = [];
  for (const t of session.tracks) {
    const matchesByKey = knownKeys.has(trackKey(t));
    const matchesByUri = !!t.uri && knownUris.has(t.uri);
    if (!matchesByKey && !matchesByUri) continue;
    const intent = t.sourceIntent;
    if (intent !== 'familiar_anchor' && intent !== 'user_seed') {
      leaks.push(`"${t.title}" by ${t.artist} (intent=${intent ?? 'none'})`);
    }
  }

  const proportion = leaks.length / session.tracks.length;
  if (proportion > max) {
    return [{
      validator: 'replay-leakage',
      severity: 'fail',
      message: `${leaks.length}/${session.tracks.length} (${(proportion * 100).toFixed(0)}%) replay leaks > max ${(max * 100).toFixed(0)}%; first: ${leaks.slice(0, 3).join('; ')}`,
    }];
  }
  return [{
    validator: 'replay-leakage',
    severity: 'pass',
    message: `${leaks.length}/${session.tracks.length} replay leaks (≤ ${(max * 100).toFixed(0)}%)`,
  }];
}

// ─── Context alignment ────────────────────────────────────────────────────

export function validateContextAlignment(scenario: EvalScenario, session: MoodcastSession): Finding[] {
  const findings: Finding[] = [];

  const moodKeywords = scenario.expectations.moodKeywords;
  if (moodKeywords && moodKeywords.length > 0) {
    const moodLower = (session.mood ?? '').toLowerCase();
    const matched = moodKeywords.find((kw) => moodLower.includes(kw.toLowerCase()));
    findings.push(matched
      ? { validator: 'context', severity: 'pass', message: `mood "${session.mood}" matches "${matched}"` }
      : { validator: 'context', severity: 'warn', message: `mood "${session.mood}" matches none of ${moodKeywords.join(', ')}` });
  }

  const activityKeywords = scenario.expectations.activityKeywords;
  if (activityKeywords && activityKeywords.length > 0) {
    const activityLower = (session.activity ?? '').toLowerCase();
    const matched = activityKeywords.find((kw) => activityLower.includes(kw.toLowerCase()));
    findings.push(matched
      ? { validator: 'context', severity: 'pass', message: `activity matches "${matched}"` }
      : { validator: 'context', severity: 'warn', message: `activity "${session.activity}" matches none of ${activityKeywords.join(', ')}` });
  }

  // Generic alignment: openingMonologue should be substantive (>= 40 chars).
  const openLen = (session.openingMonologue ?? '').trim().length;
  if (openLen < 40) {
    findings.push({
      validator: 'context',
      severity: 'warn',
      message: `openingMonologue is short (${openLen} chars) — expected a real DJ opener`,
    });
  }

  return findings;
}

// ─── Aggregator ───────────────────────────────────────────────────────────

export interface ScenarioResult {
  scenario: EvalScenario;
  findings: Finding[];
  failed: number;
  warned: number;
  passed: number;
  error?: string;
}

export function runValidators(scenario: EvalScenario, session: MoodcastSession): Finding[] {
  return [
    ...validateSchema(session),
    ...validateTrackCount(scenario, session),
    ...validateSourceIntentDistribution(scenario, session),
    ...validateReplayLeakage(scenario, session),
    ...validateContextAlignment(scenario, session),
  ];
}

export function summarize(findings: Finding[]): { failed: number; warned: number; passed: number } {
  let failed = 0, warned = 0, passed = 0;
  for (const f of findings) {
    if (f.severity === 'fail') failed += 1;
    else if (f.severity === 'warn') warned += 1;
    else passed += 1;
  }
  return { failed, warned, passed };
}
