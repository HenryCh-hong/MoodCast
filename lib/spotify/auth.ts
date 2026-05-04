// lib/spotify/auth.ts
import { cookies } from 'next/headers';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

const SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-top-read',
  'user-read-recently-played',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ');

export function getSpotifyAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('SPOTIFY_CLIENT_ID'),
    response_type: 'code',
    redirect_uri: requireEnv('SPOTIFY_REDIRECT_URI'),
    state,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
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

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${requireEnv('SPOTIFY_CLIENT_ID')}:${requireEnv('SPOTIFY_CLIENT_SECRET')}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error('Token refresh failed');
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get('spotify_access_token')?.value ?? null;
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
