'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BroadcastConsole } from '@/components/builder/BroadcastConsole';
import { saveSession } from '@/lib/storage/localSessions';
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
      const res = await fetch('/api/generate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data: GenerateSessionResponse = await res.json();
      const sessionId = data.isDemo ? data.demoId : generateId();
      if (!data.isDemo) {
        saveSession({ id: sessionId, ...data.session, createdAt: new Date().toISOString() });
      }
      router.push(`/session/${sessionId}`);
    } catch {
      setError('Could not reach the session engine. Check your API key in .env.local.');
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
