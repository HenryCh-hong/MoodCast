'use client';

// Read-only display of the MomentContext shown above the tag picker.
// Mirrors the CLI's "Signal Scan" panel layout: time, weather, location,
// calendar, discovery. Privacy: every field shown here is already a
// pre-aggregated summary — no raw event titles, attendees, or coordinates.

import type { MomentContext } from '@/lib/types/momentContext';

interface SignalScanCardProps {
  context: MomentContext | null;
  loading: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayName(dayOfWeek: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek] ?? '';
}

function calendarLabel(c: MomentContext): string {
  if (c.calendarRhythm === undefined) return 'not connected';
  const next =
    c.nextEventInMinutes !== undefined
      ? ` · next in ${c.nextEventInMinutes}m${c.nextEventTypeHint ? ` (${c.nextEventTypeHint})` : ''}`
      : '';
  return `${c.calendarRhythm}${next}`;
}

interface RowProps {
  label: string;
  value: string;
  state?: 'on' | 'off' | 'warn';
}

function Row({ label, value, state = 'on' }: RowProps) {
  const dot =
    state === 'on'
      ? 'bg-mc-lav'
      : state === 'warn'
      ? 'bg-mc-onair/70'
      : 'bg-mc-dim/50';
  return (
    <div className="flex items-center gap-3 py-1">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo w-24 shrink-0">
        {label}
      </span>
      <span className="text-[12px] font-bold tracking-tight text-mc-mid">{value}</span>
    </div>
  );
}

export function SignalScanCard({ context, loading }: SignalScanCardProps) {
  if (loading) {
    return (
      <div className="rounded border border-mc-border bg-mc-elevated px-5 py-4 mb-4">
        <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo">
          Reading the moment···
        </p>
      </div>
    );
  }
  if (!context) {
    return (
      <div className="rounded border border-mc-border bg-mc-elevated px-5 py-4 mb-4">
        <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo mb-1">
          Signal Scan
        </p>
        <p className="text-[12px] font-bold tracking-tight text-mc-dim">
          Context unavailable — generation will use defaults.
        </p>
      </div>
    );
  }

  const tod = context.timeOfDay.replace('_', ' ');
  const timeStr = `${formatTime(context.localTime)} · ${dayName(context.dayOfWeek)} ${tod}`;
  const weatherStr = context.weatherSummary
    ? context.temperatureCategory
      ? `${context.weatherSummary} · ${context.temperatureCategory}`
      : context.weatherSummary
    : 'not connected';
  const locStr = context.locationSummary
    ? context.countryCode
      ? `${context.locationSummary} (${context.countryCode}) · city-level`
      : `${context.locationSummary} · city-level`
    : 'not connected';

  return (
    <div className="rounded border border-mc-border bg-mc-elevated px-5 py-4 mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lav">
          Signal Scan
        </p>
        <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-dim">
          {context.discoveryRecommendation}
        </p>
      </div>
      <Row label="local time" value={timeStr} />
      <Row label="weather" value={weatherStr} state={context.weatherSummary ? 'on' : 'off'} />
      <Row label="location" value={locStr} state={context.locationSummary ? 'on' : 'off'} />
      <Row
        label="calendar"
        value={calendarLabel(context)}
        state={context.calendarRhythm ? 'on' : 'off'}
      />
    </div>
  );
}
