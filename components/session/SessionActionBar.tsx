'use client';

import { useRouter } from 'next/navigation';
import { deleteSession } from '@/lib/storage/localSessions';

interface SessionActionBarProps {
  sessionId: string;
  isDemo: boolean;
}

export function SessionActionBar({ sessionId, isDemo }: SessionActionBarProps) {
  const router = useRouter();

  function handleDelete() {
    deleteSession(sessionId);
    router.push('/saved');
  }

  return (
    <div className="mt-8 flex items-center gap-4 text-[11px] font-bold tracking-tight">
      <button
        onClick={() => router.push('/builder')}
        className="text-mc-lo hover:text-mc-mid transition-colors"
      >
        ⟳ New session
      </button>
      <button
        onClick={() => router.push('/saved')}
        className="text-mc-lo hover:text-mc-mid transition-colors"
      >
        Saved sessions
      </button>
      {!isDemo && (
        <button
          onClick={handleDelete}
          className="ml-auto text-mc-dim hover:text-mc-onair transition-colors"
        >
          Delete
        </button>
      )}
    </div>
  );
}
