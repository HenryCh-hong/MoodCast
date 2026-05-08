// Single source of truth for the on-disk Moodcast directory.
//
// Resolution order:
//   process.env.MOODCAST_HOME      ← set this to redirect all storage
//                                    (e.g. tests: MOODCAST_HOME=$(mktemp -d) npm run …)
//   ~/.moodcast                    ← default for normal use
//
// Every module that touches local Moodcast state — active session, session
// library, preferences, apple-calendar credentials, Spotify CLI tokens, the
// last-generation-error debug record — goes through these helpers. There must
// be **no** other place in the codebase that resolves "~/.moodcast" directly.
//
// Notes
//   - The env var is consulted on every call (lazy), so processes that set it
//     after import still see the override; in practice it's set before the
//     process starts (e.g. via the shell), but the lazy lookup avoids any
//     module-load-order footgun.
//   - ensureMoodcastHome() creates the directory with mode 0700 if missing
//     and is idempotent. Per-file modes (0600 etc.) are the caller's concern.

import fs from 'fs';
import path from 'path';
import os from 'os';

export function getMoodcastHome(): string {
  return process.env.MOODCAST_HOME ?? path.join(os.homedir(), '.moodcast');
}

export function resolveMoodcastPath(...parts: string[]): string {
  return path.join(getMoodcastHome(), ...parts);
}

export function ensureMoodcastHome(): string {
  const dir = getMoodcastHome();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
