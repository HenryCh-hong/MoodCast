// `moodcast sessions <subcommand>`
//
// Operates on the shared session library at <home>/sessions/ (default
// ~/.moodcast/sessions, override with MOODCAST_HOME). Both CLI
// generated sessions (`moodcast start`) and web-generated sessions (PUT
// /api/sessions/active) land in the same library, so list/show/play/resume/
// delete behave consistently regardless of where the session originated.

import chalk from 'chalk';
import readline from 'readline';
import { getValidToken } from '../auth.js';
import { startSessionPlayback } from '../utils/playback.js';
import { runDashboard } from '../dashboard.js';
import { writeActiveSession } from '../../lib/sessions/activeSession.js';
import { resetPollCache } from '../utils/activeSessionPoll.js';
import {
  listSessions,
  getSession,
  resolveSessionId,
  deleteSession,
  clearLibrary,
  type SessionIndexEntry,
  type StoredSessionRecord,
} from '../../lib/sessions/sessionLibrary.js';
import {
  header,
  panel,
  panelLine,
  onAirBanner,
  nowPlaying,
  nextTrack,
  mooc,
  recovery,
  error,
  success,
} from '../display.js';

// ─── Formatters ────────────────────────────────────────────────────────────

function formatRelative(ts: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - ts);
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 36) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 14) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

function tagOrMoodActivity(e: SessionIndexEntry): string {
  if (e.tagsSummary) return e.tagsSummary;
  return [e.mood, e.activity].filter(Boolean).join(' · ') || '—';
}

// ─── list ──────────────────────────────────────────────────────────────────

export async function listCmd(opts: { limit?: number } = {}): Promise<void> {
  header();
  const entries = listSessions({ limit: opts.limit ?? 20 });
  if (entries.length === 0) {
    panel('Sessions Library', [panelLine('empty', 'no saved sessions yet', 'off')]);
    console.log('');
    console.log(`  ${chalk.dim('generate one with')} ${chalk.bold('npm run moodcast start')}`);
    console.log('');
    return;
  }
  const lines: string[] = [];
  entries.forEach((e, i) => {
    const idx = chalk.dim(`${String(i + 1).padStart(2, ' ')}.`);
    const src = e.source === 'cli' ? chalk.hex('#c4b5fd')('cli') : chalk.hex('#9bbcdc')('web');
    const time = chalk.dim(formatRelative(e.createdAt));
    const tracks = chalk.dim(`${e.trackCount}t`);
    const title = chalk.bold(e.title || '(untitled)');
    lines.push(`${idx} ${title}  ${src}  ${time}  ${tracks}`);
    lines.push(`    ${chalk.dim(e.id)}`);
    const blurb = tagOrMoodActivity(e);
    if (blurb && blurb !== '—') lines.push(`    ${chalk.dim(blurb)}`);
    if (i < entries.length - 1) lines.push('');
  });
  panel('Sessions Library', lines);
  console.log('');
  console.log(
    `  ${chalk.dim('show:')} ${chalk.bold('npm run moodcast sessions show <id>')}` +
      `   ${chalk.dim('play:')} ${chalk.bold('npm run moodcast sessions play <id>')}`,
  );
  console.log('');
}

// ─── show ──────────────────────────────────────────────────────────────────

function renderSessionDetail(rec: StoredSessionRecord): void {
  panel('Session', [
    panelLine('title', rec.title || '(untitled)'),
    panelLine('subtitle', rec.subtitle || '—'),
    panelLine('mood', rec.mood || '—'),
    panelLine('activity', rec.activity || '—'),
    panelLine('energy', rec.energyArc || '—'),
    panelLine('source', rec.source),
    panelLine('saved', new Date(rec.createdAt).toISOString().replace('T', ' ').slice(0, 16)),
    panelLine('tracks', `${rec.trackCount} (${rec.validSpotifyUriCount} playable)`),
    ...(rec.length ? [panelLine('length', rec.length)] : []),
    ...(rec.discoveryDial ? [panelLine('discovery', rec.discoveryDial)] : []),
  ]);

  if (rec.selectedTags) {
    panel('Tuned', [
      panelLine('mood', rec.selectedTags.mood.length ? rec.selectedTags.mood.join(', ') : '—'),
      panelLine('activity', rec.selectedTags.activity.length ? rec.selectedTags.activity.join(', ') : '—'),
      panelLine('texture', rec.selectedTags.texture.length ? rec.selectedTags.texture.join(', ') : '—'),
      panelLine('signal', rec.selectedTags.signal.length ? rec.selectedTags.signal.join(', ') : '—'),
      panelLine('familiarity', rec.selectedTags.familiarity || '—'),
    ]);
  }

  if (rec.session.openingMonologue) {
    console.log('');
    mooc(rec.session.openingMonologue);
  }

  console.log('');
  const queueLines: string[] = [];
  rec.session.tracks.forEach((t, i) => {
    const idx = chalk.dim(String(i + 1).padStart(2, ' '));
    const intent = t.familiarityLevel ? chalk.dim(` · ${t.familiarityLevel}`) : '';
    const why = t.transitionLine || t.whyItFits || '';
    queueLines.push(`${idx} ${chalk.bold(t.title)} ${chalk.dim('—')} ${chalk.hex('#c4b5fd')(t.artist)}${intent}`);
    if (why) queueLines.push(`     ${chalk.dim(why)}`);
  });
  panel('Queue', queueLines);
  if (rec.session.endingMessage) {
    console.log('');
    console.log(`  ${chalk.dim('ending')}  ${chalk.italic.hex('#a095b8')(`“${rec.session.endingMessage}”`)}`);
  }
  console.log('');
}

export async function showCmd(idOrPrefix: string | undefined): Promise<void> {
  header();
  if (!idOrPrefix) {
    error('Usage: npm run moodcast sessions show <id>');
    return;
  }
  const entry = resolveSessionId(idOrPrefix);
  if (!entry) {
    error(`No session matching "${idOrPrefix}". Try ${chalk.bold('npm run moodcast sessions list')}.`);
    return;
  }
  const rec = getSession(entry.id);
  if (!rec) {
    error(`Index lists "${entry.id}" but the record file is missing.`);
    return;
  }
  renderSessionDetail(rec);
}

// ─── play / resume ─────────────────────────────────────────────────────────

async function playRecord(rec: StoredSessionRecord, opts: { fromResume?: boolean } = {}): Promise<void> {
  const token = await getValidToken();
  if (!token) {
    error('Spotify is not connected.');
    recovery([chalk.bold('npm run moodcast auth') + ' to connect Spotify, then re-run']);
    return;
  }

  try {
    writeActiveSession(rec.id, rec.session, rec.source);
    resetPollCache();
  } catch (e) {
    console.error(chalk.dim('  (active session write failed — dashboard will use in-memory only)'), e);
  }

  if (rec.session.openingMonologue) mooc(rec.session.openingMonologue);

  const uris = rec.session.tracks
    .map((t) => t.uri ?? '')
    .filter((u) => u.startsWith('spotify:track:'));

  const retryHint = opts.fromResume
    ? 'npm run moodcast resume'
    : `npm run moodcast sessions play ${rec.id}`;
  const result = await startSessionPlayback(token, uris, { retryHint });
  if (!result.ok) return;

  onAirBanner(rec.session.sessionTitle);
  const first = rec.session.tracks[0];
  const second = rec.session.tracks[1];
  if (first) nowPlaying(first.title, first.artist, 0, first.durationMs ?? 0);
  if (second) nextTrack(second.title, second.artist, second.transitionLine || second.whyItFits);

  await new Promise<void>((r) => setTimeout(r, 800));
  await runDashboard({ session: rec.session, sessionId: rec.id, initialToken: token });
}

export async function playCmd(idOrPrefix: string | undefined): Promise<void> {
  header();
  if (!idOrPrefix) {
    error('Usage: npm run moodcast sessions play <id>');
    return;
  }
  const entry = resolveSessionId(idOrPrefix);
  if (!entry) {
    error(`No session matching "${idOrPrefix}". Try ${chalk.bold('npm run moodcast sessions list')}.`);
    return;
  }
  const rec = getSession(entry.id);
  if (!rec) {
    error(`Index lists "${entry.id}" but the record file is missing.`);
    return;
  }
  await playRecord(rec);
}

export async function resumeCmd(): Promise<void> {
  header();
  const entries = listSessions({ limit: 1 });
  if (entries.length > 0) {
    const rec = getSession(entries[0].id);
    if (rec) {
      await playRecord(rec, { fromResume: true });
      return;
    }
  }

  // Fallback: legacy active-session.json with no library yet.
  const { readActiveSession } = await import('../../lib/sessions/activeSession.js');
  const active = readActiveSession();
  if (!active) {
    error('No saved sessions to resume.');
    recovery([
      'generate a new session: ' + chalk.bold('npm run moodcast start'),
      'or list existing: ' + chalk.bold('npm run moodcast sessions list'),
    ]);
    return;
  }
  // Synthesise a record from the active file.
  const rec: StoredSessionRecord = {
    id: active.id,
    source: active.source,
    createdAt: active.setAt,
    updatedAt: active.setAt,
    title: active.session.sessionTitle,
    subtitle: active.session.sessionSubtitle ?? '',
    mood: active.session.mood ?? '',
    activity: active.session.activity ?? '',
    energyArc: active.session.energyArc ?? '',
    trackCount: active.session.tracks.length,
    validSpotifyUriCount: active.spotifyUris.length,
    session: active.session,
  };
  await playRecord(rec, { fromResume: true });
}

// ─── delete / clear ────────────────────────────────────────────────────────

export async function deleteCmd(idOrPrefix: string | undefined): Promise<void> {
  header();
  if (!idOrPrefix) {
    error('Usage: npm run moodcast sessions delete <id>');
    return;
  }
  const entry = resolveSessionId(idOrPrefix);
  if (!entry) {
    error(`No session matching "${idOrPrefix}".`);
    return;
  }
  const ok = deleteSession(entry.id);
  if (ok) success(`Deleted ${entry.id} (${entry.title || 'untitled'}).`);
  else error(`Could not delete ${entry.id}.`);
}

function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

export async function clearCmd(): Promise<void> {
  header();
  const entries = listSessions();
  if (entries.length === 0) {
    success('Library already empty.');
    return;
  }
  console.log(`  ${chalk.yellow('!')} this will delete ${chalk.bold(String(entries.length))} saved sessions.`);
  const ok = await confirm(`  ${chalk.dim('confirm? [y/N]')}`);
  if (!ok) {
    console.log(`  ${chalk.dim('cancelled.')}`);
    return;
  }
  clearLibrary();
  success('Library cleared.');
}
