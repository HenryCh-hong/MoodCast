// ANSI alternate screen buffer + cursor management.
// Guarantees the user's terminal is restored on q, Ctrl+C, error, or process exit.

let entered = false;
let cleanupRegistered = false;

const ENTER_ALT = '\x1b[?1049h';
const LEAVE_ALT = '\x1b[?1049l';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CURSOR_HOME = '\x1b[H';
const CLEAR_SCREEN = '\x1b[2J';

export function enterAltScreen(): void {
  if (entered) return;
  process.stdout.write(ENTER_ALT);
  process.stdout.write(HIDE_CURSOR);
  entered = true;
  registerCleanup();
}

export function leaveAltScreen(): void {
  if (!entered) return;
  process.stdout.write(SHOW_CURSOR);
  process.stdout.write(LEAVE_ALT);
  entered = false;
}

export function clearAndHome(): void {
  process.stdout.write(CURSOR_HOME + CLEAR_SCREEN + CURSOR_HOME);
}

function registerCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const restore = () => {
    if (entered) {
      try {
        process.stdout.write(SHOW_CURSOR);
        process.stdout.write(LEAVE_ALT);
      } catch { /* stdout may already be closed */ }
      entered = false;
    }
  };

  // Only force-exit on a signal if alt-screen was actually active. Otherwise
  // the long-running shell REPL would die on every Ctrl+C at its prompt — the
  // shell handles its own SIGINT and decides whether to clear the line or quit.
  process.on('exit', restore);
  process.on('SIGINT', () => {
    if (entered) {
      restore();
      process.exit(130);
    }
  });
  process.on('SIGTERM', () => {
    if (entered) {
      restore();
      process.exit(143);
    }
  });
  process.on('SIGHUP', () => {
    if (entered) {
      restore();
      process.exit(129);
    }
  });
  process.on('uncaughtException', (err) => {
    restore();
    console.error(err);
    process.exit(1);
  });
}
