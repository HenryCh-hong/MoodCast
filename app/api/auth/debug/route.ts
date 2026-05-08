// DEV-ONLY debug route — safe: no token values exposed
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const jar = await cookies();
  const accessToken = jar.get('spotify_access_token')?.value;
  const refreshToken = jar.get('spotify_refresh_token')?.value;
  const expiresAt = jar.get('spotify_expires_at')?.value;

  const expiresAtMs = expiresAt ? Number(expiresAt) : null;
  const isExpired = expiresAtMs ? Date.now() > expiresAtMs : null;
  const expiresInSeconds = expiresAtMs ? Math.round((expiresAtMs - Date.now()) / 1000) : null;

  // Try a Spotify profile fetch if we have a token
  let profileStatus: string = 'skipped';
  if (accessToken) {
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      profileStatus = `${res.status} ${res.statusText}`;
    } catch (err) {
      profileStatus = `fetch error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({
    host: req.headers.get('host'),
    cookies: {
      spotify_access_token: !!accessToken,
      spotify_refresh_token: !!refreshToken,
      spotify_expires_at: !!expiresAt,
    },
    tokenExpiry: {
      expiresAtMs,
      isExpired,
      expiresInSeconds,
    },
    profileFetch: profileStatus,
    cookieHeader: req.headers.get('cookie')?.split(';').map(c => c.trim().split('=')[0]) ?? [],
  });
}
