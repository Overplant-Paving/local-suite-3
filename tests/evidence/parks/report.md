# parks — migration report (Batch C, keyed: nps, no demo tier)

Completed from the interrupted session's drafts (`handoff/batchC-drafts/parks.{html,mjs}`).
Draft assessment: both drafts were structurally complete and faithful to v1; one fix was
required in the interaction module (see concerns #2). No changes were needed in parks.html.

## v1 feature walk-through

Evidence: `interaction.txt` (line refs below), screenshots in this directory.

- [x] No-key gate: boot without `suite.key.nps` renders the "Add your free NPS key" card with
  explanation, paste field, Save button, and signup link — interaction.txt L1–4 +
  `nokey-designed-state.png`. Per Batch C this is the designed no-key state (NPS has no demo tier).
- [x] Paste-a-key mechanics: fill + Save writes the bare string to `suite.key.nps` and boots the
  tool — L5 (`suite.key.nps = "TEST-KEY-NOT-REAL-0000"`). Enter in the field submits (retained
  from v1).
- [x] Park roster fetch (`/api/v1/parks?limit=600&api_key=…`) with slim mapping
  {code,name,states}, name-sort, and 30-day cache at `suite.cache.parks.parklist` — L6–8
  (8 fixture parks rendered alphabetically, cache envelope logged with sample).
- [x] Picker: selected-chips row, live search filtering by name/state/code (60-row cap),
  click-to-toggle options with `.on` highlight — L7, L10 (search "yose" → 1 option), L11–12.
- [x] Chip remove (×) unwatches the park and re-renders alerts — L24 (`suite.parks = ["yose"]`,
  groups drop to 1).
- [x] Selection persistence: `suite.parks` JSON survives reload; alerts re-render from cache with
  no refetch — L22–23 (requests unchanged parks 1->1, alerts 2->2).
- [x] Alerts fetch for the sorted code list (`parkCode=jotr,yose`), cached per selection set at
  `suite.cache.parks.alerts.<codes>` — L13, L15.
- [x] Empty-selection state: "Pick a park" card — L9.
- [x] Rendering: per-park groups with alert count, "park page →" link to www.nps.gov/<code>/,
  severity sort Danger→Closure→Caution→Info, colored category badges, alert title links (when
  a.url present), descriptions, and the "No active alerts" card — L16–20 +
  `v2-after-interaction.png` (Yosemite: 3 sorted alerts; Joshua Tree: no-alert card).
- [x] Data-freshness stamp ("data from <time>") — L16.
- [x] "change key" button returns to the key card with the saved key prefilled — L25.
- [x] Invalid-key path: HTTP 403 from the API surfaces "That key didn't work" with the input
  cleared — L26 + `invalid-key-state.png` (deterministic route-fulfilled 403; see concerns #2).
- [x] Stale/offline path: with all network aborted and caches back-dated 24 h, the picker renders
  from the 30-day parklist cache and alerts render with the "Offline — cached data from <time>"
  stamp — L27 + `offline-stale.png`.
- [x] Theme toggle both ways, persisted — harness probe L29 (`light -> dark, aria-pressed=true`).

No real NPS key exists in this environment and NPS has no demo tier, so per the Batch C addendum
the render pipeline was driven end-to-end by route-fulfilled responses with realistic
`developer.nps.gov/api/v1` payload shapes (roster + alerts, including the real API's parkCode
filter semantics). The API itself was verified from the terminal (see endpoints).

## changes beyond the recipe

- Alerts cache TTL raised from v1's 30 min to 360 min (`cacheTtlMin` 360) — policy-mandated
  (Batch B addendum / API-AND-RELAY.md §2). Park roster keeps v1's 30-day window (reference data).
- Stale cache served after a failed alerts fetch is now labeled "Offline — cached data from
  <time>" instead of v1's fresh-looking "data from <time>" — policy-mandated stale-state rule.
- Network failure on the roster fetch with no cache now renders a designed "Couldn't load the
  park list" card; v1 left the "Loading park list…" card up forever. Justified by the Batch C
  designed-state rule (never a dead end); flagged in concerns #4.
- Fetches go through `Suite.fetchJSON` (timeout kept at v1's 15 s) but with `fallbackToCache:
  false` and the cache envelopes managed manually, because v1 caches the slim mapped arrays —
  not raw responses — under its own keys (`suite.cache.parks.parklist`,
  `suite.cache.parks.alerts.<codes>`). Byte-compatible with v1 caches.
- HTTP status for the 401/403 key gate is recovered from `Suite.fetchJSON`'s `Error("HTTP
  <status>")` message (`statusOf()` helper) since the envelope API doesn't expose status codes.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string | same (via Suite.store) |
| `suite.key.nps` | bare string | same (via Suite.store; read via Suite.key("nps")) |
| `suite.parks` | JSON array | same |
| `suite.cache.parks.parklist` | `{t,v}` envelope | same |
| `suite.cache.parks.alerts.<sorted codes>` | `{t,v}` envelope | same |

Parity verified: `localstorage.json` — `keysOnlyInV1: []`, `keysOnlyInV2: []`, identical formats.

## escape allowlist requests

none — the tool builds all output via createElement/textContent; there is no innerHTML
interpolation anywhere (v1 was already DOM-based and that was preserved).

## a11y applied

- `aria-label` on the key paste field ("NPS API key") and the park search field.
- `aria-label="Remove <park name>"` on each chip's × button (icon-only).
- Park options: `role="listbox"`/`role="option"` + `aria-selected`, `tabIndex=0`, and
  Enter/Space keyboard toggling (keyboard path verified — interaction.txt L14).
- `Suite.liveRegion()` on both result containers (#app, #content).
- Enter submits the key field (v1 behavior, retained).
- Theme button `aria-label`/`aria-pressed` via core `Suite.theme.init()`.

## endpoints

- `https://developer.nps.gov` — `/api/v1/parks`, `/api/v1/alerts`. CORS verified 2026-07-16 from
  the terminal (one keyless request):
  `curl -s -D - -o /dev/null -H "Origin: https://henry.github.io" "https://developer.nps.gov/api/v1/alerts?parkCode=yose&limit=1"`
  → `HTTP/1.1 403 Forbidden` with `Access-Control-Allow-Origin: *` — CORS-open, key enforced
  via query param or X-Api-Key header. Kept v1's `api_key` query param (CATALOG.md L206 notes
  client-side query-string use is the common pattern; Suite.fetchJSON's `headers` option is
  available if the orchestrator prefers the header form).
- Host present in CATALOG.md (L206, L538) but still marked "verify" — the curl above satisfies
  it; orchestrator may want to stamp the verification date in CATALOG.
- Navigation-only links (NOT endpoints): `www.nps.gov` park pages / alert URLs / signup page.

## concerns for the reviewer

1. **No live-key render evidence.** NPS has no demo tier and no key exists in this environment,
   so the fulfilled-route fixtures stand in for a real payload (shapes taken from the documented
   API). The only real-network evidence is the curl CORS/403 check. A one-time re-run with a real
   key (`localStorage.suite.key.nps`) would close this gap.
2. **Harness workaround for the 403 test (the one draft fix).** The draft ran the invalid-key 403
   on the main interaction page; the browser's `console.error "Failed to load resource: ... 403"`
   is counted as a hard issue by verify-tool.mjs (only `net::ERR` is filtered) → exit 2. Moved
   that step to a sibling page in the same context (routes still apply; coverage identical;
   evidence: interaction.txt L26 + invalid-key-state.png). If preferred, a harness-side allowance
   for intentionally induced HTTP errors would let it move back.
3. `interaction.txt` shows one `console.error: net::ERR_FAILED` — from the deliberate
   all-network abort in the stale-path test; it is the harness-filtered, expected class.
4. The "Couldn't load the park list" no-cache failure card is a small behavior addition over v1's
   stuck loading card (see changes). Revert to exact v1 behavior if judged out of scope.
5. Suite.liveRegion is applied to `#app` (which contains the picker UI, not only results); with
   `aria-live="polite"` on a container that re-renders on each toggle, screen-reader chatter is
   possible but bounded. Kept because both containers receive async result states.
