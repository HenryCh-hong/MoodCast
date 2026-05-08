// Diagnostic logger for CLI playback paths. Emits structured one-line records
// to stderr when MOODCAST_DEBUG is set. Off by default — production CLI runs
// stay quiet.
//
// Privacy contract:
//   - Caller must redact secrets before passing them in.
//   - This module never inspects tokens, headers, or full device ids.
//   - Spotify device ids are 22+ chars; only the last 6 are diagnostic enough
//     to correlate two log lines without identifying a user globally.

const ENABLED = (() => {
  const v = process.env.MOODCAST_DEBUG;
  if (!v) return false;
  return v !== '0' && v.toLowerCase() !== 'false';
})();

export function debugLog(event: string, fields: Record<string, unknown> = {}): void {
  if (!ENABLED) return;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    // Defensive: never let a "token" or "secret" field through even if a
    // caller forgets the contract.
    if (/token|secret|password|authorization/i.test(k)) continue;
    safe[k] = v;
  }
  // Single line, time-prefixed, easy to grep.
  const line = `[moodcast] ${new Date().toISOString()} ${event} ${JSON.stringify(safe)}`;
  process.stderr.write(line + '\n');
}

export const isDebugEnabled = (): boolean => ENABLED;
