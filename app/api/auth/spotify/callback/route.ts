// app/api/auth/spotify/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode } from '@/lib/spotify/auth';

function appOrigin(): string {
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:3001/api/auth/spotify/callback';
  return new URL(redirectUri).origin;
}

function cookieStr(name: string, value: string, maxAge: number, secure: boolean): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function deleteCookieStr(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const jar = await cookies();
  const savedState = jar.get('spotify_state')?.value;
  const codeVerifier = jar.get('spotify_code_verifier')?.value;
  const isCli = jar.get('spotify_cli')?.value === '1';

  const origin = appOrigin();

  console.log('[spotify/callback] hit', {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
    hasSavedState: !!savedState,
    hasCodeVerifier: !!codeVerifier,
    stateMatch: state === savedState,
    origin,
  });

  if (error || !code || state !== savedState || !codeVerifier) {
    console.log('[spotify/callback] validation failed, redirecting to access_denied', {
      error,
      noCode: !code,
      stateMismatch: state !== savedState,
      noVerifier: !codeVerifier,
    });
    return NextResponse.redirect(`${origin}/?spotify_error=access_denied`);
  }

  let tokens: { access_token: string; refresh_token: string; expires_in: number };
  try {
    console.log('[spotify/callback] exchanging code...');
    tokens = await exchangeCode(code, codeVerifier);
    console.log('[spotify/callback] token exchange succeeded', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });
  } catch (err) {
    console.error('[spotify/callback] token exchange FAILED', err);
    return NextResponse.redirect(`${origin}/?spotify_error=token_exchange`);
  }

  const secure = process.env.NODE_ENV === 'production';
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  if (isCli) {
    // Write tokens to <home>/tokens.json so the CLI can use them without cookies.
    // <home> respects MOODCAST_HOME — see lib/storage/moodcastHome.ts.
    const fs = await import('fs');
    const { resolveMoodcastPath, ensureMoodcastHome } = await import('@/lib/storage/moodcastHome');
    ensureMoodcastHome();
    const tokenFile = resolveMoodcastPath('tokens.json');
    fs.writeFileSync(
      tokenFile,
      JSON.stringify(
        { access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: expiresAt },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log('[spotify/callback] CLI auth: tokens written to', tokenFile);
  }

  const redirectTo = isCli ? `${origin}/api/auth/cli-done` : `${origin}/builder`;
  const headers = new Headers({ Location: redirectTo });
  headers.append('Set-Cookie', cookieStr('spotify_access_token', tokens.access_token, tokens.expires_in, secure));
  headers.append('Set-Cookie', cookieStr('spotify_refresh_token', tokens.refresh_token, 60 * 60 * 24 * 60, secure));
  headers.append('Set-Cookie', cookieStr('spotify_expires_at', String(expiresAt), 60 * 60 * 24 * 60, secure));
  headers.append('Set-Cookie', deleteCookieStr('spotify_code_verifier'));
  headers.append('Set-Cookie', deleteCookieStr('spotify_state'));
  headers.append('Set-Cookie', deleteCookieStr('spotify_cli'));

  console.log('[spotify/callback] setting cookies and redirecting', {
    cookieNames: ['spotify_access_token', 'spotify_refresh_token', 'spotify_expires_at'],
    secure,
    redirectTo,
    isCli,
  });

  return new Response(null, { status: 302, headers });
}
