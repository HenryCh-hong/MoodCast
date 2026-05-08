// Shared session library at ~/.moodcast/sessions/.
//
// Layout
//   ~/.moodcast/sessions/
//     index.json                    Sorted summary list (newest first, capped).
//     <session-id>.json             Full per-session record (mode 0600).
//
// Both the CLI and the Next.js dev server import this module. The filesystem
// is the single source of truth; the only "remote" surface is the local API
// route layer that wraps these helpers for the browser.
//
// Atomicity: every JSON write goes via "<file>.tmp" + fs.renameSync, so a
// crash mid-write never produces a half-written file. The index can be
// reconstructed by scanning per-session files if it disappears.
//
// Privacy: stored records carry only data that is already aggregate / safe.
// We never persist Spotify tokens, Apple passwords, raw calendar event titles
// or attendees, raw locations, or coordinates. The sanitised MomentContext
// projection is centralised in ./sanitiseMoment.ts.

import fs from 'fs';
import path from 'path';
import type { MoodcastSession } from '@/lib/types/moodcast';
import type { SelectedTagSet } from '@/lib/types/tags';
import type { DiscoveryDial } from '@/lib/types/momentContext';
import type { SanitisedMomentContext } from './sanitiseMoment';
import {
  ensureMoodcastHome,
  resolveMoodcastPath,
} from '@/lib/storage/moodcastHome';
import {
  readActiveSession,
  getActiveSessionPath,
  type ActiveSessionRecord,
} from './activeSession';

const MAX_INDEX_ENTRIES = 50;
const ID_RE = /^[A-Za-z0-9._-]+$/;

function dir(): string {
  return resolveMoodcastPath('sessions');
}
function indexPath(): string {
  return resolveMoodcastPath('sessions', 'index.json');
}

export type StoredSessionSource = 'cli' | 'web';

export interface StoredSessionRecord {
  id: string;
  source: StoredSessionSource;
  createdAt: number;
  updatedAt: number;
  title: string;
  subtitle: string;
  mood: string;
  activity: string;
  energyArc: string;
  length?: string;
  trackCount: number;
  validSpotifyUriCount: number;
  selectedTags?: SelectedTagSet;
  discoveryDial?: DiscoveryDial;
  momentSummary?: SanitisedMomentContext;
  session: MoodcastSession;
}

export interface SessionIndexEntry {
  id: string;
  source: StoredSessionSource;
  createdAt: number;
  updatedAt: number;
  title: string;
  subtitle: string;
  mood: string;
  activity: string;
  trackCount: number;
  validSpotifyUriCount: number;
  tagsSummary?: string;
}

export interface AppendInput {
  id: string;
  source: StoredSessionSource;
  session: MoodcastSession;
  selectedTags?: SelectedTagSet;
  discoveryDial?: DiscoveryDial;
  momentSummary?: SanitisedMomentContext;
  length?: string;
  createdAt?: number;
}

// ─── Filesystem helpers ────────────────────────────────────────────────────

function ensureDir(): void {
  ensureMoodcastHome();
  const d = dir();
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
}

function atomicWriteJson(file: string, value: unknown, mode: number): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode });
  fs.renameSync(tmp, file);
}

function isSafeId(id: string): boolean {
  return ID_RE.test(id) && !id.includes('..') && id.length <= 128;
}

function recordPath(id: string): string {
  if (!isSafeId(id)) throw new Error(`Invalid session id: ${id}`);
  return path.join(dir(), `${id}.json`);
}

function countValidUris(session: MoodcastSession): number {
  return session.tracks
    .map((t) => t.uri ?? '')
    .filter((u) => u.startsWith('spotify:track:')).length;
}

function buildTagsSummary(tags?: SelectedTagSet): string | undefined {
  if (!tags) return undefined;
  const flat = [...tags.mood, ...tags.activity, ...tags.texture, ...tags.signal]
    .filter(Boolean)
    .slice(0, 3);
  return flat.length ? flat.join(', ') : undefined;
}

function entryFromRecord(r: StoredSessionRecord): SessionIndexEntry {
  return {
    id: r.id,
    source: r.source,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    title: r.title,
    subtitle: r.subtitle,
    mood: r.mood,
    activity: r.activity,
    trackCount: r.trackCount,
    validSpotifyUriCount: r.validSpotifyUriCount,
    tagsSummary: buildTagsSummary(r.selectedTags),
  };
}

// ─── Index ─────────────────────────────────────────────────────────────────

function readIndexRaw(): SessionIndexEntry[] {
  try {
    const raw = fs.readFileSync(indexPath(), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as SessionIndexEntry[];
    return [];
  } catch {
    return [];
  }
}

function writeIndex(entries: SessionIndexEntry[]): void {
  ensureDir();
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_INDEX_ENTRIES);
  atomicWriteJson(indexPath(), sorted, 0o600);
}

// Rebuild the index by scanning per-session files. Used as a fallback when
// the index is missing or corrupt.
function rebuildIndex(): SessionIndexEntry[] {
  ensureDir();
  const entries: SessionIndexEntry[] = [];
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir());
  } catch {
    return [];
  }
  for (const name of names) {
    if (!name.endsWith('.json') || name === 'index.json') continue;
    const id = name.slice(0, -'.json'.length);
    if (!isSafeId(id)) continue;
    try {
      const raw = fs.readFileSync(path.join(dir(), name), 'utf-8');
      const rec = JSON.parse(raw) as StoredSessionRecord;
      if (rec?.id && rec?.session?.sessionTitle) entries.push(entryFromRecord(rec));
    } catch {
      // skip corrupt files
    }
  }
  writeIndex(entries);
  return readIndexRaw();
}

// ─── Migration ─────────────────────────────────────────────────────────────

// Initialise the library on disk if it doesn't yet exist. Cheap; safe to call
// many times.
function ensureLibraryInitialised(): void {
  ensureDir();
  if (!fs.existsSync(indexPath())) atomicWriteJson(indexPath(), [], 0o600);
}

// Idempotent. Imports the legacy ~/.moodcast/active-session.json into the
// library when its id is not already present. Runs every time `listSessions`
// is called so that an empty index still picks up an existing active session
// (the previous version short-circuited on `index.json` existing, which left
// users with an empty library after any earlier `clear`/cleanup).
//
// We never delete active-session.json — it remains the "now playing" pointer.
export function migrateActiveSessionIfNeeded(): void {
  ensureLibraryInitialised();
  let active: ActiveSessionRecord | null = null;
  try {
    if (fs.existsSync(getActiveSessionPath())) active = readActiveSession();
  } catch {
    return;
  }
  if (!active || !isSafeId(active.id)) return;

  // Already imported? Skip.
  const existingIndex = readIndexRaw();
  if (existingIndex.some((e) => e.id === active.id)) return;
  if (fs.existsSync(recordPath(active.id))) return;

  const record: StoredSessionRecord = {
    id: active.id,
    source: active.source,
    createdAt: active.setAt,
    updatedAt: active.setAt,
    title: active.session.sessionTitle,
    subtitle: active.session.sessionSubtitle ?? '',
    mood: active.session.mood ?? '',
    activity: active.session.activity ?? '',
    energyArc: active.session.energyArc ?? '',
    trackCount: active.session.tracks.length,
    validSpotifyUriCount: countValidUris(active.session),
    session: active.session,
  };

  try {
    atomicWriteJson(recordPath(record.id), record, 0o600);
    writeIndex([entryFromRecord(record), ...existingIndex]);
  } catch (err) {
    console.error('[sessionLibrary] migrate import failed:', err);
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export function appendSession(input: AppendInput): SessionIndexEntry {
  if (!isSafeId(input.id)) throw new Error(`Invalid session id: ${input.id}`);
  ensureLibraryInitialised();

  const now = Date.now();
  const session = input.session;
  const existing = getSession(input.id);
  const createdAt = input.createdAt ?? existing?.createdAt ?? now;

  const record: StoredSessionRecord = {
    id: input.id,
    source: input.source,
    createdAt,
    updatedAt: now,
    title: session.sessionTitle,
    subtitle: session.sessionSubtitle ?? '',
    mood: session.mood ?? '',
    activity: session.activity ?? '',
    energyArc: session.energyArc ?? '',
    length: input.length,
    trackCount: session.tracks.length,
    validSpotifyUriCount: countValidUris(session),
    selectedTags: input.selectedTags,
    discoveryDial: input.discoveryDial,
    momentSummary: input.momentSummary,
    session,
  };

  atomicWriteJson(recordPath(record.id), record, 0o600);

  // Update index: replace any prior entry for this id, then enforce cap and
  // delete dropped per-session files so the cap is real on disk.
  const prior = readIndexRaw().filter((e) => e.id !== record.id);
  const next = [entryFromRecord(record), ...prior]
    .sort((a, b) => b.createdAt - a.createdAt);
  const kept = next.slice(0, MAX_INDEX_ENTRIES);
  const dropped = next.slice(MAX_INDEX_ENTRIES);
  for (const d of dropped) {
    try { fs.unlinkSync(recordPath(d.id)); } catch { /* already gone */ }
  }
  writeIndex(kept);
  return entryFromRecord(record);
}

export function listSessions(opts: { limit?: number } = {}): SessionIndexEntry[] {
  migrateActiveSessionIfNeeded();
  let entries = readIndexRaw();
  if (entries.length === 0) entries = rebuildIndex();
  const sorted = entries.sort((a, b) => b.createdAt - a.createdAt);
  return typeof opts.limit === 'number' ? sorted.slice(0, opts.limit) : sorted;
}

export function getSession(id: string): StoredSessionRecord | null {
  if (!isSafeId(id)) return null;
  try {
    const raw = fs.readFileSync(recordPath(id), 'utf-8');
    const rec = JSON.parse(raw) as StoredSessionRecord;
    if (!rec?.id || !rec?.session) return null;
    return rec;
  } catch {
    return null;
  }
}

// Resolve a full or unique-prefix id to a stored record. Used by CLI commands
// so users can type `cli-l4a` instead of the full id.
export function resolveSessionId(idOrPrefix: string): SessionIndexEntry | null {
  if (!idOrPrefix) return null;
  const exact = listSessions().find((e) => e.id === idOrPrefix);
  if (exact) return exact;
  const matches = listSessions().filter((e) => e.id.startsWith(idOrPrefix));
  if (matches.length === 1) return matches[0];
  return null;
}

export function deleteSession(id: string): boolean {
  if (!isSafeId(id)) return false;
  let removed = false;
  try {
    fs.unlinkSync(recordPath(id));
    removed = true;
  } catch {
    // file may already be gone; still attempt index update
  }
  const before = readIndexRaw();
  const after = before.filter((e) => e.id !== id);
  if (after.length !== before.length) {
    writeIndex(after);
    removed = true;
  }
  return removed;
}

export function clearLibrary(): void {
  ensureDir();
  let names: string[] = [];
  try { names = fs.readdirSync(dir()); } catch { return; }
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try { fs.unlinkSync(path.join(dir(), name)); } catch { /* ignore */ }
  }
  atomicWriteJson(indexPath(), [], 0o600);
}

export function getSessionsDir(): string { return dir(); }
export function getSessionsIndexPath(): string { return indexPath(); }
