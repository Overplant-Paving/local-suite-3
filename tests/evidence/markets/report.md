# markets.html — migration report (Batch C: keyed + rl)

## v1 feature walk-through

- [x] **Crypto board (6 coins, CoinGecko, keyless)** — ONE real live fetch of
  `https://api.coingecko.com/api/v3/simple/price?ids=...&vs_currencies=usd&include_24hr_change=true`
  on the interaction pass; interaction.txt logs the concrete render: BTC $64,558, -0.31% · 24h,
  and the written cache envelope (`suite.cache.markets.crypto`, `bitcoin.usd=64558`). All six
  tiles (icon + sym + name + price + 24h change with up/down color) visible in the screenshots.
- [x] **`money()` tiering** ($64,558 no decimals / $76.85 two decimals / $0.073915 six decimals)
  — visible across the BTC/SOL/DOGE tiles in every screenshot; function byte-identical to v1.
- [x] **No-key designed state (keycard)** — finnhub has no demo tier, so this is the boot state:
  explanation + signup link (`https://finnhub.io/register`) + paste field + Save. Verified
  explicitly: `keycard visible=true, stock card visible=false`, nokey-designed-state.png
  (and it is the state in all four capture screenshots).
- [x] **Save key -> stock card** — paste mechanics exercised with a fake key against a
  route-fulfilled Finnhub (never a real request with an invented key): keycard hides, stock
  card shows, key stored at `suite.key.finnhub` (bare string, byte-identical to v1).
- [x] **Change key link** — code path preserved verbatim (`showStocks(false); showKeyCard(true);`
  prefills the input via `getKey()`); not separately driven — same two show/hide helpers the
  save path just proved, in the opposite order.
- [x] **Watchlist render (default AAPL/MSFT/SPY/QQQ)** — 4 tiles rendered from the fulfilled
  quote: AAPL `nm="prev close $211.12" px="$212.33" chg="+0.57% · +$1.21"` logged — i.e. `q.c`,
  `q.pc`, `q.dp`, `q.d` all wired exactly as v1 (including the U+2212 minus for negative `d`).
- [x] **Add ticker (uppercase, dedupe) + Enter submits** — typed lowercase "vti", clicked Add:
  5 tiles, `#tile_VTI` present, stored `["AAPL","MSFT","SPY","QQQ","VTI"]`. Enter path on
  `#tickerInput` is v1 code, kept.
- [x] **Remove ticker (× button)** — clicked `#tile_VTI .rm`: back to 4 tiles, stored list
  shrank. Buttons converted from `.onclick=` to `addEventListener` (recipe).
- [x] **"no quote" tile and keyBad error message** — code paths preserved verbatim
  (`q.c==null||q.c===0` -> "not on free tier"; error regex -> "Finnhub rejected the key...").
  Not driven: they would need a second fulfilled shape/status per symbol; the regex gained
  `429` (see changes).
- [x] **Cache + serve-stale on failure** — v1's manual `{t,v}` envelopes are now
  `Suite.fetchJSON` envelopes at the SAME keys (`suite.cache.markets.crypto`,
  `suite.cache.markets.stock.<SYM>`; verified byte-shape in localstorage.json). Offline test:
  all caches back-dated 72 h, all http(s) aborted, reload — crypto card renders
  "Offline — cached 72 h ago", stocks render prices with "Offline — cached 72 h ago"
  (offline-stale.png). Never a blank page.
- [x] **Rate-limit backoff (new, rl mandate)** — deterministic: crypto cache aged 25 h,
  CoinGecko route-fulfilled HTTP 429 (exactly 1 hit logged, on a sibling page per the
  launches.mjs pattern) -> "CoinGecko is rate-limiting — showing cached data · 25 h ago" +
  cached tiles (rl-backoff-429.png) + throttle memory written. Backoff proof: with the cache
  30 h old (expired vs 24 h, fresh vs the doubled 48 h) the next reload made ZERO CoinGecko
  requests and rendered "Updated 30 h ago".
- [x] **Theme toggle** — harness probe: light -> dark, `aria-pressed=true`; dark screenshots match v1.

## changes beyond the recipe

- **TTL 5 min -> 24 h (`cacheTtlMin: 1440`).** Policy-mandated: this is a self-described
  "once-a-day glance" and API-AND-RELAY.md §2 assigns CoinGecko the daily-snapshot TTL. Both
  the crypto board and per-symbol quotes now serve from cache for 24 h with no request.
- **429/403 backoff (flags `["rl"]`).** New `suite.cache.markets.throttle` memory (a `{t,v}`
  envelope under `suite.cache.*`, so it is cache-class data): on HTTP 429/403 from CoinGecko
  the tool notes the throttle, doubles the effective TTL (48 h) and renders the mandated
  "CoinGecko is rate-limiting — showing cached data · <ago>" line. Policy-mandated.
- **Stale is labeled.** v1 silently rendered expired cache as "Updated <ago>" on failure; v2
  renders "Offline — cached <ago>" on both cards (Batch B mandate). Never pretends stale is fresh.
- **`keyBad` regex gained `429`** (`/api key|invalid|403|401|429|limit/i`) — v1's message text
  already said "...or you hit the rate limit" but its regex never matched a plain "HTTP 429"
  from the shared fetcher; message text unchanged.
- **Enter submits on `#keyInput`** (a11y rule: text-entry + button pair). v1 only had Enter on
  `#tickerInput`.
- **Style-diff neutralizers:** `.topbar .theme-btn { float:none }` (v1's button is a flex child;
  core adds a float) and `.card { display:block; flex-direction:row; gap:normal; ... }`
  restoring v1's block card against core's flex `.card` — same pattern as currency.html.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via Suite.theme) |
| `suite.key.finnhub` | yes — bare string | yes — bare string (Suite.store writes strings bare) |
| `suite.markets.tickers` | yes — JSON array | yes — identical JSON |
| `suite.cache.markets.crypto` | yes — `{t,v}` | yes — same key, same envelope (fetchJSON) |
| `suite.cache.markets.stock.<SYM>` | yes — `{t,v}` | yes — same key, same envelope |
| `suite.cache.markets.throttle` | no | new — rl backoff memory (the only `keysOnlyInV2`) |

`keysOnlyInV1` is empty. A v1 user's caches, key, and watchlist are all read unchanged.

## escape allowlist requests

none — every interpolation into innerHTML template literals is wrapped in `Suite.esc()`,
including locally-derived values (symbols, formatted prices, class names).

## a11y applied

- `Suite.liveRegion()` on `#crypto`, `#cryptoUpdated`, `#stocks`, `#stockUpdated`, `#stockMsg`,
  `#keyMsg` — all async-updating result/status containers.
- Remove buttons: `aria-label="Remove <SYM>"` (v1 had only `title`). Real `<button>`s, so the
  keyboard path exists.
- Inputs: `aria-label` on `#keyInput` ("Finnhub API key") and `#tickerInput` ("Ticker symbol
  to add") — v1 had placeholders only.
- Enter submits on both text-entry + button pairs (`#tickerInput` was v1; `#keyInput` added).
- Theme button labeled + `aria-pressed` by core `Suite.theme.init()`.
- No overlays, so no Esc handling needed.

## endpoints

- `https://api.coingecko.com` — `/api/v3/simple/price` (crypto board, keyless, CORS-open).
  In CATALOG.md: present (rate-limit registry row "CoinGecko | api.coingecko.com").
- `https://finnhub.io` — `/api/v1/quote?symbol=&token=` (stocks, free key, CORS-open).
  In CATALOG.md: present ("Finnhub stocks | finnhub.io/api/v1").

No image hosts. The signup link (`https://finnhub.io/register`) is navigation, not an endpoint,
and is the same host anyway. `cacheTtlMin: 1440` — daily-snapshot class (API-AND-RELAY.md §2
registry row for markets), doubled to 2880 while throttled.

## concerns for the reviewer

- **Finnhub was never hit live.** No key exists (no demo tier, per policy "never invent a
  key"), so the keyed path was verified with a fake key against route-fulfilled responses:
  paste mechanics, quote render math, stale path, and the no-key designed state are all
  evidenced, but no real Finnhub response shape has been seen end-to-end. The shape used
  (`c,d,dp,h,l,o,pc,t`) matches Finnhub's documented /quote response and v1's field usage.
  When the user pastes a real key (flag, don't block), one live spot-check would close this.
- **CoinGecko's limiter is real and touchy:** the harness's four capture loads + the live
  interaction fetch already flirt with the per-minute cap; the first verification run had
  v1's parity load 429'd. The parity pass is therefore route-fulfilled (v2's live evidence
  stands on its own; v1 only needs to write the same keys). Re-runs within a minute of each
  other may still see error cards in the CAPTURE screenshots — rerun after a pause if so
  (this run's captures are all clean).
- **`keysOnlyInV2` = `suite.cache.markets.throttle`** — written by the deterministic 429 test
  (rl backoff memory). Cache-class, `suite.cache.*`-namespaced, harmless to v1.
- **Behavior change worth knowing:** with the 24 h TTL a user who opens the tool twice in a
  day gets cached prices with "Updated N h ago" and no refetch — v1 refetched after 5 min.
  That is the intended reading of "index levels once a day", but it is a real change.
- The stock-tile loop is sequential like v1 (one request per symbol per day per cache);
  a long watchlist still means N requests on first load — v1 behavior, unchanged.
- `Suite.key("finnhub")` reads via `Suite.store.get`, which JSON-parses: an all-digit API key
  would come back as a number and be treated as missing. Finnhub keys are alphanumeric, so
  this is theoretical; noting it because it applies to every keyed tool using this pattern.
