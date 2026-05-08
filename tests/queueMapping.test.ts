// Lightweight assertions for the canonical queue mapping. Runs with tsx —
// no test framework needed. Each `assert` throws on failure with a clear
// message; on success the script prints a summary and exits 0.
//
//   $ npx tsx tests/queueMapping.test.ts
//
// Or, via the npm script:
//
//   $ npm run test:queue
//
// These cover the cases the playback-sequencing bug was about:
//   1. All-playable session → row N maps to playable N.
//   2. Unplayable middle row → natural NEXT skips it.
//   3. Duplicate URIs → reconciliation snaps to the nearest occurrence at
//      or after the hint, not the first match.
//   4. Track click row 5 → playable index 4 (with mid-row gaps).
//   5. Terminal `track 5` semantics: same mapping behaviour.

import {
  buildSessionQueueMapping,
  findPlayableIndex,
  rawToPlayableIndex,
  playableToRawIndex,
} from '../lib/session/queueMapping';
import type { Track } from '../lib/types/moodcast';

function track(uri: string, title = 'x', artist = 'y'): Track {
  return {
    uri,
    id: '',
    title,
    artist,
    albumName: '',
    albumArt: '',
    durationMs: 0,
    moodTag: '',
    energy: 'medium',
    whyItFits: '',
    transitionLine: '',
    sourceIntent: undefined,
    familiarityLevel: undefined,
    whyThisSourceFits: '',
  } as Track;
}

let passed = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
  passed += 1;
  console.log(`✓ ${msg}`);
}

const A = 'spotify:track:aaaaaaaaaaaaaaaaaaaaaa';
const B = 'spotify:track:bbbbbbbbbbbbbbbbbbbbbb';
const C = 'spotify:track:cccccccccccccccccccccc';
const D = 'spotify:track:dddddddddddddddddddddd';
const E = 'spotify:track:eeeeeeeeeeeeeeeeeeeeee';

// 1. all-playable: NEXT after playable 0 is raw row 1
{
  const m = buildSessionQueueMapping([track(A), track(B), track(C)]);
  assert(m.playableUris.length === 3, '1: 3 playable URIs');
  assert(m.playableIndexToRaw[1] === 1, '1: playable index 1 → raw row 1');
  assert(m.rawIndexToPlayable[2] === 2, '1: raw row 2 → playable index 2');
}

// 2. raw row 2 unplayable: NEXT after track 1 = raw row 3 (visible)
{
  const m = buildSessionQueueMapping([
    track(A),    // raw 0 → playable 0
    track(''),   // raw 1 → -1 (unplayable)
    track(B),    // raw 2 → playable 1
    track(C),    // raw 3 → playable 2
  ]);
  assert(m.playableUris.length === 3, '2: 3 playable URIs (1 dropped)');
  assert(m.rawIndexToPlayable[1] === -1, '2: unplayable row maps to -1');
  assert(playableToRawIndex(m, 1) === 2, '2: NEXT after playable 0 = raw row 2 (visible)');
  assert(playableToRawIndex(m, 0) === 0, '2: playable 0 = raw 0');
  assert(playableToRawIndex(m, 99) === null, '2: out-of-range playable index → null');
}

// 3. duplicate URI: reconciliation prefers occurrence at or after the hint
{
  const m = buildSessionQueueMapping([
    track(A), // playable 0
    track(B), // playable 1
    track(A), // playable 2  ← duplicate of A
    track(C), // playable 3
  ]);
  // Player is at index 2 (the second A). Reconciliation should NOT snap
  // back to index 0 — that's the first-occurrence bug.
  const idx = findPlayableIndex(m, A, 2);
  assert(idx === 2, '3: duplicate A with hint=2 resolves to index 2, not 0');

  const idxFromZero = findPlayableIndex(m, A, 0);
  assert(idxFromZero === 0, '3: duplicate A with hint=0 resolves to index 0');

  const idxBackward = findPlayableIndex(m, A, 3);
  assert(idxBackward === 2, '3: duplicate A with hint=3 falls back to nearest earlier match (2)');

  const miss = findPlayableIndex(m, 'spotify:track:zzzzzzzzzzzzzzzzzzzzzz', 0);
  assert(miss === -1, '3: unknown URI returns -1');
}

// 4. track click row 5 with mid-row gaps
{
  const m = buildSessionQueueMapping([
    track(A),  // 0 → playable 0
    track(''), // 1 → -1
    track(B),  // 2 → playable 1
    track(''), // 3 → -1
    track(C),  // 4 → playable 2
    track(D),  // 5 → playable 3
    track(E),  // 6 → playable 4
  ]);
  assert(rawToPlayableIndex(m, 5) === 3, '4: row 5 (D) maps to playable index 3');
  assert(rawToPlayableIndex(m, 1) === -1, '4: unplayable row 1 maps to -1');
  assert(playableToRawIndex(m, 3) === 5, '4: round-trip playable 3 → raw 5');
}

// 5. terminal `track 5` semantics — 1-indexed input, same mapping result
{
  const m = buildSessionQueueMapping([
    track(A),
    track(B),
    track(''),
    track(C),
    track(D),
  ]);
  // `track 5` → rowIndex = 4, playable index = 3
  const userInput = 5;
  const rowIndex = userInput - 1;
  assert(rawToPlayableIndex(m, rowIndex) === 3, '5: terminal track 5 maps to playable index 3');
}

console.log('');
console.log(`${passed} assertion${passed === 1 ? '' : 's'} passed.`);
