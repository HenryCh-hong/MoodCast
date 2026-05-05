const BASE = 'https://api.spotify.com/v1';

export async function spotifyFetch<T>(
  path: string,
  token: string,
  options?: { method?: string; body?: string }
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const errBody = await res.json() as { error?: { message?: string } };
      detail = errBody?.error?.message ? `: ${errBody.error.message}` : '';
    } catch { /* ignore parse failure */ }
    throw new Error(`Spotify API error: ${res.status}${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function spotifySearch(
  query: string,
  token: string
): Promise<Array<{ uri: string; name: string; artists: string }>> {
  const params = new URLSearchParams({ q: query, type: 'track', limit: '5' });
  const data = await spotifyFetch<{
    tracks?: { items: Array<{ uri: string; name: string; artists: Array<{ name: string }> }> };
  }>(`/search?${params}`, token);
  return (data.tracks?.items ?? []).map((t) => ({
    uri: t.uri,
    name: t.name,
    artists: t.artists.map((a) => a.name).join(', '),
  }));
}

// Step 1: transfer playback to the Moodcast Web Playback SDK device.
// The device must be "active" before Spotify accepts a play command.
export async function transferPlayback(token: string, deviceId: string): Promise<void> {
  await spotifyFetch<void>(
    '/me/player',
    token,
    { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }) }
  );
}

// Step 2: start playback of specific URIs on the given device.
export async function startPlayback(
  token: string,
  deviceId: string,
  uris: string[]
): Promise<void> {
  await spotifyFetch<void>(
    `/me/player/play?device_id=${deviceId}`,
    token,
    { method: 'PUT', body: JSON.stringify({ uris }) }
  );
}

export async function createPlaylist(
  token: string,
  userId: string,
  name: string,
  description: string
): Promise<{ id: string; external_urls: { spotify: string } }> {
  return spotifyFetch<{ id: string; external_urls: { spotify: string } }>(
    `/users/${userId}/playlists`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        public: false,
      }),
    }
  );
}

export async function addTracksToPlaylist(
  token: string,
  playlistId: string,
  uris: string[]
): Promise<void> {
  // Spotify accepts max 100 URIs per call. Batches are sequential and not atomic —
  // a failure mid-way leaves the playlist partially populated.
  for (let i = 0; i < uris.length; i += 100) {
    await spotifyFetch<void>(
      `/playlists/${playlistId}/tracks`,
      token,
      { method: 'POST', body: JSON.stringify({ uris: uris.slice(i, i + 100) }) }
    );
  }
}
