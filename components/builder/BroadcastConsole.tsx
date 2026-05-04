'use client';

import { useState } from 'react';
import { OnAirDot } from '@/components/ui/OnAirDot';
import { RadioVisual } from '@/components/builder/RadioVisual';
import { SignalMeters } from '@/components/builder/SignalMeters';
import { SignalChips } from '@/components/builder/SignalChips';
import type { BroadcastFormData } from '@/lib/types/moodcast';

const DEFAULT_FORM: BroadcastFormData = {
  mood: '',
  activity: '',
  length: '60m',
  direction: '',
  prompt: '',
  seedArtists: '',
  seedTracks: '',
};

export interface BroadcastConsoleProps {
  onGenerate: (form: BroadcastFormData) => void;
  isScanning: boolean;
}

export function BroadcastConsole({ onGenerate, isScanning }: BroadcastConsoleProps) {
  const [form, setForm] = useState<BroadcastFormData>(DEFAULT_FORM);
  const [showOptional, setShowOptional] = useState(false);

  function update<K extends keyof BroadcastFormData>(key: K, value: BroadcastFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div
        className="rounded-xl p-px"
        style={{
          background: 'linear-gradient(135deg, rgba(184,160,216,0.18) 0%, rgba(33,29,43,0.5) 50%, rgba(212,133,106,0.1) 100%)',
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

          {/* Visual panels */}
          <div className="px-6 py-5 flex items-center gap-6 border-b border-mc-border">
            <RadioVisual />
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] font-bold tracking-tight text-mc-lo text-center leading-relaxed">
                Select your signal below.<br />
                <span className="text-mc-dim text-[11px]">Moodcast reads the mood and builds the session.</span>
              </p>
            </div>
            <SignalMeters />
          </div>

          {/* Signal chips */}
          <div className="px-6 py-5">
            <SignalChips
              mood={form.mood}
              activity={form.activity}
              length={form.length}
              direction={form.direction}
              onMoodChange={(v) => update('mood', v)}
              onActivityChange={(v) => update('activity', v)}
              onLengthChange={(v) => update('length', v)}
              onDirectionChange={(v) => update('direction', v)}
            />
          </div>

          {/* Actions row */}
          <div className="border-t border-mc-border px-6 py-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="text-[11px] font-bold tracking-tight text-mc-dim hover:text-mc-lo transition-colors"
            >
              {showOptional ? '↑ Hide options' : '↓ Add note or seed artists'}
            </button>

            <button
              type="button"
              onClick={() => onGenerate(form)}
              disabled={isScanning}
              className="shrink-0 px-5 py-2.5 rounded bg-mc-lav text-[#1a1228] text-[12px] font-bold tracking-tight hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isScanning ? 'scanning···' : '✦ SCAN SIGNAL'}
            </button>
          </div>

          {/* Optional: note + seed */}
          {showOptional && (
            <div className="border-t border-mc-border px-6 py-5 flex flex-col gap-4 bg-mc-elevated">
              <div>
                <label className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-2">
                  Note to the DJ
                  <span className="border border-mc-border rounded px-1.5 py-0.5 text-mc-dim text-[8px] normal-case tracking-normal font-normal">optional</span>
                </label>
                <textarea
                  value={form.prompt ?? ''}
                  onChange={(e) => update('prompt', e.target.value)}
                  rows={2}
                  placeholder="Late night coding, keep it quiet. Something slow and dark..."
                  className="w-full bg-mc-surface border border-mc-border rounded px-3 py-2.5 text-[12px] font-bold tracking-tight text-mc-hi placeholder:text-mc-dim placeholder:font-normal resize-none focus:outline-none focus:border-mc-lav transition-colors"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-2">
                  Seed artists
                  <span className="border border-mc-border rounded px-1.5 py-0.5 text-mc-dim text-[8px] normal-case tracking-normal font-normal">optional</span>
                </label>
                <textarea
                  value={form.seedArtists ?? ''}
                  onChange={(e) => update('seedArtists', e.target.value)}
                  rows={2}
                  placeholder="Frank Ocean, Radiohead, Bon Iver..."
                  className="w-full bg-mc-surface border border-mc-border rounded px-3 py-2.5 text-[12px] font-bold tracking-tight text-mc-hi placeholder:text-mc-dim placeholder:font-normal resize-none focus:outline-none focus:border-mc-lav transition-colors"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-2">
                  Seed songs
                  <span className="border border-mc-border rounded px-1.5 py-0.5 text-mc-dim text-[8px] normal-case tracking-normal font-normal">optional</span>
                </label>
                <textarea
                  value={form.seedTracks ?? ''}
                  onChange={(e) => update('seedTracks', e.target.value)}
                  rows={3}
                  placeholder={'One per line\nHolocene – Bon Iver\nNight Owl – Khruangbin'}
                  className="w-full bg-mc-surface border border-mc-border rounded px-3 py-2.5 text-[12px] font-bold tracking-tight text-mc-hi placeholder:text-mc-dim placeholder:font-normal resize-none focus:outline-none focus:border-mc-lav transition-colors"
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
