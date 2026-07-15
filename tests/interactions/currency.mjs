/* tests/interactions/currency.mjs — Exchange Rate Board (Batch B, cors-open)
   Live path: one real fetch of the latest board (api.frankfurter.dev), the converter
   exercised with a known amount (expected = amount x rate read from the cache the tool
   just wrote), one trend fetch for a second currency (GBP) via a board click.
   Then the Batch B stale-cache offline path: back-date every suite.cache.* entry,
   abort all http(s) and reload — the board must render the stale card, not a blank. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  "#status", ".card", ".card h2", "#convResult", "svg.chart", "footer"
];

export const screenshotAfterInteract = true;

const boardReady = page =>
  page.waitForFunction(() => document.querySelectorAll("#board .fx").length === 12, { timeout: 25000 });
const trendReady = page =>
  page.waitForFunction(() => document.querySelectorAll("#chart path").length >= 2 ||
    document.querySelector("#trendErr .errbox"), { timeout: 25000 });

export async function interact({ page, log, evidenceDir }) {
  /* ---- live fetch: latest rates board ---- */
  await boardReady(page);
  await trendReady(page);
  log(`status line: "${(await page.textContent("#status")).trim()}"`);
  for (const code of ["EUR", "GBP", "JPY"]) {
    const rate = (await page.textContent(`#board .fx[data-code="${code}"] .rate`)).trim();
    log(`board rate ${code}: ${rate} per 1 USD`);
  }

  /* ---- converter with a known amount: expected = amount x rate ---- */
  const cached = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("suite.cache.currency.latest")));
  const rEUR = cached.v.rates.EUR;
  log(`cached envelope: source=${cached.v.source} date=${cached.v.date} rates.EUR=${rEUR}`);
  await page.fill("#amt", "250");
  await page.dispatchEvent("#amt", "input");
  const expected = (250 * rEUR).toLocaleString(undefined, { maximumFractionDigits: 2 });
  log(`converter: 250 USD -> EUR, expected 250 x ${rEUR} = ${expected} EUR`);
  log(`  observed #convResult = "${(await page.textContent("#convResult")).replace(/\s+/g, " ").trim()}"`);

  /* swap: EUR -> USD, expected 250 / rate */
  await page.click("#swapBtn");
  const expSwap = (250 / rEUR).toLocaleString(undefined, { maximumFractionDigits: 2 });
  log(`swap: 250 EUR -> USD, expected 250 / ${rEUR} = ${expSwap} USD`);
  log(`  observed #convResult = "${(await page.textContent("#convResult")).replace(/\s+/g, " ").trim()}"`);

  /* ---- 30-day trend: initial EUR trend already fetched; click GBP for a second one ---- */
  log(`trend (EUR, initial): title="${(await page.textContent("#trendTitle")).trim()}" note="${(await page.textContent("#trendNote")).trim()}"`);
  await page.click('#board .fx[data-code="GBP"]');
  await page.waitForFunction(() =>
    document.getElementById("trendTitle").textContent.startsWith("GBP") &&
    document.getElementById("trendNote").textContent !== "loading…", { timeout: 25000 });
  const chartNodes = await page.evaluate(() => ({
    paths: document.querySelectorAll("#chart path").length,
    gridlines: document.querySelectorAll("#chart line").length,
    labels: document.querySelectorAll("#chart text").length
  }));
  log(`trend (GBP, after board click): title="${(await page.textContent("#trendTitle")).trim()}" note="${(await page.textContent("#trendNote")).trim()}"`);
  log(`  chart svg children: ${chartNodes.paths} paths, ${chartNodes.gridlines} gridlines, ${chartNodes.labels} text labels`);
  log(`  GBP card selected: aria-pressed=${await page.getAttribute('#board .fx[data-code="GBP"]', "aria-pressed")}`);

  /* ---- stale-cache offline path (Batch B addendum) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now() - 24 * 60 * 60 * 1000;
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await boardReady(page);   // board must render from the stale cache, not a blank page
  await trendReady(page);
  log(`offline stale status: "${(await page.textContent("#status")).trim()}"`);
  log(`offline stale board EUR: "${(await page.textContent('#board .fx[data-code="EUR"] .rate')).trim()}" per 1 USD`);
  log(`offline stale trend note: "${(await page.textContent("#trendErr")).trim()}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* restore a live-looking view for the after-interaction shot WITHOUT a second live
     fetch: re-freshen the cache timestamps so the reload serves from cache */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now();
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.reload();
  await boardReady(page);
  await trendReady(page);
  log(`restored (from fresh cache, no refetch): status="${(await page.textContent("#status")).trim()}"`);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets.
   v1 writes suite.cache.currency.latest on its automatic live load (plus suite.theme
   via the harness toggle click). The v2-only suite.cache.currency.trend.* keys are the
   policy-mandated trend cache (API-AND-RELAY.md §2) — explained in report.md. */
export async function v1Interact({ page }) {
  await page.waitForFunction(() =>
    document.querySelectorAll("#board .fx").length === 12, { timeout: 25000 });
}
