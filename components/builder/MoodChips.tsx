// components/builder/MoodChips.tsx
'use client';

import { cn } from '@/lib/utils';

const MOOD_PRESETS = [
  'calm', 'tired', 'focused', 'anxious',
  'nostalgic', 'restless', 'hopeful', 'heartbroken',
  'not sure',
];

const ACTIVITIES = [
  'coding', 'studying', 'writing', 'designing',
  'walking', 'gym', 'planning', 'late-night thinking',
];

interface MoodChipsProps {
  mood: string;
  activity: string;
  onMoodChange: (v: string) => void;
  onActivityChange: (v: string) => void;
}

export function MoodChips({ mood, activity, onMoodChange, onActivityChange }: MoodChipsProps) {
  const isPreset = MOOD_PRESETS.includes(mood);

  return (
    <>
      {/* Mood */}
      <div className="mb-6">
        <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">
          Mood
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {MOOD_PRESETS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onMoodChange(opt)}
              className={cn(
                'px-3 py-1.5 rounded text-[11px] font-bold tracking-tight border transition-all',
                mood === opt
                  ? 'border-mc-lav bg-[rgba(184,160,216,0.1)] text-mc-lav'
                  : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        {/* Free-text input — chips fill it, user can override */}
        <input
          type="text"
          value={isPreset ? '' : mood}
          onChange={(e) => onMoodChange(e.target.value)}
          onFocus={() => { if (isPreset) onMoodChange(''); }}
          placeholder="or describe it in your own words →"
          className="w-full bg-mc-elevated border border-mc-border rounded px-3 py-2 text-[12px] font-bold tracking-tight text-mc-mid placeholder:text-mc-dim placeholder:font-normal focus:outline-none focus:border-mc-lav transition-colors"
        />
        {mood === 'not sure' && (
          <p className="mt-2 text-[11px] font-bold tracking-tight text-mc-lo">
            That's fine. Moodcast reads uncertainty as a signal too.
          </p>
        )}
      </div>

      {/* Activity */}
      <div className="mb-6">
        <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">
          Activity
        </p>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onActivityChange(opt)}
              className={cn(
                'px-3 py-1.5 rounded text-[11px] font-bold tracking-tight border transition-all',
                activity === opt
                  ? 'border-mc-lav bg-[rgba(184,160,216,0.1)] text-mc-lav'
                  : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
