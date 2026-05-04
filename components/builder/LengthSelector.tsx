// components/builder/LengthSelector.tsx
import { cn } from '@/lib/utils';

const OPTIONS = ['15 min', '30 min', '45 min', '60 min'];

interface LengthSelectorProps {
  value: string;
  onChange: (v: string) => void;
}

export function LengthSelector({ value, onChange }: LengthSelectorProps) {
  return (
    <div className="mb-6">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">
        Session length
      </p>
      <div className="flex bg-mc-elevated border border-mc-border rounded overflow-hidden">
        {OPTIONS.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'flex-1 py-2.5 text-[11px] font-bold tracking-tight transition-all',
              i < OPTIONS.length - 1 ? 'border-r border-mc-border' : '',
              value === opt
                ? 'bg-[rgba(184,160,216,0.1)] text-mc-lav'
                : 'text-mc-lo hover:text-mc-mid'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
