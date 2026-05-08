// Dashboard-side helper. Reads the active-session file only when its mtime changed,
// to avoid reparsing JSON on every render tick.

import {
  readActiveSession,
  statActiveSession,
  type ActiveSessionRecord,
} from '../../lib/sessions/activeSession.js';

export interface PollResult {
  changed: boolean;
  record: ActiveSessionRecord | null;
}

let lastSeenMtime: number | null = null;
let lastRecord: ActiveSessionRecord | null = null;

export function pollActiveSession(): PollResult {
  const stat = statActiveSession();
  if (!stat.exists) {
    if (lastRecord !== null) {
      lastRecord = null;
      lastSeenMtime = null;
      return { changed: true, record: null };
    }
    return { changed: false, record: null };
  }

  if (lastSeenMtime !== null && stat.mtimeMs === lastSeenMtime) {
    return { changed: false, record: lastRecord };
  }

  const record = readActiveSession();
  lastRecord = record;
  lastSeenMtime = stat.mtimeMs ?? null;
  return { changed: true, record };
}

// Reset internal cache — used by tests or on fresh CLI invocation.
export function resetPollCache(): void {
  lastSeenMtime = null;
  lastRecord = null;
}
