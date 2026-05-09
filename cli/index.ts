#!/usr/bin/env tsx
import { config } from 'dotenv';
// `quiet: true` suppresses dotenv's `◇ injected env (N) from .env.local` log
// line so daily-driver commands (bare `moodcast`, `moodcast up`, etc.)
// don't open with developer noise. The MOODCAST_DEBUG env var re-enables
// it for setup/troubleshooting.
config({ path: '.env.local', quiet: !process.env.MOODCAST_DEBUG });

import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { playCommand } from './commands/play.js';
import { shellCommand } from './commands/shell.js';
import { authCommand } from './commands/auth.js';
import { trackCommand } from './commands/track.js';
import { upCommand } from './commands/up.js';
import { setupCommand } from './commands/setup.js';
import { appCommand } from './commands/app.js';
import { shortcutCommand } from './commands/shortcut.js';
import {
  calendarConnect,
  calendarDisconnect,
  calendarStatus,
} from './commands/calendar.js';
import {
  listCmd as sessionsListCmd,
  showCmd as sessionsShowCmd,
  playCmd as sessionsPlayCmd,
  resumeCmd as sessionsResumeCmd,
  deleteCmd as sessionsDeleteCmd,
  clearCmd as sessionsClearCmd,
} from './commands/sessions.js';

const program = new Command();

program
  .name('moodcast')
  .description('AI radio agent — terminal mode')
  .version('2.0.0')
  // Bare `moodcast` is the daily app launcher: setup-check → ensure server
  // online → open browser → drop into the interactive shell. To get just
  // the shell with no server side-effects, run `moodcast shell`.
  .option('--no-open', 'Skip opening the browser when launching the app')
  .option('--path <path>', 'Open a specific subpath, e.g. /saved or /builder', '/')
  .option(
    '--port <port>',
    'Override the port (default from SPOTIFY_REDIRECT_URI, usually 3001)',
    (v) => parseInt(v, 10),
  )
  .action((opts: { open?: boolean; path?: string; port?: number }) =>
    appCommand({
      noOpen: opts.open === false,
      openPath: opts.path,
      port: opts.port,
    }),
  );

program
  .command('up')
  .description('Boot the Moodcast dev server (if needed) and open the browser')
  .option('--no-open', 'Skip opening the browser')
  .option('--path <path>', 'Open a specific subpath, e.g. /saved or /builder', '/')
  .option(
    '--port <port>',
    'Override the port (default from SPOTIFY_REDIRECT_URI, usually 3001)',
    (v) => parseInt(v, 10),
  )
  .action((opts: { open?: boolean; path?: string; port?: number }) =>
    upCommand({
      noOpen: opts.open === false,
      openPath: opts.path,
      port: opts.port,
    }),
  );

program
  .command('setup')
  .description('Run first-time setup: deps, .env.local, optional shell aliases')
  .option('--yes', 'Run non-interactively (skip alias install / confirmations)')
  .action((opts: { yes?: boolean }) => setupCommand({ yes: opts.yes }));

program
  .command('shell')
  .description('Open the interactive Moodcast shell only (no server / browser)')
  .action(() => shellCommand());

program
  .command('shortcut')
  .description('Print copy-paste-ready Apple Shortcuts recipes for "Hey Siri, start Moodcast"')
  .action(() => shortcutCommand());

program
  .command('start')
  .description('Generate a session and open the live broadcast dashboard')
  .option('--mood <mood>', 'Override mood')
  .option('--activity <activity>', 'Override activity')
  .option('--length <length>', 'Session length e.g. 30m, 60m', '45m')
  .option('--auto', 'Auto Tune — let MooC read the moment (skip the tag picker)')
  .option('--manual', 'Manual Tune — pick your own tags')
  .option('--no-dashboard', 'Run as a one-shot command (skip the persistent dashboard)')
  .action(
    (opts: {
      mood?: string;
      activity?: string;
      length?: string;
      auto?: boolean;
      manual?: boolean;
      dashboard?: boolean;
    }) =>
      startCommand({
        mood: opts.mood,
        activity: opts.activity,
        length: opts.length,
        tuningOverride: opts.auto ? 'auto' : opts.manual ? 'manual' : undefined,
        // commander turns --no-dashboard into opts.dashboard = false
        noDashboard: opts.dashboard === false,
      })
  );

program
  .command('morning')
  .description('Generate a morning session and open the dashboard')
  .option('--no-dashboard', 'Run as a one-shot command')
  .action((opts: { dashboard?: boolean }) =>
    startCommand({ timeOverride: 'morning', noDashboard: opts.dashboard === false })
  );

program
  .command('late-night')
  .description('Generate a late-night session and open the dashboard')
  .option('--no-dashboard', 'Run as a one-shot command')
  .action((opts: { dashboard?: boolean }) =>
    startCommand({ timeOverride: 'night', noDashboard: opts.dashboard === false })
  );

program
  .command('status')
  .description('Show Spotify connection, device, and now-playing')
  .action(() => statusCommand());

program
  .command('play')
  .description('Resume playback')
  .action(() => playCommand('play'));

program
  .command('pause')
  .description('Pause playback')
  .action(() => playCommand('pause'));

program
  .command('next')
  .description('Skip to next track')
  .action(() => playCommand('next'));

program
  .command('previous')
  .alias('prev')
  .description('Return to previous track')
  .action(() => playCommand('prev'));

program
  .command('retune')
  .description('Regenerate current session (same time context)')
  .action(() => startCommand());

program
  .command('resume')
  .description('Resume the most recently saved session')
  .action(() => sessionsResumeCmd());

const sessions = program
  .command('sessions')
  .description('Browse and replay your saved Moodcast sessions');
sessions
  .command('list')
  .description('List recently saved sessions (CLI + web)')
  .option('-n, --limit <n>', 'Max entries to show', (v) => parseInt(v, 10), 20)
  .action((opts: { limit?: number }) => sessionsListCmd({ limit: opts.limit }));
sessions
  .command('show <id>')
  .description('Show full details of a saved session')
  .action((id: string) => sessionsShowCmd(id));
sessions
  .command('play <id>')
  .description('Play a saved session and open the live dashboard')
  .action((id: string) => sessionsPlayCmd(id));
sessions
  .command('resume')
  .description('Resume the most recently saved session')
  .action(() => sessionsResumeCmd());
sessions
  .command('delete <id>')
  .description('Delete one saved session')
  .action((id: string) => sessionsDeleteCmd(id));
sessions
  .command('clear')
  .description('Clear all saved sessions (with confirmation)')
  .action(() => sessionsClearCmd());

const calendar = program
  .command('calendar')
  .description('Apple iCloud Calendar integration (read-only via CalDAV)');
calendar
  .command('connect')
  .description('Connect with Apple ID + app-specific password')
  .action(calendarConnect);
calendar
  .command('disconnect')
  .description('Remove Apple Calendar credentials')
  .action(calendarDisconnect);
calendar
  .command('status')
  .description('Show Apple Calendar connection status')
  .action(calendarStatus);

program
  .command('auth')
  .description('Open browser to authorize Spotify for CLI use')
  .action(() => authCommand());

program
  .command('track <n>')
  .description('Play track N (1-indexed) of the currently active Moodcast session')
  .action((n: string) => trackCommand(n));

program.parse();
