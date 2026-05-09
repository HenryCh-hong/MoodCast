import chalk from 'chalk';

export const PANEL_WIDTH = 56;

const ANSI_RE = /\x1b\[[0-9;]*m/g;
export const visibleLength = (s: string) => s.replace(ANSI_RE, '').length;

// Truncate a string to at most `max` visible columns, adding an ellipsis if cut.
export function truncate(s: string, max: number): string {
  if (visibleLength(s) <= max) return s;
  // Strip ANSI then truncate plain text — colors will be lost but layout is preserved.
  const plain = s.replace(ANSI_RE, '');
  return plain.slice(0, Math.max(0, max - 1)) + '…';
}

export const BRAND =
  chalk.bold.hex('#c4b5fd')('▓▒░ MOODCAST ░▒▓') +
  '  ' +
  chalk.dim('FM 88.7') +
  '  ' +
  chalk.bold.hex('#ff6b6b')('[ON AIR]');

export function header() {
  console.log('');
  console.log(BRAND);
  console.log('');
}

export type BulletState = 'on' | 'off' | 'warn' | 'fail';

export function bullet(state: BulletState): string {
  switch (state) {
    case 'on':   return chalk.green('●');
    case 'off':  return chalk.dim('◌');
    case 'warn': return chalk.yellow('⚠');
    case 'fail': return chalk.red('✗');
  }
}

export function panel(title: string, lines: string[]): void {
  // PANEL_WIDTH = visible columns including borders.
  // Layout: ┌─ <title> ─...─┐  /  │ <content> │  /  └──...──┘
  const inner = PANEL_WIDTH - 2; // space between │ … │
  const titleVisible = title.length + 2; // ` title `
  const dashCount = Math.max(0, PANEL_WIDTH - 2 - titleVisible - 1); // -2 for corners, -1 for the leading ─
  const top =
    chalk.dim('┌─') +
    chalk.bold.hex('#c4b5fd')(` ${title} `) +
    chalk.dim('─'.repeat(dashCount) + '┐');
  console.log(top);

  for (const line of lines) {
    // Truncate to the inner width so long values (e.g. an email Apple ID)
    // can never push the right border past PANEL_WIDTH.
    const truncated = truncate(line, inner - 2);
    const pad = ' '.repeat(Math.max(0, inner - visibleLength(truncated) - 2));
    console.log(`${chalk.dim('│')} ${truncated}${pad} ${chalk.dim('│')}`);
  }
  console.log(chalk.dim(`└${'─'.repeat(PANEL_WIDTH - 2)}┘`));
}

export function panelLine(label: string, value: string, state: BulletState = 'on'): string {
  const labelW = 14;
  const lab = chalk.dim(label.padEnd(labelW));
  return `${bullet(state)}  ${lab}${value}`;
}

export function statusLine(label: string, value: string, dot?: string) {
  const l = chalk.dim(label.padEnd(12));
  const d = dot ? `${dot}  ` : '   ';
  console.log(`  ${l}${d}${value}`);
}

export function divider(label?: string) {
  const line = '─'.repeat(40);
  if (label) {
    console.log(chalk.dim(`  ${label} ${line.slice(label.length + 2)}`));
  } else {
    console.log(chalk.dim(`  ${line}`));
  }
}

export function mooc(line: string): void {
  console.log('');
  console.log(`${chalk.bold.hex('#c4b5fd')('◖ MooC')}${chalk.dim('  FM 88.7')}`);
  console.log(`${chalk.italic.hex('#a095b8')(`“${line}”`)}`);
}

export function cueLine(line: string): void {
  console.log(`  ${chalk.dim('↳')} ${chalk.italic.hex('#a095b8')(line)}`);
}

export function buildBar(step: number, total: number, label = 'building session'): void {
  const pct = Math.max(0, Math.min(1, step / total));
  const cells = 20;
  const filled = Math.round(pct * cells);
  const bar = '█'.repeat(filled) + '░'.repeat(cells - filled);
  const pctStr = `${Math.round(pct * 100)}%`;
  const tag = step >= total ? chalk.green('ready') : chalk.dim(label);
  // Carriage-return rewrite, no newline until done
  process.stdout.write(`\r  ${chalk.hex('#c4b5fd')('▦')} ${chalk.hex('#c4b5fd')(bar)} ${pctStr.padStart(4)}  ${tag}    `);
  if (step >= total) process.stdout.write('\n');
}

export function nowPlaying(
  trackName: string,
  artist: string,
  posMs: number,
  durationMs: number
) {
  console.log('');
  console.log(chalk.dim('Now Playing:'));
  console.log(`  ${chalk.bold(trackName)} ${chalk.dim('—')} ${chalk.hex('#c4b5fd')(artist)}`);
  if (durationMs > 0) {
    const pos = Math.floor(posMs / 1000);
    const dur = Math.floor(durationMs / 1000);
    const cells = 20;
    const filled = Math.round((posMs / durationMs) * cells);
    const bar = '█'.repeat(filled) + '░'.repeat(cells - filled);
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    console.log(`  ${chalk.dim('[')}${chalk.hex('#c4b5fd')(bar)}${chalk.dim(']')}  ${chalk.dim(`${fmt(pos)} / ${fmt(dur)}`)}`);
  }
}

export function nextTrack(trackName: string, artist: string, why?: string) {
  console.log('');
  console.log(chalk.dim('Next:'));
  console.log(`  ${chalk.bold(trackName)} ${chalk.dim('—')} ${chalk.hex('#c4b5fd')(artist)}`);
  if (why) cueLine(why);
}

export function sessionInfo(
  title: string,
  subtitle: string,
  trackIndex: number,
  trackTotal: number
) {
  console.log('');
  divider('CURRENT SESSION');
  console.log(`  ${chalk.bold(title)}  ${chalk.dim('|')}  ${chalk.dim(subtitle)}`);
  console.log(`  ${chalk.dim(`Track ${trackIndex} of ${trackTotal}`)}`);
}

export function onAirBanner(label: string): void {
  console.log('');
  console.log(`${chalk.bold.hex('#ff6b6b')('ON AIR')} ${chalk.dim('—')} ${chalk.bold(label)}`);
}

export function recovery(steps: string[]): void {
  console.log('');
  console.log(`  ${chalk.dim('To recover:')}`);
  for (const s of steps) {
    console.log(`  ${chalk.dim('·')} ${s}`);
  }
}

export function error(msg: string) {
  console.log('');
  console.log(`  ${chalk.red('✗')} ${msg}`);
}

export function success(msg: string) {
  console.log('');
  console.log(`  ${chalk.green('✓')} ${msg}`);
}

export function warn(msg: string) {
  console.log(`  ${chalk.yellow('⚠')} ${msg}`);
}

// ─── String-returning helpers used by the persistent dashboard renderer ────────

export function brandLine(): string {
  return BRAND;
}

export function panelString(title: string, lines: string[]): string[] {
  const inner = PANEL_WIDTH - 2;
  const titleVisible = title.length + 2;
  const dashCount = Math.max(0, PANEL_WIDTH - 2 - titleVisible - 1);
  const out: string[] = [];
  out.push(
    chalk.dim('┌─') +
      chalk.bold.hex('#c4b5fd')(` ${title} `) +
      chalk.dim('─'.repeat(dashCount) + '┐')
  );
  for (const line of lines) {
    const truncated = truncate(line, inner - 2);
    const pad = ' '.repeat(Math.max(0, inner - visibleLength(truncated) - 2));
    out.push(`${chalk.dim('│')} ${truncated}${pad} ${chalk.dim('│')}`);
  }
  out.push(chalk.dim(`└${'─'.repeat(PANEL_WIDTH - 2)}┘`));
  return out;
}

export function progressBarString(posMs: number, durMs: number, cells = 30): string {
  if (durMs <= 0) {
    const empty = '░'.repeat(cells);
    return `${chalk.dim('[')}${chalk.dim(empty)}${chalk.dim(']')}  ${chalk.dim('--:-- / --:--')}`;
  }
  const pct = Math.max(0, Math.min(1, posMs / durMs));
  const filled = Math.round(pct * cells);
  const bar = '█'.repeat(filled) + '░'.repeat(cells - filled);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const pos = Math.floor(posMs / 1000);
  const dur = Math.floor(durMs / 1000);
  return `${chalk.dim('[')}${chalk.hex('#c4b5fd')(bar)}${chalk.dim(']')}  ${chalk.dim(`${fmt(pos)} / ${fmt(dur)}`)}`;
}

export function shortcutsLine(): string {
  const s = (k: string, label: string) => `${chalk.bold.hex('#c4b5fd')(k)} ${chalk.dim(label)}`;
  // Two lines: playback on top, feedback below — keeps both rows under 80 cols
  // on a stock terminal.
  const playback = [
    s('space', 'pause/play'),
    s('n', 'next'),
    s('p', 'prev'),
    s('t', 'tracks'),
    s('r', 'retune'),
    s('q', 'quit'),
  ].join(chalk.dim('  ·  '));
  const feedback = [
    s('l', 'like'),
    s('d', 'dislike'),
    s('u', 'clear feedback'),
  ].join(chalk.dim('  ·  '));
  return `${playback}\n  ${feedback}`;
}

