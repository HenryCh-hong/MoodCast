export interface ServerStatus {
  online: boolean;
  origin: string;
  port: string;
  error?: string;
}

export function getServerOrigin(): string {
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? 'http://127.0.0.1:3001/api/auth/spotify/callback';
  return new URL(redirectUri).origin;
}

export async function pingServer(timeoutMs = 1500): Promise<ServerStatus> {
  const origin = getServerOrigin();
  const port = new URL(origin).port || '80';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${origin}/api/auth/cli-done`, {
      method: 'HEAD',
      signal: ctrl.signal,
    });
    return { online: res.status < 500, origin, port };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { online: false, origin, port, error };
  } finally {
    clearTimeout(timer);
  }
}
