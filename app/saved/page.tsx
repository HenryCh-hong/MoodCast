'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSessions, deleteSession } from '@/lib/storage/localSessions';
import { formatDate } from '@/lib/utils';
import type { SavedSession } from '@/lib/types/moodcast';

export default function SavedPage() {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSessions(getSessions());
    setLoaded(true);
  }, []);

  function remove(id: string) {
    deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (!loaded) return null;

  if (sessions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo mb-3">No saved sessions</p>
        <p className="text-sm font-bold tracking-tight text-mc-mid mb-6">
          Sessions you generate are saved here automatically.
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
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
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
        {sessions.map((s) => (
          <div
            key={s.id}
            className="p-5 border border-mc-border rounded bg-mc-elevated hover:border-mc-mid transition-colors group"
          >
            <Link href={`/session/${s.id}`} className="block">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-mc-dim mb-1">
                {formatDate(s.createdAt)}
              </p>
              <h2 className="text-[15px] font-bold tracking-tight text-mc-hi mb-1 group-hover:text-mc-lav transition-colors">
                {s.sessionTitle}
              </h2>
              {s.sessionSubtitle && (
                <p className="text-[12px] font-bold tracking-tight text-mc-lo mb-3 line-clamp-2">
                  {s.sessionSubtitle}
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
                  {s.tracks.length} tracks
                </span>
              </div>
            </Link>
            <button
              onClick={() => remove(s.id)}
              className="mt-3 text-[10px] font-bold tracking-tight text-mc-dim hover:text-mc-onair transition-colors"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
