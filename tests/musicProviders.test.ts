// Lightweight assertions for the music-provider abstraction.
//
//   $ npx tsx tests/musicProviders.test.ts
//
// Coverage:
//   1. Capability flags reflect what each provider actually implements
//      (no method is callable when its capability flag says false; no
//      capability flag claims true while its method is missing).
//   2. External search URLs are well-formed and properly URL-encoded
//      (NetEase / QQ rely on these for the Chinese-user fallback).
//   3. Spotify provider passes valid spotify:track:... URIs through
//      `resolveTrack` without an API call. (We don't hit Spotify in
//      tests — that requires a live token.)
//   4. Audit: `package.json` does NOT depend on any of the well-known
//      unofficial NetEase / QQ Music npm packages. This is the rule we
//      committed to in docs/music-providers.md and a check that scales
//      better than reading every PR.

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import {
  spotifyProvider,
} from '../lib/music/providers/spotify';
import { neteaseProvider } from '../lib/music/providers/netease';
import { qqMusicProvider } from '../lib/music/providers/qqmusic';
import {
  getProvider,
  listProviders,
  DEFAULT_PRIMARY_PROVIDER,
  canDrivePlayback,
} from '../lib/music/providers/index';
import type { Track } from '../lib/types/moodcast';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

let passed = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
  passed += 1;
  console.log(`✓ ${msg}`);
}

// 1. Spotify: full provider; capabilities match implementation.
{
  const p = spotifyProvider;
  assert(p.id === 'spotify', '1: spotify id');
  assert(p.capabilities.auth === true, '1: spotify auth=true');
  assert(p.capabilities.search === true, '1: spotify search=true');
  // Playback split: appDeepLinks (spotify:track:...) + sdkPlayback (Web
  // Playback SDK), but not webPlayback (we don't drop in an iframe widget).
  assert(p.capabilities.appDeepLinks === true, '1: spotify appDeepLinks=true');
  assert(p.capabilities.webPlayback === false, '1: spotify webPlayback=false');
  assert(p.capabilities.sdkPlayback === true, '1: spotify sdkPlayback=true');
  assert(p.capabilities.playlistCreate === true, '1: spotify playlistCreate=true');
  assert(p.capabilities.playlistAddTracks === true, '1: spotify playlistAddTracks=true');
  assert(p.capabilities.externalLinks === true, '1: spotify externalLinks=true');
  assert(typeof p.searchTrack === 'function', '1: spotify implements searchTrack');
  assert(typeof p.startPlayback === 'function', '1: spotify implements startPlayback');
  assert(typeof p.createPlaylist === 'function', '1: spotify implements createPlaylist');
  assert(typeof p.addTracksToPlaylist === 'function', '1: spotify implements addTracksToPlaylist');
  assert(typeof p.getExternalSearchUrl === 'function', '1: spotify implements getExternalSearchUrl');
  // Capability notes for nuance (Premium gate, playlist quota).
  assert(typeof p.capabilityNotes?.sdkPlayback === 'string', '1: spotify capabilityNotes.sdkPlayback');
  assert(typeof p.capabilityNotes?.playlistAddTracks === 'string', '1: spotify capabilityNotes.playlistAddTracks');
  // canDrivePlayback should be true (sdkPlayback is on).
  assert(canDrivePlayback(p) === true, '1: canDrivePlayback(spotify) === true');
}

// 2. NetEase: placeholder; only externalLinks should be true; no playback method.
{
  const p = neteaseProvider;
  assert(p.id === 'netease', '2: netease id');
  assert(p.capabilities.auth === false, '2: netease auth=false');
  assert(p.capabilities.search === false, '2: netease search=false');
  assert(p.capabilities.appDeepLinks === false, '2: netease appDeepLinks=false');
  assert(p.capabilities.webPlayback === false, '2: netease webPlayback=false');
  assert(p.capabilities.sdkPlayback === false, '2: netease sdkPlayback=false');
  assert(p.capabilities.playlistCreate === false, '2: netease playlistCreate=false');
  assert(p.capabilities.playlistAddTracks === false, '2: netease playlistAddTracks=false');
  assert(p.capabilities.externalLinks === true, '2: netease externalLinks=true');
  assert(typeof p.startPlayback !== 'function', '2: netease must NOT implement startPlayback');
  assert(typeof p.createPlaylist !== 'function', '2: netease must NOT implement createPlaylist');
  assert(typeof p.addTracksToPlaylist !== 'function', '2: netease must NOT implement addTracksToPlaylist');
  assert(typeof p.getExternalSearchUrl === 'function', '2: netease implements getExternalSearchUrl');
  assert(canDrivePlayback(p) === false, '2: canDrivePlayback(netease) === false');
}

// 3. QQ Music: same shape as NetEase placeholder.
{
  const p = qqMusicProvider;
  assert(p.id === 'qqmusic', '3: qqmusic id');
  assert(p.capabilities.auth === false, '3: qqmusic auth=false');
  assert(p.capabilities.search === false, '3: qqmusic search=false');
  assert(p.capabilities.appDeepLinks === false, '3: qqmusic appDeepLinks=false');
  assert(p.capabilities.webPlayback === false, '3: qqmusic webPlayback=false');
  assert(p.capabilities.sdkPlayback === false, '3: qqmusic sdkPlayback=false');
  assert(p.capabilities.externalLinks === true, '3: qqmusic externalLinks=true');
  assert(typeof p.startPlayback !== 'function', '3: qqmusic must NOT implement startPlayback');
  assert(typeof p.createPlaylist !== 'function', '3: qqmusic must NOT implement createPlaylist');
  assert(typeof p.getExternalSearchUrl === 'function', '3: qqmusic implements getExternalSearchUrl');
  assert(canDrivePlayback(p) === false, '3: canDrivePlayback(qqmusic) === false');
}

// 4. External-search URLs are well-formed AND URL-encode the query so non-ASCII
//    characters survive. The "夜空中最亮的星" / "周深" pairing exercises that.
{
  const cnQuery = { title: '夜空中最亮的星', artist: '周深' };

  const neteaseUrl = neteaseProvider.getExternalSearchUrl!(cnQuery);
  const qqUrl = qqMusicProvider.getExternalSearchUrl!(cnQuery);
  const spotifyUrl = spotifyProvider.getExternalSearchUrl!(cnQuery);

  assert(neteaseUrl.startsWith('https://music.163.com/'), '4: netease URL → music.163.com');
  assert(qqUrl.startsWith('https://y.qq.com/'), '4: qq URL → y.qq.com');
  assert(spotifyUrl.startsWith('https://open.spotify.com/'), '4: spotify URL → open.spotify.com');

  // Encoded forms of the test characters must appear; raw CJK must not.
  const encodedTitle = encodeURIComponent('夜空中最亮的星');
  assert(neteaseUrl.includes(encodedTitle), '4: netease URL contains encoded title');
  assert(qqUrl.includes(encodedTitle), '4: qq URL contains encoded title');
  assert(spotifyUrl.includes(encodedTitle), '4: spotify URL contains encoded title');
  assert(!neteaseUrl.includes('夜空'), '4: netease URL does NOT contain raw CJK');
  assert(!qqUrl.includes('夜空'), '4: qq URL does NOT contain raw CJK');

  // The URLs themselves must round-trip through URL constructor (= valid).
  // No throws ⇒ pass. Reference the result so the parse can't be DCE'd.
  const parsed = [new URL(neteaseUrl), new URL(qqUrl), new URL(spotifyUrl)];
  assert(parsed.length === 3, '4: all three external URLs parse via URL constructor');
}

// 5. Spotify resolveTrack passes valid spotify:track:... URIs through without
//    an API call. (Tests for searchTrack / network behaviour live in the real
//    integration suite — we don't hit Spotify here.)
async function test5(): Promise<void> {
  const validTrack: Track = {
    uri: 'spotify:track:0aBcDeFgHiJkLmNoPqRsTu',
    id: '0aBcDeFgHiJkLmNoPqRsTu',
    title: 'Demo',
    artist: 'Tester',
    albumName: 'Album',
    albumArt: '',
    durationMs: 180_000,
    moodTag: '',
    energy: 'medium',
    whyItFits: '',
    transitionLine: '',
  };
  // Only exercises the uri-already-valid branch. The else branch hits
  // searchTrack which requires a live token.
  const res = await spotifyProvider.resolveTrack!(validTrack);
  assert(res !== null, '5: resolveTrack(validUri) is not null');
  assert(res?.uri === validTrack.uri, '5: resolveTrack(validUri).uri === input.uri');
}

// 6. Registry resolves all three providers and DEFAULT_PRIMARY_PROVIDER is spotify.
{
  assert(getProvider('spotify') === spotifyProvider, '6: getProvider("spotify")');
  assert(getProvider('netease') === neteaseProvider, '6: getProvider("netease")');
  assert(getProvider('qqmusic') === qqMusicProvider, '6: getProvider("qqmusic")');
  assert(listProviders().length === 3, '6: listProviders returns 3');
  assert(DEFAULT_PRIMARY_PROVIDER === 'spotify', '6: default primary is spotify');
}

// 7. Capability/method invariant: a provider can only claim Moodcast-driven
//    playback (webPlayback OR sdkPlayback) if it actually exposes a
//    callable `startPlayback`. The reverse must also hold — having
//    `startPlayback` without one of the flags would let UI render a play
//    button that throws on click. This is the lying-about-state failure
//    mode the abstraction is designed to prevent.
{
  for (const p of listProviders()) {
    const drives = canDrivePlayback(p);
    const hasMethod = typeof p.startPlayback === 'function';
    assert(drives === hasMethod, `7: ${p.id}: canDrivePlayback (${drives}) === has startPlayback (${hasMethod})`);
  }
}

// 8. Audit: package.json must NOT depend on the popular unofficial NetEase /
//    QQ Music libraries. Adding any of them is the line that, per
//    docs/music-providers.md, Moodcast will not cross.
{
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'));
  const all: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };
  const banned = [
    'NeteaseCloudMusicApi',
    'neteasecloudmusicapi',
    'NetEaseMusicApi',
    'qq-music-api',
    'music-api-for-qq',
    'qqmusicapi',
    'QQMusicApi',
  ];
  for (const name of banned) {
    assert(!(name in all), `8: package.json must NOT depend on "${name}" (unofficial)`);
  }
}

async function main(): Promise<void> {
  await test5();
  console.log('');
  console.log(`${passed} assertion${passed === 1 ? '' : 's'} passed.`);
}

main().catch((err) => {
  console.error('test run failed:', err);
  process.exit(1);
});
