// components/builder/MusicTasteInputs.tsx
interface MusicTasteInputsProps {
  musicTaste: string;
  songList: string;
  onMusicTasteChange: (v: string) => void;
  onSongListChange: (v: string) => void;
}

export function MusicTasteInputs({
  musicTaste,
  songList,
  onMusicTasteChange,
  onSongListChange,
}: MusicTasteInputsProps) {
  return (
    <>
      <div className="mb-5">
        <label className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">
          Music taste
          <span className="border border-mc-border rounded px-1.5 py-0.5 text-mc-dim text-[8px] normal-case tracking-normal font-normal">
            optional
          </span>
        </label>
        <textarea
          value={musicTaste}
          onChange={(e) => onMusicTasteChange(e.target.value)}
          rows={3}
          placeholder="Frank Ocean, Radiohead, Bon Iver, ambient electronic, soft late-night R&B..."
          className="w-full bg-mc-elevated border border-mc-border rounded px-3 py-2.5 text-[12px] font-bold tracking-tight text-mc-mid placeholder:text-mc-dim placeholder:font-normal resize-none focus:outline-none focus:border-mc-lav transition-colors"
        />
      </div>
      <div className="mb-5">
        <label className="flex items-center gap-2 text-[9px] font-bold tracking-[0.18em] uppercase text-mc-lo mb-3">
          Seed songs
          <span className="border border-mc-border rounded px-1.5 py-0.5 text-mc-dim text-[8px] normal-case tracking-normal font-normal">
            optional
          </span>
        </label>
        <textarea
          value={songList}
          onChange={(e) => onSongListChange(e.target.value)}
          rows={4}
          placeholder={"One song per line — Moodcast builds the session around them\nHolocene – Bon Iver\nNight Owl – Khruangbin"}
          className="w-full bg-mc-elevated border border-mc-border rounded px-3 py-2.5 text-[12px] font-bold tracking-tight text-mc-mid placeholder:text-mc-dim placeholder:font-normal resize-none focus:outline-none focus:border-mc-lav transition-colors"
        />
      </div>
    </>
  );
}
