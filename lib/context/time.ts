// Phase 3 — Time / timezone / day-type derivation.
// Always available; needs no permissions or network.

import type { TimeOfDay, DayType } from '@/lib/types/momentContext';

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

export function deriveTimeOfDay(date: Date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 9)   return 'early_morning';
  if (h >= 9 && h < 12)  return 'morning';
  if (h >= 12 && h < 14) return 'midday';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  if (h >= 22)           return 'night';
  return 'late_night';
}

export function deriveDayType(date: Date = new Date()): DayType {
  const d = date.getDay();
  return d === 0 || d === 6 ? 'weekend' : 'weekday';
}

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function describeWhen(date: Date = new Date()): string {
  // e.g. "Tuesday morning", "Saturday late night"
  const day = DAY_NAMES[date.getDay()];
  const tod = deriveTimeOfDay(date).replace('_', ' ');
  return `${day} ${tod}`;
}

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[((dayOfWeek % 7) + 7) % 7];
}
