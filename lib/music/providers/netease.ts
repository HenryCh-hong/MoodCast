// NetEase Cloud Music (网易云音乐) — placeholder provider.
//
// SCOPE: external search URL only. We do NOT integrate with private/
// reverse-engineered NetEase APIs, do NOT bypass DRM or region locks, and
// do NOT scrape the web app. Until a sanctioned integration path exists,
// the user experience is:
//
//   1. Moodcast generates the curated track list (locally, with the AI
//      provider the user has already configured).
//   2. The web UI shows a "Open in NetEase Cloud Music" button per track,
//      which deep-links into the user's installed NetEase app or the
//      music.163.com web search.
//   3. The user starts playback themselves inside NetEase.
//
// This is enough for the *curation* part of Moodcast to be useful in
// markets where Spotify isn't available. Playback automation has to wait
// for either an official NetEase API or a clearly-licensed integration.

import type {
  MusicProvider,
  ProviderTrackQuery,
  ProviderTrack,
  ProviderCapabilities,
  ProviderCapabilityNotes,
} from './types';
import type { Track } from '@/lib/types/moodcast';

const CAPS: ProviderCapabilities = {
  auth: false,
  search: false,
  appDeepLinks: false,
  webPlayback: false,
  sdkPlayback: false,
  playlistCreate: false,
  playlistAddTracks: false,
  externalLinks: true,
};

const CAP_NOTES: ProviderCapabilityNotes = {
  // Research (May 2026): an official NetEase Cloud Music developer
  // portal exists at developer.music.163.com/st/developer/ with a public
  // "立即入驻" (apply now) entry point. What is NOT verified is whether
  // individual developers may register, whether a Moodcast-shaped
  // browser playback app is an accepted category, and what the
  // documented capability surfaces actually are — those answers are
  // gated behind portal login and an active developer application.
  //
  // The popular GitHub / npm libraries (Binaryify/NeteaseCloudMusicApi,
  // littlecodersh/NetEaseMusicApi, the NeteaseCloudMusicApi npm package,
  // multiple Python and Go ports, weapi analyses, etc.) are all
  // unofficial, reverse-engineered, and out of scope for Moodcast —
  // see docs/music-providers.md "Why not unofficial APIs?". Capability
  // flags only flip true after the official portal application is
  // approved AND a working method exists. See docs/music-providers.md
  // "Manual next actions" for the exact steps.
  auth: 'official developer portal exists; eligibility & user-OAuth flow unverified until application is approved',
  search: 'API surface likely available via the official portal; scopes & rate limits unverified',
  appDeepLinks: 'no documented official URL scheme on public docs; unverified',
  webPlayback: 'no embeddable web player documented on public pages; unverified',
  sdkPlayback: 'no official playback SDK or partner program documented on public pages; unverified',
};

function searchUrl(query: ProviderTrackQuery): string {
  // music.163.com's search route is /#/search/m/?s=<term>. Encoding the
  // hash fragment so non-ASCII characters survive.
  const q = `${query.title} ${query.artist}`.trim();
  return `https://music.163.com/#/search/m/?s=${encodeURIComponent(q)}`;
}

export const neteaseProvider: MusicProvider = {
  id: 'netease',
  displayName: 'NetEase Cloud Music',
  capabilities: CAPS,
  capabilityNotes: CAP_NOTES,

  // No searchTrack / resolveTrack / startPlayback / playlist methods —
  // capabilities flag them off, callers must check first.

  getExternalSearchUrl(query: ProviderTrackQuery): string {
    return searchUrl(query);
  },

  // Convenience: resolve a Moodcast Track to "just an external link".
  async resolveTrack(track: Track): Promise<ProviderTrack | null> {
    return {
      uri: `netease:search:${encodeURIComponent(`${track.title} ${track.artist}`)}`,
      title: track.title,
      artist: track.artist,
      album: track.albumName,
      durationMs: track.durationMs,
      externalUrl: searchUrl({ title: track.title, artist: track.artist }),
    };
  },
};
