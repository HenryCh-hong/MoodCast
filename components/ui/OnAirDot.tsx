// components/ui/OnAirDot.tsx
import { cn } from '@/lib/utils';

interface OnAirDotProps { className?: string; }

export function OnAirDot({ className }: OnAirDotProps) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full bg-mc-onair animate-breathe',
        className
      )}
    />
  );
}
