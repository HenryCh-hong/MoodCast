#!/usr/bin/env tsx
import { config } from 'dotenv';
config({ path: '.env.local' });

import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { playCommand } from './commands/play.js';
import { shellCommand } from './commands/shell.js';
import { authCommand } from './commands/auth.js';
import { trackCommand } from './commands/track.js';
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
  // Bare `moodcast` (no subcommand) drops into the interactive shell.
  .action(() => shellCommand());

program
  .command('shell')
  .description('Open the interactive Moodcast shell')
  .action(() => shellCommand());

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
