// components/landing/ExampleSessionCard.tsx
import { WaveformStrip } from '@/components/ui/WaveformStrip';
import { OnAirDot } from '@/components/ui/OnAirDot';

const TRACKS = [
  { label: 'NOW', title: 'Holocene', artist: 'Bon Iver', tag: 'melancholic' },
  { label: 'NEXT', title: 'Night Owl', artist: 'Khruangbin', tag: 'drifting' },
  { label: 'CUE 3', title: 'Motion Picture Soundtrack', artist: 'Radiohead', tag: 'melancholic' },
];

export function ExampleSessionCard() {
  return (
    <section className="px-6 py-14 max-w-6xl mx-auto border-t border-mc-border">
      {/* Section header with rule */}
      <div className="flex items-center gap-4 mb-12">
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-mc-lo whitespace-nowrap">
          Live Session Example
        </span>
        <span className="flex-1 h-px bg-mc-border" />
      </div>

      <div className="bg-mc-surface border border-mc-border rounded-xl overflow-hidden max-w-2xl">
        {/* Top broadcast bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-mc-border bg-mc-elevated">
          <div className="flex items-center gap-2">
            <OnAirDot />
            <span className="text-[9px] font-mono font-semibold tracking-[0.18em] uppercase text-mc-onair">
              On Air
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] text-mc-lo tracking-[0.08em]">
            <span>FM 88.7</span>
            <span className="text-mc-dim">·</span>
            <span>45 min</span>
            <span className="text-mc-dim">·</span>
            <span>demo session</span>
          </div>
        </div>

        {/* Session body */}
        <div className="p-5">
          <p className="font-mono text-[9px] text-mc-coral tracking-[0.12em] uppercase mb-2">
            AI Radio Session
          </p>
          <h3 className="text-xl font-bold tracking-tight mb-1">
            Late Night <em className="text-mc-lav not-italic">Debugging</em> FM
          </h3>
          <p className="font-mono text-[9px] text-mc-lo tracking-[0.06em] mb-5">
            tired · melancholic · coding · 45 min
          </p>

          {/* DJ monologue snippet */}
          <div className="bg-mc-elevated border border-mc-border rounded-lg p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-[9px] text-mc-lo tracking-[0.14em] uppercase">
                AI DJ · Opening Monologue
              </p>
              <WaveformStrip />
            </div>
            <p className="text-sm text-mc-mid italic leading-relaxed">
              &ldquo;It&rsquo;s late. The screen is still too bright, and you&rsquo;ve got one more thing to
              finish — the kind of thing that keeps you up not because it has to, but because
              you need it to feel right before you can sleep.&rdquo;
            </p>
          </div>

          {/* Track queue preview */}
          <div className="space-y-2.5">
            {TRACKS.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm"
                style={{ opacity: 1 - i * 0.2 }}
              >
                <span className="font-mono text-[9px] w-10 text-mc-lav font-bold tracking-[0.06em]">
                  {t.label}
                </span>
                <span className="text-mc-hi font-medium flex-1">{t.title}</span>
                <span className="font-mono text-[10px] text-mc-lo">{t.artist}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
