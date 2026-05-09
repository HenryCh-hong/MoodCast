// Lightweight assertions for the feedback memory subsystem. Mirrors the
// queueMapping test style — plain tsx, no framework. Sandboxes
// MOODCAST_HOME under a fresh temp dir so the user's real ~/.moodcast/ is
// never touched.
//
//   $ npx tsx tests/feedback.test.ts

import fs from 'fs';
import os from 'os';
import path from 'path';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'moodcast-feedback-'));
process.env.MOODCAST_HOME = sandbox;

// Wrap in an async IIFE — top-level await is not enabled in this project's
// CJS-emitting tsx configuration. The env var has to be set before the
// dynamic imports run so feedbackStore picks up the sandbox.

async function run(): Promise<void> {
  const {
    upsertFeedback,
    readFeedback,
    clearFeedback,
    clearAllFeedback,
    getFeedbackPath,
  } = await import('../lib/feedback/feedbackStore.js');
  const { summarizeFeedback, getDislikedUriSet } = await import('../lib/feedback/aggregate.js');
  const { filterDislikedExactTracks } = await import('../lib/feedback/applyToSession.js');

  let passed = 0;
  function assert(cond: unknown, msg: string): void {
    if (!cond) {
      console.error(`✗ ${msg}`);
      process.exit(1);
    }
    passed += 1;
    console.log(`✓ ${msg}`);
  }

const URI_A = 'spotify:track:aaaaaaaaaaaaaaaaaaaaaa';
const URI_B = 'spotify:track:bbbbbbbbbbbbbbbbbbbbbb';

// 1. roundtrip — like written, file exists with mode 0600, value persists
{
  upsertFeedback({ trackUri: URI_A, title: 'T1', artist: 'Mitski', feedback: 'like' });
  const records = readFeedback();
  assert(records.length === 1, '1: one record after upsert');
  assert(records[0].feedback === 'like', '1: verdict is like');
  assert(records[0].trackUri === URI_A, '1: uri preserved');
  const stat = fs.statSync(getFeedbackPath());
  // 0o600 = 384. Mask the ownership bits — only check the user-rw, no-group, no-other shape.
  assert((stat.mode & 0o777) === 0o600, '1: feedback.json mode is 0600');
}

// 2. toggling → latest wins, single row per track key
{
  upsertFeedback({ trackUri: URI_A, title: 'T1', artist: 'Mitski', feedback: 'dislike' });
  const records = readFeedback();
  assert(records.length === 1, '2: still one record after toggle');
  assert(records[0].feedback === 'dislike', '2: latest verdict (dislike) wins');
}

// 3. fallback key (title|artist) when no Spotify URI present
{
  upsertFeedback({ title: 'No URI Track', artist: 'Indie Folk', feedback: 'like' });
  const records = readFeedback();
  assert(records.length === 2, '3: two records (one URI-keyed, one fallback)');
  // Toggling the same fallback key shouldn't add a third row.
  upsertFeedback({ title: 'No URI Track', artist: 'Indie Folk', feedback: 'dislike' });
  const r2 = readFeedback();
  assert(r2.length === 2, '3: fallback toggle replaces, no new row');
}

// 4. summary — liked / disliked artists, blocked URIs, prompt summary present
{
  upsertFeedback({ trackUri: URI_B, title: 'T2', artist: 'Phoebe Bridgers', feedback: 'like', sourceIntent: 'familiar_anchor', familiarityLevel: 'familiar' });
  const summary = summarizeFeedback(readFeedback());
  assert(summary.hasFeedback, '4: summary.hasFeedback');
  assert(summary.likedArtists.includes('Phoebe Bridgers'), '4: likedArtists includes Phoebe Bridgers');
  assert(summary.dislikedTrackUris.includes(URI_A), '4: dislikedTrackUris includes URI_A');
  assert(summary.dislikedNonSpotifyKeys.length === 1, '4: one fallback dislike key');
  assert(typeof summary.promptSummary === 'string' && summary.promptSummary.length > 0, '4: promptSummary non-empty');
}

// 5. filter disliked exact tracks — mutates uri only, not row position
{
  const session = {
    sessionTitle: 'X',
    sessionSubtitle: '',
    mood: '',
    activity: '',
    energyArc: '',
    openingMonologue: '',
    endingMessage: '',
    sessionArc: [],
    tracks: [
      { uri: URI_A, id: '', title: 'T1', artist: 'Mitski', albumName: '', albumArt: '', durationMs: 0, moodTag: '', energy: 'medium' as const, whyItFits: '', transitionLine: '' },
      { uri: URI_B, id: '', title: 'T2', artist: 'Phoebe Bridgers', albumName: '', albumArt: '', durationMs: 0, moodTag: '', energy: 'medium' as const, whyItFits: '', transitionLine: '' },
    ],
  };
  const result = filterDislikedExactTracks(session, readFeedback());
  assert(result.blocked === 1, '5: one disliked track blocked');
  assert(result.session.tracks.length === 2, '5: row count unchanged (URI cleared, slot kept)');
  assert(result.session.tracks[0].uri === '', '5: disliked track URI cleared');
  assert(result.session.tracks[1].uri === URI_B, '5: liked track URI untouched');
}

// 6. clearFeedback by URI removes only that row
{
  const before = readFeedback().length;
  const removed = clearFeedback({ trackUri: URI_A });
  assert(removed, '6: clear-by-uri returns true');
  const after = readFeedback();
  assert(after.length === before - 1, '6: row count decreases by 1');
  assert(!after.some((r) => r.trackUri === URI_A), '6: URI_A no longer present');
}

// 7. dislikedUriSet excludes empty/non-spotify entries
{
  upsertFeedback({ trackUri: URI_A, title: 'T1', artist: 'Mitski', feedback: 'dislike' });
  const set = getDislikedUriSet(readFeedback());
  assert(set.has(URI_A), '7: dislikedUriSet contains URI_A');
  assert(!set.has(''), '7: dislikedUriSet rejects empty string');
}

// 8. no secrets / tokens in stored records
{
  const raw = fs.readFileSync(getFeedbackPath(), 'utf-8');
  assert(!/access[_-]?token/i.test(raw), '8: feedback.json contains no access tokens');
  assert(!/refresh[_-]?token/i.test(raw), '8: feedback.json contains no refresh tokens');
  assert(!/client[_-]?secret/i.test(raw), '8: feedback.json contains no client secret');
}

// 9. clearAllFeedback empties the file
{
  clearAllFeedback();
  assert(readFeedback().length === 0, '9: clearAllFeedback empties the array');
}

// 10. resolves under MOODCAST_HOME
{
  assert(getFeedbackPath().startsWith(sandbox), `10: stored path is under sandbox ${sandbox}`);
}

  console.log('');
  console.log(`${passed} assertion${passed === 1 ? '' : 's'} passed.`);
}

run()
  .catch((err) => {
    console.error('test run failed:', err);
    process.exit(1);
  })
  .finally(() => {
    // Best-effort cleanup — leave the dir on failure for inspection.
    try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch { /* ignore */ }
  });
