// components/ui/WaveformStrip.tsx
import { cn } from '@/lib/utils';

const HEIGHTS = [5, 9, 15, 20, 13, 19, 8, 17, 6, 19, 11, 5];

interface WaveformStripProps { className?: string; }

export function WaveformStrip({ className }: WaveformStripProps) {
  return (
    <div className={cn('flex items-center gap-[2px] h-5', className)}>
      {HEIGHTS.map((h, i) => (
        <span
          key={i}
          className="inline-block w-[2px] rounded-[1px] bg-mc-lav opacity-55"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}
