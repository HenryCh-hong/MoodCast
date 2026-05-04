import { cn } from '@/lib/utils';

interface Track {
  title: string;
  artist: string;
  moodTag?: string;
  energy?: string;
  whyItFits?: string;
  transitionLine?: string;
  uri?: string;
  albumArt?: string;
}

interface TrackQueueProps {
  tracks: Track[];
  playerState?: {
    track_window: {
      current_track: { uri: string };
    };
  } | null;
}

export function TrackQueue({ tracks, playerState }: TrackQueueProps) {
  const currentUri = playerState?.track_window.current_track.uri;

  return (
    <div className="mb-6">
      <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-mc-lo mb-4">Track Queue</p>
      <div className="space-y-3">
        {tracks.map((track, i) => {
          const isNow = currentUri ? track.uri === currentUri : i === 0;
          const label = isNow ? 'NOW' : i === 1 ? 'NEXT' : `CUE ${i + 1}`;
          const opacity = isNow ? '' : i === 1 ? 'opacity-65' : 'opacity-40';

          return (
            <div key={i} className={cn('flex items-start gap-4', opacity)}>
              <span className={cn(
                'text-[9px] font-bold tracking-[0.15em] w-12 shrink-0 pt-0.5',
                isNow ? 'text-mc-lav' : 'text-mc-lo'
              )}>
                {label}
              </span>
              <div className="flex-1 min-w-0">
                {track.transitionLine && i > 0 && (
                  <p className="text-[10px] font-bold tracking-tight text-mc-dim mb-1">
                    ↳ {track.transitionLine}
                  </p>
                )}
                <p className="text-[13px] font-bold tracking-tight text-mc-hi truncate">{track.title}</p>
                <p className="text-[11px] font-bold tracking-tight text-mc-lo">{track.artist}</p>
                {track.moodTag && (
                  <span className="text-[9px] font-bold tracking-tight text-mc-dim">{track.moodTag}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
