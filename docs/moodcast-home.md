# `MOODCAST_HOME` — local-state directory override

Every Moodcast on-disk artifact resolves through one helper:
`lib/storage/moodcastHome.ts` → `getMoodcastHome()`.

```
process.env.MOODCAST_HOME ?? path.join(os.homedir(), ".moodcast")
```

This applies to **all** local files:

| File / dir | Module |
|---|---|
| `active-session.json` | `lib/sessions/activeSession.ts` |
| `last-generation-error.json` | `lib/sessions/lastGenerationError.ts` |
| `sessions/index.json` + `sessions/<id>.json` | `lib/sessions/sessionLibrary.ts` |
| `preferences.json` | `lib/storage/preferencesServer.ts` |
| `apple-calendar.json` | `lib/calendar/appleCredentialStore.ts` |
| `tokens.json` | `cli/auth.ts` and `app/api/auth/spotify/callback/route.ts` |

If `MOODCAST_HOME` is unset, behavior is identical to before — everything lives under `~/.moodcast`.

## Running tests against a sandbox

Always isolate destructive or experimental work from the real `~/.moodcast`:

```bash
SBX=$(mktemp -d -t moodcast-test-XXXXXX)
echo "$SBX"

# CLI
MOODCAST_HOME="$SBX" npm run moodcast -- sessions list
MOODCAST_HOME="$SBX" npm run moodcast -- sessions delete <id>
MOODCAST_HOME="$SBX" npm run moodcast -- sessions clear

# Library helpers via tsx (for unit-style tests of appendSession etc.)
MOODCAST_HOME="$SBX" npx tsx your-test.ts

# Dev server, if you need to exercise the API routes against a sandbox
MOODCAST_HOME="$SBX" \
  SPOTIFY_REDIRECT_URI=http://127.0.0.1:3022/api/auth/spotify/callback \
  npx next dev -p 3022
# (stop your normal dev server first — Next.js refuses two on the same project)
```

A fresh tempdir starts empty, so the first call that touches the library will create `<sbx>/sessions/index.json` (mode `0600`) inside the directory `<sbx>` (mode `0700`).

## Backup before destructive operations on the real library

Before `moodcast sessions clear`, manual edits to `~/.moodcast/`, or any one-off migration script:

```bash
cp -R ~/.moodcast ~/.moodcast.backup-$(date +%Y%m%d-%H%M%S)
```

## Confirming "did this run touch my real data?"

Snapshot before, diff after:

```bash
find ~/.moodcast -type f -exec shasum {} \; | sort > /tmp/moodcast-before.sha
# … run your suspect command …
find ~/.moodcast -type f -exec shasum {} \; | sort > /tmp/moodcast-after.sha
diff /tmp/moodcast-before.sha /tmp/moodcast-after.sha
# no output → real data untouched
```
