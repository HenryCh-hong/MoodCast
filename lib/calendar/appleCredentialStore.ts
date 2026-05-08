// Phase 3 — Apple iCloud Calendar credential store.
// File: <home>/apple-calendar.json (chmod 0600), where <home> is the directory
// returned by lib/storage/moodcastHome.ts.
//
// PRIVACY:
//   - The app-specific password is stored ONLY in this file.
//   - It is never returned by `readAppleStatus()`, never echoed in CLI output,
//     never logged, never sent over a server response except implicitly to
//     iCloud's CalDAV endpoint.
//   - `clearAppleCredentials()` deletes the file completely (no soft-delete).

import fs from 'fs';
import {
  resolveMoodcastPath,
  ensureMoodcastHome,
} from '@/lib/storage/moodcastHome';

function file(): string {
  return resolveMoodcastPath('apple-calendar.json');
}

export interface AppleCredentials {
  appleId: string;             // user-visible
  appPassword: string;         // SECRET — never logged, never returned by status
  principalUrl?: string;       // populated on first successful connect
  calendarHomeUrl?: string;
  primaryCalendarUrl?: string;
  connectedAt: number;         // unix ms
  lastVerifiedAt?: number;
}

export function readAppleCredentials(): AppleCredentials | null {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf-8')) as AppleCredentials;
  } catch {
    return null;
  }
}

export function writeAppleCredentials(creds: AppleCredentials): void {
  ensureMoodcastHome();
  fs.writeFileSync(file(), JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function clearAppleCredentials(): boolean {
  try {
    fs.unlinkSync(file());
    return true;
  } catch {
    return false;
  }
}

// Public-safe metadata view. CRITICAL: must NEVER include `appPassword`.
export interface AppleStatus {
  connected: boolean;
  appleId?: string;
  connectedAt?: number;
  lastVerifiedAt?: number;
}

export function readAppleStatus(): AppleStatus {
  const creds = readAppleCredentials();
  if (!creds) return { connected: false };
  return {
    connected: true,
    appleId: creds.appleId,
    connectedAt: creds.connectedAt,
    lastVerifiedAt: creds.lastVerifiedAt,
  };
}

export function getAppleCredentialPath(): string { return file(); }
