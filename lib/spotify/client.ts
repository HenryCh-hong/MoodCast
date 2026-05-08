const BASE = 'https://api.spotify.com/v1';

export class SpotifyAPIError extends Error {
  status: number;
  spotifyMessage: string | undefined;
  spotifyReason: string | undefined;

  constructor(status: number, body?: { error?: { message?: string; reason?: string } }) {
    const detail = body?.error?.message ? `: ${body.error.message}` : '';
    const reason = body?.error?.reason ? ` (reason: ${body.error.reason})` : '';
    super(`Spotify API error: ${status}${detail}${reason}`);
    this.status = status;
    this.spotifyMessage = body?.error?.message;
    this.spotifyReason = body?.error?.reason;
  }
}

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
    let errBody: { error?: { message?: string; reason?: string } } | undefined;
    try {
      errBody = await res.json() as typeof errBody;
    } catch { /* ignore parse failure */ }
    throw new SpotifyAPIError(res.status, errBody);
  }
  if (res.status === 204) return undefined as T;
  // Some Spotify endpoints (e.g. /me/player/pause, /me/player/next) return 200 with
  // an empty or non-JSON body. Read as text first and only parse if it looks like JSON.
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
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

export async function pausePlayback(token: string, deviceId?: string): Promise<void> {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  await spotifyFetch<void>(`/me/player/pause${q}`, token, { method: 'PUT' });
}

// Resume playback on the currently active device (no URIs = continue from current position).
export async function resumePlayback(token: string, deviceId?: string): Promise<void> {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  await spotifyFetch<void>(`/me/player/play${q}`, token, { method: 'PUT' });
}

export async function skipToNext(token: string, deviceId?: string): Promise<void> {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  await spotifyFetch<void>(`/me/player/next${q}`, token, { method: 'POST' });
}

export async function skipToPrevious(token: string, deviceId?: string): Promise<void> {
  const q = deviceId ? `?device_id=${deviceId}` : '';
  await spotifyFetch<void>(`/me/player/previous${q}`, token, { method: 'POST' });
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted?: boolean;
}

export async function getDevices(token: string): Promise<SpotifyDevice[]> {
  const data = await spotifyFetch<{ devices?: SpotifyDevice[] }>('/me/player/devices', token);
  return data.devices ?? [];
}

// POST /me/playlists creates a playlist for the authenticated user.
// /users/{userId}/playlists returns 403 in Spotify's current API policy.
export async function createPlaylist(
  token: string,
  name: string,
  description: string
): Promise<{ id: string; external_urls: { spotify: string } }> {
  return spotifyFetch<{ id: string; external_urls: { spotify: string } }>(
    '/me/playlists',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ name, description, public: false }),
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
