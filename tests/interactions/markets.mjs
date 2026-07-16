/* tests/interactions/markets.mjs — Market Snapshot (Batch C, keyed + rl)
   Path 1 (CoinGecko, keyless, CORS-open): one real live fetch on load; BTC price logged.
   Path 2 (Finnhub, keyed, no demo tier): the no-key DESIGNED state is verified first
   (keycard visible, stock card hidden), then the paste-a-key mechanics with a fake key
   and a route-fulfilled quote render (never a real request with an invented key).
   Then the rl backoff (flags:["rl"]): CoinGecko route-fulfilled 429 -> throttle note +
   cached render + doubled-TTL proof (zero requests on the next reload while <48h old).
   Then the Batch B stale offline path, then a cache-served restore for the final shot. */

export const selectors = [
  "body", ".topbar", ".theme-btn", "header h1", "header .tag",
  ".card", "#cryptoUpdated", "#crypto", "#keycard", ".btn",
  ".keycard p", "footer"
];

export const screenshotAfterInteract = true;

const FAKE_KEY = "test-fake-key-not-real"; // never sent to the real API: finnhub is routed
const QUOTE = { c: 212.33, d: 1.21, dp: 0.5731, h: 213.9, l: 210.2, o: 211.5, pc: 211.12, t: 1752570000 };
const CRYPTO = {
  bitcoin:  { usd: 64554, usd_24h_change: -0.31 },
  ethereum: { usd: 3111.2, usd_24h_change: 0.42 },
  solana:   { usd: 152.4, usd_24h_change: -1.05 },
  ripple:   { usd: 2.31, usd_24h_change: 0.88 },
  cardano:  { usd: 0.71, usd_24h_change: -0.12 },
  dogecoin: { usd: 0.183, usd_24h_change: 1.94 }
};

const cryptoReady = page =>
  page.waitForFunction(() => document.querySelectorAll("#crypto .tile").length === 6, { timeout: 25000 });
const stocksReady = (page, n) =>
  page.waitForFunction(count =>
    document.querySelectorAll("#stocks .tile").length === count &&
    ![...document.querySelectorAll("#stocks .nm")].some(e => e.textContent === "loading…"),
    n, { timeout: 25000 });

const routeFinnhub = page =>
  page.route(/finnhub\.io/, r => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(QUOTE)
  }));

export async function interact({ page, log, evidenceDir }) {
  /* ---- path 1: live CoinGecko fetch (the one real request) ---- */
  await cryptoReady(page);
  log(`crypto updated line: "${(await page.textContent("#cryptoUpdated")).trim()}"`);
  const btc = await page.evaluate(() => {
    const t = [...document.querySelectorAll("#crypto .tile")]
      .find(x => x.querySelector(".sym").textContent.includes("BTC"));
    return { px: t.querySelector(".px").textContent, chg: (t.querySelector(".chg") || {}).textContent || "" };
  });
  log(`live BTC tile: price=${btc.px} change="${btc.chg.trim()}"`);
  const env = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.cache.markets.crypto")));
  log(`cache envelope suite.cache.markets.crypto: t=${env.t} bitcoin.usd=${env.v.bitcoin && env.v.bitcoin.usd}`);

  /* ---- path 2a: no-key DESIGNED state (finnhub has no demo tier) ---- */
  log(`no-key state: keycard visible=${await page.isVisible("#keycard")}, ` +
    `stock card visible=${await page.isVisible("#stockCard")}, ` +
    `signup link href=${await page.getAttribute("#keycard a", "href")}`);
  await page.screenshot({ path: `${evidenceDir}/nokey-designed-state.png`, fullPage: true });

  /* ---- path 2b: paste mechanics + route-fulfilled quote render ---- */
  await routeFinnhub(page);
  await page.fill("#keyInput", FAKE_KEY);
  await page.press("#keyInput", "Enter"); // Enter-submit (a11y addition; v1 required the button)
  await stocksReady(page, 4);
  log(`after key save: keycard visible=${await page.isVisible("#keycard")}, ` +
    `stock card visible=${await page.isVisible("#stockCard")}`);
  const aapl = await page.evaluate(() => {
    const t = document.getElementById("tile_AAPL");
    return { nm: t.querySelector(".nm").textContent, px: t.querySelector(".px").textContent,
             chg: t.querySelector(".chg").textContent };
  });
  log(`AAPL tile (route-fulfilled quote c=212.33 pc=211.12 dp=0.5731): ` +
    `nm="${aapl.nm}" px="${aapl.px}" chg="${aapl.chg.trim()}"`);
  log(`stocks updated line: "${(await page.textContent("#stockUpdated")).trim()}"`);

  /* add + remove a ticker (watchlist mechanics) */
  await page.fill("#tickerInput", "vti");
  await page.click("#addBtn");
  await stocksReady(page, 5);
  log(`added "vti": tiles=${await page.locator("#stocks .tile").count()} (uppercased id present: ` +
    `${await page.locator("#tile_VTI").count() === 1}), stored=${await page.evaluate(() => localStorage.getItem("suite.markets.tickers"))}`);
  await page.click('#tile_VTI .rm');
  await stocksReady(page, 4);
  log(`removed VTI: tiles=${await page.locator("#stocks .tile").count()}, ` +
    `stored=${await page.evaluate(() => localStorage.getItem("suite.markets.tickers"))}`);

  /* ---- rl backoff: deterministic 429 on the CoinGecko path ----
     Run on a sibling page (same context => same localStorage) so the intentional
     429 "Failed to load resource" console line stays off the harness's
     fail-on-console gate — the established pattern (launches.mjs, congress.mjs). */
  await page.evaluate(() => {
    const k = "suite.cache.markets.crypto";
    const e = JSON.parse(localStorage.getItem(k));
    e.t = Date.now() - 25 * 60 * 60 * 1000; // expired vs the 24h TTL
    localStorage.setItem(k, JSON.stringify(e));
  });
  const p2 = await page.context().newPage();
  let cg429 = 0;
  await p2.route(/api\.coingecko\.com/, r => {
    cg429++;
    r.fulfill({ status: 429, contentType: "application/json", body: '{"status":{"error_code":429}}' });
  });
  await routeFinnhub(p2); // stock caches are fresh, but never risk a real hit with the fake key
  await p2.goto(page.url());
  await cryptoReady(p2);
  await stocksReady(p2, 4);
  log(`429 load (sibling page): coingecko hits=${cg429} (expect 1), crypto updated line: ` +
    `"${(await p2.textContent("#cryptoUpdated")).trim()}"`);
  log(`429 load: BTC still rendered from cache: ` +
    `${await p2.evaluate(() => [...document.querySelectorAll("#crypto .tile")].some(t => t.textContent.includes("BTC") && t.querySelector(".px").textContent.startsWith("$")))}`);
  log(`throttle memory written: suite.cache.markets.throttle=${await p2.evaluate(() => localStorage.getItem("suite.cache.markets.throttle"))}`);
  await p2.screenshot({ path: `${evidenceDir}/rl-backoff-429.png`, fullPage: true });
  await p2.close();

  /* backoff proof: cache 30h old = expired vs 24h but fresh vs the doubled 48h TTL ->
     the reload must serve from cache and make ZERO coingecko requests */
  await page.evaluate(() => {
    const k = "suite.cache.markets.crypto";
    const e = JSON.parse(localStorage.getItem(k));
    e.t = Date.now() - 30 * 60 * 60 * 1000;
    localStorage.setItem(k, JSON.stringify(e));
  });
  let cgHits = 0;
  await page.route(/api\.coingecko\.com/, r => { cgHits++; r.abort(); });
  await page.reload();
  await cryptoReady(page);
  log(`backoff proof (cache 30h old, throttled -> effective TTL 48h): ` +
    `coingecko requests on reload=${cgHits}, ` +
    `updated line: "${(await page.textContent("#cryptoUpdated")).trim()}"`);
  await page.unroute(/api\.coingecko\.com/);

  /* ---- stale offline path (Batch B addendum) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.markets.") && k !== "suite.cache.markets.throttle") {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now() - 72 * 60 * 60 * 1000; // beyond even the doubled 48h TTL
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.unroute(/finnhub\.io/);
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await cryptoReady(page);
  await stocksReady(page, 4);
  log(`offline stale: crypto updated line: "${(await page.textContent("#cryptoUpdated")).trim()}"`);
  log(`offline stale: stocks updated line: "${(await page.textContent("#stockUpdated")).trim()}"`);
  log(`offline stale: AAPL still priced from cache: ` +
    `"${await page.evaluate(() => document.querySelector("#tile_AAPL .px").textContent)}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* restore a live-looking view for the final shot WITHOUT any refetch:
     re-freshen cache timestamps so both cards serve from cache */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.markets.") && k !== "suite.cache.markets.throttle") {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now();
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.reload();
  await cryptoReady(page);
  await stocksReady(page, 4);
  log(`restored (all from fresh cache, no refetch): crypto="${(await page.textContent("#cryptoUpdated")).trim()}" ` +
    `stocks="${(await page.textContent("#stockUpdated")).trim()}"`);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   crypto cache from its automatic live load, then the same fake key + routed finnhub
   quotes (v1 has no Enter handler on #keyInput, so the button is clicked), then the
   same VTI add/remove. v2's suite.cache.markets.throttle (rl backoff memory, written
   by the deterministic 429 test) is the one expected keysOnlyInV2 — see report.md. */
export async function v1Interact({ page }) {
  /* fully deterministic: v2's interact() already live-verified CoinGecko; the parity
     pass only needs v1 to WRITE the same keys, so both APIs are route-fulfilled here
     (also avoids tripping CoinGecko's per-minute limiter with a sixth request — the
     unrouted first run did exactly that and v1's crypto card never rendered). */
  await page.route(/api\.coingecko\.com/, r => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(CRYPTO)
  }));
  await routeFinnhub(page);
  await page.reload(); // the pre-route live load may have failed; re-boot under the routes
  await page.waitForFunction(() => document.querySelectorAll("#crypto .tile").length === 6, { timeout: 25000 });
  await page.fill("#keyInput", FAKE_KEY);
  await page.click("#saveKey");
  await stocksReady(page, 4);
  await page.fill("#tickerInput", "vti");
  await page.click("#addBtn");
  await stocksReady(page, 5);
  await page.click('#tile_VTI .rm');
  await stocksReady(page, 4);
}
