'use client';

import { useState } from 'react';
import type { MoodcastSession } from '@/lib/types/moodcast';

const HINTS = [
  'Why this track now?',
  'What comes after this?',
  'Can you lift the energy?',
  'What should I feel next?',
];

interface AskDJPanelProps {
  session: MoodcastSession;
}

export function AskDJPanel({ session }: AskDJPanelProps) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch('/api/ask-dj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, question: q }),
      });
      const data = await res.json() as { djMessage: string };
      setResponse(data.djMessage);
    } finally {
      setLoading(false);
      setQuestion('');
    }
  }

  return (
    <div className="mt-8 mb-6 p-5 border border-mc-border rounded bg-mc-elevated">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-4">Ask the DJ</p>

      {response && (
        <div className="mb-4 p-3 border border-mc-border rounded">
          <p className="text-[13px] font-sans italic text-mc-mid leading-relaxed">{response}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {HINTS.map((hint) => (
          <button
            key={hint}
            onClick={() => ask(hint)}
            disabled={loading}
            className="text-[10px] font-bold tracking-tight border border-mc-border rounded px-2.5 py-1 text-mc-dim hover:text-mc-lo hover:border-mc-mid transition-colors disabled:opacity-40"
          >
            {hint}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask(question)}
          placeholder="Ask the DJ anything..."
          className="flex-1 bg-mc-surface border border-mc-border rounded px-3 py-2 text-[12px] font-bold tracking-tight text-mc-hi placeholder:text-mc-dim placeholder:font-normal focus:outline-none focus:border-mc-lav transition-colors"
        />
        <button
          onClick={() => ask(question)}
          disabled={loading || !question.trim()}
          className="px-3 py-2 rounded border border-mc-border text-[11px] font-bold tracking-tight text-mc-lo hover:border-mc-mid hover:text-mc-mid transition-colors disabled:opacity-35"
        >
          {loading ? '···' : 'Send'}
        </button>
      </div>
    </div>
  );
}
