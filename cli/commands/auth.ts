// Shared Spotify auth handler — invoked from the top-level `moodcast auth`
// command and from the shell's `auth` / `spotify auth` / `login` /
// `connect spotify` aliases. Browser-driven PKCE flow handled by the dev
// server; this command just opens the right URL.

import chalk from 'chalk';
import { isShellMode } from '../utils/shellContext.js';

export async function authCommand(): Promise<void> {
  const open = (await import('open')).default;
  // Derive base URL from SPOTIFY_REDIRECT_URI so it always matches the
  // running dev server, e.g.
  //   http://127.0.0.1:3001/api/auth/spotify/callback → http://127.0.0.1:3001
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:3001/api/auth/spotify/callback';
  const base = new URL(redirectUri).origin;
  const url = `${base}/api/auth/spotify?cli=1`;

  console.log('');
  console.log('  Opening browser for Spotify authorization…');
  console.log(`  URL: ${url}`);
  console.log('');

  await open(url);

  // Confirmation hint matches the surface the user is on.
  if (isShellMode()) {
    console.log(`  After authorizing in the browser, type ${chalk.bold('status')} to confirm.`);
  } else {
    console.log(
      `  After authorizing in the browser, run ${chalk.bold('npm run moodcast --silent -- status')} to confirm.`
    );
  }
  console.log('');
}
