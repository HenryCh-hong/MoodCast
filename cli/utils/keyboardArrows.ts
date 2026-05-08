// Phase 3 — Raw stdin sequence → semantic key.
// Used by the tag picker. Compatible with the existing keyboard.ts module
// for the dashboard, but does not replace it (different consumers).

export type ArrowKey =
  | 'up' | 'down' | 'left' | 'right'
  | 'enter' | 'esc' | 'space' | 'tab'
  | 'char' | 'ctrl-c';

export interface ParsedKey {
  key: ArrowKey;
  raw: string;
}

export function parseSequence(data: string): ParsedKey {
  if (data === '\x03') return { key: 'ctrl-c', raw: data };
  if (data === '\r' || data === '\n') return { key: 'enter', raw: data };
  if (data === '\x1b') return { key: 'esc', raw: data };
  if (data === '\t') return { key: 'tab', raw: data };
  if (data === ' ') return { key: 'space', raw: data };
  if (data === '\x1b[A') return { key: 'up', raw: data };
  if (data === '\x1b[B') return { key: 'down', raw: data };
  if (data === '\x1b[C') return { key: 'right', raw: data };
  if (data === '\x1b[D') return { key: 'left', raw: data };
  return { key: 'char', raw: data };
}
