// Provider registry. Use this module to look providers up by id; do NOT
// import individual provider files at call sites that just need "some
// provider" — that defeats the abstraction.
//
// The registry deliberately stays small and explicit. We prefer adding
// providers one at a time, fully-typed, over a plugin discovery
// mechanism — there are only ever going to be a handful of music
// services, and the abstraction's job is to keep us honest about each
// provider's actual capabilities.

import { spotifyProvider } from './spotify';
import { neteaseProvider } from './netease';
import { qqMusicProvider } from './qqmusic';
import type { MusicProvider, MusicProviderId } from './types';

const REGISTRY: Record<MusicProviderId, MusicProvider> = {
  spotify: spotifyProvider,
  netease: neteaseProvider,
  qqmusic: qqMusicProvider,
};

export function getProvider(id: MusicProviderId): MusicProvider {
  const p = REGISTRY[id];
  if (!p) throw new Error(`Unknown music provider: ${id}`);
  return p;
}

export function listProviders(): MusicProvider[] {
  return Object.values(REGISTRY);
}

/**
 * The provider Moodcast currently treats as authoritative for taste,
 * playback, and playlist creation. This stays "spotify" until we ship a
 * real second integration; flipping the default isn't a 1-line change
 * because dependent flows (taste profile, web playback SDK, etc.) need
 * matching paths first.
 */
export const DEFAULT_PRIMARY_PROVIDER: MusicProviderId = 'spotify';

export type { MusicProvider, MusicProviderId } from './types';
export type {
  ProviderCapabilities,
  ProviderCapabilityNotes,
  ProviderTrack,
  ProviderTrackQuery,
  PlaybackHandle,
} from './types';
export { ProviderCapabilityError, canDrivePlayback } from './types';
