'use client';
// Phase 3 — Browser-side preferences store (localStorage).

import { DEFAULT_PREFERENCES, type MoodcastPreferences } from '@/lib/types/preferences';

const KEY = 'moodcast:preferences';

export function readPreferences(): MoodcastPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<MoodcastPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(patch: Partial<MoodcastPreferences>): MoodcastPreferences {
  const merged: MoodcastPreferences = { ...readPreferences(), ...patch };
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* quota */ }
  }
  return merged;
}
