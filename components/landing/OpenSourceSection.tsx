// components/landing/OpenSourceSection.tsx
const BADGES = [
  'Self-hostable',
  'BYOK',
  'No music hosting',
  'No account required',
  'MIT License',
  'Demo mode included',
];

export function OpenSourceSection() {
  return (
    <section className="px-6 py-14 max-w-6xl mx-auto border-t border-mc-border">
      <div className="flex items-center gap-4 mb-12">
        <span className="text-[9px] tracking-[0.2em] uppercase text-mc-lo whitespace-nowrap">
          Open Source · BYOK
        </span>
        <span className="flex-1 h-px bg-mc-border" />
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-4">
            Your key. Your cost. Your data.
          </h2>
          <p className="text-[13px] text-mc-mid leading-[1.75] mb-7">
            Moodcast is local-first and BYOK. You provide your own Anthropic API
            key — the project author does not pay for your generations, and your
            sessions never leave your machine. No database, no accounts, no
            subscription. No key? Demo mode activates automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            {BADGES.map((b) => (
              <span
                key={b}
                className="text-[9px] tracking-[0.1em] uppercase px-3 py-1.5 rounded border border-mc-border text-mc-lo"
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-mc-elevated border border-mc-border rounded-lg overflow-hidden text-xs">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-mc-border">
            <span className="text-[9px] tracking-[0.1em] text-mc-lo">setup</span>
            <span className="text-[9px] text-mc-lo">~5 min</span>
          </div>
          <div className="p-4 space-y-1.5 text-mc-mid">
            <p><span className="text-mc-lo">$</span> git clone https://github.com/your-org/moodcast</p>
            <p><span className="text-mc-lo">$</span> cd moodcast</p>
            <p><span className="text-mc-lo">$</span> npm install</p>
            <p><span className="text-mc-lo">$</span> cp .env.example .env.local</p>
            <p className="text-mc-lav"><span className="text-mc-lo">#</span> add ANTHROPIC_API_KEY to .env.local</p>
            <p><span className="text-mc-lo">$</span> npm run dev</p>
          </div>
          <div className="px-4 pb-4 space-y-1 border-t border-mc-border mx-4 pt-3">
            <p><span className="text-mc-sage">●</span> <span className="text-mc-mid">ready on localhost:3000</span></p>
            <p className="text-mc-lo">no key? <span className="text-mc-lav">demo mode activates automatically.</span></p>
          </div>
        </div>
      </div>
    </section>
  );
}
