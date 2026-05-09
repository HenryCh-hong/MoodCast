// Eval scenarios for the prompt-quality regression harness.
//
// Each scenario is a fixed (form + context + tags + dial + tasteProfile) input
// with declarative expectations. Used by scripts/eval/runEval.ts to verify
// generation quality before/after prompt changes.
//
// Add a scenario when you encounter a real failure mode (e.g., "auto-tune at
// late-night kept returning high-energy queues"). Don't write scenarios that
// only check things the parser already enforces — focus on behavioral outputs.

import type { TasteProfile } from '../../lib/types/moodcast';
import type { MomentContext, DiscoveryDial } from '../../lib/types/momentContext';
import type { SelectedTagSet } from '../../lib/types/tags';

export type IntentBound = readonly [number, number];

export interface SourceIntentBounds {
  familiar_anchor?: IntentBound;
  same_artist_fresh?: IntentBound;
  adjacent_artist?: IntentBound;
  contextual_discovery?: IntentBound;
  user_seed?: IntentBound;
}

export interface EvalExpectations {
  /** Track count must fall in [min, max]. Default derived from form.length. */
  trackCount?: { min: number; max: number };

  /**
   * Source-intent proportion bounds (fraction of total tracks). Bounds widened
   * a few percentage points beyond the prompt's stated targets — we're
   * checking for blatant violation, not tight calibration.
   */
  sourceIntentBounds?: SourceIntentBounds;

  /**
   * Maximum fraction of tracks that may exactly replay something from the
   * provided tasteProfile (matched on title|artist or uri) without being
   * marked as a familiar_anchor or user_seed. 0 means strict — any leak
   * fails. Only meaningful when scenario.input.tasteProfile is set.
   */
  maxReplayLeakage?: number;

  /** session.mood must contain one of these (case-insensitive substring). */
  moodKeywords?: string[];

  /** session.activity must contain one of these (case-insensitive substring). */
  activityKeywords?: string[];

  /** Skip distribution checks entirely (rare — for "any output is fine" smoke tests). */
  skipDistribution?: boolean;
}

export interface EvalScenario {
  id: string;
  description: string;
  input: {
    form: {
      mood: string;
      activity: string;
      length: string;
      direction: string;
      seedArtists?: string;
      seedTracks?: string;
    };
    momentContext?: MomentContext;
    selectedTags?: SelectedTagSet;
    discoveryDial?: DiscoveryDial;
    tasteProfile?: TasteProfile;
  };
  expectations: EvalExpectations;
}

// ─── Default bounds per discovery dial ────────────────────────────────────
// Pulled from lib/ai/moodcastPrompt.ts, widened by ~5pp on each side so the
// harness fails on real drift, not on small-sample variance.
//
// These can be overridden per-scenario via expectations.sourceIntentBounds.

export const DIAL_DEFAULT_BOUNDS: Record<DiscoveryDial, SourceIntentBounds> = {
  familiar: {
    familiar_anchor: [0.40, 0.70],       // prompt: 50–60%
    same_artist_fresh: [0.15, 0.40],     // prompt: ~25%
    adjacent_artist: [0.05, 0.25],       // prompt: 10–15%
    contextual_discovery: [0.0, 0.15],   // prompt: up to 5%
    user_seed: [0.0, 0.20],              // prompt: only when seeded
  },
  balanced: {
    familiar_anchor: [0.15, 0.45],
    same_artist_fresh: [0.15, 0.40],
    adjacent_artist: [0.15, 0.40],
    contextual_discovery: [0.05, 0.30],
    user_seed: [0.0, 0.20],
  },
  discover: {
    familiar_anchor: [0.0, 0.25],         // prompt: 10–15%
    same_artist_fresh: [0.05, 0.30],      // prompt: 15–20%
    adjacent_artist: [0.20, 0.55],        // prompt: 35–40%
    contextual_discovery: [0.15, 0.50],   // prompt: 25–35%
    user_seed: [0.0, 0.20],
  },
};

// ─── Synthetic taste profiles ─────────────────────────────────────────────
// Used to test replay-leakage and same-artist-fresh behavior. The URIs are
// deliberately well-formed but fictional — we never call Spotify with these.

const SYNTHETIC_TOP_TRACKS = [
  { title: 'Motion Sickness',   artist: 'Phoebe Bridgers',  uri: 'spotify:track:eval0000000000000000a1' },
  { title: 'Garden Song',       artist: 'Phoebe Bridgers',  uri: 'spotify:track:eval0000000000000000a2' },
  { title: 'Shrike',            artist: 'Hozier',           uri: 'spotify:track:eval0000000000000000b1' },
  { title: 'Cherry Wine',       artist: 'Hozier',           uri: 'spotify:track:eval0000000000000000b2' },
  { title: 'Visions of Gideon', artist: 'Sufjan Stevens',   uri: 'spotify:track:eval0000000000000000c1' },
  { title: 'Fourth of July',    artist: 'Sufjan Stevens',   uri: 'spotify:track:eval0000000000000000c2' },
  { title: 'Saturn',            artist: 'Sleeping at Last', uri: 'spotify:track:eval0000000000000000d1' },
  { title: 'Plainsong',         artist: 'The Cure',         uri: 'spotify:track:eval0000000000000000e1' },
];

const SYNTHETIC_RECENT_TRACKS = [
  { title: 'Kyoto',           artist: 'Phoebe Bridgers',   uri: 'spotify:track:eval0000000000000000a3' },
  { title: 'Take Me to Church', artist: 'Hozier',          uri: 'spotify:track:eval0000000000000000b3' },
  { title: 'Mystery of Love', artist: 'Sufjan Stevens',    uri: 'spotify:track:eval0000000000000000c3' },
];

const SYNTHETIC_TOP_ARTISTS = [
  { name: 'Phoebe Bridgers',   genres: ['indie', 'folk'] },
  { name: 'Hozier',            genres: ['indie', 'soul'] },
  { name: 'Sufjan Stevens',    genres: ['indie', 'folk'] },
  { name: 'Sleeping at Last',  genres: ['indie', 'cinematic'] },
  { name: 'The Cure',          genres: ['post-punk', 'goth'] },
];

export const SYNTHETIC_TASTE: TasteProfile = {
  topArtists: SYNTHETIC_TOP_ARTISTS,
  topTracks: SYNTHETIC_TOP_TRACKS,
  recentTracks: SYNTHETIC_RECENT_TRACKS,
  contextualSignals: {
    morningArtists: ['Sufjan Stevens', 'Sleeping at Last'],
    eveningArtists: ['Hozier', 'Phoebe Bridgers'],
    lateNightArtists: ['Phoebe Bridgers', 'The Cure'],
    mostActiveHour: 22,
    recentSessionMoods: ['reflective', 'gentle'],
    recentSessionActivities: ['study', 'walking'],
    repeatedArtists: ['Phoebe Bridgers', 'Hozier'],
    recentEnergyTrend: 'medium',
    confidence: 'high',
    explanation: 'Synthetic eval taste — high confidence',
    userMaturity: 'established',
  },
};

// ─── Moment context fixtures ──────────────────────────────────────────────

function ctx(overrides: Partial<MomentContext>): MomentContext {
  return {
    localTime: '2026-05-09T22:00:00-04:00',
    timeZone: 'America/New_York',
    timeOfDay: 'late_night',
    dayType: 'weekend',
    dayOfWeek: 6,
    contextualSignals: [],
    discoveryRecommendation: 'balanced',
    confidence: { time: 'high', location: 'none', weather: 'none', calendar: 'none' },
    ...overrides,
  };
}

const LATE_NIGHT_CTX = ctx({
  timeOfDay: 'late_night',
  contextualSignals: ['quiet apartment', 'past midnight'],
});

const MORNING_CTX = ctx({
  localTime: '2026-05-09T08:30:00-04:00',
  timeOfDay: 'morning',
  dayType: 'weekend',
  weatherSummary: 'clear',
  temperatureCategory: 'cool',
  locationSummary: 'Boston',
  countryCode: 'US',
  contextualSignals: ['slow start', 'sun coming up'],
});

const RAINY_AFTERNOON_CTX = ctx({
  localTime: '2026-05-08T15:00:00-04:00',
  timeOfDay: 'afternoon',
  dayType: 'weekday',
  weatherSummary: 'rain',
  temperatureCategory: 'cool',
  locationSummary: 'Boston',
  countryCode: 'US',
  calendarRhythm: 'light',
  contextualSignals: ['steady rain', 'open afternoon'],
});

const HEAVY_CALENDAR_CTX = ctx({
  localTime: '2026-05-08T13:30:00-04:00',
  timeOfDay: 'afternoon',
  dayType: 'weekday',
  weatherSummary: 'cloudy',
  temperatureCategory: 'mild',
  calendarRhythm: 'heavy',
  nextEventInMinutes: 25,
  nextEventTypeHint: 'meeting',
  contextualSignals: ['busy afternoon', 'meeting soon'],
});

// ─── Scenarios ────────────────────────────────────────────────────────────

export const SCENARIOS: EvalScenario[] = [
  {
    id: 'core-late-night-coding',
    description: 'Late-night coding, balanced dial, no taste profile',
    input: {
      form: { mood: 'focused', activity: 'coding', length: '45m', direction: 'stay' },
      momentContext: LATE_NIGHT_CTX,
      discoveryDial: 'balanced',
    },
    expectations: {
      trackCount: { min: 8, max: 14 },
      moodKeywords: ['focus', 'late', 'calm', 'quiet'],
    },
  },

  {
    id: 'core-morning-walk',
    description: 'Slow weekend morning walk, balanced',
    input: {
      form: { mood: 'gentle', activity: 'walking', length: '30m', direction: 'stay' },
      momentContext: MORNING_CTX,
      discoveryDial: 'balanced',
    },
    expectations: {
      trackCount: { min: 6, max: 10 },
    },
  },

  {
    id: 'core-rainy-afternoon-reset',
    description: 'Rainy afternoon, reset/journaling, familiar dial',
    input: {
      form: { mood: 'reflective', activity: 'journaling', length: '40m', direction: 'stay' },
      momentContext: RAINY_AFTERNOON_CTX,
      discoveryDial: 'familiar',
    },
    expectations: {
      trackCount: { min: 8, max: 12 },
    },
  },

  {
    id: 'core-pre-meeting-focus',
    description: 'Heavy calendar, meeting in 25min — short focused session',
    input: {
      form: { mood: 'focused', activity: 'study', length: '25m', direction: 'stay' },
      momentContext: HEAVY_CALENDAR_CTX,
      discoveryDial: 'balanced',
    },
    expectations: {
      trackCount: { min: 5, max: 10 },
    },
  },

  // ─── Replay-leakage guards (taste profile present) ──────────────────────

  {
    id: 'replay-discover-with-taste',
    description: 'Discover dial with rich taste profile must NOT replay top tracks',
    input: {
      form: { mood: 'reflective', activity: 'study', length: '40m', direction: 'stay' },
      momentContext: LATE_NIGHT_CTX,
      discoveryDial: 'discover',
      tasteProfile: SYNTHETIC_TASTE,
    },
    expectations: {
      trackCount: { min: 8, max: 12 },
      // Discover dial: at most 1 leaked replay (ie a top/recent track NOT
      // marked as familiar_anchor). Tight because the prompt is explicit.
      maxReplayLeakage: 0.1,
    },
  },

  {
    id: 'replay-balanced-with-taste',
    description: 'Balanced dial with taste profile — anchors OK, blatant replay is not',
    input: {
      form: { mood: 'warm', activity: 'reset', length: '45m', direction: 'stay' },
      momentContext: RAINY_AFTERNOON_CTX,
      discoveryDial: 'balanced',
      tasteProfile: SYNTHETIC_TASTE,
    },
    expectations: {
      trackCount: { min: 8, max: 14 },
      // Balanced — allow some leakage in case the AI mis-labels an anchor as
      // "fresh", but a queue full of top tracks is still a fail.
      maxReplayLeakage: 0.25,
    },
  },

  {
    id: 'replay-familiar-with-taste',
    description: 'Familiar dial — anchors expected, but not 100% replay',
    input: {
      form: { mood: 'gentle', activity: 'reset', length: '30m', direction: 'stay' },
      momentContext: MORNING_CTX,
      discoveryDial: 'familiar',
      tasteProfile: SYNTHETIC_TASTE,
    },
    expectations: {
      trackCount: { min: 6, max: 10 },
      maxReplayLeakage: 0.4,
    },
  },

  // ─── Manual-tune scenarios with selectedTags ────────────────────────────

  {
    id: 'manual-tune-late-night-instrumental',
    description: 'Manual tags: late-night + instrumental + low-vocal, discover',
    input: {
      form: { mood: '', activity: '', length: '35m', direction: 'stay' },
      momentContext: LATE_NIGHT_CTX,
      selectedTags: {
        mood: ['late-night', 'gentle'],
        activity: ['coding'],
        texture: ['instrumental', 'low-vocal'],
        signal: [],
        familiarity: 'discover',
      },
      discoveryDial: 'discover',
    },
    expectations: {
      trackCount: { min: 6, max: 12 },
    },
  },

  {
    id: 'manual-tune-uplifting-gym',
    description: 'High-energy uplifting gym session, balanced',
    input: {
      form: { mood: '', activity: '', length: '40m', direction: 'stay' },
      momentContext: ctx({
        localTime: '2026-05-09T17:00:00-04:00',
        timeOfDay: 'evening',
        dayType: 'weekend',
      }),
      selectedTags: {
        mood: ['uplifting', 'restless'],
        activity: ['gym'],
        texture: [],
        signal: [],
        familiarity: 'balanced',
      },
      discoveryDial: 'balanced',
    },
    expectations: {
      trackCount: { min: 8, max: 14 },
    },
  },

  // ─── Auto-tune scenarios (no selectedTags, just moment context) ─────────

  {
    id: 'auto-tune-no-context',
    description: 'Bare auto-tune with only form fields — no moment, no taste',
    input: {
      form: { mood: 'calm', activity: 'reading', length: '30m', direction: 'stay' },
      discoveryDial: 'balanced',
    },
    expectations: {
      trackCount: { min: 6, max: 10 },
      moodKeywords: ['calm', 'quiet', 'gentle', 'soft'],
    },
  },

  {
    id: 'auto-tune-rainy-with-taste',
    description: 'Auto-tune: rainy afternoon + taste profile + calendar light',
    input: {
      form: { mood: 'cozy', activity: 'reset', length: '35m', direction: 'stay' },
      momentContext: RAINY_AFTERNOON_CTX,
      tasteProfile: SYNTHETIC_TASTE,
      // No discoveryDial → uses momentContext.discoveryRecommendation = 'balanced'
    },
    expectations: {
      trackCount: { min: 7, max: 11 },
      maxReplayLeakage: 0.3,
    },
  },

  // ─── Seed-driven scenario (user_seed intent) ────────────────────────────

  {
    id: 'seeded-by-artist',
    description: 'User seeded an artist — must include user_seed track',
    input: {
      form: {
        mood: 'reflective',
        activity: 'study',
        length: '30m',
        direction: 'stay',
        seedArtists: 'Sufjan Stevens',
      },
      momentContext: LATE_NIGHT_CTX,
      tasteProfile: SYNTHETIC_TASTE,
      discoveryDial: 'balanced',
    },
    expectations: {
      trackCount: { min: 6, max: 10 },
      sourceIntentBounds: {
        // Override: at least one user_seed track expected.
        user_seed: [0.05, 0.5],
      },
    },
  },
];

export function findScenarios(ids?: string[]): EvalScenario[] {
  if (!ids || ids.length === 0) return SCENARIOS;
  const set = new Set(ids);
  return SCENARIOS.filter((s) => set.has(s.id));
}
