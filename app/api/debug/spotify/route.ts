import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getValidAccessToken } from '@/lib/spotify/auth';
import { SCOPES_LIST } from '@/lib/spotify/auth';

// Debug-only endpoint — never ship to production.
// GET /api/debug/spotify

function maskId(val: string | undefined): string {
  if (!val) return '(missing)';
  if (val.length <= 8) return `(${val.length} chars, too short to mask)`;
  return `${val.slice(0, 4)}...${val.slice(-4)} (${val.length} chars)`;
}

function safeResponseHeaders(res: Response): Record<string, string | null> {
  return {
    'www-authenticate': res.headers.get('www-authenticate'),
    'content-type': res.headers.get('content-type'),
    'spotify-request-id': res.headers.get('spotify-request-id'),
    'x-oauth-scopes': res.headers.get('x-oauth-scopes'),
    'x-accepted-oauth-scopes': res.headers.get('x-accepted-oauth-scopes'),
    'retry-after': res.headers.get('retry-after'),
  };
}

async function tryParseJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  // Cookie timestamps
  const jar = await cookies();
  const expiresAt = Number(jar.get('spotify_expires_at')?.value ?? '0');
  const hasAccessCookie = !!jar.get('spotify_access_token')?.value;
  const hasRefreshCookie = !!jar.get('spotify_refresh_token')?.value;

  const appIdentity = {
    clientId: maskId(clientId),
    redirectUri: redirectUri ?? '(missing)',
    expectedScopes: SCOPES_LIST,
    expectedScopeString: SCOPES_LIST.join(' '),
  };

  const cookieState = {
    hasAccessToken: hasAccessCookie,
    hasRefreshToken: hasRefreshCookie,
    tokenExpiresAt: expiresAt > 0 ? new Date(expiresAt).toISOString() : '(not set)',
    tokenApproxIssuedAt: expiresAt > 0 ? new Date(expiresAt - 3600 * 1000).toISOString() : '(not set)',
    nowUtc: new Date().toISOString(),
  };

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ appIdentity, cookieState, error: 'No valid access token' }, { status: 401 });
  }

  console.log('[debug/spotify] token:', `${token.slice(0, 6)}...${token.slice(-6)} (len:${token.length})`);

  // --- /me ---
  const meRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meHeaders = safeResponseHeaders(meRes);
  const meBody = await tryParseJson(meRes) as Record<string, unknown> | null;
  const userId = typeof meBody?.id === 'string' ? meBody.id : null;

  const grantedScopes = meHeaders['x-oauth-scopes'];
  const grantedScopeList = grantedScopes ? grantedScopes.split(' ') : null;
  const missingPlaylistScopes = grantedScopeList
    ? ['playlist-modify-public', 'playlist-modify-private'].filter(s => !grantedScopeList.includes(s))
    : '(X-OAuth-Scopes header not returned — cannot verify)';

  const me = {
    status: meRes.status,
    id: userId,
    email: meBody?.email ?? null,
    product: meBody?.product ?? null,
    country: meBody?.country ?? null,
    explicitContent: meBody?.explicit_content ?? null,
    type: meBody?.type ?? null,
    scopesFromHeader: grantedScopes ?? '(not returned)',
    missingPlaylistScopes,
    responseHeaders: meHeaders,
  };

  // --- Test A: POST /v1/users/{userId}/playlists — returns 403 in current Spotify API policy ---
  let testA: Record<string, unknown>;
  if (userId) {
    const payloadA = { name: 'MoodCast Debug A — DELETE ME', public: false };
    const resA = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadA),
    });
    const bodyA = await tryParseJson(resA);
    testA = {
      endpoint: `POST /v1/users/${userId}/playlists`,
      userIdEncoded: encodeURIComponent(userId),
      payload: payloadA,
      status: resA.status,
      body: bodyA,
      responseHeaders: safeResponseHeaders(resA),
    };
    if (resA.ok && bodyA && typeof bodyA === 'object' && 'id' in (bodyA as object)) {
      await fetch(`https://api.spotify.com/v1/playlists/${(bodyA as { id: string }).id}/followers`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } else {
    testA = { skipped: 'userId not available from /me' };
  }

  // --- Test B: POST /v1/me/playlists — working endpoint used by the app ---
  const payloadB = { name: 'MoodCast Debug B — DELETE ME', public: false };
  const resB = await fetch('https://api.spotify.com/v1/me/playlists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadB),
  });
  const bodyB = await tryParseJson(resB);
  const testB: Record<string, unknown> = {
    endpoint: 'POST /v1/me/playlists',
    payload: payloadB,
    status: resB.status,
    body: bodyB,
    responseHeaders: safeResponseHeaders(resB),
  };
  if (resB.ok && bodyB && typeof bodyB === 'object' && 'id' in (bodyB as object)) {
    await fetch(`https://api.spotify.com/v1/playlists/${(bodyB as { id: string }).id}/followers`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return NextResponse.json({ appIdentity, cookieState, me, tests: { testA, testB } });
}
