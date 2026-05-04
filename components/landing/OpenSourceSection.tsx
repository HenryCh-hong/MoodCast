// components/landing/OpenSourceSection.tsx
const BADGES = [
  { label: 'Self-hostable' },
  { label: 'BYOK' },
  { label: 'No music hosting' },
  { label: 'No account required' },
  { label: 'MIT License' },
];

export function OpenSourceSection() {
  return (
    <section className="px-6 py-16 max-w-6xl mx-auto border-t border-mc-border">
      <div className="max-w-xl">
        <p className="text-[9px] font-mono font-bold tracking-[0.18em] uppercase text-mc-lo mb-6">
          Open source · BYOK
        </p>
        <h2 className="text-2xl font-bold tracking-tight mb-4">
          Your key. Your cost. Your data.
        </h2>
        <p className="text-mc-mid text-sm leading-relaxed mb-8">
          Moodcast is local-first and BYOK. You provide your own Anthropic API key —
          the project author does not pay for your generations, and your sessions
          never leave your machine. No database, no accounts, no subscription.
        </p>
        <div className="flex flex-wrap gap-2 mb-8">
          {BADGES.map((b) => (
            <span
              key={b.label}
              className="text-[10px] font-mono tracking-[0.08em] px-3 py-1 rounded border border-mc-border text-mc-lo"
            >
              {b.label}
            </span>
          ))}
        </div>
        <div className="bg-mc-elevated border border-mc-border rounded-lg p-4 font-mono text-xs text-mc-mid space-y-1">
          <p><span className="text-mc-lo">$</span> git clone https://github.com/your-org/moodcast</p>
          <p><span className="text-mc-lo">$</span> cp .env.example .env.local</p>
          <p><span className="text-mc-lo">$</span> <span className="text-mc-lav"># add ANTHROPIC_API_KEY to .env.local</span></p>
          <p><span className="text-mc-lo">$</span> npm install && npm run dev</p>
        </div>
      </div>
    </section>
  );
}
