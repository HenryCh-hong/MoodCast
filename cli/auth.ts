import fs from 'fs';
import {
  resolveMoodcastPath,
  ensureMoodcastHome,
} from '../lib/storage/moodcastHome.js';

function tokenFile(): string {
  return resolveMoodcastPath('tokens.json');
}

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix ms
}

export function readTokens(): StoredTokens | null {
  try {
    const raw = fs.readFileSync(tokenFile(), 'utf-8');
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function writeTokens(tokens: StoredTokens): void {
  ensureMoodcastHome();
  fs.writeFileSync(tokenFile(), JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function clearTokens(): void {
  try { fs.unlinkSync(tokenFile()); } catch { /* already gone */ }
}

export function isTokenValid(tokens: StoredTokens): boolean {
  return Date.now() < tokens.expires_at - 60_000;
}

export async function refreshTokens(tokens: StoredTokens): Promise<StoredTokens | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: clientId,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  const newTokens: StoredTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  writeTokens(newTokens);
  return newTokens;
}

export async function getValidToken(): Promise<string | null> {
  let tokens = readTokens();
  if (!tokens) return null;
  if (isTokenValid(tokens)) return tokens.access_token;
  tokens = await refreshTokens(tokens);
  return tokens?.access_token ?? null;
}
