// `moodcast shortcut` — prints a copy-paste-ready Apple Shortcuts recipe.
//
// We deliberately do NOT create the Shortcut on the user's behalf. macOS's
// Shortcuts ecosystem has changed enough across OS releases that a programmatic
// install is fragile, and we don't want to surprise the user by creating a
// system automation. Instead, this command shows them exactly what to paste,
// and where.
//
// Output covers two recipes:
//   1. "Run Shell Script" — the recommended path, runs `moodcast` so the
//      whole launcher (setup check → server → browser → shell) fires.
//   2. "Open URL" — the lighter alternative for when the dev server is
//      already running.

import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

export async function shortcutCommand(): Promise<void> {
  const root = repoRoot();

  console.log('');
  console.log(`  ${chalk.bold.hex('#c4b5fd')('▓▒░ MOODCAST ░▒▓')}  ${chalk.dim('Apple Shortcuts setup')}`);
  console.log('');
  console.log(`  ${chalk.dim('1. Open the Shortcuts app on your Mac.')}`);
  console.log(`  ${chalk.dim('2. ⌘+N to create a new shortcut, name it "Start Moodcast".')}`);
  console.log(`  ${chalk.dim('3. Choose ONE of the actions below.')}`);
  console.log('');

  // Recipe A — Run Shell Script.
  console.log(`  ${chalk.bold('Recipe A — Run Shell Script')}  ${chalk.dim('(recommended)')}`);
  console.log(`    ${chalk.dim('Action: "Run Shell Script". Shell: zsh. Pass Input: no input.')}`);
  console.log(`    ${chalk.dim('Script body (copy-paste):')}`);
  console.log('');
  console.log(`      ${chalk.bold('/bin/zsh -lc "source ~/.zshrc && moodcast"')}`);
  console.log('');
  console.log(`    ${chalk.dim('If the alias is not installed, use the absolute repo path instead:')}`);
  console.log('');
  console.log(`      ${chalk.bold(`/bin/zsh -lc 'cd "${root}" && npm run --silent moodcast'`)}`);
  console.log('');

  // Recipe B — Open URL.
  console.log(`  ${chalk.bold('Recipe B — Open URL')}  ${chalk.dim('(lighter; assumes server already running)')}`);
  console.log(`    ${chalk.dim('Action: "Open URL".')}`);
  console.log('');
  console.log(`      ${chalk.bold('http://127.0.0.1:3001')}`);
  console.log('');

  // Siri phrases.
  console.log(`  ${chalk.bold('Then enable Siri')}`);
  console.log(`    ${chalk.dim('In the shortcut info pane (ⓘ), enable "Use with Siri".')}`);
  console.log(`    ${chalk.dim('Suggested phrases:')}`);
  console.log(`      ${chalk.bold('"Hey Siri, start Moodcast"')}`);
  console.log(`      ${chalk.bold('"Hey Siri, open Moodcast"')}`);
  console.log(`      ${chalk.bold('"Hey Siri, play my focus radio"')}`);
  console.log('');
  console.log(`  ${chalk.dim('Full guide:')} ${chalk.bold('docs/siri-shortcuts.md')}`);
  console.log('');
  console.log(`  ${chalk.dim('Note: Shortcuts is a launch layer. Skip / pause / retune still')}`);
  console.log(`  ${chalk.dim('happen in the web app or the terminal shell — `moodcast` itself.')}`);
  console.log('');
}
