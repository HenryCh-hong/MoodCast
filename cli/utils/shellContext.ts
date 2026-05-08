// Shell-mode context for the Moodcast CLI.
//
// When the user is inside the interactive `moodcast>` shell, recovery hints
// should tell them to type a shell command (`auth`, `resume`) rather than to
// run a fresh npm invocation. This module is the single source of truth for
// that branch.
//
// The flag is process-local — never serialized to env vars (so child processes
// don't inherit it accidentally) and never persisted.

import chalk from 'chalk';

let inShell = false;

export function setShellMode(on: boolean): void {
  inShell = on;
}

export function isShellMode(): boolean {
  return inShell;
}

// Recovery hint for "Spotify is not connected".
//   In-shell:  "type `auth` to connect Spotify"
//   One-shot:  "npm run moodcast --silent -- auth  (or: moodcast auth)"
export function authRecoveryHint(): string {
  if (inShell) {
    return `type ${chalk.bold('auth')} to connect Spotify`;
  }
  return (
    chalk.bold('npm run moodcast --silent -- auth') +
    chalk.dim('  (or: ') +
    chalk.bold('moodcast auth') +
    chalk.dim(')')
  );
}

// Recovery hint for "no active device — bring one online and resume".
//   In-shell:  "open Spotify or Moodcast Web Playback, then type `resume`"
//   One-shot:  "open Spotify on any device, or start the Moodcast Web Playback in a browser tab"
export function deviceRecoveryHint(): string {
  if (inShell) {
    return `open Spotify or Moodcast Web Playback, then type ${chalk.bold('resume')}`;
  }
  return 'open Spotify on any device, or start the Moodcast Web Playback in a browser tab';
}

// Generic "re-run this action" hint. Inside the shell, points at the bare
// shell verb; outside, prints the npm invocation.
export function rerunHint(action: string): string {
  if (inShell) {
    return `then type ${chalk.bold(action)}`;
  }
  return 'then re-run: ' + chalk.bold(`npm run moodcast ${action}`);
}
