import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/spotify/auth';

// Debug-only. GET /api/debug/add-tracks
// Tests PUT replace-items, POST add-items (json + query-param), and generates curl commands.
// Most playlists are deleted after testing. The curl-test playlist is left alive — delete it manually.

const KNOWN_GOOD_URI = 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh'; // Bohemian Rhapsody, Queen

type FetchResult = { status: number; body: unknown; headers: Record<string, string | null> };

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

function safeHeaders(res: Response): Record<string, string | null> {
  return {
    'www-authenticate': res.headers.get('www-authenticate'),
    'spotify-request-id': res.headers.get('spotify-request-id'),
    'x-oauth-scopes': res.headers.get('x-oauth-scopes'),
    'x-accepted-oauth-scopes': res.headers.get('x-accepted-oauth-scopes'),
    'content-type': res.headers.get('content-type'),
    'retry-after': res.headers.get('retry-after'),
  };
}

async function createTestPlaylist(
  token: string,
  label: string,
  isPublic: boolean
): Promise<{ id: string; public: unknown; collaborative: unknown; owner: unknown } | null> {
  const res = await fetch('https://api.spotify.com/v1/me/playlists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `MoodCast Debug ${label} — DELETE ME`, public: isPublic }),
  });
  if (!res.ok) return null;
  const body = await safeJson(res) as Record<string, unknown> | null;
  if (!body?.id) return null;
  return { id: body.id as string, public: body.public, collaborative: body.collaborative, owner: body.owner };
}

async function deletePlaylist(token: string, id: string): Promise<number> {
  const res = await fetch(`https://api.spotify.com/v1/playlists/${id}/followers`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function postAddJson(token: string, id: string, uris: string[]): Promise<FetchResult> {
  const body = JSON.stringify({ uris });
  console.log('[debug/add-tracks] POST json body:', body);
  const res = await fetch(`https://api.spotify.com/v1/playlists/${id}/tracks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
  });
  return { status: res.status, body: await safeJson(res), headers: safeHeaders(res) };
}

async function postAddQuery(token: string, id: string, uri: string): Promise<FetchResult> {
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${id}/tracks?uris=${encodeURIComponent(uri)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
  );
  return { status: res.status, body: await safeJson(res), headers: safeHeaders(res) };
}

async function putReplaceJson(token: string, id: string, uris: string[]): Promise<FetchResult> {
  const body = JSON.stringify({ uris });
  console.log('[debug/add-tracks] PUT replace body:', body);
  const res = await fetch(`https://api.spotify.com/v1/playlists/${id}/tracks`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
  });
  return { status: res.status, body: await safeJson(res), headers: safeHeaders(res) };
}

async function getMeId(token: string): Promise<string | null> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await safeJson(res) as Record<string, unknown> | null;
  return typeof body?.id === 'string' ? body.id : null;
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const meId = await getMeId(token);
  const out: Record<string, unknown> = { meId };

  // ─── Test 1: POST add — private playlist ───────────────────────────────────
  const priv = await createTestPlaylist(token, 'POST-PRIVATE', false);
  if (priv) {
    out.test1_privatePost = {
      playlist: { id: priv.id, public: priv.public, owner: priv.owner },
      postJson: await postAddJson(token, priv.id, [KNOWN_GOOD_URI]),
      postQuery: await postAddQuery(token, priv.id, KNOWN_GOOD_URI),
      cleanup: await deletePlaylist(token, priv.id),
    };
  }

  // ─── Test 2: POST add — public playlist ────────────────────────────────────
  const pub = await createTestPlaylist(token, 'POST-PUBLIC', true);
  if (pub) {
    out.test2_publicPost = {
      playlist: { id: pub.id, public: pub.public, owner: pub.owner },
      postJson: await postAddJson(token, pub.id, [KNOWN_GOOD_URI]),
      postQuery: await postAddQuery(token, pub.id, KNOWN_GOOD_URI),
      cleanup: await deletePlaylist(token, pub.id),
    };
  }

  // ─── Test 3: PUT replace — private playlist ────────────────────────────────
  const privPut = await createTestPlaylist(token, 'PUT-PRIVATE', false);
  if (privPut) {
    out.test3_privatePut = {
      playlist: { id: privPut.id, public: privPut.public, owner: privPut.owner },
      putJson: await putReplaceJson(token, privPut.id, [KNOWN_GOOD_URI]),
      cleanup: await deletePlaylist(token, privPut.id),
    };
  }

  // ─── Test 4: PUT replace — public playlist ─────────────────────────────────
  const pubPut = await createTestPlaylist(token, 'PUT-PUBLIC', true);
  if (pubPut) {
    out.test4_publicPut = {
      playlist: { id: pubPut.id, public: pubPut.public, owner: pubPut.owner },
      putJson: await putReplaceJson(token, pubPut.id, [KNOWN_GOOD_URI]),
      cleanup: await deletePlaylist(token, pubPut.id),
    };
  }

  // ─── Curl test playlist (left alive — delete manually) ─────────────────────
  // Create a persistent test playlist for manual curl testing.
  const curlPlaylist = await createTestPlaylist(token, 'CURL-TEST', true);
  if (curlPlaylist) {
    const pid = curlPlaylist.id;
    out.curlTest = {
      playlistId: pid,
      note: [
        'This playlist is NOT deleted automatically. Delete it from Spotify after testing.',
        'Get your access token: GET http://127.0.0.1:3001/api/auth/spotify/token',
      ],
      curlPost: [
        `curl -X POST 'https://api.spotify.com/v1/playlists/${pid}/tracks'`,
        `  -H 'Authorization: Bearer ACCESS_TOKEN'`,
        `  -H 'Content-Type: application/json'`,
        `  -d '{"uris":["spotify:track:4iV5W9uYEdYUVa79Axb7Rh"]}'`,
      ].join(' \\\n'),
      curlPut: [
        `curl -X PUT 'https://api.spotify.com/v1/playlists/${pid}/tracks'`,
        `  -H 'Authorization: Bearer ACCESS_TOKEN'`,
        `  -H 'Content-Type: application/json'`,
        `  -d '{"uris":["spotify:track:4iV5W9uYEdYUVa79Axb7Rh"]}'`,
      ].join(' \\\n'),
      oneLineToGetTokenAndTest: [
        `TOKEN=$(curl -s http://127.0.0.1:3001/api/auth/spotify/token | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")`,
        `curl -X POST 'https://api.spotify.com/v1/playlists/${pid}/tracks' -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"uris":["spotify:track:4iV5W9uYEdYUVa79Axb7Rh"]}'`,
      ].join('\n'),
    };
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  out.summary = {
    'POST private json': (out.test1_privatePost as Record<string,unknown>)?.postJson as FetchResult | undefined,
    'POST public json':  (out.test2_publicPost as Record<string,unknown>)?.postJson as FetchResult | undefined,
    'PUT private json':  (out.test3_privatePut as Record<string,unknown>)?.putJson as FetchResult | undefined,
    'PUT public json':   (out.test4_publicPut as Record<string,unknown>)?.putJson as FetchResult | undefined,
    diagnosis: 'If all 4 are 403: Spotify API policy restriction — app needs Extended Quota Mode. If any succeed: use that method.',
  };

  return NextResponse.json(out);
}
