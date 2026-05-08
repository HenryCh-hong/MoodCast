'use client';

import { useState, useCallback } from 'react';
import type { MoodcastSession, AskDJStructuredResponse, AskDJResponseRetune } from '@/lib/types/moodcast';

export function useAskDJ(session: MoodcastSession | null) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [pendingRetune, setPendingRetune] = useState<AskDJResponseRetune | null>(null);

  const ask = useCallback(async (question: string) => {
    if (!question.trim() || !session) return;
    setLoading(true);
    setResponse(null);
    setPendingRetune(null);
    try {
      const res = await fetch('/api/ask-dj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, question }),
      });
      if (!res.ok) {
        setResponse('The DJ is off-air right now. Try again.');
        return;
      }
      const data = await res.json() as AskDJStructuredResponse;
      setResponse(data.djMessage);
      if (data.type === 'session_update') {
        setPendingRetune(data);
      }
    } catch {
      setResponse('Connection lost. Try again.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setPendingRetune(null);
  }, []);

  const clearPendingRetune = useCallback(() => setPendingRetune(null), []);

  return { ask, loading, response, pendingRetune, clearResponse, clearPendingRetune };
}
