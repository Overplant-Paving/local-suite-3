# nutrition.html — migration report (Batch C, keyed: usda demo tier, RL)

Completed from the unverified handoff draft `handoff/batchC-drafts/nutrition.html` (prior agent
killed by usage limit). The draft was diffed line-by-line against v1 and found **complete and
correct** — no truncation, no missing features; it was moved to `tools/nutrition.html` unchanged.
All verification below was produced fresh in this session (the killed agent left no interaction
module and no evidence).

## v1 feature walk-through

- [x] **Theme toggle + persistence** — harness probe: `light -> dark, aria-pressed=true`; `suite.theme` written (localstorage.json).
- [x] **Key state line (DEMO_KEY / "your key ✓")** — interaction.txt lines 1, 4, 5: DEMO_KEY on load; "your key ✓" after save; back to DEMO_KEY after clear.
- [x] **Paste-a-key: toggle box, Save, "Use demo" clear** — exercised end-to-end; `suite.key.usda` written on save (`stored=TEST-KEY-NOT-REAL`) and removed on clear (`stored=null`). v1 mechanics kept per API-AND-RELAY.md §3.
- [x] **Search (Enter submit + button)** — Enter-submitted live search of "banana": HTTP 200, 477,384 bytes, 20 rows rendered, stamp "USDA search · live · …". Response archived as `live-response.json`.
- [x] **Result rows: title-cased name, brand/dataType meta, kcal/100g** — logged rows 1–2 ("Wonder Natural Foods Corp · 312 kcal/100g").
- [x] **Cache write, v1 envelope + v1 key** — `suite.cache.nutrition.banana|d` `{t, v: 20 slimmed foods}` — byte-compatible with v1 (localstorage.json values match v1's to the char count, 54,058 chars).
- [x] **Cached render before refetch** — "restored from fresh cache (no refetch): stamp=…cached…" (also proves the v2 TTL gate, see policy change below).
- [x] **A/B slot pick + unpick toggle** — A and B picked (aria-pressed=true both), compare grid gets class `compare two`.
- [x] **Compare cards: slot color, h3, sub, big kcal, macros + micros tables** — both cards logged (312 vs 336 kcal, 21 table rows each); after-interaction screenshot shows the full two-up layout.
- [x] **Basis toggle per 100 g / per serving** — "per serving (32 g, 2 Tbsp)": 312 kcal/100 g -> 100 kcal per serving (32 g × 3.12 ✓).
- [x] **Serving-size gram/ml detection** — exercised via the Branded rows above (32 g and 28 g, 1 ONZ chips visible in the after shot).
- [x] **Remove slot** — slot B removed (1 card, grid back to `compare`), then re-added.
- [x] **Error cards: 429 rate-limit, 403 key-rejected, generic** — 429-no-cache card verified live-identical text to v1 (`rl-429-nocache.png`); 403 branch is the same code path with different static text (route-fulfil not spent on it — see concerns).
- [x] **No-match state** — code path identical to v1 ("No foods matched…"); not driven (would cost a second live request or a fabricated empty response).
- [x] **Footer / header / placeholder text** — screenshot-identical both themes.

## changes beyond the recipe

- **Demo-key nudge (Batch C addendum, required):** "— using the shared demo key, [get your free key]" line, visible only when `Suite.key("usda").isDemo`; link = manifest `key.signup`.
- **TTL policy (Batch B addendum, policy-mandated):** v1 re-fetched on every search even with a cache hit. v2 skips the request when the cache is fresher than `cacheTtlMin` 10080 (reference data, 7 d) and renders "cached". Rendering behavior otherwise identical.
- **Stale/offline state (policy-mandated):** "Offline — cached results from <time>." card + stamp; v1 silently showed the cached render with no note.
- **429 backoff (flags:["rl"], Batch C addendum):** session-scoped `rlBackoff` doubles the effective TTL after a 429 and renders "USDA is rate-limiting — showing cached results from <time>."
- **Key box a11y:** `keyToggle` got `role=button tabindex=0 aria-expanded aria-controls` + Enter/Space activation; Esc closes the box and returns focus.
- The slimmed-foods cache envelope, cache keys, nutrient tables, rounding, and all rendering are v1-identical.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | ✓ | ✓ (via Suite.store, bare string) |
| `suite.key.usda` | ✓ (set/removed by key box) | ✓ same key, same lifecycle |
| `suite.cache.nutrition.<term>\|d` / `\|k` | ✓ `{t, v:[slimmed foods]}` | ✓ identical envelope — v1 caches keep working |

Parity proof: `localstorage.json` — `keysOnlyInV1: []`, `keysOnlyInV2: []`, identical values.

## escape allowlist requests

none — the three `innerHTML` writes ("Searching USDA…", 429 text, 403 text) are static string
literals with zero interpolation; every remote-data render goes through `createElement`/`textContent`
(v1 already did; v2 keeps it).

## a11y applied

- `aria-label` on the search input, key input, A/B slot buttons ("Put <food> in slot A/B"), and remove buttons ("Remove <food> from slot A/B").
- `aria-pressed` on A/B slot buttons and basis toggle buttons.
- `Suite.liveRegion()` on `#results` and `#compare`.
- Enter submits the search form (native form submit, verified).
- Keyboard path for the key box: toggle is `role=button`/`tabindex=0` with Enter/Space, Esc closes and restores focus (verified: `focus on=keyToggle`).
- Theme button label/pressed state from core.

## endpoints

- `https://api.nal.usda.gov` (FDC `/fdc/v1/foods/search`) — present in CATALOG.md (line 298 narrative; line 512 table, CORS column still says "verify": this session's live fetch from `file://` (Origin null) succeeded HTTP 200, so the orchestrator can stamp the verification date).

## verification evidence (this directory)

- `v1-light/dark.png`, `v2-light/dark.png` — visually indistinguishable; only intended diff is the added demo-nudge text.
- `computed-style-diff.txt` — 14/theme: `-webkit-font-smoothing` (pre-approved, core), `.theme-btn float:right` (core shared chrome; inert inside the flex `.topbar`, screenshots prove identical layout), `input outline-offset 2px` (core `:focus-visible` a11y rule, visible only on keyboard focus).
- `interaction.txt` — full feature walk; console clean (single filtered `net::ERR_FAILED` from the deliberate offline test). Harness exit 0.
- `live-response.json` — the one real DEMO_KEY response (HTTP 200).
- `offline-stale.png` — stale path (cache back-dated 15 d > 7 d TTL, all http aborted).
- `rl-429-backoff.txt`, `rl-429-state.png`, `rl-429-nocache.png` — deterministic 429 pass: rate-limit note + cached render; follow-up search made **0 requests** (8-day-old cache fresh under the doubled 14-day TTL = backoff proven); no-cache 429 error card. Run standalone (dictionary.mjs precedent) because a fulfilled 429 logs a console error the harness gate counts as hard; **zero real requests** — seeded by route-fulfilling `live-response.json`.
- DEMO_KEY budget: **1 real request total** (budget 2). v1 parity search was route-fulfilled with the captured v2 response.

## concerns for the reviewer

1. **The 429/backoff evidence lives outside the harness run** (`rl-429-backoff.txt`), same pattern as dictionary's archived run-1 — verify-tool.mjs's console gate cannot tolerate a fulfilled 429. If the orchestrator prefers it inside `interaction.txt`, the gate's filter would need to admit status-429 resource errors.
2. **The 403 "Key rejected" branch was not driven** — it is the adjacent `else if` of the verified 429 branch with static text; driving it deterministically costs another fulfilled-error console hit. Flagged rather than silently claimed.
3. **CATALOG.md line 512 still lists USDA FDC CORS as "verify"** — this session's live `file://` fetch is the missing verification; CATALOG is orchestrator-owned so it was not touched.
4. **`slim()` drops `nutrient.number`-shaped nutrients** (search API returns flat `nutrientNumber`, so harmless today) — v1 had exactly the same shape assumption; kept for parity.
5. The tool never fetches per-food detail endpoints (`/fdc/v1/food/{id}`) — compare works entirely from search-response nutrients, as in v1. No hidden request budget.
