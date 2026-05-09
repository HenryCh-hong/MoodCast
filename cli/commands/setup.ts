// `moodcast setup` — first-time setup helper.
//
//   • Verifies a recent-enough Node version
//   • Verifies node_modules looks installed (or tells the user to run `npm install`)
//   • Seeds .env.local from .env.example without overwriting existing values
//   • Prompts (Y/n) before appending shell aliases to ~/.zshrc
//   • Prints next steps clearly
//
// Privacy: never reads or echoes the user's existing .env.local — we only
// write a fresh template if .env.local doesn't already exist.

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import {
  header,
  panel,
  panelLine,
  recovery,
} from '../display.js';

const MIN_NODE_MAJOR = 18;
const ALIAS_BLOCK_HEADER = '# Moodcast aliases (added by `moodcast setup`)';

interface SetupOptions {
  /** Skip interactive prompts. .env.local is still seeded; aliases are NOT installed. */
  yes?: boolean;
}

function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

function nodeMajor(): number {
  const m = process.versions.node.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      resolve('');
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? '[Y/n]' : '[y/N]';
  const ans = (await ask(`  ${question} ${suffix} `)).toLowerCase();
  if (ans === '') return defaultYes;
  return ans.startsWith('y');
}

function seedEnvLocal(root: string): { created: boolean; path: string; example: string | null } {
  const envPath = path.join(root, '.env.local');
  const examplePath = path.join(root, '.env.example');
  const exampleExists = fs.existsSync(examplePath);
  if (fs.existsSync(envPath)) {
    return { created: false, path: envPath, example: exampleExists ? examplePath : null };
  }
  if (!exampleExists) {
    fs.writeFileSync(envPath, '# Moodcast env. See README for required variables.\n', { mode: 0o600 });
    return { created: true, path: envPath, example: null };
  }
  fs.copyFileSync(examplePath, envPath);
  // Tighten perms — .env.local can hold user secrets later.
  try { fs.chmodSync(envPath, 0o600); } catch { /* fs may not honor mode on some OS */ }
  return { created: true, path: envPath, example: examplePath };
}

function nodeModulesInstalled(root: string): boolean {
  // A heuristic check — full integrity is npm's job. We just want to nudge
  // the user toward `npm install` if they cloned the repo and haven't run it.
  const next = path.join(root, 'node_modules', 'next', 'package.json');
  return fs.existsSync(next);
}

interface AliasPlan {
  block: string;
  zshrc: string;
  alreadyInstalled: boolean;
}

function buildAliases(root: string): AliasPlan {
  const block = [
    '',
    ALIAS_BLOCK_HEADER,
    `alias moodcast='npm --prefix "${root}" run --silent moodcast --'`,
    `alias moodcast-dev='npm --prefix "${root}" run dev -- -p 3001'`,
    '',
  ].join('\n');
  const zshrc = path.join(process.env.HOME ?? '', '.zshrc');
  let alreadyInstalled = false;
  try {
    if (fs.existsSync(zshrc)) {
      const current = fs.readFileSync(zshrc, 'utf-8');
      if (current.includes(ALIAS_BLOCK_HEADER) && current.includes(`--prefix "${root}"`)) {
        alreadyInstalled = true;
      }
    }
  } catch {
    /* unreadable; treat as not installed */
  }
  return { block, zshrc, alreadyInstalled };
}

function installAliases(plan: AliasPlan): void {
  fs.appendFileSync(plan.zshrc, plan.block);
}

export async function setupCommand(opts: SetupOptions = {}): Promise<void> {
  header();

  const root = repoRoot();

  // Stage 1 — Node version check
  const nodeOk = nodeMajor() >= MIN_NODE_MAJOR;
  // Stage 2 — deps
  const depsOk = nodeModulesInstalled(root);
  // Stage 3 — .env.local
  const envResult = seedEnvLocal(root);

  panel('Setup', [
    panelLine('node', `v${process.versions.node}`, nodeOk ? 'on' : 'fail'),
    panelLine('deps', depsOk ? 'installed' : 'missing — run `npm install`', depsOk ? 'on' : 'warn'),
    panelLine(
      '.env.local',
      envResult.created
        ? envResult.example
          ? 'created from .env.example'
          : 'created (empty template)'
        : 'already exists — left untouched',
      envResult.created ? 'on' : 'on',
    ),
    panelLine('repo', root),
  ]);

  if (!nodeOk) {
    recovery([
      `Node ${MIN_NODE_MAJOR}+ is required. Current: ${process.versions.node}.`,
      'install a newer Node (e.g. via nvm: `nvm install 20`) and re-run setup.',
    ]);
    return;
  }
  if (!depsOk) {
    recovery([
      `cd ${chalk.bold(root)}`,
      `then run: ${chalk.bold('npm install')}`,
      `then re-run: ${chalk.bold('npm run moodcast --silent -- setup')}`,
    ]);
    return;
  }

  // Stage 4 — required env var hints (do NOT print user values)
  console.log('');
  console.log('  ' + chalk.dim('required env vars (set in .env.local):'));
  console.log('  ' + chalk.bold('•') + ' ANTHROPIC_API_KEY' + chalk.dim('  — full DJ MOOC + chat'));
  console.log('  ' + chalk.bold('•') + ' GOOGLE_API_KEY' + chalk.dim('     — alternative AI provider (no chat)'));
  console.log('  ' + chalk.bold('•') + ' SPOTIFY_CLIENT_ID' + chalk.dim('  — Spotify playback'));
  console.log('  ' + chalk.bold('•') + ' SPOTIFY_REDIRECT_URI' + chalk.dim(' (default already in .env.example)'));
  console.log('');

  // Stage 5 — alias install (interactive)
  const aliasPlan = buildAliases(root);
  if (aliasPlan.alreadyInstalled) {
    console.log('  ' + chalk.dim('shell aliases already present in ~/.zshrc — skipping.'));
  } else if (opts.yes) {
    console.log('  ' + chalk.dim('--yes given; skipping interactive alias install. To install, re-run `moodcast setup` without --yes.'));
  } else {
    console.log('  ' + chalk.dim('shell aliases (preview):'));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    aliasPlan.block.trim().split('\n').forEach((l) => console.log(`  ${l}`));
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    const ok = await confirm(`Append these to ${chalk.bold(aliasPlan.zshrc)}?`, true);
    if (ok) {
      try {
        installAliases(aliasPlan);
        console.log('  ' + chalk.green('●') + ' aliases installed');
        console.log('  ' + chalk.dim('open a new terminal, or run `source ~/.zshrc`, to activate.'));
      } catch (e) {
        console.log('  ' + chalk.yellow('⚠') + ' could not write ~/.zshrc: ' + (e as Error).message);
      }
    } else {
      console.log('  ' + chalk.dim('skipped — you can paste the lines above into ~/.zshrc manually later.'));
    }
  }

  // Stage 6 — next steps
  console.log('');
  console.log('  ' + chalk.bold('next steps:'));
  console.log('  ' + chalk.bold('1.') + ' fill in API keys in ' + chalk.bold(envResult.path));
  console.log('  ' + chalk.bold('2.') + ' run ' + chalk.bold('moodcast up') + chalk.dim('  — boots the dev server + opens the browser'));
  console.log('  ' + chalk.bold('3.') + ' run ' + chalk.bold('moodcast') + chalk.dim('       — drop into the terminal shell'));
  console.log('');
}
