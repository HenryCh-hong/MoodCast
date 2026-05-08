// Phase 3 — Server / CLI preferences store at <home>/preferences.json (chmod 0600).

import fs from 'fs';
import {
  resolveMoodcastPath,
  ensureMoodcastHome,
} from '@/lib/storage/moodcastHome';
import { DEFAULT_PREFERENCES, type MoodcastPreferences } from '@/lib/types/preferences';

function file(): string {
  return resolveMoodcastPath('preferences.json');
}

export function readPreferences(): MoodcastPreferences {
  try {
    const raw = fs.readFileSync(file(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<MoodcastPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(patch: Partial<MoodcastPreferences>): MoodcastPreferences {
  ensureMoodcastHome();
  const merged: MoodcastPreferences = { ...readPreferences(), ...patch };
  fs.writeFileSync(file(), JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}

export function getPreferencesPath(): string { return file(); }
