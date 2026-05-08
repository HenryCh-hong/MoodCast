// Phase 3 — Context → suggested tags.
// Pure function: given a MomentContext, propose pre-selected tags by group.

import type { MomentContext } from '@/lib/types/momentContext';
import type { SuggestedTagSet } from '@/lib/types/tags';

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function suggestTags(ctx: MomentContext): SuggestedTagSet {
  const mood: string[] = [];
  const activity: string[] = [];
  const texture: string[] = [];
  const signal: string[] = [];

  // ── Time-based ────────────────────────────────────────────────
  switch (ctx.timeOfDay) {
    case 'early_morning':
    case 'morning':
      signal.push('morning');
      mood.push('gentle');
      texture.push('soft-vocal');
      break;
    case 'midday':
    case 'afternoon':
      mood.push('focused');
      activity.push(ctx.dayType === 'weekday' ? 'coding' : 'walking');
      break;
    case 'evening':
      mood.push('warm');
      texture.push('atmospheric');
      break;
    case 'night':
    case 'late_night':
      signal.push('recharge');
      mood.push('late-night');
      texture.push('low-vocal');
      break;
  }

  // ── Weather-based ─────────────────────────────────────────────
  if (ctx.weatherSummary === 'rain' || ctx.weatherSummary === 'heavy_rain') {
    signal.push('rainy-day');
    if (!texture.includes('atmospheric')) texture.push('atmospheric');
  }
  if (ctx.weatherSummary === 'snow' || ctx.temperatureCategory === 'cold') {
    if (!mood.includes('warm')) mood.push('warm');
  }
  if (ctx.temperatureCategory === 'hot') {
    if (!mood.includes('uplifting')) mood.push('uplifting');
  }
  if (ctx.weatherSummary === 'thunderstorm') {
    if (!texture.includes('atmospheric')) texture.push('atmospheric');
    if (!mood.includes('reflective')) mood.push('reflective');
  }

  // ── Calendar-based ────────────────────────────────────────────
  if (ctx.nextEventInMinutes !== undefined && ctx.nextEventInMinutes <= 30) {
    signal.push('pre-meeting');
    if (!mood.includes('focused')) mood.push('focused');
    if (!texture.includes('low-vocal')) texture.push('low-vocal');
  }
  if (ctx.calendarRhythm === 'heavy') {
    if (!signal.includes('workday')) signal.push('workday');
  }
  if (ctx.calendarRhythm === 'light' && (ctx.timeOfDay === 'evening' || ctx.timeOfDay === 'afternoon')) {
    if (!signal.includes('slow-start')) signal.push('slow-start');
  }
  if (ctx.nextEventTypeHint === 'class') {
    if (!signal.includes('after-class')) signal.push('after-class');
  }

  return {
    mood: dedupe(mood).slice(0, 2),
    activity: dedupe(activity).slice(0, 2),
    texture: dedupe(texture).slice(0, 2),
    signal: dedupe(signal).slice(0, 2),
    familiarity: ctx.discoveryRecommendation,
  };
}
