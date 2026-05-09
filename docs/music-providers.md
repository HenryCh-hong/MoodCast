# Music providers

Moodcast was built around Spotify, but the goal is to support listeners
wherever they actually have an account. This document describes the current
provider abstraction (`lib/music/providers/`) and the **honest** state of
each provider.

## Current state

The previous version of this table collapsed playback into one yes/no
column, which was dishonest: "open in app" is not the same as "Moodcast
plays it in our page", and a partner-cert SDK is not the same as an
embeddable widget. Capabilities now split playback into three independent
flags so the UI can never accidentally promise something we don't deliver.

| Provider              | Auth | Search | App deep links | Web playback (embed) | SDK playback (driven) | Playlists | External links |
| --------------------- | ---- | ------ | -------------- | -------------------- | --------------------- | --------- | -------------- |
| Spotify               | ✅   | ✅     | ✅             | ❌                   | ✅¹                   | ✅²       | ✅             |
| QQ Music              | ❌   | ❌     | ❌³            | ❌⁴                  | ❌⁵                   | ❌        | ✅             |
| NetEase Cloud Music   | ❌   | ❌     | ❌             | ❌                   | ❌                    | ❌        | ✅             |

¹ Spotify SDK playback uses the official Web Playback SDK and requires
Spotify Premium on the listening account.
² `playlistAddTracks` may require an extended-quota grant from Spotify
for high-volume use.
³ A `qqmusic://` URL scheme is referenced in community sources (yt-dlp
etc.) but is **not** in QQ Music's official documentation. Undocumented
schemes are not a public contract.
⁴ QQ Music's first-party web player at `y.qq.com/webplayer/player.html`
exists, but no documented third-party-app embed path.
⁵ QPlay / QPlay Auth is a hardware-partner certification program (cars,
smart speakers, TVs), not a generic web SDK. See research findings below.

The `capabilities` flag on each provider is the source of truth. Any UI
surface that wants to render a "play" button **must** check
`canDrivePlayback(provider)` (true iff `webPlayback || sdkPlayback`)
first; "open in app" surfaces should use `appDeepLinks` and label
themselves as such — not as Moodcast playback. The `capabilityNotes`
field carries per-flag nuance that doesn't fit a boolean.

## Playback support status

A separate, narrower table for the most-asked question:

| Provider              | Can Moodcast drive playback in-page today? | Path                          | Why                                                           |
| --------------------- | ------------------------------------------ | ----------------------------- | ------------------------------------------------------------- |
| Spotify               | **Yes**                                    | Web Playback SDK              | Official, documented; requires Premium account.               |
| QQ Music              | **No (under investigation)**               | QPlay Auth / OpenAPI / WebPlayer? | Hardware-partner cert; web embed undocumented for 3P apps.    |
| NetEase Cloud Music   | **No**                                     | None confirmed                | No official open API or developer platform published.         |

If/when a sanctioned playback path becomes available for QQ Music or
NetEase, capability flags flip to true *together with* a working
`startPlayback` method — see the test invariant in
`tests/musicProviders.test.ts` (#7) that enforces this.

## What "placeholder" means

For a placeholder provider:

* Moodcast still generates the **curated track list** locally, using the AI
  provider the user has already configured (Anthropic / Google).
* The track-row UI offers a single action: **"Open in <provider>"**, which
  deep-links to that service's search page (`music.163.com` for NetEase,
  `y.qq.com` for QQ Music).
* The user starts playback themselves inside the target service's app or
  website. Moodcast cannot drive playback, fetch a now-playing state, or
  create playlists in the user's account.
* No taste profile is available — the prompt falls back to mood + activity +
  context only.

This is good enough for "I have a curated radio show and a way to copy it
somewhere I can actually listen". It's deliberately not enough to pretend
Moodcast is a full music app on these services.

## Constraints — what we will NOT do

* **No private / reverse-engineered APIs.** The unofficial NetEaseCloud
  Music and QQ Music endpoints that float around Github are off-limits.
  They break with every server-side change, can be considered a Terms of
  Service violation, and a single ban on either platform wipes out a real
  user's account.
* **No DRM bypass.** Encrypted track streams stay encrypted.
* **No region-restriction or paid-content workarounds.** If a track requires
  a paid VIP subscription on QQ Music, Moodcast doesn't try to retrieve it
  for free.
* **No login bypass / scraping.** If a service requires the user to log in,
  Moodcast either uses the official OAuth flow (when one exists) or sends
  the user to the service's own app to log in.

When an official integration path becomes available — a public OAuth flow,
a developer SDK, a sanctioned partner API — these placeholders will be
replaced with real implementations. Until then, "open the curated list in
your existing app" is the honest UX.

## Research findings (May 2026)

Recorded here so future contributors don't repeat the search and so the
honest "we don't actually know X" cells are explicit instead of buried.

### QQ Music (腾讯QQ音乐) — playback-feasibility deep-dive

Structured against the project's seven-question research checklist. Every
"unverified" cell is something gated behind the developer-portal login;
public web fetches do not surface answers and Moodcast has not yet
registered an app.

**1. Developer eligibility (individual vs. legal entity).**
The QQ Music portal at
[developer.y.qq.com](https://developer.y.qq.com/docs/openapi) does not
publish its eligibility rules on public pages. Tencent's *general*
developer infrastructure (QQ互联, 腾讯开放平台, 微信开放平台) does
support both individual developers (个人开发者: freelancers, students,
sole proprietors) and enterprise developers (企业开发者: limited
companies etc.) — but each surface has its own rules and QQ Music has
not been observed to publish its own. **Status: unverified.** Must be
confirmed by registering on developer.y.qq.com.

**2. App category.**
The portal's top-level navigation lists:
*登录鉴权 (Login/Auth), SDK, OpenAPI, APP互联 (App Integration), QPlay,
大屏解决方案 (Large Screen Solutions), 车机解决方案 (In-Car Solutions)*.
A second documented surface — the *移动WEB开放平台* at
[`y.qq.com/m/api/open/index.html`](https://y.qq.com/m/api/open/index.html)
— exists for mobile web. **No surface is explicitly named for a
desktop / browser-based third-party music web app.** Whether Moodcast
fits "APP互联", "移动WEB开放平台", or no category at all is
**unverified**.

**3. Auth flow.**
"登录鉴权" is a top-level menu item, implying an OAuth-style flow with
QQ / WeChat / QQ Music account login. The OpenAPI SDK login
documentation that *is* publicly visible
([qqMusicLogin reference](https://developer.y.qq.com/static/docs/edge/android/javadoc/core/com.tencent.qqmusic.openapisdk.core.login/-login-api/qq-music-login.html))
explicitly targets `androidJvm` — i.e., the documented login surface is
**Android-native, requires an Activity, and is not a web flow.** A
browser-side OAuth equivalent is not surfaced in the public docs.
User-consent scopes: **unverified.**

**4. API scopes (search / metadata / playback URL / web playback / JS
SDK / deep link / playlist create / playlist add / now-playing / pause
/ next / prev).**
- *Search & metadata.* Almost certainly part of OpenAPI based on menu
  naming; **unverified scopes / quotas.**
- *Playback URL.* Decryptable stream URLs are gated by QPlay Auth and
  partner certification; not exposed to generic OpenAPI clients.
  **Unverified for web apps.**
- *JS SDK / web playback.* The 移动WEB开放平台 docs describe a
  **`QMplayer`** JavaScript component with `play / pause / toggle /
  playReady / on / off` methods and `play / pause / ended / timeupdate
  / waiting / error` events. This is the closest thing to a documented
  browser playback SDK. **Whether registration as a third-party
  Moodcast-shaped app grants access — unverified.**
- *App deep link.* Community sources (yt-dlp, iOS Shortcuts) describe a
  `qqmusic://` scheme (`qqmusic:album:`, `qqmusic:playlist:`,
  `qqmusic:singer:`). **Not documented in QQ Music's official portal.**
  Undocumented schemes do not carry a platform commitment.
- *Playlist create / add.* Not visible on public pages; **unverified.**
- *Now-playing / transport (play, pause, next, previous).* The QMplayer
  JS SDK exposes basic transport methods; whether a non-mobile-web app
  may use them under ToS is **unverified.**

**5. Web playback.**
The first-party web player at
[`y.qq.com/webplayer/player.html`](https://y.qq.com/webplayer/player.html)
exists, plus a plugin page at `y.qq.com/plugins/music_player.html`.
**Neither is documented as a third-party-embeddable SDK.** The
documented embed surface is QMplayer on the 移动WEB开放平台 (above).
Whether Moodcast may use QMplayer — and whether it requires app
approval / ICP filing / a Chinese mainland deployment — is **unverified
and almost certainly approval-gated.**

**6. Open-source distribution.**
ToS for the developer portal is gated behind login. Tencent platforms
generally restrict redistribution of SDK keys/secrets and require keys
to live on the developer's server. Self-hosted **BYOK** (each user
brings their own QQ Music developer credentials) is the only model that
is plausibly compatible with a public GitHub repo, but **whether
Tencent's ToS permits per-user developer keys for an open-source web
app is unverified.** Until confirmed, no client secret should be
embedded in the repo or shipped to end-users.

**7. Account safety / rate limits.**
Tencent platforms have a long history of flagging accounts that drive
non-standard traffic patterns through their consumer endpoints. Rate
limits and "what counts as automation abuse" are spelled out in the
portal-internal ToS. **Unverified.** Until known, Moodcast must not
drive any QQ Music account at scale even if a public path opens up.

**QPlay / QPlay Auth — the partner-only playback path.**
QPlay is Tencent's "intelligent wireless streaming media transmission"
protocol; the QQ Music app on a phone selects tracks and a certified
device (Denon, Pioneer, B&W, B&O, Philips JukeBlox, DTS Play-Fi, etc.)
streams audio directly from QQ Music servers. **QPlay Auth** grants
partner products access to streams and playback control. It is
oriented toward terminals and brand integrations (cars, smart
speakers, TVs), **not** browser-based third-party music apps; Allion
is the sole authorized test lab. A Moodcast-shaped browser app does
not obviously fit any documented QPlay category.

**Mapped to capability flags (all stay false).**

| Capability    | Flag  | Reason                                                                                                              |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| auth          | false | OAuth menu exists; documented OpenAPI SDK login is Android-only; web flow + scopes unverified.                      |
| search        | false | OpenAPI metadata search likely; eligibility, scopes, ToS unverified — Moodcast has not registered an app.           |
| appDeepLinks  | false | `qqmusic://` is community-observed only; not in QQ Music's official documentation.                                  |
| webPlayback   | false | QMplayer JS SDK exists on 移动WEB开放平台; third-party-app eligibility & ToS unverified.                            |
| sdkPlayback   | false | QPlay Auth is partner-cert gated and hardware-oriented; no browser-app category documented.                         |
| externalLinks | true  | `https://y.qq.com/n/ryqq/search?w=...` is an unauthenticated search URL — always-safe.                              |

### NetEase Cloud Music (网易云音乐) — playback-feasibility deep-dive

**Correction vs. earlier note.** A prior version of this doc stated
"no official open API or developer platform published". That was
incomplete. NetEase Cloud Music **does** run an official developer
portal at
[`developer.music.163.com/st/developer/`](https://developer.music.163.com/st/developer/),
with a public "立即入驻" (apply now) entry point. What is *unverified*
is whether the platform's documented use cases include a Moodcast-
shaped third-party browser playback app, vs. only e.g. brand /
hardware / commercial-broadcast partners.

Structured against the same seven-question checklist:

1. **Official developer platform for music playback?** Yes — at
   `developer.music.163.com/st/developer/`. Eligibility, app categories,
   and ToS are gated behind portal registration. **Unverified** whether
   individual developers may apply.

2. **Official Web SDK?** Not visible on public docs pages. **Unverified.**

3. **Official user-authorized playback?** Not visible on public docs
   pages. NetEase has its own login; whether an OAuth equivalent exists
   that allows a third-party browser app to drive playback in the user's
   account is **unverified**.

4. **Search / metadata APIs available?** Likely some surface exists
   (the portal explicitly markets API access), but **scopes,
   eligibility, and rate limits are unverified.**

5. **Playlist APIs?** Not visible on public docs. **Unverified.**

6. **App deep links?** No documented `cloudmusic://` or `orpheus://` URL
   scheme on public NetEase pages. **Unverified.**

7. **Are common npm/GitHub packages official?** **No.** The popular
   libraries — `Binaryify/NeteaseCloudMusicApi`,
   `littlecodersh/NetEaseMusicApi`, the npm `NeteaseCloudMusicApi`
   package, multiple Python / Go / Rust ports, `metowolf` weapi
   analyses, `chaunsin/netease-cloud-music`, etc. — are **unofficial,
   reverse-engineered** wrappers around NetEase's internal endpoints.
   They are out of scope for Moodcast under any circumstances. See the
   "Why not unofficial APIs?" section above.

Until eligibility, scopes, and a sanctioned playback path are confirmed
through the official portal, NetEase support stays at "external search
URL only" and all playback flags stay false.

## Why not unofficial APIs?

Even popular reverse-engineered libraries are off-limits for Moodcast.
The reasoning is durable, not tied to any particular library:

1. **Legal / ToS risk.** Reverse-engineered endpoints are typically
   accessed against the platform's terms of service. Shipping that to
   end-users transfers the risk to *them* without informed consent.
2. **Account-safety risk.** A user who installs Moodcast and signs in
   with their real NetEase / QQ Music account exposes that account to
   takedown if the platform later flags the traffic pattern. Moodcast is
   not in a position to rebuild a banned account.
3. **Reliability risk.** Reverse-engineered APIs break whenever the
   platform changes a header, a signing algorithm, or an internal route.
   The library's GitHub issues are a wall of "stopped working today",
   and Moodcast's release cadence cannot keep up with that maintenance
   burden.
4. **Open-source distribution risk.** Moodcast wants to be installable
   from its public repo by anyone. Bundling a reverse-engineered
   integration creates a downstream redistribution problem (the Tencent /
   NetEase trademarks, the embedded signing logic, etc.). Even if our use
   were permitted, redistributing it generally isn't.
5. **Integrity of the product.** "We curate, we don't bypass" is a
   product position. Honest capability flags + external search links is
   the position that matches the position. Cool tricks aren't worth the
   identity drift.

When an official, sanctioned, individually-developer-eligible path
appears for either platform, Moodcast will adopt it. Until then,
external search URLs are the safe fallback.

### Manual next actions (project owner — not for an AI to do)

These are the steps that must happen before any QQ Music or NetEase
Cloud Music capability flag can flip from `false` to `true`.

**QQ Music — `developer.y.qq.com`**
1. Register a Tencent / QQ developer account and complete identity
   verification (个人 vs 企业 — you'll need ID or business license).
2. Apply for a QQ Music developer-platform account at
   `developer.y.qq.com`. Note exactly which "应用类型" (app type)
   options are offered — confirm whether one matches "third-party
   browser music app" vs. only hardware / in-car / public-broadcast /
   mini program.
3. Read the developer ToS in full. Pay attention to:
   - whether self-hosted BYOK distribution to end-users is permitted;
   - whether keys/secrets must stay on a server you control;
   - rate limits and account-flagging rules;
   - any mainland-China deployment / ICP filing requirement.
4. Specifically confirm the **QMplayer** JS SDK
   (`y.qq.com/m/api/open/index.html`) terms — is it embeddable from a
   non-mainland third-party domain, or is it bound to the 移动WEB开放
   平台 surface only?
5. Ask Tencent (via the portal's support / ticket channel) whether a
   browser-based playback category exists, and whether QPlay Auth is
   ever granted to non-hardware partners.
6. Only after the above: decide whether to flip any of QQ Music's
   capability flags. Each flip must come with a working method
   implementation and a passing test in `tests/musicProviders.test.ts`.

**NetEase Cloud Music — `developer.music.163.com`**
1. Click "立即入驻" on `developer.music.163.com/st/developer/` and
   register. Note whether individual developers are accepted.
2. Read the developer ToS in full (the same questions as QQ Music
   above: BYOK, key handling, ICP, rate limits, account safety).
3. Confirm whether any of the following exist as official surfaces:
   OAuth user login, search API, playback URL API, web playback SDK,
   playlist create / add APIs, app deep-link scheme.
4. Only after the above: decide on flag flips for `neteaseProvider`.

In all cases: **do not** install or import any
`NeteaseCloudMusicApi` / `qq-music-api` / similar npm or GitHub
package. The audit in `tests/musicProviders.test.ts` exists precisely
to catch that.

### Sources

* [QQ Music Developer Platform — OpenAPI docs](https://developer.y.qq.com/docs/openapi)
* [QQ Music 移动WEB开放平台 — QMplayer JS SDK](https://y.qq.com/m/api/open/index.html)
* [QQ Music OpenAPI SDK login — Android (qqMusicLogin)](https://developer.y.qq.com/static/docs/edge/android/javadoc/core/com.tencent.qqmusic.openapisdk.core.login/-login-api/qq-music-login.html)
* [QQ Music Mobile Web Open Platform docs (legacy index)](https://y.qq.com/m/api/api.html)
* [QPlay Certified hardware partners (DTS Play-Fi)](https://play-fi.com/news/dts-play-fi-products-support-qplay)
* [QPlay protocol overview (Allion ATL)](https://www.allion.com/certification/qplay/)
* [LUMIN QQ Music with QPlay (partner integration walkthrough)](https://luminmusic.com/manual/qqmusic-qplay.html)
* [Does QQ Music have an API? — Musicfetch](https://musicfetch.io/services/qq-music/api)
* [Tencent 开发者资质 (individual vs enterprise)](https://wiki.connect.qq.com/%E6%88%90%E4%B8%BA%E5%BC%80%E5%8F%91%E8%80%85)
* [NetEase Cloud Music Developer Platform](https://developer.music.163.com/st/developer/)
* [Does NetEase have an API? — Musicfetch](https://musicfetch.io/services/netease/api)

## Adding a provider

1. Create `lib/music/providers/<id>.ts`. Implement `MusicProvider` with
   accurate `capabilities` flags. Throw `ProviderCapabilityError` when a
   capability isn't supported — never silently no-op.
2. Add the provider to the `REGISTRY` in `lib/music/providers/index.ts`.
3. Update the table in this file.
4. Update the README's *Music provider roadmap* section.
5. If the provider needs auth, design the OAuth flow such that secrets stay
   in `.env.local` and refresh tokens stay in `<MOODCAST_HOME>/`. Do not
   commit any client secrets.

## Files

* `lib/music/providers/types.ts` — `MusicProvider`, `MusicProviderId`,
  `ProviderCapabilities`, `ProviderCapabilityNotes`,
  `ProviderCapabilityError`, `canDrivePlayback(provider)`.
* `lib/music/providers/spotify.ts` — wraps the existing `lib/spotify/*`
  helpers without changing their behaviour.
* `lib/music/providers/netease.ts` — external-link placeholder.
* `lib/music/providers/qqmusic.ts` — external-link placeholder.
* `lib/music/providers/index.ts` — registry + `DEFAULT_PRIMARY_PROVIDER`.

## Why the abstraction exists alongside, not instead of, lib/spotify/*

The Spotify call sites (the playback page, the resolve-tracks pipeline, the
taste profile, the dashboard) are the canonical implementation. Replacing
those with a generic-provider layer in a single pass would risk breaking the
already-working flow. Instead:

* `lib/spotify/*` stays the source of truth for Spotify behaviour.
* `lib/music/providers/spotify.ts` is a thin adapter that re-exposes that
  behaviour through the generic interface.
* New code that needs to be provider-agnostic (future "open in NetEase"
  buttons, future provider switcher in settings) goes through the
  abstraction; existing code keeps working unchanged.
