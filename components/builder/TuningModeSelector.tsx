'use client';

// Two-card chooser at the top of /builder. Picks between Auto Tune
// (MooC reads the moment, skip tag picker) and Manual Tune (existing
// chip-based tag picker). Single source of truth for the visual mode toggle.

import type { SuggestedTagSet } from '@/lib/types/tags';

export type TuningMode = 'auto' | 'manual';

interface TuningModeSelectorProps {
  value: TuningMode;
  onChange: (next: TuningMode) => void;
  suggested: SuggestedTagSet | null;
}

function summariseAuto(s: SuggestedTagSet | null): string {
  if (!s) return 'time · weather · taste';
  const parts = [
    ...s.mood,
    ...s.activity,
    ...s.texture,
    ...s.signal,
    s.familiarity,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'time · weather · taste';
}

export function TuningModeSelector({ value, onChange, suggested }: TuningModeSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      <button
        type="button"
        onClick={() => onChange('auto')}
        className={
          'text-left rounded border px-4 py-3 transition-all ' +
          (value === 'auto'
            ? 'border-mc-lav bg-[rgba(184,160,216,0.1)]'
            : 'border-mc-border hover:border-mc-mid')
        }
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={
              'w-1.5 h-1.5 rounded-full ' +
              (value === 'auto' ? 'bg-mc-lav' : 'bg-mc-dim/50')
            }
          />
          <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo">
            Auto Tune
          </span>
        </div>
        <p className="text-[12px] font-bold tracking-tight text-mc-mid leading-snug">
          MooC reads the moment.
        </p>
        <p className="text-[11px] tracking-tight text-mc-dim leading-snug mt-1">
          {summariseAuto(suggested)}
        </p>
      </button>
      <button
        type="button"
        onClick={() => onChange('manual')}
        className={
          'text-left rounded border px-4 py-3 transition-all ' +
          (value === 'manual'
            ? 'border-mc-lav bg-[rgba(184,160,216,0.1)]'
            : 'border-mc-border hover:border-mc-mid')
        }
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={
              'w-1.5 h-1.5 rounded-full ' +
              (value === 'manual' ? 'bg-mc-lav' : 'bg-mc-dim/50')
            }
          />
          <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo">
            Manual Tune
          </span>
        </div>
        <p className="text-[12px] font-bold tracking-tight text-mc-mid leading-snug">
          Tune it yourself.
        </p>
        <p className="text-[11px] tracking-tight text-mc-dim leading-snug mt-1">
          mood · activity · texture · signal · familiarity
        </p>
      </button>
    </div>
  );
}
