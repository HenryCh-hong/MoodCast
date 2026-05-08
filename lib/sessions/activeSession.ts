// Node-only helpers for the active-session store at <home>/active-session.json
// where <home> is the directory returned by lib/storage/moodcastHome.ts.
// Used by:
//   - app/api/sessions/active/route.ts (Next.js server)
//   - cli/commands/start.ts (CLI write after generation)
//   - cli/utils/activeSessionPoll.ts (CLI dashboard read)
//
// File is the single source of truth. Mode 0600 (owner read/write only).

import fs from 'fs';
import {
  resolveMoodcastPath,
  ensureMoodcastHome,
} from '@/lib/storage/moodcastHome';
import type { MoodcastSession } from '@/lib/types/moodcast';

export type ActiveSessionSource = 'web' | 'cli';

export interface ActiveSessionRecord {
  id: string;
  source: ActiveSessionSource;
  setAt: number; // Unix ms
  spotifyUris: string[];
  session: MoodcastSession;
}

function file(): string {
  return resolveMoodcastPath('active-session.json');
}

export function getActiveSessionPath(): string {
  return file();
}

export function readActiveSession(): ActiveSessionRecord | null {
  try {
    const raw = fs.readFileSync(file(), 'utf-8');
    const parsed = JSON.parse(raw) as ActiveSessionRecord;
    if (!parsed?.id || !parsed?.session) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveSession(
  id: string,
  session: MoodcastSession,
  source: ActiveSessionSource,
): ActiveSessionRecord {
  ensureMoodcastHome();
  const spotifyUris = session.tracks
    .map((t) => t.uri ?? '')
    .filter((u) => u.startsWith('spotify:track:'));
  const record: ActiveSessionRecord = {
    id,
    source,
    setAt: Date.now(),
    spotifyUris,
    session,
  };
  fs.writeFileSync(file(), JSON.stringify(record, null, 2), { mode: 0o600 });
  return record;
}

export function clearActiveSession(): void {
  try {
    fs.unlinkSync(file());
  } catch {
    // already gone
  }
}

export interface ActiveSessionStat {
  exists: boolean;
  mtimeMs?: number;
}

export function statActiveSession(): ActiveSessionStat {
  try {
    const s = fs.statSync(file());
    return { exists: true, mtimeMs: s.mtimeMs };
  } catch {
    return { exists: false };
  }
}
