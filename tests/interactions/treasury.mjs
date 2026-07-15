/* tests/interactions/treasury.mjs — Treasury & Debt Dashboard (Batch B, cors-open)
   Live path: three real FiscalData fetches on load (debt-to-the-penny latest + 1-year
   series, average interest rates, recent auctions) — log the actual rendered debt
   figure, per-person/household derivations, rates rows, auction rows, and the cache
   envelopes written. Then the Batch B stale-cache offline path: back-date every
   suite.cache.* entry, abort all http(s), reload — all three sections must render
   from the stale cache with the "Offline — showing cached data" stamp, not a blank.

   TEST-ENVIRONMENT ACCOMMODATION (documented in report.md "concerns"): FiscalData's
   front-end returns HTTP 500 (without CORS headers) to any request whose User-Agent
   contains the literal string "HeadlessChrome". The API is otherwise open to every
   client — curl's default UA gets 200 + Access-Control-Allow-Origin: * — so this is
   an artifact of the harness browser, not of real use. To make the harness run match
   what a real browser sends, we set a real Chrome UA on every context the harness
   creates (wrapping chromium.launch at import time; verify-tool.mjs itself is
   untouched). This applies equally to the v1 and v2 passes. */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const REAL_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const realLaunch = chromium.launch.bind(chromium);
chromium.launch = async function (opts) {
  const browser = await realLaunch(opts);
  const realNewContext = browser.newContext.bind(browser);
  browser.newContext = (o = {}) => realNewContext({ userAgent: REAL_CHROME_UA, ...o });
  return browser;
};

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  "#hero", ".hero .lbl", "section h2", "section .note", ".stamp", "footer"
];

export const screenshotAfterInteract = true;

const debtReady = page =>
  page.waitForFunction(() => {
    const d = document.querySelector("#hero .debt");
    return (d && !d.classList.contains("skel") && d.textContent.trim().startsWith("$")) ||
      !!document.querySelector("#hero .errcard");
  }, { timeout: 30000 });
const ratesReady = page =>
  page.waitForFunction(() =>
    document.querySelectorAll("#ratesBox tbody tr td.rate").length > 0 ||
    document.querySelector("#ratesBox .errcard"), { timeout: 30000 });
const auctionsReady = page =>
  page.waitForFunction(() =>
    document.querySelectorAll("#auctionsBox tbody tr td.rate").length > 0 ||
    document.querySelector("#auctionsBox .errcard"), { timeout: 30000 });

async function logSections(page, log, tag) {
  const debt = (await page.textContent("#hero .debt")).trim();
  const asof = (await page.textContent("#hero .asof")).replace(/\s+/g, " ").trim();
  log(`${tag} debt figure rendered: ${debt} (${asof})`);
  const pcs = await page.$$eval("#hero .pc", els =>
    els.map(e => `${e.querySelector(".v").textContent.trim()} ${e.querySelector(".k").textContent.trim()}`));
  log(`${tag} per-citizen figures: ${pcs.join(" · ")}`);
  const spark = await page.evaluate(() => ({
    paths: document.querySelectorAll("#hero .spark svg path").length,
    meta: (document.querySelector("#hero .sparkmeta") || { textContent: "" }).textContent.replace(/\s+/g, " ").trim()
  }));
  log(`${tag} sparkline: ${spark.paths} svg paths; meta: "${spark.meta}"`);
  log(`${tag} hero stamp: "${(await page.textContent("#hero .stamp")).trim()}"`);

  const rateRows = await page.$$eval("#ratesBox tbody tr", trs =>
    trs.map(tr => Array.from(tr.children).map(td => td.textContent.trim()).join(" | ")));
  log(`${tag} rates table: ${rateRows.length} rows; first: "${rateRows[0]}"; last: "${rateRows[rateRows.length - 1]}"`);
  log(`${tag} rates stamp: "${(await page.textContent("#ratesStamp")).trim()}"`);

  const aucRows = await page.$$eval("#auctionsBox tbody tr", trs =>
    trs.map(tr => Array.from(tr.children).map(td => td.textContent.replace(/\s+/g, " ").trim()).join(" | ")));
  log(`${tag} auctions table: ${aucRows.length} rows; first: "${aucRows[0]}"`);
  log(`${tag} auctions stamp: "${(await page.textContent("#auctionsStamp")).trim()}"`);
}

async function allReady(page) {
  await debtReady(page);
  await ratesReady(page);
  await auctionsReady(page);
  return page.evaluate(() => ({
    hero: !!document.querySelector("#hero .errcard"),
    rates: !!document.querySelector("#ratesBox .errcard"),
    auctions: !!document.querySelector("#auctionsBox .errcard")
  }));
}

export async function interact({ page, log, evidenceDir }) {
  /* diagnostics on failure: the harness only writes interaction.txt when interact
     resolves, so capture console + section state ourselves for the failure case */
  const consoleLines = [];
  page.on("console", m => { if (m.type() === "error") consoleLines.push(m.text().slice(0, 250)); });

  /* ---- live fetch: all three FiscalData sources ---- */
  let errs = await allReady(page);
  if (errs.hero || errs.rates || errs.auctions) {
    /* FiscalData's WAF intermittently 500s under the harness's burst of page loads
       (see report.md concerns). One polite retry after a pause — not a hammer loop. */
    log(`live load hit error card(s) ${JSON.stringify(errs)} — one retry after 5 s pause`);
    await page.waitForTimeout(5000);
    await page.reload();
    errs = await allReady(page);
    if (errs.hero || errs.rates || errs.auctions) {
      const dump = await page.evaluate(() => ({
        hero: document.getElementById("hero").innerHTML,
        rates: document.getElementById("ratesBox").innerHTML,
        auctions: document.getElementById("auctionsBox").innerHTML
      }));
      writeFileSync(join(evidenceDir, "live-fail.txt"),
        "live fetch failed after one retry\nsections in error: " + JSON.stringify(errs) +
        "\n\nconsole errors:\n" + consoleLines.join("\n") +
        "\n\nhero:\n" + dump.hero + "\n\nrates:\n" + dump.rates + "\n\nauctions:\n" + dump.auctions + "\n");
      throw new Error("treasury live fetch failed after retry — see evidence/treasury/live-fail.txt");
    }
  }
  await logSections(page, log, "live");

  /* cache envelopes the tool just wrote (v1 keys, v1 processed value shapes) */
  const env = await page.evaluate(() => {
    const out = {};
    for (const k of ["latest", "series", "rates", "auctions"]) {
      const raw = localStorage.getItem("suite.cache.treasury." + k);
      if (!raw) { out[k] = null; continue; }
      const e = JSON.parse(raw);
      out[k] = {
        t: e.t,
        shape: Array.isArray(e.v) ? `array[${e.v.length}]` : Object.keys(e.v).join(","),
        sample: Array.isArray(e.v) ? JSON.stringify(e.v[0]).slice(0, 120) : JSON.stringify(e.v).slice(0, 120)
      };
    }
    return out;
  });
  for (const [k, v] of Object.entries(env))
    log(`cache suite.cache.treasury.${k}: ${v ? `shape=${v.shape} sample=${v.sample}` : "MISSING"}`);

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
  await debtReady(page);      // must render from the stale cache, not a blank page
  await ratesReady(page);
  await auctionsReady(page);
  await logSections(page, log, "offline-stale");
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
  await debtReady(page);
  await ratesReady(page);
  await auctionsReady(page);
  log(`restored (from fresh cache, no refetch): debt = ${(await page.textContent("#hero .debt")).trim()}`);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   v1 writes suite.cache.treasury.{latest,series,rates,auctions} on its automatic
   live load (plus suite.theme via the harness toggle click). */
export async function v1Interact({ page }) {
  const v1Ready = () => page.waitForFunction(() => {
    const done = document.querySelector("#hero .debt") &&
      !document.querySelector("#hero .debt").classList.contains("skel") &&
      document.querySelector("#hero .debt").textContent.trim().startsWith("$") &&
      document.querySelectorAll("#ratesBox tbody tr td.rate").length > 0 &&
      document.querySelectorAll("#auctionsBox tbody tr td.rate").length > 0;
    return done || !!document.querySelector(".errcard");
  }, { timeout: 30000 });
  await v1Ready();
  if (await page.locator(".errcard").count()) {  // same polite single retry as v2
    await page.waitForTimeout(5000);
    await page.reload();
    await v1Ready();
  }
}
