// app/api/auth/spotify/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSpotifyAuthUrl } from '@/lib/spotify/auth';
import crypto from 'crypto';

function base64URLEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function GET() {
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const codeChallenge = base64URLEncode(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  const state = base64URLEncode(crypto.randomBytes(16));

  const jar = await cookies();
  jar.set('spotify_code_verifier', codeVerifier, { httpOnly: true, sameSite: 'lax', maxAge: 300 });
  jar.set('spotify_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 300 });

  return NextResponse.redirect(getSpotifyAuthUrl(state, codeChallenge));
}
