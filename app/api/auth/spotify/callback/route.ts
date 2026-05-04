// app/api/auth/spotify/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode, setTokenCookies } from '@/lib/spotify/auth';

// Derive the app origin from SPOTIFY_REDIRECT_URI so redirects always land
// on the same origin where cookies are valid.
function appOrigin(): string {
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:3001/api/auth/spotify/callback';
  return new URL(redirectUri).origin;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const jar = await cookies();
  const savedState = jar.get('spotify_state')?.value;
  const codeVerifier = jar.get('spotify_code_verifier')?.value;

  const origin = appOrigin();

  if (error || !code || state !== savedState || !codeVerifier) {
    return NextResponse.redirect(`${origin}/?spotify_error=access_denied`);
  }

  try {
    const tokens = await exchangeCode(code, codeVerifier);
    await setTokenCookies(tokens.access_token, tokens.refresh_token, tokens.expires_in);
    jar.delete('spotify_code_verifier');
    jar.delete('spotify_state');
    return NextResponse.redirect(`${origin}/builder`);
  } catch {
    return NextResponse.redirect(`${origin}/?spotify_error=token_exchange`);
  }
}
