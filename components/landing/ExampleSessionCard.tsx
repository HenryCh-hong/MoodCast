// components/landing/ExampleSessionCard.tsx
import { WaveformStrip } from '@/components/ui/WaveformStrip';
import { OnAirDot } from '@/components/ui/OnAirDot';

export function ExampleSessionCard() {
  return (
    <section className="px-6 py-16 max-w-6xl mx-auto border-t border-mc-border">
      <p className="text-[9px] font-mono font-bold tracking-[0.18em] uppercase text-mc-lo mb-10">
        Example session
      </p>
      <div className="bg-mc-surface border border-mc-border rounded-xl overflow-hidden max-w-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-mc-border bg-mc-elevated">
          <div className="flex items-center gap-2">
            <OnAirDot />
            <span className="text-[10px] font-mono font-semibold tracking-[0.14em] uppercase text-mc-onair">
              On Air
            </span>
          </div>
          <span className="text-[10px] font-mono text-mc-lo">FM 88.7 · 45 min</span>
        </div>
        {/* Session info */}
        <div className="p-5">
          <p className="text-[9px] font-mono text-mc-coral tracking-[0.1em] uppercase mb-2">
            AI Radio Session
          </p>
          <h3 className="text-xl font-bold tracking-tight mb-1">
            Late Night <em className="text-mc-lav not-italic">Debugging</em> FM
          </h3>
          <p className="text-xs text-mc-mid mb-4">tired · melancholic · coding · 45 min</p>

          {/* DJ snippet */}
          <div className="bg-mc-elevated border border-mc-border rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-mono text-mc-lo tracking-[0.12em] uppercase">
                AI DJ · Opening
              </p>
              <WaveformStrip />
            </div>
            <p className="text-sm text-mc-mid italic leading-relaxed">
              &ldquo;It&rsquo;s late. The screen is still too bright, and you&rsquo;ve got one more thing to
              finish — the kind of thing that keeps you up not because it has to, but because
              you need it to feel right before you can sleep.&rdquo;
            </p>
          </div>

          {/* 3 tracks preview */}
          <div className="space-y-2">
            {[
              { label: 'NOW', title: 'Holocene', artist: 'Bon Iver', tag: 'melancholic' },
              { label: 'NEXT', title: 'Night Owl', artist: 'Khruangbin', tag: 'drifting' },
              { label: 'CUE 3', title: 'Motion Picture Soundtrack', artist: 'Radiohead', tag: 'melancholic' },
            ].map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm"
                style={{ opacity: 1 - i * 0.25 }}
              >
                <span className="text-[9px] font-mono w-10 text-mc-lav font-bold">{t.label}</span>
                <span className="text-mc-hi font-medium flex-1">{t.title}</span>
                <span className="text-mc-lo font-mono text-xs">{t.artist}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
