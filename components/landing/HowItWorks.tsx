// components/landing/HowItWorks.tsx
const STEPS = [
  {
    num: '01',
    title: 'Tune your mood',
    body: 'Choose your mood, activity, energy level, and session length. Takes about 15 seconds.',
  },
  {
    num: '02',
    title: 'Shape the signal',
    body: 'Optionally describe your music taste, paste a song list, or pick a DJ style. All optional — skip straight through.',
  },
  {
    num: '03',
    title: 'Broadcast starts',
    body: 'Get an AI DJ opening monologue, a curated track queue with mood tags, and transition lines between every song.',
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-14 max-w-6xl mx-auto border-t border-mc-border">
      {/* Section header with rule */}
      <div className="flex items-center gap-4 mb-12">
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-mc-lo whitespace-nowrap">
          Session Protocol
        </span>
        <span className="flex-1 h-px bg-mc-border" />
      </div>

      <div className="grid sm:grid-cols-3 gap-10">
        {STEPS.map((step) => (
          <div key={step.num}>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-[9px] text-mc-lav tracking-[0.12em]">
                {step.num}
              </span>
              <span className="flex-1 h-px bg-mc-border" />
            </div>
            <h3 className="text-base font-semibold text-mc-hi mb-2">{step.title}</h3>
            <p className="text-sm text-mc-mid leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
