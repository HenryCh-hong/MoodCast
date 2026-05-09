// MusicProvider abstraction.
//
// Goal: keep Spotify as the only fully-implemented provider while leaving
// honest seams for future Chinese-market providers (NetEase Cloud Music, QQ
// Music) without coupling Moodcast core to any vendor's auth model or
// playback API.
//
// Design rules
//   • The interface describes WHAT a provider can do; concrete files in
//     this directory describe HOW. Never call Spotify-specific helpers from
//     code that only needs a generic provider.
//   • `capabilities` is the source of truth for what surfaces the UI is
//     allowed to render. Adding a method to the interface without flipping
//     the matching capability flag is the lying-about-state failure mode.
//   • External-search providers (NetEase / QQ today) implement
//     `getExternalSearchUrl` only. They are NOT a playback provider; the
//     web UI shows a "open in NetEase / QQ Music" link instead of a
//     transport.
//   • No private API scraping, no DRM bypass, no region-lock workarounds.
//     Anything that requires those is out of scope for this codebase.

import type { Track } from '@/lib/types/moodcast';

export type MusicProviderId = 'spotify' | 'netease' | 'qqmusic';

export interface ProviderCapabilities {
  /** Provider supports a full auth flow inside Moodcast. */
  auth: boolean;
  /** Provider can search its own catalogue from Moodcast. */
  search: boolean;

  // ─── Playback surfaces (split for honesty) ──────────────────────────
  // The single `playback: boolean` of the previous iteration was a lie:
  // "open in app" is not the same as "Moodcast plays this in our page".
  // Each surface below is independently true/false. A provider that can
  // do *any* of webPlayback / sdkPlayback is considered Moodcast-driven
  // playback; appDeepLinks is a hand-off (Moodcast cues the URL, the
  // user's installed app does the playing).
  /**
   * The provider has a documented, officially-supported deep link / URL
   * scheme that opens its installed native app on the track.
   * Moodcast cues the link; the external app does the playing.
   * This is NOT "Moodcast playback".
   */
  appDeepLinks: boolean;
  /**
   * The provider exposes an officially-documented embeddable web player
   * (e.g. a sanctioned iframe widget) that we can place inside Moodcast.
   * Distinct from sdkPlayback — a widget we drop in vs. an SDK we drive.
   */
  webPlayback: boolean;
  /**
   * The provider ships an officially-supported JavaScript / Web SDK we
   * can call programmatically to play / pause / seek (e.g. Spotify Web
   * Playback SDK). Implies the provider has an `startPlayback` method.
   */
  sdkPlayback: boolean;

  /** Provider can create playlists in the user's account. */
  playlistCreate: boolean;
  /** Provider can add tracks to an existing playlist. */
  playlistAddTracks: boolean;
  /** Provider exposes external links (web search URLs). Always-safe fallback. */
  externalLinks: boolean;
}

/**
 * Convenience: does this provider drive playback inside Moodcast itself?
 * App deep links don't count — they hand control to a different app.
 */
export function canDrivePlayback(p: MusicProvider): boolean {
  return p.capabilities.webPlayback || p.capabilities.sdkPlayback;
}

/**
 * Free-form per-capability annotations. The boolean flag is the gate; the
 * note is a hint to the UI / docs (e.g. Spotify can create playlists but
 * adding tracks may require a developer-quota extension; that nuance
 * shouldn't be lost just because we have to pick true or false).
 *
 * Example:
 *   capabilityNotes: { playlistAddTracks: 'may require quota extension' }
 */
export type ProviderCapabilityNotes = Partial<Record<keyof ProviderCapabilities, string>>;

/** Loose track shape for cross-provider lookups. */
export interface ProviderTrackQuery {
  title: string;
  artist: string;
  /** Optional album hint. Some search APIs use it; placeholders ignore it. */
  album?: string;
}

export interface ProviderTrack {
  /** Stable, provider-namespaced track id (e.g. spotify:track:..., netease:song:...). */
  uri: string;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  /** Web URL the user can open if Moodcast can't drive playback itself. */
  externalUrl?: string;
}

export interface PlaybackHandle {
  /** Internal handle / device id, opaque to the caller. */
  deviceId?: string;
  /** True when the call placed the queue but a user gesture is required. */
  requiresUserGesture?: boolean;
}

export interface MusicProvider {
  id: MusicProviderId;
  displayName: string;
  capabilities: ProviderCapabilities;
  /** Per-capability annotations, see ProviderCapabilityNotes. */
  capabilityNotes?: ProviderCapabilityNotes;

  /**
   * Search for tracks. Throws if `capabilities.search` is false. Returns
   * an empty array when the provider has no matches for the query — never
   * `null`, so callers can `[...result, ...other]` without nullish guards.
   */
  searchTrack?(query: ProviderTrackQuery): Promise<ProviderTrack[]>;

  /**
   * Best-effort resolution of a Moodcast `Track` into a provider track.
   * For Spotify this currently round-trips through searchTrack; for
   * external-link providers this maps to a search URL.
   */
  resolveTrack?(track: Track): Promise<ProviderTrack | null>;

  /**
   * Returns a URL the user can open in a browser / native app. Always safe
   * to call when `capabilities.externalLinks` is true.
   */
  getExternalSearchUrl?(query: ProviderTrackQuery): string;

  /**
   * Start playback of a list of provider URIs. Throws if
   * `capabilities.playback` is false. Implementations are responsible for
   * sanitising / validating the URIs against their own format.
   */
  startPlayback?(uris: string[], opts?: { startIndex?: number; deviceId?: string }): Promise<PlaybackHandle>;

  /**
   * Create a new playlist. Throws if `capabilities.playlistCreate` is
   * false. Returns a provider-namespaced playlist id.
   */
  createPlaylist?(name: string, description?: string): Promise<{ id: string; url?: string }>;

  /**
   * Add tracks to an existing playlist. Throws if
   * `capabilities.playlistAddTracks` is false.
   */
  addTracksToPlaylist?(playlistId: string, uris: string[]): Promise<void>;
}

export class ProviderCapabilityError extends Error {
  constructor(provider: MusicProviderId, capability: keyof ProviderCapabilities) {
    super(`Provider "${provider}" does not implement capability: ${capability}`);
    this.name = 'ProviderCapabilityError';
  }
}
