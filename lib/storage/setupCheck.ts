// Cheap, conservative "did the user run setup?" check.
//
// The bare `moodcast` command uses this to decide between "open the app"
// and "show a one-line nudge to run `moodcast setup`". The check
// intentionally stays loose:
//
//   • node_modules/next/package.json present  →  `npm install` has run
//   • <repoRoot>/.env.local present           →  setup created the env file
//
// We deliberately do NOT validate the *contents* of .env.local here.
// Moodcast supports demo mode without keys, and the `setup` command's
// existing instructions already explain what each var does. Reporting
// "missing key" from the daily launcher would be both noisy and partly
// wrong (since demo mode is a real, supported flow).

import fs from 'fs';
import path from 'path';

export interface SetupCheckResult {
  ok: boolean;
  /** Short list of missing-piece labels for the nudge message. */
  missing: Array<'deps' | 'env'>;
  /** Resolved repo root, returned for callers that need to print it. */
  repoRoot: string;
  /** Whether the user has run any Moodcast session yet (a heuristic — the
   *  daily launcher uses this to decide between "first run, show a hint"
   *  and "returning user, just open the app"). */
  hasRunBefore: boolean;
}

export function checkSetup(repoRoot: string, moodcastHome: string): SetupCheckResult {
  const missing: Array<'deps' | 'env'> = [];

  const depsMarker = path.join(repoRoot, 'node_modules', 'next', 'package.json');
  if (!fs.existsSync(depsMarker)) missing.push('deps');

  const envFile = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envFile)) missing.push('env');

  // hasRunBefore is best-effort: we look for the active-session pointer or
  // any session record in <home>/sessions/. Either implies the user has
  // been here before.
  let hasRunBefore = false;
  try {
    if (fs.existsSync(path.join(moodcastHome, 'active-session.json'))) {
      hasRunBefore = true;
    } else {
      const sessionsDir = path.join(moodcastHome, 'sessions');
      if (fs.existsSync(sessionsDir)) {
        const names = fs.readdirSync(sessionsDir);
        hasRunBefore = names.some((n) => n.endsWith('.json'));
      }
    }
  } catch {
    /* fs unavailable — keep false, harmless */
  }

  return { ok: missing.length === 0, missing, repoRoot, hasRunBefore };
}
