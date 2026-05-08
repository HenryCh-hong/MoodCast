// Phase 3 — MomentContext orchestrator.
//
// Assembles a privacy-summarized MomentContext from any subset of available
// context sources. Each source is independent and degrades silently.

import { deriveTimeOfDay, deriveDayType, detectTimeZone, dayName } from './time';
import { fetchWeatherSafe } from './weather';
import { fetchIpLocation, geocodeCity } from './location';
import { fetchEventsRaw } from '@/lib/calendar/appleCalDAV';
import { summarize } from '@/lib/calendar/icsSummarize';
import { readPreferences } from '@/lib/storage/preferencesServer';
import type { MomentContext } from '@/lib/types/momentContext';

export interface BuildOptions {
  // Browser-supplied coordinates (locationMode === 'browser').
  // Coordinates are used only to query weather / reverse-geocode and are
  // discarded immediately after.
  forceLat?: number;
  forceLon?: number;
  // Optional override for the dial; defaults to prefs.discoveryDial.
  discoveryOverride?: 'familiar' | 'balanced' | 'discover';
}

export async function buildMomentContext(
  opts: BuildOptions = {}
): Promise<MomentContext> {
  const prefs = readPreferences();
  const now = new Date();

  const ctx: MomentContext = {
    localTime: now.toISOString(),
    timeZone: detectTimeZone(),
    timeOfDay: deriveTimeOfDay(now),
    dayType: deriveDayType(now),
    dayOfWeek: now.getDay(),
    contextualSignals: [],
    discoveryRecommendation: opts.discoveryOverride ?? prefs.discoveryDial,
    confidence: {
      time: 'high',
      location: 'none',
      weather: 'none',
      calendar: 'none',
    },
  };

  // ── Location ──────────────────────────────────────────────────────────
  // Coordinates live only in this scope. They are NOT propagated to ctx.
  let lat: number | undefined;
  let lon: number | undefined;

  if (opts.forceLat !== undefined && opts.forceLon !== undefined) {
    lat = opts.forceLat;
    lon = opts.forceLon;
    ctx.confidence.location = 'browser';
    // Leave locationSummary empty here — caller is expected to reverse-geocode.
  } else if (prefs.locationMode === 'manual' && prefs.manualCity) {
    const geo = await geocodeCity(prefs.manualCity);
    lat = geo.lat;
    lon = geo.lon;
    ctx.locationSummary = prefs.manualCity;
    ctx.countryCode = geo.countryCode ?? prefs.countryCode ?? undefined;
    ctx.confidence.location = 'manual';
  } else if (prefs.locationMode === 'ip') {
    const ip = await fetchIpLocation();
    if (ip.city) {
      lat = ip.latitude;
      lon = ip.longitude;
      ctx.locationSummary = ip.city;
      ctx.countryCode = ip.countryCode;
      ctx.confidence.location = 'ip';
    }
  }
  // 'off' or anything else → no location.

  // ── Weather ───────────────────────────────────────────────────────────
  if (prefs.weatherEnabled && lat !== undefined && lon !== undefined) {
    const w = await fetchWeatherSafe(lat, lon);
    if (w) {
      ctx.weatherSummary = w.summary;
      ctx.temperatureCategory = w.temperatureCategory;
      ctx.confidence.weather = 'live';
    }
  }
  // Coordinates fall out of scope here — never reach the prompt.

  // ── Calendar ──────────────────────────────────────────────────────────
  if (prefs.calendarEnabled) {
    try {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      end.setHours(end.getHours() + 12); // catch early-morning items past midnight
      const events = await fetchEventsRaw(start, end);
      if (events !== null) {
        const sum = summarize(events);
        ctx.calendarRhythm = sum.rhythm;
        ctx.nextEventInMinutes = sum.nextEventInMinutes;
        ctx.nextEventTypeHint = sum.nextEventTypeHint;
        ctx.confidence.calendar = 'live';
      }
    } catch {
      // Silent degrade.
    }
  }

  // ── Derived signals (1–4 short phrases for the prompt) ───────────────
  ctx.contextualSignals = composeSignals(ctx);

  return ctx;
}

function composeSignals(c: MomentContext): string[] {
  const s: string[] = [];
  // Day + time-of-day
  s.push(`${dayName(c.dayOfWeek)} ${c.timeOfDay.replace('_', ' ')}`);
  // Weather (only when notable)
  if (c.weatherSummary && c.weatherSummary !== 'clear') {
    s.push(`${c.weatherSummary.replace('_', ' ')} outside`);
  }
  // Imminent event
  if (c.nextEventInMinutes !== undefined && c.nextEventInMinutes <= 30) {
    s.push(`something coming up in ~${c.nextEventInMinutes}m`);
  }
  // Day intensity
  if (c.calendarRhythm === 'heavy') s.push('packed day');
  if (c.calendarRhythm === 'light' && c.dayType === 'weekend') s.push('quiet weekend');
  return s.slice(0, 4);
}
