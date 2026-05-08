// Phase 3 — ICS summarizer.
//
// PRIVACY CHOKE POINT:
//   This is the ONLY module permitted to read raw ICS data. Its public return
//   type (`CalendarSummary`) intentionally excludes:
//     - rawSummary / event title
//     - attendees
//     - location
//     - description / notes
//     - any URL / UID / source link
//   Callers (orchestrator, API endpoints, prompt builder) must consume the
//   returned summary only. Code review must reject any change that adds a
//   forbidden field to `CalendarSummary` or leaks raw event text outward.

import ICAL from 'ical.js';
import type { CalendarRhythm } from '@/lib/types/momentContext';
import type { RawCalendarObject } from './appleCalDAV';

export type DayIntensity = 'open' | 'light' | 'busy' | 'packed';
export type NextEventTypeHint =
  | 'class' | 'meeting' | 'study' | 'travel' | 'personal' | 'unknown';
export type SuggestedSessionLength = '15m' | '30m' | '45m' | '60m' | '90m';

export interface CalendarSummary {
  rhythm: CalendarRhythm;
  dayIntensity: DayIntensity;
  eventCount: number;
  nextEventInMinutes?: number;
  nextEventTypeHint?: NextEventTypeHint;
  suggestedSessionLength?: SuggestedSessionLength;
}

// Internal-only struct. NEVER returned outside this module.
interface ParsedEvent {
  startMs: number;
  endMs: number;
  attendeeCount: number;
  // Local-only — used to derive `nextEventTypeHint` via small regex.
  // NEVER copied into CalendarSummary.
  rawSummary?: string;
}

function parseEvents(items: RawCalendarObject[] | null): ParsedEvent[] {
  if (!items) return [];
  const out: ParsedEvent[] = [];
  for (const item of items) {
    if (!item?.data || typeof item.data !== 'string') continue;
    try {
      const jcal = ICAL.parse(item.data);
      const comp = new ICAL.Component(jcal);
      const vevents = comp.getAllSubcomponents('vevent');
      for (const ve of vevents) {
        const event = new ICAL.Event(ve);
        const start = event.startDate?.toJSDate();
        const end = event.endDate?.toJSDate();
        const startMs = start ? start.getTime() : NaN;
        const endMs = end ? end.getTime() : startMs;
        if (!Number.isFinite(startMs)) continue;
        const attendees = ve.getAllProperties('attendee') ?? [];
        out.push({
          startMs,
          endMs: Number.isFinite(endMs) ? endMs : startMs,
          attendeeCount: attendees.length,
          rawSummary: typeof event.summary === 'string' ? event.summary : undefined,
        });
      }
    } catch {
      // Skip malformed VEVENTs silently.
    }
  }
  return out;
}

function classifyType(
  raw: string | undefined,
  attendeeCount: number
): NextEventTypeHint {
  const t = (raw ?? '').toLowerCase();
  if (/\b(class|lecture|seminar|tutorial|lab)\b/.test(t)) return 'class';
  if (/\b(study|reading|review|hw|homework)\b/.test(t)) return 'study';
  if (/\b(flight|train|drive|commute|airport|uber|lyft)\b/.test(t)) return 'travel';
  if (
    attendeeCount > 1 ||
    /\b(meeting|sync|standup|stand-up|1:1|interview|call|zoom)\b/.test(t)
  ) {
    return 'meeting';
  }
  if (/\b(lunch|dinner|coffee|gym|workout|family|birthday|wedding|date|brunch)\b/.test(t)) {
    return 'personal';
  }
  return 'unknown';
}

function intensityFor(
  todayCount: number,
  totalUpcomingBusyMinutes: number
): DayIntensity {
  if (todayCount === 0) return 'open';
  if (todayCount >= 5 || totalUpcomingBusyMinutes >= 6 * 60) return 'packed';
  if (todayCount >= 3 || totalUpcomingBusyMinutes >= 4 * 60) return 'busy';
  return 'light';
}

function rhythmFromIntensity(i: DayIntensity): CalendarRhythm {
  if (i === 'open' || i === 'light') return 'light';
  if (i === 'busy') return 'moderate';
  return 'heavy';
}

function suggestLengthFromContext(
  now: Date,
  next?: ParsedEvent
): SuggestedSessionLength {
  if (!next) return '60m';
  const minsTo = (next.startMs - now.getTime()) / 60_000;
  if (minsTo <= 20) return '15m';
  if (minsTo <= 35) return '30m';
  if (minsTo <= 65) return '45m';
  if (minsTo <= 100) return '60m';
  return '90m';
}

/**
 * Summarize raw ICS objects into a privacy-safe CalendarSummary.
 * The summarizer is the ONLY function allowed to look at raw event data.
 */
export function summarize(items: RawCalendarObject[] | null): CalendarSummary {
  const events = parseEvents(items);
  const now = Date.now();
  const todayEnd = (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  })();

  // "Today" = events that start today and haven't fully ended >30m ago.
  const todayEvents = events.filter(
    (e) => e.startMs <= todayEnd && e.endMs >= now - 30 * 60_000
  );

  // Total upcoming busy minutes today (clamped at "now").
  const totalBusyMin = todayEvents
    .filter((e) => e.endMs > now)
    .reduce(
      (acc, e) => acc + Math.max(0, (e.endMs - Math.max(e.startMs, now)) / 60_000),
      0
    );

  // Soonest upcoming event.
  const upcoming = events
    .filter((e) => e.startMs > now)
    .sort((a, b) => a.startMs - b.startMs);
  const next = upcoming[0];

  const dayIntensity = intensityFor(todayEvents.length, totalBusyMin);
  const summary: CalendarSummary = {
    rhythm: rhythmFromIntensity(dayIntensity),
    dayIntensity,
    eventCount: todayEvents.length,
    suggestedSessionLength: suggestLengthFromContext(new Date(), next),
  };

  if (next) {
    summary.nextEventInMinutes = Math.round((next.startMs - now) / 60_000);
    summary.nextEventTypeHint = classifyType(next.rawSummary, next.attendeeCount);
  }

  // CRITICAL: by intentionally returning an object literal here, we ensure no
  // raw event fields can leak by reference. `rawSummary`, attendees, location,
  // description, etc. exist only inside this function's scope.
  return summary;
}
