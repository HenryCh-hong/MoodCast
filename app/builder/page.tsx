'use client';

// Web Moodcast builder — context-aware flow that mirrors the CLI:
//
//   1. Fetch /api/context/moment to get a privacy-summarised MomentContext.
//   2. Render a "Signal Scan" card with the same fields as the terminal.
//   3. Pre-fill suggested tags via suggestTags(ctx).
//   4. User picks Auto Tune (skip tag picker) or Manual Tune (edit tags).
//   5. Submit → POST /api/generate-session with {form, momentContext, selectedTags}.
//   6. Route to /session/<sessionId>.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnAirDot } from '@/components/ui/OnAirDot';
import { SignalScanCard } from '@/components/builder/SignalScanCard';
import { TagChips } from '@/components/builder/TagChips';
import { TuningModeSelector, type TuningMode } from '@/components/builder/TuningModeSelector';
import { getSessions } from '@/lib/storage/localSessions';
import { suggestTags } from '@/lib/tags/suggest';
import { readPreferences, writePreferences } from '@/lib/storage/preferencesClient';
import type { BroadcastFormData, GenerateSessionResponse } from '@/lib/types/moodcast';
import type { MomentContext } from '@/lib/types/momentContext';
import type { SelectedTagSet, SuggestedTagSet } from '@/lib/types/tags';

const LENGTH_OPTIONS = ['30m', '45m', '60m', '90m'];

const DEFAULT_TAGS: SelectedTagSet = {
  mood: [],
  activity: [],
  texture: [],
  signal: [],
  familiarity: 'balanced',
};

function deriveForm(tags: SelectedTagSet, ctx: MomentContext | null, length: string): BroadcastFormData {
  const mood = tags.mood[0] ?? (ctx?.timeOfDay.includes('morning') ? 'gentle' : 'focused');
  const activity = tags.activity[0] ?? (ctx?.dayType === 'weekend' ? 'walking' : 'working');
  return { mood, activity, length, direction: 'stay' };
}

function suggestedToSelected(s: SuggestedTagSet, fallbackDial: string): SelectedTagSet {
  return {
    mood: s.mood,
    activity: s.activity,
    texture: s.texture,
    signal: s.signal,
    familiarity: s.familiarity || fallbackDial || 'balanced',
  };
}

export default function BuilderPage() {
  const router = useRouter();
  const [ctx, setCtx] = useState<MomentContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [suggested, setSuggested] = useState<SuggestedTagSet | null>(null);
  const [tags, setTags] = useState<SelectedTagSet>(DEFAULT_TAGS);
  const [length, setLength] = useState<string>('45m');
  const [mode, setMode] = useState<TuningMode>('auto');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount: load saved tuning-mode preference and fetch the moment context.
  // Both happen inside the async IIFE so neither setState is a synchronous
  // call from the effect body (Next.js 16 lint rule react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = readPreferences();
      if (cancelled) return;
      setMode(prefs.tuningMode === 'manual' ? 'manual' : 'auto');
      try {
        const res = await fetch('/api/context/moment', { cache: 'no-store' });
        if (!res.ok) throw new Error(`context HTTP ${res.status}`);
        const body = (await res.json()) as { context: MomentContext };
        if (cancelled) return;
        setCtx(body.context);
        const s = suggestTags(body.context);
        setSuggested(s);
        setTags(suggestedToSelected(s, body.context.discoveryRecommendation));
      } catch {
        if (!cancelled) setCtx(null);
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleModeChange(next: TuningMode) {
    setMode(next);
    try {
      writePreferences({ tuningMode: next });
    } catch {
      /* localStorage quota / unavailable — non-fatal */
    }
  }

  const recentSessions = useMemo(() => {
    try {
      return getSessions()
        .slice(0, 5)
        .map(({ mood, activity, createdAt }) => ({ mood, activity, createdAt }));
    } catch {
      return [];
    }
  }, []);

  async function generate() {
    setIsScanning(true);
    setError(null);
    try {
      // Auto mode generates from the suggested tags directly. Manual uses
      // whatever the user has tweaked in TagChips.
      const submitTags =
        mode === 'auto' && suggested
          ? suggestedToSelected(suggested, ctx?.discoveryRecommendation ?? 'balanced')
          : tags;
      const form = deriveForm(submitTags, ctx, length);
      const res = await fetch('/api/generate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          recentSessions,
          momentContext: ctx ?? undefined,
          selectedTags: submitTags,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          code?: string;
          provider?: string;
        };
        if (body.code === 'AI_QUOTA_EXCEEDED') {
          throw new Error(
            body.message ??
              `MooC reached the ${body.provider ?? 'AI'} API limit for this key. The signal was tuned, but session generation could not complete. Try again after the quota resets, or update the provider key.`,
          );
        }
        throw new Error(body.error ?? body.message ?? `Server error ${res.status}`);
      }
      const data = (await res.json()) as GenerateSessionResponse;
      router.push(`/session/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the session engine.');
      setIsScanning(false);
    }
  }

  const buttonLabel =
    mode === 'auto' ? '✦ AUTO TUNE MOODCAST' : '✦ GENERATE FROM SELECTED SIGNAL';

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {error && (
        <div className="mb-4 p-3 border border-mc-onair/30 rounded text-[12px] font-bold tracking-tight text-mc-mid bg-mc-elevated">
          {error}
        </div>
      )}

      <div
        className="rounded-xl p-px"
        style={{
          background:
            'linear-gradient(135deg, rgba(184,160,216,0.18) 0%, rgba(33,29,43,0.5) 50%, rgba(212,133,106,0.1) 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div className="bg-mc-surface rounded-[11px] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-mc-border bg-mc-elevated text-[9px] font-bold tracking-[0.16em] uppercase">
            <OnAirDot className="w-1.5 h-1.5" />
            <span className="text-mc-onair">On Air</span>
            <span className="text-mc-dim">·</span>
            <span className="text-mc-mid">Moodcast</span>
            <span className="text-mc-dim">·</span>
            <span className="text-mc-lo">FM 88.7</span>
            <span className="flex-1" />
            <span className="text-mc-dim">tune the signal</span>
          </div>

          <div className="px-6 py-5 border-b border-mc-border">
            <SignalScanCard context={ctx} loading={ctxLoading} />
            <TuningModeSelector value={mode} onChange={handleModeChange} suggested={suggested} />
            <p className="text-[11px] font-bold tracking-tight text-mc-dim leading-relaxed">
              {mode === 'auto'
                ? 'MooC will read the moment and pick the signal — adjust below, or hit Auto Tune.'
                : 'Tune the tags yourself. Selected tags override auto suggestions.'}
            </p>
          </div>

          {mode === 'manual' && (
            <div className="px-6 py-5 border-b border-mc-border">
              <TagChips value={tags} onChange={setTags} />
            </div>
          )}

          <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo shrink-0 w-20">
              session
            </span>
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setLength(opt)}
                className={
                  'px-2.5 py-1 rounded text-[11px] font-bold tracking-tight border transition-all ' +
                  (length === opt
                    ? 'border-mc-lav bg-[rgba(184,160,216,0.1)] text-mc-lav'
                    : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid')
                }
              >
                {opt}
              </button>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={generate}
              disabled={isScanning}
              className="shrink-0 px-5 py-2.5 rounded bg-mc-lav text-[#1a1228] text-[12px] font-bold tracking-tight hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isScanning ? 'scanning···' : buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
