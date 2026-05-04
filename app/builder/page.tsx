'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnAirDot } from '@/components/ui/OnAirDot';
import { StepIndicator } from '@/components/builder/StepIndicator';
import { MoodChips } from '@/components/builder/MoodChips';
import { EnergySelector } from '@/components/builder/EnergySelector';
import { LengthSelector } from '@/components/builder/LengthSelector';
import { MusicTasteInputs } from '@/components/builder/MusicTasteInputs';
import { DJStyleChips } from '@/components/builder/DJStyleChips';
import { saveSession } from '@/lib/storage/localSessions';
import { generateId } from '@/lib/utils';
import type { BuilderFormData, GenerateSessionResponse } from '@/lib/types/moodcast';

const DEFAULT_FORM: BuilderFormData = {
  mood: '',
  activity: '',
  energy: 'medium',
  length: '45 min',
  musicTaste: '',
  songList: '',
  djStyle: '',
};

export default function BuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<BuilderFormData>(DEFAULT_FORM);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof BuilderFormData>(key: K, value: BuilderFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function canProceed() {
    return form.mood.trim() !== '' && form.activity.trim() !== '';
  }

  async function generate() {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data: GenerateSessionResponse = await res.json();
      const sessionId = data.isDemo && data.demoId ? data.demoId : generateId();
      if (!data.isDemo) {
        saveSession({ id: sessionId, ...data.session, createdAt: new Date().toISOString() });
      }
      router.push(`/session/${sessionId}`);
    } catch {
      setError('Could not reach the session engine. Check your API key in .env.local.');
      setIsGenerating(false);
    }
  }

  // ── Generating state ─────────────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-mc-coral opacity-20" />
          <span className="absolute inset-2 rounded-full border border-mc-coral opacity-40" />
          <span className="absolute inset-4 rounded-full border border-mc-coral opacity-70" />
          <span className="w-1.5 h-1.5 rounded-full bg-mc-coral" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lav">
            Moodcast DJ
          </p>
          <p className="text-sm font-bold tracking-tight text-mc-mid">
            Tuning your session<span className="text-mc-lo">···</span>
          </p>
        </div>
      </div>
    );
  }

  // ── Builder ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">

      {/* Console frame */}
      <div
        className="rounded-xl p-px"
        style={{
          background:
            'linear-gradient(135deg, rgba(184,160,216,0.18) 0%, rgba(33,29,43,0.5) 50%, rgba(212,133,106,0.1) 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div className="bg-mc-surface rounded-[11px] overflow-hidden">

          {/* Console header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-mc-border bg-mc-elevated text-[9px] font-bold tracking-[0.16em] uppercase">
            <OnAirDot className="w-1.5 h-1.5" />
            <span className="text-mc-onair">On Air</span>
            <span className="text-mc-dim">·</span>
            <span className="text-mc-mid">Moodcast</span>
            <span className="text-mc-dim">·</span>
            <span className="text-mc-lo">FM 88.7</span>
            <span className="flex-1" />
            <span className="text-mc-dim">session builder</span>
          </div>

          {/* Form body */}
          <div className="px-6 py-7">

            <StepIndicator currentStep={step} />

            {/* Error state */}
            {error && (
              <div className="mb-5 p-3 border border-mc-onair/30 rounded text-[12px] font-bold tracking-tight text-mc-mid bg-mc-elevated">
                {error}
              </div>
            )}

            {/* ── Step 1: Tune your mood ────────────────────────── */}
            {step === 1 && (
              <>
                <div className="mb-7">
                  <h1 className="text-2xl font-bold tracking-tight mb-1">
                    Tune your mood.
                  </h1>
                  <p className="text-[12px] font-bold tracking-tight text-mc-lo">
                    What's the room like right now?
                  </p>
                </div>

                <MoodChips
                  mood={form.mood}
                  activity={form.activity}
                  onMoodChange={(v) => update('mood', v)}
                  onActivityChange={(v) => update('activity', v)}
                />
                <EnergySelector
                  value={form.energy}
                  onChange={(v) => update('energy', v)}
                />
                <LengthSelector
                  value={form.length}
                  onChange={(v) => update('length', v)}
                />

                {/* Actions */}
                <div className="mt-8 space-y-2.5">
                  <button
                    onClick={() => canProceed() && setStep(2)}
                    disabled={!canProceed()}
                    className="w-full py-3 rounded bg-mc-lav text-[#1a1228] text-sm font-bold tracking-tight hover:opacity-90 transition-opacity disabled:opacity-35"
                  >
                    Continue →
                  </button>
                  <button
                    onClick={() => canProceed() && generate()}
                    disabled={!canProceed()}
                    className="w-full py-2.5 rounded border border-mc-border text-[12px] font-bold tracking-tight text-mc-lo hover:border-mc-mid hover:text-mc-mid transition-colors disabled:opacity-35"
                  >
                    Generate with defaults
                  </button>
                  <p className="text-center pt-1">
                    <a
                      href="/session/demo-debugging"
                      className="text-[11px] font-bold tracking-tight text-mc-dim hover:text-mc-lo transition-colors"
                    >
                      or try <span className="text-mc-lo">Demo Mode</span> — no API key needed
                    </a>
                  </p>
                </div>
              </>
            )}

            {/* ── Step 2: Shape the signal ──────────────────────── */}
            {step === 2 && (
              <>
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 text-[11px] font-bold tracking-tight text-mc-lo mb-6 hover:text-mc-mid transition-colors"
                >
                  ← Tune your mood
                </button>

                <div className="mb-7">
                  <h1 className="text-2xl font-bold tracking-tight mb-1">
                    Shape the signal.
                  </h1>
                  <p className="text-[12px] font-bold tracking-tight text-mc-lo">
                    All optional — skip if you want Moodcast to decide.
                  </p>
                </div>

                <MusicTasteInputs
                  musicTaste={form.musicTaste}
                  songList={form.songList}
                  onMusicTasteChange={(v) => update('musicTaste', v)}
                  onSongListChange={(v) => update('songList', v)}
                />

                <div className="border-t border-mc-border my-6" />

                <DJStyleChips
                  value={form.djStyle}
                  onChange={(v) => update('djStyle', v)}
                />

                {/* Actions */}
                <div className="mt-8 space-y-2.5">
                  <button
                    onClick={generate}
                    className="w-full py-3 rounded bg-mc-lav text-[#1a1228] text-sm font-bold tracking-tight hover:opacity-90 transition-opacity"
                  >
                    ✦ Generate Moodcast
                  </button>
                  <button
                    onClick={generate}
                    className="w-full py-2.5 rounded border border-mc-border text-[12px] font-bold tracking-tight text-mc-lo hover:border-mc-mid hover:text-mc-mid transition-colors"
                  >
                    Skip and generate
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Console footer: signal summary */}
          <div className="border-t border-mc-border bg-mc-elevated px-5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-bold tracking-[0.12em]">
              <span>
                <span className="text-mc-lo">mood:</span>{' '}
                <span className={form.mood ? 'text-mc-mid' : 'text-mc-dim'}>
                  {form.mood || '—'}
                </span>
              </span>
              <span>
                <span className="text-mc-lo">activity:</span>{' '}
                <span className={form.activity ? 'text-mc-mid' : 'text-mc-dim'}>
                  {form.activity || '—'}
                </span>
              </span>
              <span>
                <span className="text-mc-lo">energy:</span>{' '}
                <span className="text-mc-mid">{form.energy}</span>
              </span>
              <span>
                <span className="text-mc-lo">length:</span>{' '}
                <span className="text-mc-mid">{form.length}</span>
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
