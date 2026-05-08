export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function detectTimeOfDay(hour?: number): TimeOfDay {
  const h = hour ?? new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

export function timeOfDayToMood(t: TimeOfDay): { mood: string; activity: string } {
  const map: Record<TimeOfDay, { mood: string; activity: string }> = {
    morning: { mood: 'calm and clear', activity: 'morning routine' },
    afternoon: { mood: 'focused', activity: 'working' },
    evening: { mood: 'winding down', activity: 'relaxing' },
    night: { mood: 'introspective', activity: 'late night' },
  };
  return map[t];
}
