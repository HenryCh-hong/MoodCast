// app/api/auth/spotify/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode, setTokenCookies } from '@/lib/spotify/auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const jar = await cookies();
  const savedState = jar.get('spotify_state')?.value;
  const codeVerifier = jar.get('spotify_code_verifier')?.value;

  if (error || !code || state !== savedState || !codeVerifier) {
    return NextResponse.redirect(new URL('/?spotify_error=access_denied', req.url));
  }

  try {
    const tokens = await exchangeCode(code, codeVerifier);
    await setTokenCookies(tokens.access_token, tokens.refresh_token, tokens.expires_in);
    jar.delete('spotify_code_verifier');
    jar.delete('spotify_state');
    return NextResponse.redirect(new URL('/builder', req.url));
  } catch {
    return NextResponse.redirect(new URL('/?spotify_error=token_exchange', req.url));
  }
}
