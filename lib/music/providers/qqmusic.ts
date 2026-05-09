// QQ Music (QQ音乐) — placeholder provider.
//
// SCOPE: external search URL only. Same constraints as the NetEase
// placeholder — no private/reverse-engineered APIs, no DRM bypass, no
// scraping. The user experience is the same shape:
//
//   1. Moodcast curates locally.
//   2. The UI offers a "Open in QQ Music" link per track, deep-linking
//      into y.qq.com search.
//   3. Playback happens inside QQ Music itself.

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
  // Research (May 2026). QQ Music runs an official developer platform at
  // developer.y.qq.com with visible surfaces: 登录鉴权 (Login Auth), SDK,
  // OpenAPI, APP互联, QPlay, 大屏解决方案, 车机解决方案. A second
  // documented surface is the 移动WEB开放平台 at y.qq.com/m/api/open
  // which describes a `QMplayer` JS SDK (play / pause / toggle / events).
  // Findings per surface, mapped to our capability flags:
  //
  //   • auth
  //       Top-level "登录鉴权" menu implies OAuth. The publicly visible
  //       OpenAPI SDK login docs target `androidJvm` only — i.e., the
  //       documented flow needs an Android Activity, not a browser.
  //       Whether individual developers can register and whether a web
  //       OAuth equivalent exists is gated behind portal login.
  //       Unverified.
  //
  //   • search
  //       OpenAPI almost certainly exposes metadata search. Until
  //       Moodcast registers an app and confirms scopes, off.
  //
  //   • appDeepLinks
  //       Community sources (yt-dlp etc.) reference a `qqmusic://` URL
  //       scheme with patterns like qqmusic:album: / qqmusic:playlist: /
  //       qqmusic:singer:. We could NOT find this scheme in QQ Music's
  //       official developer documentation — undocumented schemes are
  //       not a public contract and can break without notice.
  //
  //   • webPlayback
  //       QQ Music ships a first-party web player at
  //       y.qq.com/webplayer/player.html and a "music_player" plugin at
  //       y.qq.com/plugins/music_player.html. Neither is documented for
  //       third-party-app embedding. The 移动WEB开放平台 documents a
  //       `QMplayer` JS component, but third-party-app eligibility and
  //       cross-domain embedding terms are not visible on public pages.
  //       Hot-linking would not be a sanctioned integration; QMplayer
  //       use must come with a confirmed ToS path.
  //
  //   • sdkPlayback
  //       QQ Music supports playback via the QPlay protocol and
  //       "QPlay Auth", which can grant partner products access to
  //       music streams + playback control. QPlay is a hardware-partner
  //       certification program (cars / smart speakers / TVs) with
  //       authorized test labs (Allion is the only ATL). Approval-gated
  //       and oriented toward terminals, not browser-based music apps.
  //       A Moodcast-shaped app may not fit any documented category.
  //
  // None of these flip true without documented ToS-permitted access. See
  // docs/music-providers.md "Manual next actions" for the exact steps.
  // For now Moodcast emits an external y.qq.com search URL only.
  auth: 'OAuth-style menu exists; documented OpenAPI SDK login is Android-only; web OAuth + scopes unverified',
  search: 'OpenAPI metadata search likely available; off until Moodcast registers and scopes are confirmed',
  appDeepLinks: 'qqmusic:// scheme appears in community sources but is NOT in QQ Music official docs — treated as undocumented',
  webPlayback: 'QMplayer JS SDK documented on 移动WEB开放平台; third-party-app eligibility & cross-domain ToS unverified',
  sdkPlayback: 'QPlay / QPlay Auth is partner-cert gated (cars / speakers / TVs); browser music apps may not fit any documented category',
};

function searchUrl(query: ProviderTrackQuery): string {
  // y.qq.com search route: /n/ryqq/search?w=<term>
  const q = `${query.title} ${query.artist}`.trim();
  return `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(q)}`;
}

export const qqMusicProvider: MusicProvider = {
  id: 'qqmusic',
  displayName: 'QQ Music',
  capabilities: CAPS,
  capabilityNotes: CAP_NOTES,

  getExternalSearchUrl(query: ProviderTrackQuery): string {
    return searchUrl(query);
  },

  async resolveTrack(track: Track): Promise<ProviderTrack | null> {
    return {
      uri: `qqmusic:search:${encodeURIComponent(`${track.title} ${track.artist}`)}`,
      title: track.title,
      artist: track.artist,
      album: track.albumName,
      durationMs: track.durationMs,
      externalUrl: searchUrl({ title: track.title, artist: track.artist }),
    };
  },
};
