// User feedback memory at <MOODCAST_HOME>/feedback.json (mode 0600).
//
// Storage shape — flat array of per-track records, newest-first. The file is
// owned exclusively by Moodcast on disk; both the CLI and the Next.js dev
// server import this module. Writes go through a tmp-file + rename pair so a
// crash mid-write never produces a half-written file.
//
// Keys:
//   trackUri          — when present, the canonical match key (Spotify URI).
//                       For non-Spotify rows we fall back to "title|artist".
//   feedback          — 'like' | 'dislike'. Toggling to the same value is a
//                       no-op; toggling to the opposite replaces the prior
//                       record (one feedback per track, latest wins).
//   sourceIntent /
//   familiarityLevel  — copied off the Track at write-time so the aggregator
//                       can profile by intent without reloading sessions.
//   sessionId         — opaque, optional. Helps debug "why did this track
//                       turn up" without needing to read the full session.
//
// Privacy: this file MUST never carry tokens, refresh tokens, raw Spotify
// access tokens, Apple credentials, or anything else sensitive. The shape is
// enforced by `sanitizeRecord` on every write.

import fs from 'fs';
import {
  ensureMoodcastHome,
  resolveMoodcastPath,
} from '@/lib/storage/moodcastHome';
import type {
  TrackSourceIntent,
  TrackFamiliarityLevel,
} from '@/lib/types/moodcast';

export type FeedbackVerdict = 'like' | 'dislike';

export interface FeedbackRecord {
  /** Canonical match key when present (full spotify:track:... URI). */
  trackUri?: string;
  title: string;
  artist: string;
  feedback: FeedbackVerdict;
  sourceIntent?: TrackSourceIntent;
  familiarityLevel?: TrackFamiliarityLevel;
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertFeedbackInput {
  trackUri?: string;
  title: string;
  artist: string;
  feedback: FeedbackVerdict;
  sourceIntent?: TrackSourceIntent;
  familiarityLevel?: TrackFamiliarityLevel;
  sessionId?: string;
}

const MAX_RECORDS = 500;

function file(): string {
  return resolveMoodcastPath('feedback.json');
}

function trackKey(rec: { trackUri?: string; title: string; artist: string }): string {
  if (rec.trackUri && rec.trackUri.startsWith('spotify:track:')) return rec.trackUri;
  return `${rec.title.toLowerCase().trim()}|${rec.artist.toLowerCase().trim()}`;
}

/** Strip any incoming object down to the documented schema before writing. */
function sanitizeRecord(input: UpsertFeedbackInput, now: number, prior?: FeedbackRecord): FeedbackRecord {
  return {
    trackUri: typeof input.trackUri === 'string' && input.trackUri.startsWith('spotify:track:')
      ? input.trackUri
      : undefined,
    title: String(input.title ?? '').slice(0, 256),
    artist: String(input.artist ?? '').slice(0, 256),
    feedback: input.feedback === 'dislike' ? 'dislike' : 'like',
    sourceIntent: input.sourceIntent,
    familiarityLevel: input.familiarityLevel,
    sessionId: input.sessionId ? String(input.sessionId).slice(0, 128) : undefined,
    createdAt: prior?.createdAt ?? now,
    updatedAt: now,
  };
}

function atomicWrite(records: FeedbackRecord[]): void {
  ensureMoodcastHome();
  const path = file();
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, path);
}

export function readFeedback(): FeedbackRecord[] {
  try {
    const raw = fs.readFileSync(file(), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Drop entries that don't match the shape — tolerant to schema drift.
    return parsed.filter((r): r is FeedbackRecord => {
      if (!r || typeof r !== 'object') return false;
      const obj = r as Record<string, unknown>;
      return (
        typeof obj.title === 'string' &&
        typeof obj.artist === 'string' &&
        (obj.feedback === 'like' || obj.feedback === 'dislike') &&
        typeof obj.createdAt === 'number' &&
        typeof obj.updatedAt === 'number'
      );
    });
  } catch {
    return [];
  }
}

export function upsertFeedback(input: UpsertFeedbackInput): FeedbackRecord {
  const all = readFeedback();
  const incomingKey = trackKey(input);
  const priorIdx = all.findIndex((r) => trackKey(r) === incomingKey);
  const prior = priorIdx >= 0 ? all[priorIdx] : undefined;
  const now = Date.now();
  const next = sanitizeRecord(input, now, prior);

  const filtered = priorIdx >= 0 ? all.filter((_, i) => i !== priorIdx) : all;
  // Newest-first, capped at MAX_RECORDS (oldest fall off the end).
  const updated = [next, ...filtered].slice(0, MAX_RECORDS);
  atomicWrite(updated);
  return next;
}

export function clearFeedback(key: { trackUri?: string; title?: string; artist?: string }): boolean {
  const all = readFeedback();
  const matchKey = trackKey({
    trackUri: key.trackUri,
    title: key.title ?? '',
    artist: key.artist ?? '',
  });
  const filtered = all.filter((r) => trackKey(r) !== matchKey);
  if (filtered.length === all.length) return false;
  atomicWrite(filtered);
  return true;
}

export function clearAllFeedback(): void {
  atomicWrite([]);
}

export function getFeedbackPath(): string { return file(); }
