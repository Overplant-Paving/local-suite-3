# recalls.html migration report (Batch B — CORS-open fetcher, 3 sources)

Migrated 2026-07-15 against v1 `../Local Suite/recalls.html`. Harness: `node verify-tool.mjs recalls`, exit 0.
Evidence: `interaction.txt` (main run), `interaction-supplemental-404-path.txt` (routed-404 run, see below),
`v1/v2-{light,dark}.png`, `v2-after-interaction.png`, `offline-stale.png`, `fda-down.png`,
`computed-style-diff.txt`, `localstorage.json`.

## v1 feature walk-through

- [x] **Theme toggle + persistence** — harness probe: `light -> dark, aria-pressed=true`; `suite.theme` written.
- [x] **State picker (51 states + DC, "— choose —" placeholder)** — options built identically; manual pick persists `suite.state` (interaction.txt line 12: `suite.state after manual pick: CA`).
- [x] **Default state derived from `suite.location` label** (`", CA"` regex) — seeded LA location, reload: `stateSel = "CA"` with no `suite.state` set beforehand (line 7).
- [x] **Food panel, openFDA live** — `distribution_pattern:("California" "nationwide")`, sort desc, limit 30. Live fetch rendered 30 recalls; sample logged: Class I, "FIRST STREET Dark Chocolate Raisins…", Western Mixers Produce & Nuts, Inc., initiated 20260615, reason "Undeclared peanuts." (lines 8–11). Class badge mapping (Class I to c1, II to c2, else c3), YMD date + status, 160-char product truncation, firm, reason — visible in first-card log and screenshots.
- [x] **Food 6 h cache** — envelope `suite.cache.recalls.food.CA` `{t,v:results[]}` written (line 10); the manual state re-pick re-ran `loadFood` and rendered from the fresh cache without a second request (envelope `t` unchanged).
- [x] **Food 404 = "no recalls on record … Reassuring." + foodN "0"** — proven with a routed 404 response (zero real requests): see `interaction-supplemental-404-path.txt` line 29. This pass lives outside the standing module (see concerns).
- [x] **Food stale fallback** — aged caches + network blocked: `foodN = "30 · data from Jul 14, 2026"`, 30 rows (line 22); v1's `renderFood` stamp logic byte-identical.
- [x] **Food hard error (no cache)** — FDA-only outage pass: `"Couldn't reach openFDA (Failed to fetch). Try again later."` (line 25).
- [x] **"Choose your state" empty state** — first-run log line 1.
- [x] **Vehicle add validation (all 3 fields required)** — empty click adds nothing, `suite.cars` stays null (line 13).
- [x] **Vehicle add + NHTSA live** — 2020 Honda Odyssey: `vehN = "1 vehicle"`, head "2020 Honda Odyssey", `carcount-0 = "14 recalls"`; sample recall 20V438000, component "BACK OVER PREVENTION: SENSING SYSTEM: CAMERA", DMY date 28/07/2020 rendered "Jul 28, 2020", Summary/Risk/Remedy blocks in card (lines 14–18 + screenshots).
- [x] **Vehicle remove** — panel returns to empty message, `suite.cars = []` (line 20).
- [x] **Vehicle 24 h cache** — re-add served from cache, no refetch (line 21).
- [x] **Vehicle stale fallback** — `"14 recalls · data from Jul 14, 2026"`, 14 rows offline (line 23).
- [ ] **Park outside / Do not drive badges** — code path preserved verbatim (`r.parkOutSide || r.parkIt`); not exercised live (sample vehicle has both flags false — visible in the cached envelope). Verified by inspection only.
- [ ] **Vehicle hard error (no cache)** — code path preserved verbatim; not exercised (would need a live block before any vehicle cache exists, i.e. a wasted real request). Verified by inspection.
- [x] **CPSC panel live** — 90-day `RecallDateStart` window, sorted desc, trimmed to 40: `prodN = "40 recent"`; sample: "Best Buy Recalls Insignia® Gas Ranges…", 2026-07-09, hazard badge, linked title to cpsc.gov recall page, products line, tag-stripped 220-char description (lines 3–6 + screenshots).
- [x] **CPSC 12 h cache** — envelope `suite.cache.recalls.cpsc` written (line 5); boot after reload served from it.
- [x] **CPSC stale fallback** — `"40 recent · data from Jul 14, 2026"`, 40 rows offline (line 24).
- [x] **CPSC hard error (no cache), link-out card** — `"Couldn't reach the CPSC recall service right now. See recalls at cpsc.gov →"`, href `https://www.cpsc.gov/Recalls` (line 29).
- [x] **Per-source degradation (3-source board)** — only api.fda.gov blocked, food cache removed: food shows its error card while vehicle (14 rows) and CPSC (40 rows) keep rendering (lines 25–27, `fda-down.png`). v1's fully independent per-panel loaders survive intact.
- [x] **Visual parity both themes** — `v1/v2-{light,dark}.png` side-by-side: indistinguishable (same live CPSC data rendered in all four captures).
- [x] **`locNote` span** — kept; it is written by nothing in v1 either (inert element, preserved as-is).

## changes beyond the recipe

1. **Stale-data stamps on the vehicle and CPSC panels** (policy-mandated, API-AND-RELAY.md §2 "never pretend"): v1 fell back to cached NHTSA/CPSC data *silently* on network failure; v2 appends the food panel's existing language (`" · data from <date>"`) to `carcount-N` / `prodN` **only on the stale-fallback path**. Fresh renders are byte-identical to v1. (Food already stamped cached data in v1 — that logic is unchanged.)
2. **Caching stays tool-local (manual `{t,v}` envelopes via `Suite.store`) instead of `Suite.fetchJSON`'s `cacheKey`** — same pattern as zip.html. Reason: v1 envelopes store *transformed* values (FDA `results[]`, CPSC sorted-and-trimmed-to-40 array), not raw response bodies. `fetchJSON`'s built-in cache would write raw bodies, (a) breaking round-trip compat for a user moving between v1 and v2 files, and (b) for CPSC caching the untrimmed multi-hundred-KB 90-day payload v1 deliberately avoided. All network I/O still goes through `Suite.fetchJSON` (timeout/abort/Accept unified; `tries: 1` to keep v1's no-retry etiquette); v1's bespoke `fetchJSON` helper deleted.
3. **404 detection** — v1 read `e.status === 404`; `Suite.fetchJSON` throws `Error("HTTP 404")` without a status property, so v2 tests `/HTTP 404/` on the message. Semantics proven identical via the routed-404 supplemental run.
4. **Enter submits the add-vehicle form** (a11y checklist item; also listed under a11y below).
5. Empty-fields Add click, remove, Enter re-add, and cache-hit behavior otherwise equivalent to v1 (logic transplanted verbatim, only `onclick=` to `addEventListener` and storage-helper swaps).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string | identical (via `Suite.store`, strings written bare) |
| `suite.state` | bare string, e.g. `CA` | identical |
| `suite.cars` | JSON array | identical bytes (`[{"make":"Honda","model":"Odyssey","year":"2020"}]` both sides) |
| `suite.location` | read-only (derive state) | identical (read via `Suite.location.get`) |
| `suite.cache.recalls.food.<ST>` | `{t, v: results[]}` | identical envelope + value shape |
| `suite.cache.recalls.veh.<make-model-year>` | `{t, v: results[]}` | identical (pipe-joined lowercase key as v1) |
| `suite.cache.recalls.cpsc` | `{t, v: trimmed[40]}` | identical (121793 chars both sides in the snapshot) |

`localstorage.json`: `keysOnlyInV1: []`, `keysOnlyInV2: []`. (The v2 `food.CA` envelope's `t` is 24 h old in the snapshot because the offline pass ages it and the restore keeps the aged stash — value payload identical.)

## escape allowlist requests

**none** — v1 built every card via `createElement`/`textContent` and v2 keeps that; there is no `innerHTML` in the tool at all. Remote text (FDA/NHTSA/CPSC fields) only ever flows through `textContent`.

## a11y applied

- `<span>Your state</span>` changed to `<label for="stateSel">` (was an unassociated span).
- `aria-label` on the three add-vehicle inputs ("Vehicle make/model/model year") — placeholders were their only hint.
- Enter in any add-vehicle field submits (text-entry + button pair rule); verified live (interaction line 21).
- Per-car remove buttons get `aria-label="Remove <year> <make> <model>"` (visible text "remove" alone doesn't say which).
- `Suite.liveRegion()` on the three async result containers `#foodList`, `#carList`, `#prodList`.
- Theme button label/`aria-pressed` from core `Suite.theme.init()`. No overlays; all interactions are native buttons/select/inputs (keyboard path inherent); `:focus-visible` from core.

## endpoints

- `https://api.fda.gov` — food enforcement JSON (CATALOG §4.3 + CORS table, verified Jul 2026).
- `https://api.nhtsa.gov` — recallsByVehicle JSON (CATALOG, verified Jul 2026).
- `https://www.saferproducts.gov` — CPSC recall REST JSON. **Host note for the orchestrator:** CATALOG's §4.3 prose lists the full `https://www.saferproducts.gov/...` URL (so the `--check` cross-check will pass), but the CORS-table row says bare `saferproducts.gov/RestWebServices`; the tool (v1 and v2) actually contacts the `www.` host — the manifest entry declares `www.` since CSP `connect-src` needs the exact host. Consider aligning the CATALOG table row.
- `https://www.cpsc.gov/Recalls` appears only as a **navigation link** (`<a href>` in the CPSC error card and in each recall title's URL field) — never fetched by script, so it is not in `endpoints`/`connect-src`.

`cacheTtlMin: 360` — recall feeds update on a daily-ish editorial cadence, not minute-by-minute; 6 h is v1's own food TTL (the shortest of the tool's three) and caps at four requests/source/day at most. The other v1 TTLs are longer and stay tool-local as in v1: vehicles 24 h (1440), CPSC 12 h (720). The manifest field declares the tool's most aggressive refresh.

## concerns for the reviewer

1. **FDA-404 pass lives outside the standing module.** Chrome emits `console.error: Failed to load resource: ... 404` for any non-2xx fetch; the harness counts that as a hard issue (only `net::ERR*` lines are exempt) and exits 2, even though handling the 404 *is* the feature (openFDA 404s on empty result sets, and v1 produces the same console line in that case). The path is proven in `interaction-supplemental-404-path.txt` (routed 404, `foodN="0"`, "…Reassuring." card); the standing module carries a comment explaining the omission.
2. **CPSC `r.URL` is assigned to `a.href` unmodified** (v1 behavior preserved). A hostile/compromised API response could carry a `javascript:` URL; `textContent` protects everything else but href assignment is an attribute sink. v1-parity kept per "no behavior removed/added"; suggest the Phase 4 escaping re-audit consider a one-line http(s) scheme guard here (and the same pattern elsewhere in the suite).
3. **Harness makes ~6 CPSC requests per verify run** (4 fresh-profile captures + v2 interact boot + v1 parity boot — each new context re-fetches on boot). Inherent to the shared harness (quakes et al. behave identically), not a tool defect; noted for etiquette honesty. Three verify runs were needed today (initial, parity fix, final), each within source limits.
4. **Vehicle hard-error card and park-it badges verified by inspection only** (see walk-through) — exercising them live would have required burning extra real requests or finding a currently-park-it vehicle; the code is transplanted verbatim from v1.
5. **CPSC cache is ~119 KB** in localStorage — same as v1 (same trimmed-to-40 payload); no change, just a known chunk of the quota.
6. The `net::ERR_FAILED` console lines in `interaction.txt` come exclusively from the deliberately-blocked offline/per-source passes and are the harness's documented exemption.

## Phase 4 audit fix: URL scheme guard (2026-07-16)

Concern 2 above (CPSC `r.URL` assigned to `a.href` unmodified) is now fixed. `renderProducts`
routes `r.URL` through a new `httpUrl()` helper: only strings matching `^https?://` (trimmed,
case-insensitive) reach the anchor; anything else (`javascript:`, `data:`, protocol-relative,
non-strings) renders the title as plain text via the tool's existing `else` branch — no link,
nothing dropped from the card.

Proof: `tests/interactions/recalls.mjs` gained a route-fulfilled hostile-payload probe (zero
real requests — all other hosts blocked): a CPSC response carrying `javascript:alert(document.domain)`,
a whitespace/mixed-case `  JaVaScRiPt:alert(1)` variant, and one legit `https://` URL. Asserted:
both hostile titles render with `href=null` (plain text), no non-http(s) value appears in any
href, and the https recall still links. interaction.txt:

    URL scheme guard probe (hostile CPSC payload): [{"text":"HOSTILE javascript recall","href":null},{"text":"HOSTILE disguised recall","href":null},{"text":"Legit https recall","href":"https://www.cpsc.gov/Recalls/2026/example"}]
    scheme guard verified: both javascript: variants rendered as plain text, https link intact

Harness re-run: `node verify-tool.mjs recalls` exit 0 (net::ERR console lines are the
documented exemption from the deliberately-blocked passes). CPSC cache stashed/restored
around the probe, so the parity snapshot keeps the real payload.
