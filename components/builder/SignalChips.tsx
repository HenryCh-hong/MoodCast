import { cn } from '@/lib/utils';

export interface SignalChipsProps {
  mood: string;
  activity: string;
  length: string;
  direction: string;
  onMoodChange: (v: string) => void;
  onActivityChange: (v: string) => void;
  onLengthChange: (v: string) => void;
  onDirectionChange: (v: string) => void;
}

const MOOD_OPTIONS = ['chill', 'focused', 'melancholic', 'energetic', 'late-night', 'morning', 'creative'];
const ACTIVITY_OPTIONS = ['coding', 'reading', 'creating', 'chilling', 'gaming', 'studying', 'working out'];
const LENGTH_OPTIONS = ['30m', '60m', '90m', '120m', '∞'];
const DIRECTION_OPTIONS = ['stay', 'lift', 'soften', 'focus', 'drift'];

interface ChipRowProps {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

function ChipRow({ label, options, value, onChange }: ChipRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo shrink-0 w-20">
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? '' : opt)}
          className={cn(
            'px-2.5 py-1 rounded text-[11px] font-bold tracking-tight border transition-all',
            value === opt
              ? 'border-mc-lav bg-[rgba(184,160,216,0.1)] text-mc-lav'
              : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function SignalChips({
  mood,
  activity,
  length,
  direction,
  onMoodChange,
  onActivityChange,
  onLengthChange,
  onDirectionChange,
}: SignalChipsProps) {
  return (
    <div className="flex flex-col gap-3">
      <ChipRow label="MOOD" options={MOOD_OPTIONS} value={mood} onChange={onMoodChange} />
      <ChipRow label="ACTIVITY" options={ACTIVITY_OPTIONS} value={activity} onChange={onActivityChange} />
      <ChipRow label="SESSION" options={LENGTH_OPTIONS} value={length} onChange={onLengthChange} />
      <ChipRow label="DIRECTION" options={DIRECTION_OPTIONS} value={direction} onChange={onDirectionChange} />
    </div>
  );
}
