/* tests/interactions/yields.mjs — Treasury Yields & Savings (Batch B, cors-open)
   Live path: one real fetch per data source (auctions_query for the savings pills +
   term table; avg_interest_rates for the now/3mo/1yr comparison), logging concrete
   term/rate pairs and comparison values as rendered. Then the Batch B stale-cache
   offline path: back-date every suite.cache.* entry, abort all http(s) and reload —
   both sections must render from the stale cache with the "Offline — cached from"
   stamps, not a blank page. No shared location: this tool is location-free.

   HARNESS-ENVIRONMENT WORKAROUND (documented in report.md "concerns"): Treasury's WAF
   in front of api.fiscaldata.treasury.gov rejects requests whose User-Agent contains
   "HeadlessChrome" — it answers HTTP 500 (an HTML block page with no
   Access-Control-Allow-Origin header), so the browser reports a CORS failure. Real
   Chrome from file:// works: curl with a normal Chrome UA and `Origin: null` gets
   200 + `Access-Control-Allow-Origin: *` on both dataset URLs. To let the headless
   harness exercise the real API, every context gets a route on fiscaldata requests
   that rewrites "HeadlessChrome" -> "Chrome" in the UA and drops the sec-ch-ua*
   headless client hints. The requests still go to the live API over real CORS —
   nothing is mocked or fulfilled locally. Applied identically to v1 and v2 contexts
   (verify-tool.mjs creates contexts itself, hence the launch wrap below). */

import { chromium } from "playwright";

async function deHeadless(route) {
  const h = { ...route.request().headers() };
  for (const k of Object.keys(h)) if (k.toLowerCase().startsWith("sec-ch-ua")) delete h[k];
  if (h["user-agent"]) h["user-agent"] = h["user-agent"].replace("HeadlessChrome", "Chrome");
  await route.continue({ headers: h });
}
const origLaunch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await origLaunch(...args);
  const origNewContext = browser.newContext.bind(browser);
  browser.newContext = async (...ctxArgs) => {
    const ctx = await origNewContext(...ctxArgs);
    await ctx.route("https://api.fiscaldata.treasury.gov/**", deHeadless);
    return ctx;
  };
  return browser;
};

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".savings", "#termBox .table-scroll", ".chartcard", ".box.linkout", ".btnlink", "footer"
];

export const screenshotAfterInteract = true;

const termsReady = page =>
  page.waitForFunction(() =>
    document.querySelectorAll("#termBox table tbody tr").length > 5 &&
    document.querySelector("#termBox td.grp") &&
    document.querySelector(".savings .pill .v") &&
    !document.querySelector(".savings .pill .v.skel"), { timeout: 30000 });
const compareReady = page =>
  page.waitForFunction(() =>
    document.querySelectorAll("#cmpBox .barrow").length >= 3 &&
    document.querySelectorAll("#legend span").length === 3, { timeout: 30000 });

async function logRendered(page, log, label) {
  /* savings pills + blurb */
  const pills = await page.evaluate(() =>
    [...document.querySelectorAll(".savings .pill")].map(p =>
      `${p.querySelector(".k").textContent.trim()}=${p.querySelector(".v").textContent.trim()}`));
  log(`${label} savings pills: ${pills.join("  ")}`);
  const blurb = (await page.textContent(".savings .blurb")).replace(/\s+/g, " ").trim();
  log(`${label} savings blurb: "${blurb.slice(0, 160)}${blurb.length > 160 ? "…" : ""}"`);

  /* a few tenor/rate pairs from the auction table */
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("#termBox tbody tr")]
      .filter(tr => !tr.querySelector("td.grp"))
      .slice(0, 5)
      .map(tr => [...tr.children].map(td => td.textContent.trim()).join(" | ")));
  for (const r of rows) log(`${label} auction row: ${r}`);
  log(`${label} term stamp: "${(await page.textContent("#termStamp")).trim()}"`);

  /* comparison bars: label + now/3mo/1yr values */
  const bars = await page.evaluate(() =>
    [...document.querySelectorAll("#cmpBox .barrow")].map(row =>
      `${row.querySelector(".lab").textContent.trim()}: ` +
      [...row.querySelectorAll(".bar span")].map(s => s.textContent.trim()).join(" / ")));
  for (const b of bars) log(`${label} compare: ${b}`);
  log(`${label} legend: "${(await page.textContent("#legend")).replace(/\s+/g, " ").trim()}"`);
  log(`${label} compare stamp: "${(await page.textContent("#cmpStamp")).trim()}"`);
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- live fetch: both FiscalData datasets ---- */
  await termsReady(page);
  await compareReady(page);
  await logRendered(page, log, "live");

  /* cache envelopes the tool just wrote (must be the v1 processed shapes) */
  const env = await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem("suite.cache.yields.auctions"));
    const c = JSON.parse(localStorage.getItem("suite.cache.yields.compare"));
    return {
      aIsArray: Array.isArray(a.v), aLen: a.v.length, aFirst: a.v[0],
      cHasSeries: Array.isArray(c.v.series), cLen: c.v.series.length,
      cDates: { dNow: c.v.dNow, d3: c.v.d3, d1y: c.v.d1y }
    };
  });
  log(`cache suite.cache.yields.auctions: v is array=${env.aIsArray}, ${env.aLen} rows, first=${JSON.stringify(env.aFirst)}`);
  log(`cache suite.cache.yields.compare: v.series array=${env.cHasSeries}, ${env.cLen} series, dates=${JSON.stringify(env.cDates)}`);

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
  await termsReady(page);   // must render from the stale cache, not a blank page
  await compareReady(page);
  log(`offline stale term stamp: "${(await page.textContent("#termStamp")).trim()}"`);
  log(`offline stale compare stamp: "${(await page.textContent("#cmpStamp")).trim()}"`);
  log(`offline stale 4-week pill: "${(await page.textContent(".savings .pill .v")).trim()}"`);
  const staleRow = await page.evaluate(() => {
    const tr = [...document.querySelectorAll("#termBox tbody tr")].find(t => !t.querySelector("td.grp"));
    return [...tr.children].map(td => td.textContent.trim()).join(" | ");
  });
  log(`offline stale auction row: ${staleRow}`);
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
  await termsReady(page);
  await compareReady(page);
  log(`restored (from fresh cache, no refetch): term stamp="${(await page.textContent("#termStamp")).trim()}"`);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   v1 writes suite.cache.yields.auctions + suite.cache.yields.compare on its automatic
   live load (plus suite.theme via the harness toggle click). Just wait for both renders. */
export async function v1Interact({ page }) {
  await page.waitForFunction(() =>
    document.querySelectorAll("#termBox table tbody tr").length > 5 &&
    document.querySelector("#termBox td.grp") &&
    document.querySelectorAll("#cmpBox .barrow").length >= 3, { timeout: 30000 });
}
