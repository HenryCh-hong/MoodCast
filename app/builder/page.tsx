'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BroadcastConsole } from '@/components/builder/BroadcastConsole';
import { getSessions, saveSession } from '@/lib/storage/localSessions';
import { generateId } from '@/lib/utils';
import type { BroadcastFormData, GenerateSessionResponse } from '@/lib/types/moodcast';

export default function BuilderPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(form: BroadcastFormData) {
    setIsScanning(true);
    setError(null);
    try {
      // Slim snapshot of local session history — passed as context to the AI.
      // Only mood/activity/createdAt are sent; no track data leaves the client.
      const recentSessions = (() => {
        try {
          return getSessions()
            .slice(0, 5)
            .map(({ mood, activity, createdAt }) => ({ mood, activity, createdAt }));
        } catch {
          return [];
        }
      })();
      const res = await fetch('/api/generate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, recentSessions }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const data: GenerateSessionResponse = await res.json();
      const sessionId = data.isDemo ? data.demoId : generateId();
      if (!data.isDemo) {
        saveSession({ id: sessionId, ...data.session, createdAt: new Date().toISOString() });
      }
      router.push(`/session/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the session engine.');
      setIsScanning(false);
    }
  }

  return (
    <>
      {error && (
        <div className="max-w-4xl mx-auto px-6 pt-6">
          <div className="p-3 border border-mc-onair/30 rounded text-[12px] font-bold tracking-tight text-mc-mid bg-mc-elevated">
            {error}
          </div>
        </div>
      )}
      <BroadcastConsole onGenerate={generate} isScanning={isScanning} />
    </>
  );
}
