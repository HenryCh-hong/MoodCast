'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getSessions,
  deleteSession as deleteLocalSession,
} from '@/lib/storage/localSessions';
import { formatDate } from '@/lib/utils';
import type { SavedSession } from '@/lib/types/moodcast';

type SourceTag = 'cli' | 'web' | 'local';

interface UnifiedEntry {
  id: string;
  source: SourceTag;
  createdAtIso: string;     // for formatDate()
  createdAt: number;        // for sort
  title: string;
  subtitle: string;
  mood: string;
  activity: string;
  trackCount: number;
}

interface LibraryIndexEntry {
  id: string;
  source: 'cli' | 'web';
  createdAt: number;
  title: string;
  subtitle: string;
  mood: string;
  activity: string;
  trackCount: number;
}

function fromLibrary(e: LibraryIndexEntry): UnifiedEntry {
  return {
    id: e.id,
    source: e.source,
    createdAt: e.createdAt,
    createdAtIso: new Date(e.createdAt).toISOString(),
    title: e.title || '(untitled)',
    subtitle: e.subtitle || '',
    mood: e.mood || '',
    activity: e.activity || '',
    trackCount: e.trackCount,
  };
}

function fromLocal(s: SavedSession): UnifiedEntry {
  const ms = Date.parse(s.createdAt);
  return {
    id: s.id,
    source: 'local',
    createdAt: Number.isFinite(ms) ? ms : 0,
    createdAtIso: s.createdAt,
    title: s.sessionTitle,
    subtitle: s.sessionSubtitle || '',
    mood: s.mood || '',
    activity: s.activity || '',
    trackCount: s.tracks.length,
  };
}

function sourceChip(src: SourceTag): { label: string; cls: string } {
  switch (src) {
    case 'cli':
      return { label: 'terminal', cls: 'text-mc-lav border-mc-lav/40' };
    case 'web':
      return { label: 'web', cls: 'text-mc-mid border-mc-border' };
    case 'local':
      return { label: 'browser', cls: 'text-mc-dim border-mc-border' };
  }
}

export default function SavedPage() {
  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Library wins on id collision; localStorage is fallback for legacy entries.
    let cancelled = false;
    (async () => {
      let library: UnifiedEntry[] = [];
      try {
        const res = await fetch('/api/sessions/library', { cache: 'no-store' });
        if (res.ok) {
          const body = (await res.json()) as { sessions?: LibraryIndexEntry[] };
          library = (body.sessions ?? []).map(fromLibrary);
        }
      } catch {
        library = [];
      }
      const local = getSessions().map(fromLocal);
      const seen = new Set(library.map((e) => e.id));
      const merged = [...library, ...local.filter((e) => !seen.has(e.id))].sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      if (!cancelled) {
        setEntries(merged);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(id: string, source: SourceTag) {
    if (source === 'local') {
      deleteLocalSession(id);
    } else {
      try {
        await fetch(`/api/sessions/library/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch {
        // server may be down; UI still removes the row, library state will reconcile on next reload
      }
      // Clean up any localStorage shadow with the same id, harmless if absent.
      deleteLocalSession(id);
    }
    setEntries((prev) => prev.filter((s) => s.id !== id));
  }

  if (!loaded) return null;

  if (entries.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo mb-3">No saved sessions</p>
        <p className="text-sm font-bold tracking-tight text-mc-mid mb-6">
          Sessions you generate are saved here automatically — from the terminal or the web.
        </p>
        <Link
          href="/builder"
          className="inline-block px-4 py-2 rounded bg-mc-lav text-[#1a1228] text-[12px] font-bold tracking-tight hover:opacity-90 transition-opacity"
        >
          Start a session
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Saved sessions</h1>
          <p className="text-[12px] font-bold tracking-tight text-mc-lo">
            {entries.length} session{entries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/builder"
          className="text-[11px] font-bold tracking-tight text-mc-lo hover:text-mc-mid transition-colors"
        >
          + New session
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {entries.map((s) => {
          const chip = sourceChip(s.source);
          return (
            <div
              key={`${s.source}:${s.id}`}
              className="p-5 border border-mc-border rounded bg-mc-elevated hover:border-mc-mid transition-colors group"
            >
              <Link href={`/session/${s.id}`} className="block">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-mc-dim">
                    {formatDate(s.createdAtIso)}
                  </p>
                  <span
                    className={`text-[9px] font-bold tracking-[0.15em] uppercase border rounded px-2 py-0.5 ${chip.cls}`}
                  >
                    {chip.label}
                  </span>
                </div>
                <h2 className="text-[15px] font-bold tracking-tight text-mc-hi mb-1 group-hover:text-mc-lav transition-colors">
                  {s.title}
                </h2>
                {s.subtitle && (
                  <p className="text-[12px] font-bold tracking-tight text-mc-lo mb-3 line-clamp-2">
                    {s.subtitle}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {[s.mood, s.activity].filter(Boolean).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] font-bold tracking-tight border border-mc-border rounded px-2 py-0.5 text-mc-dim"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="text-[9px] font-bold tracking-tight text-mc-dim">
                    {s.trackCount} tracks
                  </span>
                </div>
              </Link>
              <button
                onClick={() => void remove(s.id, s.source)}
                className="mt-3 text-[10px] font-bold tracking-tight text-mc-dim hover:text-mc-onair transition-colors"
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
