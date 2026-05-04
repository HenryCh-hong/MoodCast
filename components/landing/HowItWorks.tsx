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
    body: 'Optionally describe your music taste, paste a song list, or pick a DJ style. All optional.',
  },
  {
    num: '03',
    title: 'Your session starts',
    body: 'Get an AI DJ opening monologue, a curated track queue with mood tags, and transition lines between every song.',
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-16 max-w-6xl mx-auto border-t border-mc-border">
      <p className="text-[9px] font-mono font-bold tracking-[0.18em] uppercase text-mc-lo mb-10">
        How it works
      </p>
      <div className="grid sm:grid-cols-3 gap-8">
        {STEPS.map((step) => (
          <div key={step.num}>
            <div className="text-[9px] font-mono text-mc-lav tracking-[0.1em] uppercase mb-3">
              {step.num} ·
            </div>
            <h3 className="text-base font-semibold text-mc-hi mb-2">{step.title}</h3>
            <p className="text-sm text-mc-mid leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
