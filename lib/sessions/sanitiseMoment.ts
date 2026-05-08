// Shared sanitised projection of MomentContext used by:
//   - lib/sessions/lastGenerationError.ts (debug record on AI quota failure)
//   - lib/sessions/sessionLibrary.ts       (per-session library record)
//
// Privacy contract: this projection deliberately omits anything that could
// leak raw calendar event titles, attendees, notes, locations, or coordinates.
// The CLI's MomentContext is already city-level by construction, so we only
// pass through aggregate/summary fields. No raw provider data ever lands here.

import type { MomentContext } from '@/lib/types/momentContext';

export interface SanitisedMomentContext {
  timeOfDay: MomentContext['timeOfDay'];
  dayType: MomentContext['dayType'];
  dayOfWeek: MomentContext['dayOfWeek'];
  weatherSummary?: MomentContext['weatherSummary'];
  temperatureCategory?: MomentContext['temperatureCategory'];
  locationSummary?: string;       // city-level only, e.g. "Boston"
  countryCode?: string;
  calendarRhythm?: MomentContext['calendarRhythm'];
  nextEventInMinutes?: number;
  nextEventTypeHint?: string;     // 'class' | 'meeting' | … | 'unknown'
  discoveryRecommendation: MomentContext['discoveryRecommendation'];
}

export function sanitiseMomentContext(ctx: MomentContext): SanitisedMomentContext {
  return {
    timeOfDay: ctx.timeOfDay,
    dayType: ctx.dayType,
    dayOfWeek: ctx.dayOfWeek,
    weatherSummary: ctx.weatherSummary,
    temperatureCategory: ctx.temperatureCategory,
    locationSummary: ctx.locationSummary,
    countryCode: ctx.countryCode,
    calendarRhythm: ctx.calendarRhythm,
    nextEventInMinutes: ctx.nextEventInMinutes,
    nextEventTypeHint: ctx.nextEventTypeHint,
    discoveryRecommendation: ctx.discoveryRecommendation,
  };
}
