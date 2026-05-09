// AI session-quality eval harness.
//
// Runs each scenario in scripts/eval/scenarios.ts against the live AI
// provider, applies validators, and prints a structured report. Intended as
// a regression check before/after prompt changes.
//
// Usage:
//   npm run eval                    # all scenarios
//   npm run eval -- --ids core-late-night-coding,replay-discover-with-taste
//   npm run eval -- --concurrency 1 # serialize calls (default 2)
//   npm run eval -- --dry-run       # validate scenarios + bounds, no AI calls
//
// Cost: each scenario is one Anthropic Sonnet call (~3–5k input tokens,
// ~2–4k output). Budget ~$0.10–0.30 for a full run.
//
// Sandboxing: MOODCAST_HOME is set to a temp dir before any imports, so the
// run never touches ~/.moodcast.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadDotenv } from 'dotenv';

// Set the sandbox FIRST, before any lib/* imports run.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'moodcast-eval-'));
process.env.MOODCAST_HOME = SANDBOX;

// Load .env.local so AI provider keys come through (matches `next dev`).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
loadDotenv({ path: path.join(REPO_ROOT, '.env.local') });

interface CliArgs {
  ids?: string[];
  concurrency: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { concurrency: 2, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--ids' && argv[i + 1]) {
      out.ids = argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean);
      i += 1;
    } else if (a === '--concurrency' && argv[i + 1]) {
      out.concurrency = Math.max(1, parseInt(argv[i + 1], 10) || 1);
      i += 1;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--help' || a === '-h') {
      console.log(`Moodcast eval harness
  --ids <id1,id2>     Run only the named scenarios
  --concurrency <n>   Parallel AI calls (default 2; cap as you like)
  --dry-run           Skip AI calls; sanity-check scenario set
  --help              This message`);
      process.exit(0);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Dynamic imports so MOODCAST_HOME / dotenv take effect first.
  const { generateMoodcastSession } = await import('../../lib/ai/generateMoodcastSession');
  const { getActiveProvider } = await import('../../lib/ai/provider');
  const { findScenarios } = await import('./scenarios');
  const { runValidators, summarize } = await import('./validators');
  type ScenarioResultModule = typeof import('./validators');
  type Finding = ReturnType<ScenarioResultModule['runValidators']>[number];

  const scenarios = findScenarios(args.ids);
  if (scenarios.length === 0) {
    console.error(`No scenarios matched ids=${args.ids?.join(',') ?? '(all)'}`);
    process.exit(2);
  }

  const provider = getActiveProvider();
  console.log(`▓▒░ MOODCAST EVAL ░▒▓`);
  console.log(`scenarios:   ${scenarios.length}`);
  console.log(`provider:    ${provider ?? '(none — would fail without --dry-run)'}`);
  console.log(`concurrency: ${args.concurrency}`);
  console.log(`sandbox:     ${SANDBOX}`);
  console.log('');

  if (args.dryRun) {
    for (const s of scenarios) console.log(`  · ${s.id}  —  ${s.description}`);
    console.log(`\nDry run OK. ${scenarios.length} scenarios validated.`);
    return;
  }
  if (!provider) {
    console.error('No AI provider configured. Set ANTHROPIC_API_KEY or GOOGLE_API_KEY in .env.local.');
    process.exit(2);
  }

  type Result = {
    id: string;
    description: string;
    findings: Finding[];
    error?: string;
    durationMs: number;
  };
  const results: Result[] = [];

  // Simple bounded-concurrency worker pool.
  const queue = [...scenarios];
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const s = queue.shift();
      if (!s) return;
      const started = Date.now();
      process.stdout.write(`▶ ${s.id} ... `);
      try {
        const session = await generateMoodcastSession({
          form: s.input.form,
          tasteProfile: s.input.tasteProfile,
          momentContext: s.input.momentContext,
          selectedTags: s.input.selectedTags,
          discoveryDial: s.input.discoveryDial,
        });
        const findings = runValidators(s, session);
        const sum = summarize(findings);
        const ms = Date.now() - started;
        const status = sum.failed > 0 ? 'FAIL' : sum.warned > 0 ? 'warn' : 'PASS';
        process.stdout.write(`${status} (${(ms / 1000).toFixed(1)}s, ${sum.passed}p/${sum.warned}w/${sum.failed}f)\n`);
        results.push({ id: s.id, description: s.description, findings, durationMs: ms });
      } catch (err) {
        const ms = Date.now() - started;
        const msg = err instanceof Error ? err.message : String(err);
        process.stdout.write(`ERROR (${(ms / 1000).toFixed(1)}s)\n`);
        results.push({ id: s.id, description: s.description, findings: [], error: msg, durationMs: ms });
      }
    }
  }

  const workers = Array.from({ length: args.concurrency }, worker);
  await Promise.all(workers);

  // ─── Detailed report ───────────────────────────────────────────────────
  console.log('\n──── DETAILED FINDINGS ────\n');
  let totalFail = 0;
  let totalWarn = 0;
  let totalPass = 0;
  let scenariosFailed = 0;
  let scenariosErrored = 0;

  for (const r of results) {
    console.log(`■ ${r.id}  —  ${r.description}`);
    if (r.error) {
      scenariosErrored += 1;
      console.log(`  ✗ generation error: ${r.error}`);
      console.log('');
      continue;
    }
    const sum = summarize(r.findings);
    totalFail += sum.failed;
    totalWarn += sum.warned;
    totalPass += sum.passed;
    if (sum.failed > 0) scenariosFailed += 1;

    for (const f of r.findings) {
      const sigil = f.severity === 'fail' ? '✗' : f.severity === 'warn' ? '⚠' : '✓';
      console.log(`  ${sigil} [${f.validator}] ${f.message}`);
    }
    console.log('');
  }

  // ─── Summary ───────────────────────────────────────────────────────────
  console.log('──── SUMMARY ────');
  console.log(`scenarios:  ${results.length}  passed: ${results.length - scenariosFailed - scenariosErrored}  failed: ${scenariosFailed}  errored: ${scenariosErrored}`);
  console.log(`findings:   ${totalPass} pass · ${totalWarn} warn · ${totalFail} fail`);
  console.log(`sandbox:    ${SANDBOX} (safe to delete)`);

  if (scenariosFailed > 0 || scenariosErrored > 0) process.exit(1);
}

main().catch((err) => {
  console.error('eval harness crashed:', err);
  process.exit(2);
});
