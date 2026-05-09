// SpotifyProvider — wraps the existing lib/spotify/* helpers behind the
// generic MusicProvider interface so call sites that opt into the
// abstraction can switch providers without rewriting Spotify-specific
// code.
//
// IMPORTANT: this file MUST NOT change the behaviour of any direct Spotify
// caller. The existing flow (auth.ts, client.ts, resolveTracks.ts,
// taste.ts) is the canonical implementation; this is a thin adapter
// layered alongside.

import {
  spotifySearch,
  startPlayback as rawStartPlayback,
  createPlaylist as rawCreatePlaylist,
  addTracksToPlaylist as rawAddTracksToPlaylist,
} from '@/lib/spotify/client';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { isValidSpotifyTrackUri, sanitizeSpotifyTrackUris } from '@/lib/spotify/uris';
import type {
  MusicProvider,
  ProviderTrackQuery,
  ProviderTrack,
  PlaybackHandle,
  ProviderCapabilities,
  ProviderCapabilityNotes,
} from './types';
import { ProviderCapabilityError } from './types';
import type { Track } from '@/lib/types/moodcast';

const CAPS: ProviderCapabilities = {
  auth: true,
  search: true,
  // spotify:track:... URIs hand off to the desktop / mobile app when the
  // user clicks them — sanctioned by Spotify and stable across years.
  appDeepLinks: true,
  // We don't embed Spotify's iframe widget; we drive the SDK directly.
  webPlayback: false,
  // Moodcast uses Spotify's Web Playback SDK to play tracks in-page.
  sdkPlayback: true,
  playlistCreate: true,
  playlistAddTracks: true,
  externalLinks: true,
};

const CAP_NOTES: ProviderCapabilityNotes = {
  // Spotify's API returns 200 on the request itself but enforces per-token
  // and per-app quotas on /v1/playlists/{id}/tracks. Apps in the default
  // "extended quota mode = off" tier hit a low ceiling fast in production;
  // bulk add operations should batch and tolerate 429s.
  playlistAddTracks: 'may require an extended-quota grant for high volume',
  // Playback is gated on a Premium account — `auth` succeeds for free
  // accounts but `startPlayback` calls return 403.
  sdkPlayback: 'via Spotify Web Playback SDK; requires Spotify Premium on the listening account',
};

async function tokenOrThrow(): Promise<string> {
  const tok = await getValidAccessToken();
  if (!tok) {
    throw new Error('Spotify is not authorized. Run `moodcast auth` or click "Connect Spotify" in the web app.');
  }
  return tok;
}

function searchUrl(query: ProviderTrackQuery): string {
  const q = `${query.title} ${query.artist}`.trim();
  return `https://open.spotify.com/search/${encodeURIComponent(q)}`;
}

export const spotifyProvider: MusicProvider = {
  id: 'spotify',
  displayName: 'Spotify',
  capabilities: CAPS,
  capabilityNotes: CAP_NOTES,

  async searchTrack(query: ProviderTrackQuery): Promise<ProviderTrack[]> {
    const tok = await tokenOrThrow();
    const q = `track:"${query.title}" artist:"${query.artist}"${query.album ? ` album:"${query.album}"` : ''}`;
    const items = await spotifySearch(q, tok);
    return items.map((item) => ({
      uri: item.uri,
      title: item.name,
      artist: item.artists,
      album: query.album,
    }));
  },

  async resolveTrack(track: Track): Promise<ProviderTrack | null> {
    if (track.uri && isValidSpotifyTrackUri(track.uri)) {
      return {
        uri: track.uri,
        title: track.title,
        artist: track.artist,
        album: track.albumName,
        durationMs: track.durationMs,
      };
    }
    const matches = await this.searchTrack!({
      title: track.title,
      artist: track.artist,
      album: track.albumName,
    });
    return matches[0] ?? null;
  },

  getExternalSearchUrl(query: ProviderTrackQuery): string {
    return searchUrl(query);
  },

  async startPlayback(uris: string[], opts?: { startIndex?: number; deviceId?: string }): Promise<PlaybackHandle> {
    if (!opts?.deviceId) {
      throw new ProviderCapabilityError('spotify', 'sdkPlayback');
    }
    const safe = sanitizeSpotifyTrackUris(uris);
    if (safe.length === 0) {
      throw new Error('No valid Spotify track URIs to play.');
    }
    const tok = await tokenOrThrow();
    await rawStartPlayback(tok, opts.deviceId, safe, opts.startIndex ?? 0);
    return { deviceId: opts.deviceId };
  },

  async createPlaylist(name: string, description?: string): Promise<{ id: string; url?: string }> {
    const tok = await tokenOrThrow();
    const playlist = await rawCreatePlaylist(tok, name, description ?? '');
    return { id: `spotify:playlist:${playlist.id}`, url: playlist.external_urls?.spotify };
  },

  async addTracksToPlaylist(playlistId: string, uris: string[]): Promise<void> {
    const tok = await tokenOrThrow();
    const bareId = playlistId.replace(/^spotify:playlist:/, '');
    const safe = sanitizeSpotifyTrackUris(uris);
    if (safe.length === 0) return;
    await rawAddTracksToPlaylist(tok, bareId, safe);
  },
};
