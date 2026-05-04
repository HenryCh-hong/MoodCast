// components/builder/DJStyleChips.tsx
import { cn } from '@/lib/utils';

const STYLES = [
  'calm late-night host',
  'poetic & cinematic',
  'minimal & focused',
  'warm & encouraging',
  'dry & witty',
];

interface DJStyleChipsProps {
  value: string;
  onChange: (v: string) => void;
}

export function DJStyleChips({ value, onChange }: DJStyleChipsProps) {
  return (
    <div className="mb-5">
      <p className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">
        DJ voice
        <span className="border border-mc-border rounded px-1.5 py-0.5 text-mc-dim text-[8px] normal-case tracking-normal font-normal">
          optional
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {STYLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(value === s ? '' : s)}
            className={cn(
              'px-3 py-1.5 rounded text-[11px] font-bold tracking-tight border transition-all',
              value === s
                ? 'border-mc-lav bg-[rgba(184,160,216,0.1)] text-mc-lav'
                : 'border-mc-border text-mc-lo hover:border-mc-mid hover:text-mc-mid'
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
