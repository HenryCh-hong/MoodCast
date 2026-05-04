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
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
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
