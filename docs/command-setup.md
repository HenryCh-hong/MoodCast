# Moodcast command setup

After cloning, the `npm run moodcast …` form always works:

```sh
npm run moodcast --silent -- shell
npm run moodcast --silent -- start
npm run moodcast --silent -- sessions list
```

…but it gets old fast. There are two ways to make `moodcast` work as a normal
command.

## Option A — shell alias (recommended, zero install)

Add this line to your `~/.zshrc` (or `~/.bashrc`):

```sh
alias moodcast='npm --prefix ~/Desktop/MoodCast run --silent moodcast --'
```

Reload your shell (`source ~/.zshrc`), then from anywhere:

```sh
moodcast              # opens the interactive shell
moodcast shell        # same
moodcast start        # one-shot generate + dashboard
moodcast start --auto
moodcast sessions list
moodcast resume
```

The alias passes everything after `moodcast` straight through to the underlying
`tsx cli/index.ts` entry point, so any flag the npm form supports works here too.

If you keep the repo somewhere other than `~/Desktop/MoodCast`, change the
`--prefix` path to match.

## Option B — `npm link` (global symlink)

`package.json` already declares the `moodcast` bin (it points at the existing
`cli/index.ts` shebang). To make it globally callable:

```sh
cd ~/Desktop/MoodCast
npm link
```

`npm` will install a symlink in your global `bin` directory (usually
`/usr/local/bin/moodcast` or `~/.npm-global/bin/moodcast`, depending on your
Node setup). After that:

```sh
moodcast
moodcast start
moodcast sessions list
```

Notes:

* The CLI is `tsx`-based, so `tsx` must be on your `PATH`. The repo already
  installs it as a dev-dependency, and `npm link` resolves it inside the repo,
  so this generally just works after `npm install`.
* If you later switch repos / branches, `npm unlink -g moodcast` removes the
  symlink.
* The alias from Option A and the symlink from Option B can coexist — use
  whichever feels right. Option A is easier to undo.

## Inside the shell

Once you have `moodcast` available, the typical flow is:

```
$ moodcast
  ▓▒░ MOODCAST ░▒▓  FM 88.7
  MooC online.
  Type help for commands.

moodcast> help
moodcast> sessions          ← interactive picker
moodcast> start --auto      ← skip the tag picker
moodcast> resume
moodcast> quit
```

Aliases inside the shell: `ls` → `sessions list`, `s` → picker, `r` → resume,
`n` → next, `p` → previous, `q` → quit.

## Storage location

The shell, and every command it dispatches, reads/writes inside `~/.moodcast`
(or `$MOODCAST_HOME` if set). For experimenting without touching your real data,
launch a throwaway shell with:

```sh
MOODCAST_HOME=$(mktemp -d) moodcast
```
