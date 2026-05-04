// components/builder/BroadcastConsole.tsx
'use client';

import { useState } from 'react';
import { OnAirDot } from '@/components/ui/OnAirDot';
import { RadioVisual } from '@/components/builder/RadioVisual';
import { PromptTerminal } from '@/components/builder/PromptTerminal';
import { SignalMeters } from '@/components/builder/SignalMeters';
import { SignalChips } from '@/components/builder/SignalChips';
import type { BroadcastFormData } from '@/lib/types/moodcast';

const DEFAULT_FORM: BroadcastFormData = {
  prompt: '',
  activity: '',
  length: '',
  direction: '',
  seedArtists: '',
  seedTracks: '',
};

export interface BroadcastConsoleProps {
  onGenerate: (form: BroadcastFormData) => void;
  isScanning: boolean;
}

export function BroadcastConsole({ onGenerate, isScanning }: BroadcastConsoleProps) {
  const [form, setForm] = useState<BroadcastFormData>(DEFAULT_FORM);
  const [showSeed, setShowSeed] = useState(false);

  function update<K extends keyof BroadcastFormData>(key: K, value: BroadcastFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const canScan = form.prompt.trim() !== '' && !isScanning;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Gradient border wrapper */}
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

          {/* Main body */}
          <div className="px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-6 items-start">

              {/* Left: RadioVisual */}
              <div className="shrink-0">
                <RadioVisual />
              </div>

              {/* Center: PromptTerminal */}
              <div className="flex-1 min-w-0">
                <PromptTerminal
                  value={form.prompt}
                  onChange={(v) => update('prompt', v)}
                />
              </div>

              {/* Right: SignalMeters */}
              <div className="shrink-0">
                <SignalMeters />
              </div>

            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-mc-border" />

          {/* SignalChips + SCAN SIGNAL button */}
          <div className="px-6 py-5 flex flex-col sm:flex-row gap-5 items-start sm:items-end">
            <div className="flex-1 min-w-0">
              <SignalChips
                activity={form.activity}
                length={form.length}
                direction={form.direction}
                onActivityChange={(v) => update('activity', v)}
                onLengthChange={(v) => update('length', v)}
                onDirectionChange={(v) => update('direction', v)}
              />
            </div>

            {/* SCAN SIGNAL button */}
            <button
              type="button"
              onClick={() => onGenerate(form)}
              disabled={!canScan}
              className="shrink-0 px-5 py-2.5 rounded bg-mc-lav text-[#1a1228] text-[12px] font-bold tracking-tight hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isScanning ? 'scanning···' : '✦ SCAN SIGNAL'}
            </button>
          </div>

          {/* Seed artists/songs expandable section */}
          <div className="border-t border-mc-border px-6 py-4">
            <button
              type="button"
              onClick={() => setShowSeed((v) => !v)}
              className="text-[11px] font-bold tracking-tight text-mc-dim hover:text-mc-lo transition-colors"
            >
              ♪ No taste input? Moodcast infers from your signal.{' '}
              <span className="text-mc-lo">
                {showSeed ? 'Hide artists/songs ↑' : 'Add artists/songs ↓'}
              </span>
            </button>

            {showSeed && (
              <div className="mt-4 flex flex-col gap-4">
                {/* Seed artists */}
                <div>
                  <label className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">
                    Seed artists
                    <span className="border border-mc-border rounded px-1.5 py-0.5 text-mc-dim text-[8px] normal-case tracking-normal font-normal">
                      optional
                    </span>
                  </label>
                  <textarea
                    value={form.seedArtists ?? ''}
                    onChange={(e) => update('seedArtists', e.target.value)}
                    rows={3}
                    placeholder="Frank Ocean, Radiohead, Bon Iver, ambient electronic..."
                    className="w-full bg-mc-elevated border border-mc-border rounded px-3 py-2.5 text-[12px] font-bold tracking-tight text-mc-mid placeholder:text-mc-dim placeholder:font-normal resize-none focus:outline-none focus:border-mc-lav transition-colors"
                  />
                </div>

                {/* Seed tracks */}
                <div>
                  <label className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">
                    Seed songs
                    <span className="border border-mc-border rounded px-1.5 py-0.5 text-mc-dim text-[8px] normal-case tracking-normal font-normal">
                      optional
                    </span>
                  </label>
                  <textarea
                    value={form.seedTracks ?? ''}
                    onChange={(e) => update('seedTracks', e.target.value)}
                    rows={4}
                    placeholder={'One song per line — Moodcast builds the session around them\nHolocene – Bon Iver\nNight Owl – Khruangbin'}
                    className="w-full bg-mc-elevated border border-mc-border rounded px-3 py-2.5 text-[12px] font-bold tracking-tight text-mc-mid placeholder:text-mc-dim placeholder:font-normal resize-none focus:outline-none focus:border-mc-lav transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
