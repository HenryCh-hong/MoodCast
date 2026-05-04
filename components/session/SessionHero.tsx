interface SessionHeroProps {
  session: { sessionTitle: string; sessionSubtitle?: string; mood: string; activity: string; energyArc?: string };
}

export function SessionHero({ session }: SessionHeroProps) {
  return (
    <div className="mb-8">
      <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-onair mb-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-mc-onair animate-breathe inline-block" />
        On Air
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-mc-hi mb-1">{session.sessionTitle}</h1>
      {session.sessionSubtitle && (
        <p className="text-[13px] font-bold tracking-tight text-mc-lo">{session.sessionSubtitle}</p>
      )}
      <div className="flex flex-wrap gap-3 mt-4">
        {[session.mood, session.activity, session.energyArc].filter(Boolean).map((tag) => (
          <span key={tag} className="text-[10px] font-bold tracking-tight border border-mc-border rounded px-2.5 py-1 text-mc-lo">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
