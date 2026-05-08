// Raw stdin keyboard handler. Returns a stop function to detach.

export type Key = 'space' | 'n' | 'p' | 'r' | 'q' | 'ctrl-c' | 'help' | 'unknown';

export function startKeyboard(onKey: (key: Key, raw: string) => void): () => void {
  const stdin = process.stdin;

  // If stdin isn't a TTY (e.g. running under a pipe), keyboard mode is disabled.
  if (!stdin.isTTY) {
    return () => {};
  }

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  const handler = (data: string) => {
    let key: Key = 'unknown';
    if (data === ' ') key = 'space';
    else if (data === 'n' || data === 'N') key = 'n';
    else if (data === 'p' || data === 'P') key = 'p';
    else if (data === 'r' || data === 'R') key = 'r';
    else if (data === 'q' || data === 'Q') key = 'q';
    else if (data === '?' || data === 'h' || data === 'H') key = 'help';
    else if (data === '\x03' /* Ctrl+C */ || data === '\x04' /* Ctrl+D */) key = 'ctrl-c';

    try {
      onKey(key, data);
    } catch (e) {
      // Don't crash the dashboard from a key handler error
      // eslint-disable-next-line no-console
      console.error('keyboard handler error:', e);
    }
  };

  stdin.on('data', handler);

  return () => {
    stdin.off('data', handler);
    if (stdin.isTTY) {
      try { stdin.setRawMode(false); } catch { /* ignore */ }
    }
    stdin.pause();
  };
}
