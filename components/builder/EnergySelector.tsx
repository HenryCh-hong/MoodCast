// components/builder/EnergySelector.tsx
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
  { value: 'rising', label: 'rising ↑' },
  { value: 'cooling', label: 'cooling ↓' },
];

interface EnergySelectorProps {
  value: string;
  onChange: (v: string) => void;
}

export function EnergySelector({ value, onChange }: EnergySelectorProps) {
  return (
    <div className="mb-6">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">
        Energy level
      </p>
      <div className="flex bg-mc-elevated border border-mc-border rounded overflow-hidden">
        {OPTIONS.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 py-2.5 text-[11px] font-bold tracking-tight transition-all',
              i < OPTIONS.length - 1 ? 'border-r border-mc-border' : '',
              value === opt.value
                ? 'bg-[rgba(184,160,216,0.1)] text-mc-lav'
                : 'text-mc-lo hover:text-mc-mid'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
