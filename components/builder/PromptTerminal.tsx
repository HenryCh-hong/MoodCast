// components/builder/PromptTerminal.tsx

export interface PromptTerminalProps {
  value: string;
  onChange: (v: string) => void;
}

const HINT_CHIPS = [
  'sunday morning, slow + present',
  'late night coding, keep it quiet',
  'pre-run energy, lift me up',
  'creative block, need to reset',
];

export function PromptTerminal({ value, onChange }: PromptTerminalProps) {
  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Label */}
      <label className="text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo">
        {'> _ '}SIGNAL IN
      </label>

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="Late night coding, quiet focus. Something instrumental and dark."
        className="w-full bg-mc-elevated border border-mc-border rounded px-3 py-2.5 font-bold tracking-tight text-mc-hi placeholder:text-mc-dim placeholder:font-normal resize-none focus:outline-none focus:border-mc-lav transition-colors"
      />

      {/* Hint chips */}
      <div className="flex flex-wrap gap-2">
        {HINT_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onChange(chip)}
            className="text-[10px] font-bold tracking-tight border border-mc-border rounded px-2 py-1 text-mc-dim hover:text-mc-lo hover:border-mc-mid transition-colors cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
