interface DJMonologueCardProps {
  monologue: string;
}

export function DJMonologueCard({ monologue }: DJMonologueCardProps) {
  return (
    <div className="mb-6 p-5 border border-mc-border rounded bg-mc-elevated">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">DJ Opening</p>
      <p className="text-[14px] font-sans italic text-mc-mid leading-[1.75]">{monologue}</p>
    </div>
  );
}
