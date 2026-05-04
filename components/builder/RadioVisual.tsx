// components/builder/RadioVisual.tsx

export function RadioVisual() {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Vinyl record */}
      <div className="relative w-20 h-20 rounded-full border-2 border-mc-border bg-mc-elevated flex items-center justify-center">
        {/* Inner ring */}
        <div className="w-10 h-10 rounded-full border border-mc-border flex items-center justify-center">
          {/* Center dot */}
          <div className="w-2 h-2 rounded-full bg-mc-lav" />
        </div>
      </div>

      {/* FM frequency */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-mc-lav font-bold text-xs tracking-widest">88.7</span>
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo">
          MOODCAST FM
        </span>
        <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-dim">
          STUDIO N.01
        </span>
      </div>

      {/* Waveform bars */}
      <div className="flex items-end gap-0.5 h-4">
        {[
          '0s',
          '0.15s',
          '0.3s',
          '0.45s',
          '0.6s',
        ].map((delay, i) => (
          <div
            key={i}
            className="w-1 bg-mc-lo rounded-sm animate-waveform origin-bottom"
            style={{
              height: `${[12, 16, 10, 14, 8][i]}px`,
              animationDelay: delay,
            }}
          />
        ))}
      </div>
    </div>
  );
}
