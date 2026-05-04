// components/ui/LoadingState.tsx
export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {/* Transmission arcs */}
      <div className="relative w-12 h-12 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-mc-coral opacity-20" />
        <span className="absolute inset-2 rounded-full border border-mc-coral opacity-40" />
        <span className="absolute inset-4 rounded-full border border-mc-coral opacity-70" />
        <span className="w-1.5 h-1.5 rounded-full bg-mc-coral" />
      </div>
      <div className="text-center">
        <p className="text-mc-lav font-mono text-xs tracking-[0.16em] uppercase mb-2">
          Moodcast DJ
        </p>
        <p className="text-mc-mid text-sm">
          Tuning your session<span className="ml-0.5 text-mc-lo">···</span>
        </p>
      </div>
    </div>
  );
}
