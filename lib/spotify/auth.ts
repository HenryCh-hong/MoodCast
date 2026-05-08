// lib/spotify/auth.ts
import { cookies } from 'next/headers';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

export const SCOPES_LIST = [
  'user-read-email',
  'user-read-private',
  'user-top-read',
  'user-read-recently-played',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-private',
  'playlist-read-collaborative',
];
const SCOPES = SCOPES_LIST.join(' ');

export function getSpotifyAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('SPOTIFY_CLIENT_ID'),
    response_type: 'code',
    redirect_uri: requireEnv('SPOTIFY_REDIRECT_URI'),
    state,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    show_dialog: 'true',
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code: string, codeVerifier: string) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: requireEnv('SPOTIFY_REDIRECT_URI'),
      client_id: requireEnv('SPOTIFY_CLIENT_ID'),
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error('Token exchange failed');
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

// PKCE refresh — sends client_id in the body, no client secret.
// Spotify rotates the refresh token on each refresh, so we accept and persist
// the new one when present.
export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: requireEnv('SPOTIFY_CLIENT_ID'),
    }),
  });
  if (!res.ok) throw new Error('Token refresh failed');
  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  }>;
}

export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get('spotify_access_token')?.value ?? null;
}

// Dev-only diagnostic logger. Never accepts a token or other secret value
// as input — only structural facts ("present"/"missing", durations, error
// shapes). Production silently no-ops.
function devLog(event: string, fields: Record<string, string | number | boolean>): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.log(`[spotify-auth] ${event}`, fields);
}

export async function getValidAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const accessToken = jar.get('spotify_access_token')?.value ?? null;
  const expiresAt = Number(jar.get('spotify_expires_at')?.value ?? '0');
  const refreshToken = jar.get('spotify_refresh_token')?.value ?? null;

  if (!refreshToken) {
    // Distinguish from refresh-failed in diagnostics. Caller treats both as
    // null today, but the dev log makes it possible to see which path fired.
    devLog('no_refresh_token', {
      hasAccessCookie: !!accessToken,
      hasExpiresAtCookie: expiresAt > 0,
    });
    return null;
  }

  // Refresh 60 seconds before expiry to avoid edge-case expiry mid-request
  if (accessToken && Date.now() < expiresAt - 60_000) {
    devLog('cached_token_ok', {
      msUntilExpiry: expiresAt - Date.now(),
    });
    return accessToken;
  }

  // Need to refresh
  try {
    const tokens = await refreshAccessToken(refreshToken);
    // Spotify may rotate the refresh token under PKCE; persist the new one when given.
    const nextRefresh = tokens.refresh_token ?? refreshToken;
    await setTokenCookies(tokens.access_token, nextRefresh, tokens.expires_in);
    devLog('refresh_ok', {
      rotatedRefreshToken: !!tokens.refresh_token,
      expiresInSec: tokens.expires_in,
    });
    return tokens.access_token;
  } catch (err) {
    devLog('refresh_failed', {
      message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
    return null;
  }
}

export async function setTokenCookies(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const jar = await cookies();
  jar.set('spotify_access_token', accessToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: expiresIn,
  });
  jar.set('spotify_refresh_token', refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 60 * 60 * 24 * 60,
  });
  jar.set('spotify_expires_at', String(Date.now() + expiresIn * 1000), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 60,
  });
}
