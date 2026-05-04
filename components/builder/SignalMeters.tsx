// components/builder/SignalMeters.tsx
import { OnAirDot } from '@/components/ui/OnAirDot';

const WAVEFORM_HEIGHTS = [10, 14, 8, 16, 12];
const WAVEFORM_DELAYS = ['0s', '0.2s', '0.1s', '0.35s', '0.25s'];

export function SignalMeters() {
  return (
    <div className="flex flex-col gap-6">

      {/* SIGNAL IN */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo">
          SIGNAL IN
        </span>
        <div className="flex items-end gap-0.5 h-5">
          {WAVEFORM_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className="w-1 bg-mc-border rounded-sm animate-waveform origin-bottom"
              style={{
                height: `${h}px`,
                animationDelay: WAVEFORM_DELAYS[i],
              }}
            />
          ))}
        </div>
      </div>

      {/* MOOD LEVEL */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo">
          MOOD LEVEL
        </span>
        {/* Decorative dial */}
        <div className="relative w-8 h-8 rounded-full border-2 border-mc-border flex items-center justify-center">
          {/* Fixed position indicator dot — positioned at ~2 o'clock */}
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-mc-lav"
            style={{ top: '3px', right: '3px' }}
          />
        </div>
      </div>

      {/* ON AIR */}
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo">
          ON AIR
        </span>
        <div className="flex items-center gap-2">
          <OnAirDot />
          <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-onair animate-breathe">
            ON AIR
          </span>
        </div>
      </div>

    </div>
  );
}
