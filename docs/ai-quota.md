# AI Provider Quota Exhaustion

## Symptom

Session generation fails after Signal Scan + tag picker with:

> MooC reached the gemini API limit for this key. The signal was tuned, but session generation could not complete.

The CLI exits cleanly without writing `<home>/active-session.json` (where `<home>` is `~/.moodcast` by default, or `$MOODCAST_HOME` if set — see [docs/moodcast-home.md](moodcast-home.md)). The selected tags and MomentContext summary remain visible in the terminal scrollback.

## How Moodcast detects it

`lib/ai/quotaError.ts` normalises both Gemini and Anthropic error shapes into a single `QuotaExhaustedError`. It matches on:

- HTTP `429`
- Google `RESOURCE_EXHAUSTED` or `insufficient_quota`
- Message text containing `quota`, `rate limit`, `resource exhausted`, `too many requests`, or `API key … limit`

Detection is deliberately broad — false positives just get a friendlier error message; false negatives degrade to the generic "Generation failed" path.

## How to recover

1. **Wait for quota reset.** Gemini free-tier quotas reset daily; paid tiers reset per-minute or per-day depending on the limit hit. Check the [Google AI Studio](https://aistudio.google.com/) usage dashboard.
2. **Update the provider key.** Replace `GOOGLE_API_KEY` (or `ANTHROPIC_API_KEY`) in `.env.local` and re-run `npm run moodcast start`.
3. **Switch providers.** Set the other key and `AI_PROVIDER=anthropic` (or `gemini`) in `.env.local`. See `lib/ai/provider.ts` for the priority order.

## API surface

`POST /api/generate-session` returns `429` with:

```json
{
  "ok": false,
  "code": "AI_QUOTA_EXCEEDED",
  "message": "MooC reached the gemini API limit for this key. …",
  "provider": "gemini"
}
```

The web builder (`app/builder/page.tsx`) surfaces `body.message` directly when `code === 'AI_QUOTA_EXCEEDED'`.

## Debug record

On quota failure the CLI writes `<home>/last-generation-error.json` with:

- timestamp, code, provider, original SDK message
- the user's selected tags
- a sanitised MomentContext summary — only city-level location, weather summary, and calendar rhythm; **never raw event titles or coordinates**

Use it to confirm what context MooC had at the moment of failure without leaking PII into a bug report.

## Retry policy

Moodcast does **not** auto-retry on quota errors. One clear failure is preferred over a tight loop that burns the rest of the quota window.
