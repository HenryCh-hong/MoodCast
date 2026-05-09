// Terminal-side feedback tests. Mirrors the framework-free style of
// tests/feedback.test.ts. Sandboxes MOODCAST_HOME so the user's real
// ~/.moodcast/feedback.json is never touched.
//
//   $ npx tsx tests/feedback.terminal.test.ts

import fs from 'fs';
import os from 'os';
import path from 'path';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'moodcast-cli-feedback-'));
process.env.MOODCAST_HOME = sandbox;

async function run(): Promise<void> {
  // Dynamic imports so MOODCAST_HOME is in effect before lib/* loads.
  const { applyFeedbackForTrack, getVerdictForTrack } = await import('../cli/feedback.js');
  const { readFeedback, getFeedbackPath } = await import('../lib/feedback/feedbackStore.js');

  type Track = {
    title: string;
    artist: string;
    moodTag: string;
    energy: 'low' | 'medium' | 'high';
    whyItFits: string;
    transitionLine: string;
    uri?: string;
    sourceIntent?: 'familiar_anchor' | 'same_artist_fresh' | 'adjacent_artist' | 'contextual_discovery' | 'user_seed';
    familiarityLevel?: 'familiar' | 'fresh' | 'discovery';
  };

  let passed = 0;
  function assert(cond: unknown, msg: string): void {
    if (!cond) {
      console.error(`✗ ${msg}`);
      process.exit(1);
    }
    passed += 1;
    console.log(`✓ ${msg}`);
  }

  const TRACK_A: Track = {
    title: 'Garden Song',
    artist: 'Phoebe Bridgers',
    moodTag: 'gentle',
    energy: 'low',
    whyItFits: '',
    transitionLine: '',
    uri: 'spotify:track:terminaltest0000000000a1',
    sourceIntent: 'familiar_anchor',
    familiarityLevel: 'familiar',
  };
  const TRACK_B: Track = {
    title: 'Shrike',
    artist: 'Hozier',
    moodTag: 'reflective',
    energy: 'low',
    whyItFits: '',
    transitionLine: '',
    uri: 'spotify:track:terminaltest0000000000b1',
    sourceIntent: 'same_artist_fresh',
    familiarityLevel: 'fresh',
  };
  const TRACK_NO_URI: Track = {
    title: 'A Track Without URI',
    artist: 'Some Artist',
    moodTag: '',
    energy: 'medium',
    whyItFits: '',
    transitionLine: '',
  };

  // 1. Like a track — disk file and verdict round-trip.
  {
    const result = applyFeedbackForTrack({ track: TRACK_A, verdict: 'like', sessionId: 'sess-1' });
    assert(result.ok, '1: like result.ok');
    assert(result.changed, '1: like changed disk');
    assert(result.message === 'Liked this track', '1: like message');
    assert(getVerdictForTrack(TRACK_A) === 'like', '1: verdict reads back as like');
    assert(getVerdictForTrack(TRACK_B) === 'none', '1: untouched track is none');
  }

  // 2. Toggle the same track from like → dislike (one record, latest wins).
  {
    const before = readFeedback();
    const result = applyFeedbackForTrack({ track: TRACK_A, verdict: 'dislike' });
    assert(result.ok, '2: dislike result.ok');
    const after = readFeedback();
    assert(after.length === before.length, '2: row count unchanged on toggle');
    assert(getVerdictForTrack(TRACK_A) === 'dislike', '2: verdict updated to dislike');
  }

  // 3. Dislike a second track — two distinct rows.
  {
    const result = applyFeedbackForTrack({ track: TRACK_B, verdict: 'dislike', sessionId: 'sess-1' });
    assert(result.ok, '3: dislike on track B ok');
    const all = readFeedback();
    assert(all.length === 2, '3: two rows now exist');
    assert(getVerdictForTrack(TRACK_A) === 'dislike', '3: A still dislike');
    assert(getVerdictForTrack(TRACK_B) === 'dislike', '3: B now dislike');
  }

  // 4. Clear feedback for one track — only that row removed.
  {
    const result = applyFeedbackForTrack({ track: TRACK_A, verdict: 'clear' });
    assert(result.ok, '4: clear result.ok');
    assert(result.changed, '4: clear changed disk');
    const all = readFeedback();
    assert(all.length === 1, '4: one row remains after clear');
    assert(getVerdictForTrack(TRACK_A) === 'none', '4: A verdict cleared');
    assert(getVerdictForTrack(TRACK_B) === 'dislike', '4: B verdict untouched');
  }

  // 5. Clear when there's nothing to clear — ok, but changed=false.
  {
    const result = applyFeedbackForTrack({ track: TRACK_A, verdict: 'clear' });
    assert(result.ok, '5: clear-empty ok');
    assert(!result.changed, '5: clear-empty did not change disk');
    assert(result.message === 'No feedback to clear', '5: clear-empty message');
  }

  // 6. Track without URI — title|artist fallback works for both write + read.
  {
    const writeResult = applyFeedbackForTrack({ track: TRACK_NO_URI, verdict: 'like' });
    assert(writeResult.ok, '6: like on URI-less track ok');
    assert(getVerdictForTrack(TRACK_NO_URI) === 'like', '6: verdict on URI-less track is like');
    const clearResult = applyFeedbackForTrack({ track: TRACK_NO_URI, verdict: 'clear' });
    assert(clearResult.changed, '6: clear on URI-less track changed disk');
    assert(getVerdictForTrack(TRACK_NO_URI) === 'none', '6: verdict on URI-less track cleared');
  }

  // 7. Source intent metadata is preserved on write (fed to aggregator later).
  {
    applyFeedbackForTrack({ track: TRACK_B, verdict: 'like', sessionId: 'sess-2' });
    const all = readFeedback();
    const row = all.find((r) => r.trackUri === TRACK_B.uri);
    assert(!!row, '7: row for track B exists');
    assert(row?.sourceIntent === 'same_artist_fresh', '7: sourceIntent persisted');
    assert(row?.familiarityLevel === 'fresh', '7: familiarityLevel persisted');
    assert(row?.sessionId === 'sess-2', '7: sessionId persisted');
  }

  // 8. Privacy: feedback file contains no Spotify tokens, refresh tokens, or secrets.
  {
    const raw = fs.readFileSync(getFeedbackPath(), 'utf-8');
    assert(!/access_token/i.test(raw), '8: no access_token field in feedback file');
    assert(!/refresh_token/i.test(raw), '8: no refresh_token field in feedback file');
    assert(!/client_secret/i.test(raw), '8: no client_secret in feedback file');
  }

  // 9. Sandbox isolation — the file we wrote is under the temp MOODCAST_HOME.
  {
    const p = getFeedbackPath();
    assert(p.startsWith(sandbox), `9: feedback file is under sandbox ${sandbox}`);
  }

  // 10. Empty / malformed track is rejected without crashing.
  {
    const result = applyFeedbackForTrack({
      track: { title: '', artist: '', moodTag: '', energy: 'medium', whyItFits: '', transitionLine: '' },
      verdict: 'like',
    });
    assert(!result.ok, '10: empty track rejected');
    assert(!result.changed, '10: rejected attempt did not write');
  }

  console.log(`\n${passed} assertions passed.`);
}

void run();
