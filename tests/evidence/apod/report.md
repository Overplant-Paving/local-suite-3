# apod.html — migration report (Batch C: keyed, rate-limited)

Completer-agent note: this tool was drafted by a prior agent killed mid-session
(handoff/batchC-drafts/apod.html). The draft was diffed line-by-line against v1,
found complete and correct (see "draft assessment" at the end), moved to
tools/apod.html, and fully verified here.

## v1 feature walk-through

- [x] Load today's APOD on open — verified live twice: one Node-side fetch (HTTP 200,
  raw body archived as apod-live-today.json) and one genuine in-browser fetch in a
  route-free context (HTTP 200, X-RateLimit-Remaining=8, title "Red Sprites in the
  Tatacoa Desert" rendered; live-browser.png). All other harness loads route-fulfilled
  with the same-day real payload to respect the shared DEMO_KEY pool (interaction.txt
  lines 1-5, 11).
- [x] Image render: hero image + HD link when hdurl differs — initial render log line 6
  (img src + hd href from the real payload); HD pill also exercised on the 2015-10-31
  fixture (line 17).
- [x] Title / date / copyright / explanation — line 6: meta "📅 Wednesday, July 15, 2026
  © Mario Vargas...", explanation 1030 chars == payload's 1030.
- [x] Demo-key nudge + paste-a-key card — summary "Using the shared NASA demo key
  (30 requests/hour)..." with signup link https://api.nasa.gov/ (lines 9-10). Save key →
  request fired with api_key=TESTKEY-not-real, summary flips to "Using your saved NASA
  key (1,000/hour)...", stamp drops the "· demo key" suffix; Use demo → key removed,
  nudge returns (lines 12-14). Keys via Suite.key("nasa")/Suite.store on suite.key.nasa.
- [x] prev / next buttons with edge disabling — prev to 2026-07-14 (line 15), nextBtn
  disabled at today / re-enabled off today (lines 8, 15).
- [x] Keyboard ArrowLeft/ArrowRight navigation — ArrowRight back to today from cache
  (line 16).
- [x] Date picker (min 1995-06-16, max today) — bounds line 8; jump to 2015-10-31 line 17.
- [x] today button — line 19.
- [x] 🎲 random — Math.random stubbed to 0.5 for determinism/v1-parity → 2010-12-29
  rendered (line 18).
- [x] ↻ refresh (force re-fetch) — used as the 429 trigger (line 22).
- [x] Video days — v1 embedded an iframe for youtube/vimeo URLs; dist CSP is
  default-src 'none' with NO frame-src (build.py build_csp), so an iframe would be dead
  in dist. v2 renders a designed link-out card: thumbnail_url still + "▶ Watch video ↗"
  badge, target=_blank rel=noopener, aria-label (line 20, video-day.png, 0 iframes).
  Non-embeddable hosts keep v1's plain .videolink fallback. See "changes beyond the
  recipe". Today was an image day (media_type=image, logged) — video path verified via a
  clearly-labeled synthetic fixture.
- [x] Cache per date in suite.cache.apod.<date> ({t,v} envelope) — localstorage.json:
  identical envelopes v1/v2; past dates cached forever, today per TTL.
- [x] Cached/loaded stamps — "Loaded just now · demo key." / "Cached · today's picture
  from just now." / "Cached · loaded X ago." exercised (lines 7, 16, 19, 24).
- [x] 404 state — real archive gap date 1995-06-17 fulfilled with 404: "No picture
  published for this date yet — try another day.", no cache key written (line 21).
- [x] 429 state — deterministic route-fulfilled 429 on forced refresh: rate-limit hint
  in the error card + cached copy rendered below + "Source is rate-limiting — showing
  cached data from just now." (lines 22-23, rl-429.png).
- [x] rl backoff (Batch C requirement, new) — after the 429 the effective TTL doubles:
  cache aged to 25 h (stale under the normal 24 h TTL) then today reloaded → served from
  cache with ZERO api requests fired (line 24).
- [x] Offline/stale path — cache aged 25 h, all network aborted, reload: error card +
  cached hero + "Showing cached copy from 25 hr ago." + "Live fetch failed — showing
  what we had." (line 26, offline-stale.png). Image itself cannot load offline (alt text
  shows) — identical to v1 offline behavior.
- [x] Theme toggle — light → dark, aria-pressed=true (line 27).

## changes beyond the recipe

1. **Video days: iframe → designed link-out card.** The dist CSP (build.py build_csp)
   emits default-src 'none' and no frame-src, so v1's YouTube/Vimeo iframe embed would be
   blocked in dist. The v2 card uses the API's thumbnail_url (v1 already requested
   thumbs=true but never used it) as a full-bleed still with a "▶ Watch video ↗" badge
   linking to the video on its own site — consistent with the Batch C link-out philosophy
   (API-AND-RELAY.md §4). Plain-link fallback when no thumbnail. This is the one genuine
   behavior change; flagged for reviewer sign-off.
2. **Today's freshness window 1 h → 24 h.** v1 refetched today's picture after 1 h; the
   manifest declares cacheTtlMin 1440 (daily-stats class, API-AND-RELAY.md §2), so v2
   serves today's cache for 24 h. Policy-mandated; one picture per day makes hourly
   refetching pointless. Past dates cache forever (immutable), exactly as v1.
3. **429 handling upgraded per Batch C** (flags: rl): backoff doubles the effective TTL
   (cap 8x) and the stamp says "Source is rate-limiting — showing cached data from X".
   v1 only showed the error hint.
4. **Error hints on non-mapped HTTP statuses lost API detail.** v1's local fetchJSON
   surfaced body.msg from the API on errors; Suite.fetchJSON discards error bodies, so
   e.g. an invalid-date 400 now shows "HTTP 400" instead of the API's sentence. 404 and
   429 (the states a user actually hits) keep their friendly v1 hints.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| suite.theme | bare string | bare string (Suite.store writes strings bare) |
| suite.key.nasa | bare string, removeItem to clear | identical via Suite.store.set/remove |
| suite.cache.apod.<date> | JSON {t,v} | identical envelope via Suite.fetchJSON cacheKey |

localstorage.json: keysOnlyInV1=[], keysOnlyInV2=[] — six identical keys after identical
interactions (today + prev + fixed + stubbed-random + video dates + theme). v2's today
envelope shows t 25 h older — that is the backoff-test aging, not a format difference.

## escape allowlist requests

none — the tool builds all dynamic DOM via createElement/textContent; the only innerHTML
use is the constant `view.innerHTML = ""` clear. (v1's `esc()` was a no-op String coercion;
v2 drops it in favor of textContent everywhere.)

## a11y applied

- view + stamp wrapped in Suite.liveRegion() (async result containers).
- aria-label on the key input ("NASA API key") and the date picker ("Choose a date").
- Enter in the key input saves the key (text-entry + button pair).
- Video link-out card carries aria-label "Watch today's video on the source site (opens
  in a new tab)"; thumbnail has alt text.
- prev/next/refresh keep their v1 title attributes and have visible text; theme button
  aria-label/aria-pressed from core. ArrowLeft/ArrowRight keyboard path preserved.
- Keycard is a native details element — keyboard-toggleable; focus-visible outlines from core.

## endpoints

- https://api.nasa.gov — the APOD API (connect-src). In CATALOG.md (lines 154, 515).
- https://apod.nasa.gov — every image/hdurl the API returns is hosted here (img-src).
  **Missing from CATALOG.md** — orchestrator: please add.
- https://img.youtube.com — thumbnail_url host for YouTube video days (the API's thumbs
  service returns img.youtube.com/vi/<id>/0.jpg). **Missing from CATALOG.md.**
- https://i.vimeocdn.com — thumbnail_url host for Vimeo video days (the API returns
  Vimeo's thumbnail_large). **Missing from CATALOG.md.**
- The video link itself (youtube.com / vimeo.com watch page) is navigation via a href,
  NOT an endpoint, per batchC-common.
- cacheTtlMin 1440: daily-stats class — APOD publishes exactly once per day
  (API-AND-RELAY.md §2 names APOD in the 24 h class explicitly).

## DEMO_KEY budget accounting

Exactly 2 live api.nasa.gov requests total, as budgeted: (1) Node-side fetch of today's
payload at module load, archived + reused on reruns via apod-live-meta.json; (2) one
genuine in-browser fetch in a route-free context, result persisted (live-browser-meta.json)
and reused on reruns. Response headers reported the demo pool at X-RateLimit 9/10 then 8
remaining (this IP's header said limit 10 — recorded as observed). All other harness
traffic was route-fulfilled. One real image fetch from apod.nasa.gov (static host)
provides deterministic screenshot bytes for every context.

## concerns for the reviewer

1. **Video link-out card is a v1 behavior change** (iframe removed). Forced by the dist
   CSP (no frame-src) — but it is a UX difference a v1 user will notice on video days.
   Verified only against a synthetic fixture payload this run (today was an image day);
   the fixture mirrors the API's documented video shape (media_type, url, thumbnail_url).
2. **X-RateLimit headers observed were 9/10 → 8** — the DEMO_KEY pool on this IP reported
   a limit of 10/hr, not the documented 30/hr. The tool's nudge text (v1-inherited) says
   30 requests/hour; harmless, but the real demo ceiling may be lower than advertised.
3. **Console lines in interaction.txt**: the two net::ERR_FAILED lines are from the
   deliberately-aborted offline segment (harness-tolerated class). The 404/429
   provocations were run on a sibling page whose console was captured and logged
   verbatim (line 25) — resource-load errors on non-2xx responses are browser-generated
   and unavoidable; v1 produces the same lines.
4. **Error-body detail loss on unmapped statuses** (see change 4) — inherent to
   Suite.fetchJSON's envelope; acceptable IMO, flagged for awareness.
5. **Inherited v1 quirk kept**: the HD link CSS selector `.media a.hd` never matches (the
   element is appended to `.media-wrap`), so "HD ↗" renders as a plain link below the
   image, not an overlay pill — byte-identical in v1 and v2 screenshots. Preserved for
   parity rather than fixed.
6. **suite.location** is not used by this tool (APOD is location-free).

## draft assessment (handoff)

The interrupted agent's draft was complete — not cut mid-write. Line-by-line diff against
v1 found: correct recipe application (palette/reset/theme-script stripped, core links +
data-suite-inline present, correct .back/.theme-btn/footer/body-line-height overrides for
v1's nonstandard chrome), all v1 features present, Suite.key/store/fetchJSON wiring
correct, rl backoff + 429/404 hints correct, and the video link-out already implemented
with an accurate CSP justification in its comments. No fixes were required; the file was
moved to tools/apod.html unchanged. All verification artifacts (interaction module,
evidence, this report) are new work by the completer.
