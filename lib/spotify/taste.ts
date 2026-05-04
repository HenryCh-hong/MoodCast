// lib/spotify/taste.ts
import { spotifyFetch } from './client';
import type { TasteProfile } from '@/lib/types/moodcast';

export async function buildTasteProfile(token: string): Promise<TasteProfile> {
  const [topArtistsRes, topTracksRes, recentRes] = await Promise.all([
    spotifyFetch<{ items: Array<{ name: string; genres: string[] }> }>(
      '/me/top/artists?limit=20&time_range=medium_term', token
    ),
    spotifyFetch<{ items: Array<{ name: string; uri: string; artists: Array<{ name: string }> }> }>(
      '/me/top/tracks?limit=50&time_range=medium_term', token
    ),
    spotifyFetch<{ items: Array<{ track: { name: string; uri: string; artists: Array<{ name: string }> } }> }>(
      '/me/player/recently-played?limit=50', token
    ),
  ]);

  return {
    topArtists: topArtistsRes.items.map((a) => ({ name: a.name, genres: a.genres })),
    topTracks: topTracksRes.items.map((t) => ({
      title: t.name,
      artist: t.artists[0]?.name ?? '',
      uri: t.uri,
    })),
    recentTracks: recentRes.items.map((i) => ({
      title: i.track.name,
      artist: i.track.artists[0]?.name ?? '',
      uri: i.track.uri,
    })),
  };
}
