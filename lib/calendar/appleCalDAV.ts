// Phase 3 — Apple iCloud CalDAV wrapper.
// Uses tsdav for the CalDAV protocol. iCloud server URL: https://caldav.icloud.com
//
// PRIVACY:
//   - We never log credentials. tsdav's debug mode is left disabled.
//   - Raw event data (ICS text) is returned by `fetchEventsRaw()` and consumed
//     ONLY by `lib/calendar/icsSummarize.ts`. Other call sites must not parse it.

import { createDAVClient, fetchCalendars, fetchCalendarObjects } from 'tsdav';
import {
  readAppleCredentials,
  writeAppleCredentials,
  type AppleCredentials,
} from './appleCredentialStore';

const APPLE_URL = 'https://caldav.icloud.com';

// Lightweight subsets of tsdav's internal types so we don't depend on
// non-exported types. Matches DAVCalendar / DAVCalendarObject shape.
interface DAVCalendarLike {
  url: string;
  displayName?: unknown;
  components?: string[];
}
interface DAVCalendarObjectLike {
  url: string;
  data?: string;
}

async function makeClient(creds: { appleId: string; appPassword: string }) {
  return createDAVClient({
    serverUrl: APPLE_URL,
    credentials: { username: creds.appleId, password: creds.appPassword },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
}

export interface VerifyOk {
  ok: true;
  calendars: Array<{ displayName: string; url: string }>;
}
export interface VerifyFail {
  ok: false;
  error: string;
}

/**
 * Verify credentials by listing calendars. On success, persist the credentials
 * with discovered URLs. On failure, do NOT write the file.
 */
export async function verifyAndDiscover(
  appleId: string,
  appPassword: string
): Promise<VerifyOk | VerifyFail> {
  if (!appleId || !appPassword) {
    return { ok: false, error: 'appleId and appPassword required' };
  }
  try {
    const client = await makeClient({ appleId, appPassword });
    const calendars = (await client.fetchCalendars()) as DAVCalendarLike[];
    const usable = calendars
      .filter((c) => Array.isArray(c.components) && c.components.includes('VEVENT'))
      .map((c) => ({
        displayName:
          typeof c.displayName === 'string' && c.displayName.length > 0
            ? c.displayName
            : 'Calendar',
        url: c.url,
      }));
    if (usable.length === 0) {
      return { ok: false, error: 'No event calendars found on this Apple ID.' };
    }

    // Persist credentials with discovery info. Writing only happens on success.
    const account = (client as unknown as { account?: { principalUrl?: string; homeUrl?: string } })
      .account;
    const next: AppleCredentials = {
      appleId,
      appPassword,
      principalUrl: account?.principalUrl,
      calendarHomeUrl: account?.homeUrl,
      primaryCalendarUrl: usable[0].url,
      connectedAt: Date.now(),
      lastVerifiedAt: Date.now(),
    };
    writeAppleCredentials(next);
    return { ok: true, calendars: usable };
  } catch (err) {
    // Map common iCloud failure shapes to friendly messages.
    const raw = err instanceof Error ? err.message : String(err);
    let friendly = 'CalDAV connection failed';
    if (/401|unauthor/i.test(raw)) {
      friendly = 'Apple rejected the credentials (HTTP 401). Check the Apple ID and app-specific password.';
    } else if (/timeout|network|ENOTFOUND|ECONN/i.test(raw)) {
      friendly = 'Could not reach iCloud (network error).';
    } else if (raw) {
      friendly = `CalDAV error: ${raw.slice(0, 200)}`;
    }
    return { ok: false, error: friendly };
  }
}

/**
 * Fetch raw calendar objects (ICS) for the given UTC time range.
 * Returns null if no credentials, or if the network/auth layer fails.
 */
export async function fetchEventsRaw(
  start: Date,
  end: Date
): Promise<DAVCalendarObjectLike[] | null> {
  const creds = readAppleCredentials();
  if (!creds) return null;
  try {
    const client = await makeClient(creds);
    const calendars = (await client.fetchCalendars()) as DAVCalendarLike[];
    const target =
      calendars.find((c) => c.url === creds.primaryCalendarUrl) ??
      calendars.find(
        (c) => Array.isArray(c.components) && c.components.includes('VEVENT')
      );
    if (!target) return null;

    const events = (await client.fetchCalendarObjects({
      calendar: target as Parameters<typeof fetchCalendarObjects>[0]['calendar'],
      timeRange: { start: start.toISOString(), end: end.toISOString() },
      expand: true,
    })) as DAVCalendarObjectLike[];

    // Best-effort lastVerifiedAt update — never blocks on failure.
    try {
      writeAppleCredentials({ ...creds, lastVerifiedAt: Date.now() });
    } catch { /* ignore */ }

    return events;
  } catch {
    return null;
  }
}

// Re-export type that consumers (icsSummarize) need without importing tsdav.
export type { DAVCalendarObjectLike as RawCalendarObject };
