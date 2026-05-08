// Phase 3 — Calendar context summary endpoint.
// GET → { summary, connected }
//
// PRIVACY: returns only the privacy-safe `CalendarSummary` shape.
// Raw events are read by `fetchEventsRaw()` (provider) and consumed by
// `summarize()` (privacy choke point). Nothing else sees the raw ICS data.

import { NextResponse } from 'next/server';
import { fetchEventsRaw } from '@/lib/calendar/appleCalDAV';
import { summarize } from '@/lib/calendar/icsSummarize';

export async function GET() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  // Extend window 12h past midnight so "next event" still catches early-morning
  // items if the user runs `moodcast start` late at night.
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  end.setHours(end.getHours() + 12);

  const events = await fetchEventsRaw(start, end);
  if (events === null) {
    return NextResponse.json({ summary: null, connected: false });
  }
  const summary = summarize(events);
  return NextResponse.json({ summary, connected: true });
}
