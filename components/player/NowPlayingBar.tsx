'use client';

import Image from 'next/image';

interface NowPlayingTrack {
  name: string;
  uri: string;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
}

interface NowPlayingBarProps {
  track: NowPlayingTrack | null;
  paused: boolean;
  onPlayPause: () => void;
}

export function NowPlayingBar({ track, paused, onPlayPause }: NowPlayingBarProps) {
  if (!track) return null;

  const albumArt = track.album.images[0]?.url;
  const artistNames = track.artists.map((a) => a.name).join(', ');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-mc-elevated border-t border-mc-border px-5 py-3 flex items-center gap-4 z-50">
      {albumArt && (
        <Image
          src={albumArt}
          alt={track.album.name}
          width={40}
          height={40}
          className="rounded"
          unoptimized
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold tracking-tight text-mc-hi truncate">{track.name}</p>
        <p className="text-[11px] font-bold tracking-tight text-mc-lo truncate">{artistNames}</p>
      </div>
      <button
        onClick={onPlayPause}
        className="w-8 h-8 rounded-full border border-mc-border flex items-center justify-center text-mc-mid hover:text-mc-hi hover:border-mc-mid transition-colors"
        aria-label={paused ? 'Play' : 'Pause'}
      >
        {paused ? '▶' : '⏸'}
      </button>
    </div>
  );
}
