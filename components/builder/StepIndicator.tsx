// components/builder/StepIndicator.tsx
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: 1 | 2;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {/* Step 1 node */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span
          className={cn(
            'w-2 h-2 rounded-full transition-all',
            currentStep === 1
              ? 'bg-mc-lav shadow-[0_0_6px_rgba(184,160,216,0.5)]'
              : 'bg-mc-faded'
          )}
        />
        <span
          className={cn(
            'text-[8px] tracking-[0.1em] uppercase leading-none whitespace-nowrap transition-colors',
            currentStep === 1 ? 'text-mc-lav' : 'text-mc-lo'
          )}
        >
          Tune mood
        </span>
      </div>

      {/* Connector */}
      <div
        className={cn(
          'flex-1 h-px transition-colors',
          currentStep === 2 ? 'bg-mc-faded' : 'bg-mc-border'
        )}
      />

      {/* Step 2 node */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span
          className={cn(
            'w-2 h-2 rounded-full border transition-all',
            currentStep === 2
              ? 'bg-mc-lav border-mc-lav shadow-[0_0_6px_rgba(184,160,216,0.5)]'
              : 'border-mc-border bg-transparent'
          )}
        />
        <span
          className={cn(
            'text-[8px] tracking-[0.1em] uppercase leading-none whitespace-nowrap transition-colors',
            currentStep === 2 ? 'text-mc-lav' : 'text-mc-lo'
          )}
        >
          Shape signal
        </span>
      </div>
    </div>
  );
}
