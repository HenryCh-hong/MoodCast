// components/ui/DemoBadge.tsx
export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.12em] uppercase font-mono text-mc-mid border border-mc-border rounded px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-mc-lav opacity-50" />
      Demo Mode
    </span>
  );
}
