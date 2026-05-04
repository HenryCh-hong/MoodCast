// components/landing/ExampleSessionCard.tsx
const SESSIONS = [
  {
    id: 'demo-debugging',
    title: 'Late Night Debugging FM',
    tags: 'tired · melancholic · coding',
    length: '45 min',
    nowPlaying: { label: 'NOW', track: 'Holocene', artist: 'Bon Iver' },
  },
  {
    id: 'demo-walk',
    title: 'Midnight Walk',
    tags: 'nostalgic · lonely but peaceful',
    length: '20 min',
    nowPlaying: { label: 'NOW', track: 'Street Lights', artist: 'Kanye West' },
  },
  {
    id: 'demo-design',
    title: 'Design Sprint Radio',
    tags: 'energetic · creative',
    length: '45 min',
    nowPlaying: { label: 'NOW', track: 'Electric Feel', artist: 'MGMT' },
  },
];

export function ExampleSessionCard() {
  return (
    <section className="px-6 py-14 max-w-6xl mx-auto border-t border-mc-border">
      <div className="flex items-center gap-4 mb-12">
        <span className="text-[9px] tracking-[0.2em] uppercase text-mc-lo whitespace-nowrap">
          Demo Sessions
        </span>
        <span className="flex-1 h-px bg-mc-border" />
        <span className="text-[9px] text-mc-dim whitespace-nowrap">no API key required</span>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {SESSIONS.map((s) => (
          <a
            key={s.id}
            href={`/session/${s.id}`}
            className="group block bg-mc-surface border border-mc-border rounded-xl p-4 hover:border-mc-lav transition-colors"
          >
            <p className="text-[8px] tracking-[0.12em] uppercase text-mc-lo mb-3 flex items-center justify-between">
              <span>Demo</span>
              <span>{s.length}</span>
            </p>

            <h3 className="text-sm font-semibold text-mc-hi leading-tight mb-1 tracking-tight group-hover:text-mc-lav transition-colors">
              {s.title}
            </h3>
            <p className="text-[10px] text-mc-lo mb-4">{s.tags}</p>

            <div className="flex items-center gap-2 pt-3 border-t border-mc-border">
              <span className="text-[9px] text-mc-lav font-bold">
                {s.nowPlaying.label}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-mc-mid truncate">
                  {s.nowPlaying.track}
                </p>
                <p className="text-[9px] text-mc-lo">{s.nowPlaying.artist}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
