// lib/storage/localSessions.ts
import type { SavedSession } from '@/lib/types/moodcast';

const LIST_KEY = 'moodcast:sessions';
const MAX_SESSIONS = 20;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getSessions(): SavedSession[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LIST_KEY);
    return raw ? (JSON.parse(raw) as SavedSession[]) : [];
  } catch {
    return [];
  }
}

export function getSession(id: string): SavedSession | null {
  // Demo sessions resolved separately — caller handles demo- prefix
  const all = getSessions();
  return all.find((s) => s.id === id) ?? null;
}

export function saveSession(session: SavedSession): void {
  if (!isBrowser()) return;
  const all = getSessions().filter((s) => s.id !== session.id);
  const updated = [session, ...all].slice(0, MAX_SESSIONS);
  localStorage.setItem(LIST_KEY, JSON.stringify(updated));
}

export function deleteSession(id: string): void {
  if (!isBrowser()) return;
  const updated = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(LIST_KEY, JSON.stringify(updated));
}

export function updateSession(id: string, patch: Partial<SavedSession>): void {
  if (!isBrowser()) return;
  const all = getSessions();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...patch };
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(all));
  } catch {
    // QuotaExceededError — patch is not persisted
  }
}
