import { cn } from '@/lib/utils';

interface ArcPhase {
  phase: string;
  description: string;
}

interface SessionArcPanelProps {
  arc: ArcPhase[];
}

export function SessionArcPanel({ arc }: SessionArcPanelProps) {
  return (
    <div className="mb-6 p-5 border border-mc-border rounded bg-mc-elevated">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-4">Emotional Arc</p>
      <div className="flex items-start gap-0">
        {arc.map((phase, i) => (
          <div key={i} className="flex-1 relative">
            {/* Connector line */}
            {i < arc.length - 1 && (
              <div className="absolute top-[5px] left-[50%] w-full h-px bg-mc-border" />
            )}
            <div className="relative flex flex-col items-center gap-2">
              <div className={cn(
                'w-2.5 h-2.5 rounded-full border-2 z-10',
                i === 0 || i === arc.length - 1
                  ? 'border-mc-lav bg-transparent'
                  : 'border-mc-border bg-mc-bg'
              )} />
              <p className="text-[9px] font-bold tracking-tight text-mc-lo text-center px-1">{phase.phase}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1">
        {arc.map((phase, i) => (
          <p key={i} className="text-[11px] font-bold tracking-tight text-mc-dim">
            <span className="text-mc-lo">{phase.phase}:</span> {phase.description}
          </p>
        ))}
      </div>
    </div>
  );
}
