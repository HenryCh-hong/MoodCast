// Writes a small debug record at <home>/last-generation-error.json after
// an AI generation failure (e.g. quota exhausted). Only stores already-aggregated
// MomentContext fields and the user's selected tags — never raw event titles or
// raw coordinates. The sanitisation projection is shared with the session
// library; see lib/sessions/sanitiseMoment.ts.

import fs from 'fs';
import {
  resolveMoodcastPath,
  ensureMoodcastHome,
} from '@/lib/storage/moodcastHome';
import type { SelectedTagSet } from '@/lib/types/tags';
import type { SanitisedMomentContext } from './sanitiseMoment';

export interface LastGenerationErrorRecord {
  timestamp: number;
  code: string;
  provider?: string;
  originalMessage?: string;
  moment: SanitisedMomentContext;
  tags: SelectedTagSet;
}

export function writeLastGenerationError(record: LastGenerationErrorRecord): string | null {
  try {
    ensureMoodcastHome();
    const file = resolveMoodcastPath('last-generation-error.json');
    fs.writeFileSync(file, JSON.stringify(record, null, 2), { mode: 0o600 });
    return file;
  } catch {
    return null;
  }
}
