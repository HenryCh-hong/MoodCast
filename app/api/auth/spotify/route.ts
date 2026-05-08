// app/api/auth/spotify/route.ts
import { NextResponse } from 'next/server';
import { getSpotifyAuthUrl } from '@/lib/spotify/auth';
import crypto from 'crypto';

function base64URLEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function GET(req: Request) {
  const isCli = new URL(req.url).searchParams.get('cli') === '1';
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const codeChallenge = base64URLEncode(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  const state = base64URLEncode(crypto.randomBytes(16));

  const secure = process.env.NODE_ENV === 'production';
  const cookieOpts = `Path=/; Max-Age=300; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

  const authUrl = getSpotifyAuthUrl(state, codeChallenge);
  const parsedUrl = new URL(authUrl);
  console.log('[spotify/auth] Authorization URL components:', {
    scope: parsedUrl.searchParams.get('scope'),
    redirect_uri: parsedUrl.searchParams.get('redirect_uri'),
    show_dialog: parsedUrl.searchParams.get('show_dialog'),
    client_id_present: !!parsedUrl.searchParams.get('client_id'),
    response_type: parsedUrl.searchParams.get('response_type'),
  });

  const headers = new Headers({
    Location: authUrl,
  });
  headers.append('Set-Cookie', `spotify_code_verifier=${encodeURIComponent(codeVerifier)}; ${cookieOpts}`);
  headers.append('Set-Cookie', `spotify_state=${encodeURIComponent(state)}; ${cookieOpts}`);
  if (isCli) {
    headers.append('Set-Cookie', `spotify_cli=1; ${cookieOpts}`);
  }

  return new Response(null, { status: 302, headers });
}
