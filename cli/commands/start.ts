// Phase 3 — moodcast start
//
// Full context-aware tuning flow:
//   Stage 1  Signal Check (server, spotify, account, device, taste)
//   Stage 2  Build MomentContext (time + location + weather + calendar)
//   Stage 3  Render "Signal Scan" panel
//   Stage 4  MooC reads the room (one line, locally generated)
//   Stage 5  Interactive tag picker (alt-screen)
//   Stage 6  Persist discovery dial if changed
//   Stage 7  Generate fresh session with momentContext + selectedTags
//   Stage 8  Write active session
//   Stage 9  MooC opening monologue
//   Stage 10 Resolve device + start playback
//   Stage 11 Hand off to live dashboard
//
// Privacy: nothing in this file logs raw coordinates or raw event titles.

import chalk from 'chalk';
import { getValidToken } from '../auth.js';
import { spotifyFetch } from '../../lib/spotify/client.js';
import { startSessionPlayback } from '../utils/playback.js';
import { buildTasteProfile } from '../../lib/spotify/taste.js';
import { generateMoodcastSession } from '../../lib/ai/generateMoodcastSession.js';
import { QuotaExhaustedError } from '../../lib/ai/quotaError.js';
import { writeLastGenerationError } from '../../lib/sessions/lastGenerationError.js';
import { sanitiseMomentContext } from '../../lib/sessions/sanitiseMoment.js';
import { resolveSessionTracks } from '../../lib/spotify/resolveTracks.js';
import {
  summarizeSourceIntent,
  shouldRegenerate,
  describeIntentSummary,
  regenerateInstruction,
} from '../../lib/ai/sessionValidation.js';
import { pingServer } from '../utils/serverPing.js';
import { resolveDevice } from '../utils/devices.js';
import { runDashboard } from '../dashboard.js';
import { writeActiveSession } from '../../lib/sessions/activeSession.js';
import { appendSession } from '../../lib/sessions/sessionLibrary.js';
import { resetPollCache } from '../utils/activeSessionPoll.js';
import { buildMomentContext } from '../../lib/context/momentContext.js';
import { suggestTags } from '../../lib/tags/suggest.js';
import { pickTags } from '../tagPicker.js';
import { pickTuningMode } from '../tuningModePicker.js';
import {
  readPreferences,
  writePreferences,
} from '../../lib/storage/preferencesServer.js';
import { dayName } from '../../lib/context/time.js';
import {
  header,
  panel,
  panelLine,
  buildBar,
  mooc,
  nowPlaying,
  nextTrack,
  onAirBanner,
  recovery,
  error,
} from '../display.js';
import type {
  BroadcastFormData,
  MoodcastSession,
  TasteProfile,
} from '../../lib/types/moodcast.js';
import type { MomentContext, DiscoveryDial } from '../../lib/types/momentContext.js';
import type { SelectedTagSet } from '../../lib/types/tags.js';

interface StartOptions {
  // Legacy hint, retained for backwards compat with `morning` / `late-night` aliases.
  timeOverride?: 'morning' | 'afternoon' | 'evening' | 'night';
  // Optional explicit overrides (still respected if user passes --mood etc.)
  mood?: string;
  activity?: string;
  length?: string;
  noDashboard?: boolean;
  /** From CLI flags --auto / --manual; overrides the saved tuningMode preference. */
  tuningOverride?: 'auto' | 'manual';
}

function nowHHMM(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function topGenres(taste: TasteProfile, k = 3): string {
  const counts: Record<string, number> = {};
  for (const a of taste.topArtists) {
    for (const g of a.genres ?? []) counts[g] = (counts[g] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, k);
  return sorted.length ? sorted.map((s) => s[0]).join(' / ') : 'no genre signal yet';
}

// ─── MooC reads-the-room phrase (locally generated, no LLM call) ───────────
function moocReadsTheRoom(ctx: MomentContext, dial: DiscoveryDial): string {
  // Priority order: imminent event > heavy day > rainy/cold > time-of-day default.
  if (ctx.nextEventInMinutes !== undefined && ctx.nextEventInMinutes <= 30) {
    return `You have something coming up soon, so I'll keep this clean and focused.`;
  }
  if (ctx.calendarRhythm === 'heavy') {
    return `Day looks a little packed, so I'll avoid a demanding session.`;
  }
  if (ctx.weatherSummary === 'rain' || ctx.weatherSummary === 'heavy_rain') {
    return `Looks like a rainy ${ctx.timeOfDay.replace('_', ' ')}, so I'll keep the opening soft.`;
  }
  if (ctx.weatherSummary === 'snow' || ctx.temperatureCategory === 'cold') {
    return `Cold outside — I'll keep the room warm and steady.`;
  }
  if (ctx.calendarRhythm === 'light' && (ctx.timeOfDay === 'evening' || ctx.timeOfDay === 'afternoon')) {
    return `There's room for a longer broadcast, so I'll let this unfold.`;
  }
  if (dial === 'discover') {
    return `I'll start close to your taste, then open the room a little.`;
  }
  if (dial === 'familiar') {
    return `Keeping things close to what you already love.`;
  }
  // Default
  return `Reading the room — let's tune the signal.`;
}

// ─── Signal Scan panel ─────────────────────────────────────────────────────
function renderSignalScan(ctx: MomentContext, taste: TasteProfile | undefined): void {
  const lines: string[] = [];
  // Time row
  const tod = ctx.timeOfDay.replace('_', ' ');
  const t = new Date(ctx.localTime);
  lines.push(panelLine('local time', `${nowHHMM(t)} · ${dayName(ctx.dayOfWeek)} ${tod}`));
  // Weather row
  if (ctx.weatherSummary) {
    const w = ctx.temperatureCategory ? `${ctx.weatherSummary} · ${ctx.temperatureCategory}` : ctx.weatherSummary;
    lines.push(panelLine('weather', w, 'on'));
  } else {
    lines.push(panelLine('weather', 'not connected', 'off'));
  }
  // Location row
  if (ctx.locationSummary) {
    const loc = ctx.countryCode ? `${ctx.locationSummary} (${ctx.countryCode})` : ctx.locationSummary;
    lines.push(panelLine('location', `${loc} · city-level`, 'on'));
  } else {
    lines.push(panelLine('location', 'not connected', 'off'));
  }
  // Calendar row
  if (ctx.calendarRhythm) {
    const next = ctx.nextEventInMinutes !== undefined
      ? ` · next in ${ctx.nextEventInMinutes}m (${ctx.nextEventTypeHint ?? 'unknown'})`
      : '';
    lines.push(panelLine('calendar', `${ctx.calendarRhythm}${next}`, 'on'));
  } else {
    lines.push(panelLine('calendar', 'not connected', 'off'));
  }
  // Taste memory row
  if (taste) {
    lines.push(panelLine('taste memory', topGenres(taste), 'on'));
  } else {
    lines.push(panelLine('taste memory', 'unavailable', 'warn'));
  }
  // Discovery row
  lines.push(panelLine('discovery', ctx.discoveryRecommendation, 'on'));
  panel('Signal Scan', lines);
}

// ─── Form synthesis from selectedTags + ctx ────────────────────────────────
function synthesizeForm(
  selected: SelectedTagSet,
  ctx: MomentContext,
  opts: StartOptions
): BroadcastFormData {
  const mood =
    opts.mood ??
    selected.mood[0] ??
    (ctx.timeOfDay.includes('morning') ? 'gentle' : 'focused');
  const activity =
    opts.activity ?? selected.activity[0] ?? (ctx.dayType === 'weekend' ? 'walking' : 'working');
  // Length priority: explicit opts.length > legacy timeOverride hints > calendar suggestion > default
  const length = opts.length ?? '45m';

  return {
    mood,
    activity,
    length,
    direction: 'stay',
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────
export async function startCommand(opts: StartOptions = {}): Promise<void> {
  header();

  // ─── Stage 1: Signal Check ─────────────────────────────────────────
  const server = await pingServer();
  const token = await getValidToken();
  let taste: TasteProfile | undefined;

  const sigLines: string[] = [];
  sigLines.push(
    panelLine('server', server.online ? `online :${server.port}` : 'offline', server.online ? 'on' : 'fail')
  );
  sigLines.push(panelLine('spotify', token ? 'connected' : 'disconnected', token ? 'on' : 'fail'));

  if (token) {
    try {
      const profile = await spotifyFetch<{ display_name: string }>('/me', token);
      sigLines.push(panelLine('account', profile.display_name ?? '—'));
    } catch {
      sigLines.push(panelLine('account', 'unavailable', 'warn'));
    }
    try {
      const dev = await resolveDevice(token, { retries: 1 });
      if (dev) {
        sigLines.push(panelLine('device', dev.is_active ? `${dev.name} · active` : `${dev.name} · idle`, 'on'));
      } else {
        sigLines.push(panelLine('device', 'no device available', 'off'));
      }
    } catch {
      sigLines.push(panelLine('device', 'unknown', 'warn'));
    }
    try {
      taste = await buildTasteProfile(token);
      sigLines.push(panelLine('taste profile', `${taste.topArtists.length} artists`, 'on'));
    } catch {
      sigLines.push(panelLine('taste profile', 'unavailable', 'warn'));
    }
  }
  panel('Signal Check', sigLines);

  if (!server.online) {
    recovery([
      'in another terminal run: ' + chalk.bold('npm run dev -- -p 3001'),
      'then re-run: ' + chalk.bold('npm run moodcast start'),
    ]);
    return;
  }
  if (!token) {
    recovery([chalk.bold('npm run moodcast auth') + ' to connect Spotify']);
    return;
  }

  // ─── Stage 2: Build MomentContext (real providers) ─────────────────
  console.log('');
  console.log(`  ${chalk.dim('reading the moment…')}`);
  let ctx: MomentContext;
  try {
    ctx = await buildMomentContext({
      // Apply legacy --morning / --late-night by overriding the time part of the
      // signal phrase and tag suggestions later. The orchestrator itself derives
      // time from the actual clock; we don't fake it.
    });
  } catch (e) {
    error(`Could not build moment context: ${(e as Error).message}`);
    recovery(['this is unexpected — please report; falling back is not currently implemented']);
    return;
  }

  // ─── Stage 3: Signal Scan panel ────────────────────────────────────
  console.log('');
  renderSignalScan(ctx, taste);

  // ─── Stage 4: MooC reads the room ──────────────────────────────────
  const prefs = readPreferences();
  const moocLine = moocReadsTheRoom(ctx, prefs.discoveryDial);
  console.log('');
  console.log(`${chalk.bold.hex('#c4b5fd')('◖ MooC')}${chalk.dim('  reads the room')}`);
  console.log(`${chalk.italic.hex('#a095b8')(`“${moocLine}”`)}`);
  console.log('');

  // ─── Stage 5: Resolve tuning mode (auto vs manual) ─────────────────
  const suggested = suggestTags(ctx);
  let mode: 'auto' | 'manual';
  if (opts.tuningOverride) {
    mode = opts.tuningOverride;
  } else if (prefs.tuningMode === 'auto' || prefs.tuningMode === 'manual') {
    mode = prefs.tuningMode;
  } else {
    const choice = await pickTuningMode();
    if (!choice) {
      console.log(`  ${chalk.dim('cancelled — no session generated.')}`);
      console.log('');
      return;
    }
    mode = choice;
  }

  let selected: SelectedTagSet;
  if (mode === 'auto') {
    selected = {
      mood: suggested.mood,
      activity: suggested.activity,
      texture: suggested.texture,
      signal: suggested.signal,
      familiarity: suggested.familiarity || prefs.discoveryDial,
    };
    const summary = [
      ...suggested.mood,
      ...suggested.activity,
      ...suggested.texture,
      ...suggested.signal,
      selected.familiarity,
    ]
      .filter(Boolean)
      .join(' · ');
    console.log('');
    console.log(`  ${chalk.dim('Auto Tune — using:')} ${chalk.hex('#c4b5fd')(summary || 'defaults')}`);
  } else {
    let picked: SelectedTagSet | null;
    try {
      picked = await pickTags(suggested);
    } catch (e) {
      error(`Tag picker failed: ${(e as Error).message}`);
      return;
    }
    if (!picked) {
      console.log(`  ${chalk.dim('cancelled — no session generated.')}`);
      console.log('');
      return;
    }
    selected = picked;
  }

  // ─── Stage 6: Persist discovery dial change ────────────────────────
  if (selected.familiarity && selected.familiarity !== prefs.discoveryDial) {
    try {
      writePreferences({ discoveryDial: selected.familiarity as DiscoveryDial });
      // Reflect in ctx so the prompt sees the user's final choice.
      ctx.discoveryRecommendation = selected.familiarity as DiscoveryDial;
    } catch {
      /* prefs write failure is non-fatal */
    }
  }

  // Confirmation panel — read back what was selected.
  console.log('');
  panel('Tuned', [
    panelLine('mood', selected.mood.length ? selected.mood.join(', ') : '—'),
    panelLine('activity', selected.activity.length ? selected.activity.join(', ') : '—'),
    panelLine('texture', selected.texture.length ? selected.texture.join(', ') : '—'),
    panelLine('signal', selected.signal.length ? selected.signal.join(', ') : '—'),
    panelLine('discover', selected.familiarity),
  ]);

  // ─── Stage 7: Generate session ─────────────────────────────────────
  const form = synthesizeForm(selected, ctx, opts);
  console.log('');
  buildBar(0, 4, 'building session');

  let session: MoodcastSession;
  let sessionId: string;
  try {
    buildBar(1, 4, 'reading taste memory');
    buildBar(2, 4, 'arranging cue');
    const dial = ctx.discoveryRecommendation;
    session = await generateMoodcastSession({
      form,
      tasteProfile: taste,
      momentContext: ctx,
      selectedTags: selected,
      discoveryDial: dial,
    });
    let summary = summarizeSourceIntent(session);
    if (summary.missingSourceIntent > Math.ceil(summary.total / 2)) {
      console.error(
        chalk.dim(`  (warning: sourceIntent missing on ${summary.missingSourceIntent}/${summary.total} tracks)`),
      );
    }
    if (shouldRegenerate(summary, dial)) {
      console.error(
        chalk.dim(`  (rebalancing — first pass leaned on familiar tracks: ${describeIntentSummary(summary)})`),
      );
      try {
        session = await generateMoodcastSession({
          form,
          tasteProfile: taste,
          momentContext: ctx,
          selectedTags: selected,
          discoveryDial: dial,
          extraInstruction: regenerateInstruction(dial),
        });
        summary = summarizeSourceIntent(session);
        console.error(chalk.dim(`  (post-rebalance: ${describeIntentSummary(summary)})`));
      } catch (retryErr) {
        console.error(chalk.dim('  (rebalance failed, keeping original session)'), retryErr);
      }
    } else {
      console.error(chalk.dim(`  (${describeIntentSummary(summary)})`));
    }
    // Best-effort URI resolution for tracks the AI left empty.
    try {
      const resolved = await resolveSessionTracks(session, token);
      session = resolved.session;
      if (resolved.resolved > 0 || resolved.unresolved > 0) {
        console.error(
          chalk.dim(`  (uri resolution: filled=${resolved.resolved} unresolved=${resolved.unresolved})`),
        );
      }
    } catch (resolveErr) {
      console.error(chalk.dim('  (uri resolution failed)'), resolveErr);
    }
    buildBar(4, 4);
    sessionId = `cli-${Date.now().toString(36)}`;
    try {
      writeActiveSession(sessionId, session, 'cli');
      resetPollCache();
    } catch (e) {
      console.error(chalk.dim('  (active session write failed — dashboard will use in-memory only)'), e);
    }
    try {
      appendSession({
        id: sessionId,
        source: 'cli',
        session,
        selectedTags: selected,
        discoveryDial: ctx.discoveryRecommendation,
        momentSummary: sanitiseMomentContext(ctx),
        length: form.length,
      });
    } catch (e) {
      console.error(chalk.dim('  (session library write failed — sessions list will not show this run)'), e);
    }
  } catch (err) {
    process.stdout.write('\n');
    if (err instanceof QuotaExhaustedError) {
      error(
        `MooC reached the ${err.provider} API limit for this key. The signal was tuned, but session generation could not complete.`,
      );
      const debugPath = writeLastGenerationError({
        timestamp: Date.now(),
        code: err.code,
        provider: err.provider,
        originalMessage: err.originalMessage,
        moment: sanitiseMomentContext(ctx),
        tags: selected,
      });
      const otherProvider = err.provider === 'gemini' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY';
      const sameKeyEnv = err.provider === 'gemini' ? 'GOOGLE_API_KEY' : 'ANTHROPIC_API_KEY';
      const steps = [
        'wait for the provider quota to reset, then re-run: ' + chalk.bold('npm run moodcast start'),
        `switch keys: update ${chalk.bold(sameKeyEnv)} in ${chalk.bold('.env.local')}`,
        `or switch provider: set ${chalk.bold(otherProvider)} and ${chalk.bold('AI_PROVIDER=' + (err.provider === 'gemini' ? 'anthropic' : 'gemini'))}`,
      ];
      if (debugPath) {
        steps.push(chalk.dim(`debug record: ${debugPath} (no raw calendar/location data)`));
      }
      recovery(steps);
      return;
    }
    error(`Generation failed: ${err instanceof Error ? err.message : String(err)}`);
    recovery([
      'check that GOOGLE_API_KEY or ANTHROPIC_API_KEY is set in .env.local',
      'then re-run: ' + chalk.bold('npm run moodcast start'),
    ]);
    return;
  }

  // ─── Stage 9: Broadcast intro ──────────────────────────────────────
  if (session.openingMonologue) mooc(session.openingMonologue);

  // ─── Stage 10: Resolve device, transfer, play, verify ──────────────
  const uris = session.tracks
    .map((t) => t.uri ?? '')
    .filter((u) => u.startsWith('spotify:track:'));

  const result = await startSessionPlayback(token, uris, {
    retryHint: 'npm run moodcast start',
  });
  if (!result.ok) return;

  // ─── Stage 11: ON AIR ──────────────────────────────────────────────
  onAirBanner(session.sessionTitle);
  const first = session.tracks[0];
  const second = session.tracks[1];
  if (first) nowPlaying(first.title, first.artist, 0, first.durationMs ?? 0);
  if (second) {
    nextTrack(second.title, second.artist, second.transitionLine || second.whyItFits);
  }

  if (opts.noDashboard) {
    console.log('');
    console.log(
      '  ' +
        chalk.dim(`${session.tracks.length} tracks queued · run `) +
        chalk.bold('npm run moodcast status') +
        chalk.dim(' to track the room')
    );
    console.log('');
    return;
  }

  await new Promise<void>((r) => setTimeout(r, 800));
  await runDashboard({ session, sessionId, initialToken: token });
}
