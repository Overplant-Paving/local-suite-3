/* tests/interactions/gas.mjs — Gas Price Tracker (Batch C, keyed: EIA, no demo tier)

   EIA has NO demo tier and no key may be invented (batchC-common), so the live
   API is never contacted in this run. Verified instead, per the batch C policy:
   1. The NO-KEY DESIGNED STATE — the keycard with signup link + paste field is
      what the harness's four capture screenshots show (v1/v2, both themes),
      since no key is seeded. interact() re-asserts it and shoots nokey-state.png.
   2. The PASTE-KEY MECHANICS (suite.key.eia via the tool's own UI) and the full
      RENDER PIPELINE (Suite.fetchJSON -> v1 cache envelope -> hero / compare /
      all-regions / SVG trend chart) against route-fulfilled responses in the
      real EIA v2 payload shape (string values, response.data envelope, desc
      sort), generated deterministically so every rendered number is checked
      against independently computed expectations.
   3. Key-rejection UX (HTTP 403 -> "key rejected" + rekey link -> keycard) in a
      throwaway context so the main page's localStorage stays parity-comparable.
   4. Theme-flip chart redraw (v1 behavior: draw(last) on theme click).
   5. The Batch B stale-cache offline path (aged envelopes + aborted network ->
      "Offline — cached from <time>" on both cards, chart still rendered). */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  "#keycard", "#keycard h2", "#keycard p", "#keyInput", "#saveKey", "footer"
];

export const screenshotAfterInteract = true;

const EIA_RE = /api\.eia\.gov/;
const TEST_KEY = "TESTKEY-LOCAL-HARNESS"; // never sent to the real API — all requests route-fulfilled

/* ---- deterministic EIA v2 payload generator ---- */
const BASE = { NUS: 3.1, R10: 3.2, R20: 2.95, R30: 2.75, R40: 3.3, R50: 4.1 };
const PROD_OFF = { EPMR: 0, EPMM: 0.4, EPMP: 0.8, EPD2D: 0.55 };
const PROD_NAME = { EPMR: "Regular Gasoline", EPMM: "Midgrade Gasoline", EPMP: "Premium Gasoline", EPD2D: "No 2 Diesel" };
const AREA_NAME = { NUS: "U.S.", R10: "PADD 1", R20: "PADD 2", R30: "PADD 3", R40: "PADD 4", R50: "PADD 5" };
const END = Date.UTC(2026, 6, 13); // fixed Monday, deterministic periods

/* i = weeks back from the latest survey week */
const genValue = (area, product, i) =>
  (BASE[area] + PROD_OFF[product] + 0.25 * Math.sin(i / 5) + 0.002 * i).toFixed(3);
const genPeriod = i => new Date(END - i * 7 * 86400000).toISOString().slice(0, 10);
/* what the tool renders for week i back: parseFloat(value).toFixed(3), $-prefixed */
const expectPrice = (area, product, i) => "$" + parseFloat(genValue(area, product, i)).toFixed(3);

function eiaBody(area, product, length) {
  const data = [];
  for (let i = 0; i < length; i++) { // desc order, as requested by sort[0][direction]=desc
    data.push({
      period: genPeriod(i), duoarea: area, "area-name": AREA_NAME[area],
      product, "product-name": PROD_NAME[product],
      process: "PTE", "process-name": "Retail Sales",
      series: `EMM_${product}_PTE_${area}_DPG`,
      "series-description": `${AREA_NAME[area]} ${PROD_NAME[product]} Retail Price`,
      value: genValue(area, product, i), units: "$/GAL"
    });
  }
  return JSON.stringify({
    response: { total: String(length), dateFormat: "YYYY-MM-DD", frequency: "weekly",
      data, description: "Weekly Retail Gasoline and On-Highway Diesel Prices" },
    request: { command: "/v2/petroleum/pri/gnd/data/", params: {} },
    apiVersion: "2.1.8"
  });
}

async function routeEIA(pageOrCtx) {
  await pageOrCtx.route(EIA_RE, route => {
    const u = new URL(route.request().url());
    const area = u.searchParams.get("facets[duoarea][]");
    const product = u.searchParams.get("facets[product][]");
    const length = parseInt(u.searchParams.get("length"), 10) || 60;
    if (!BASE[area] || !(product in PROD_OFF)) return route.abort();
    return route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: eiaBody(area, product, length)
    });
  });
}

const heroReady = page => page.waitForFunction(() => {
  const p = document.querySelector("#dataArea .price");
  return p && /^\$\d/.test(p.textContent.trim());
}, null, { timeout: 15000 });

const regionsReady = page => page.waitForFunction(() => {
  const cells = [...document.querySelectorAll("#compare .v")];
  return cells.length === 6 && cells.every(c => /^\$\d|^—$/.test(c.textContent.trim()));
}, null, { timeout: 15000 });

const txt = async (page, sel) => (await page.locator(sel).innerText()).replace(/\s+/g, " ").trim();

export async function interact({ page, log, evidenceDir }) {
  log(`NOTE: EIA has no demo tier and no real key exists in this environment; every api.eia.gov`);
  log(`NOTE: request in this run is route-fulfilled with deterministic payloads in the real EIA v2`);
  log(`NOTE: shape. The no-key designed state, paste-key mechanics, render pipeline, key-rejection`);
  log(`NOTE: UX, theme redraw, and stale path are what this run proves. No live request was made.`);

  /* ---- 1. no-key designed state ---- */
  log(`no-key state: keycard visible=${await page.locator("#keycard").isVisible()}, ` +
    `mainCard visible=${await page.locator("#mainCard").isVisible()}, ` +
    `natlCard visible=${await page.locator("#natlCard").isVisible()}`);
  log(`keycard copy: "${await txt(page, "#keycard h2")}" / "${await txt(page, "#keycard p")}"`);
  log(`signup link href: ${await page.getAttribute("#keycard a", "href")}`);
  await page.screenshot({ path: join(evidenceDir, "nokey-state.png"), fullPage: true });
  // empty-key guard
  await page.click("#saveKey");
  log(`save with empty field -> keyMsg: "${await txt(page, "#keyMsg")}" (class=${await page.getAttribute("#keyMsg", "class")})`);

  /* ---- 2. paste-key mechanics (Enter path) + route-fulfilled render pipeline ---- */
  await routeEIA(page);
  await page.fill("#keyInput", TEST_KEY);
  await page.press("#keyInput", "Enter"); // a11y: Enter submits the key field
  await heroReady(page);
  await regionsReady(page);
  log(`after key save: keycard visible=${await page.locator("#keycard").isVisible()}, ` +
    `stored suite.key.eia=${await page.evaluate(() => JSON.stringify(localStorage.getItem("suite.key.eia")))}`);

  /* hero + compare, NUS / EPMR — every number checked against the generator */
  const hero = await txt(page, "#dataArea .price");
  log(`hero price: "${hero}" (expected ${expectPrice("NUS", "EPMR", 0)} / gal)`);
  log(`hero meta: "${await txt(page, "#dataArea .meta")}"`);
  const cmps = await page.$$eval("#dataArea .compare .cmp", els =>
    els.map(e => e.querySelector(".k").textContent + " = " + e.querySelector(".v").textContent.trim()));
  const yearIdx = 51; // rows_asc[len-52] with len 60 -> weeks-back index 51
  const yExp = (parseFloat(genValue("NUS", "EPMR", 0)) - parseFloat(genValue("NUS", "EPMR", yearIdx)));
  log(`compare cards: ${cmps.join(" | ")}`);
  log(`  expected: 1 week ago ${expectPrice("NUS", "EPMR", 1)}, ~1 year ago ${expectPrice("NUS", "EPMR", yearIdx)}, ` +
    `1-year change ${(yExp >= 0 ? "+" : "−") + "$" + Math.abs(yExp).toFixed(3)}`);

  /* trend chart */
  const chart = await page.evaluate(() => {
    const s = document.getElementById("chart");
    const line = s.querySelector("path[fill='none']");
    return { paths: s.querySelectorAll("path").length, gridLines: s.querySelectorAll("line").length,
      labels: s.querySelectorAll("text").length, dot: s.querySelectorAll("circle").length,
      stroke: line && line.getAttribute("stroke"),
      role: s.getAttribute("role"), ariaLabel: s.getAttribute("aria-label") };
  });
  log(`trend chart: ${chart.paths} paths (area+line), ${chart.gridLines} grid lines, ${chart.labels} axis labels, ` +
    `${chart.dot} end dot, line stroke=${chart.stroke} (light --accent #2f6f6a), role=${chart.role}, aria-label="${chart.ariaLabel}"`);

  /* all-regions card */
  log(`all-regions sub: "${await txt(page, "#natlSub")}"`);
  for (const a of ["NUS", "R10", "R20", "R30", "R40", "R50"]) {
    const v = await txt(page, `#cmp_${a}`);
    log(`  region ${a}: "${v}" (expected ${expectPrice(a, "EPMR", 0)})`);
  }

  /* cache envelopes: v1 processed shape {t, v:[{period,value,units,name}]} */
  const env = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("suite.cache.gas.")).sort();
    const e = JSON.parse(localStorage.getItem("suite.cache.gas.NUS.EPMR"));
    const lastRow = e.v[e.v.length - 1];
    return { keys, rows: e.v.length, isArray: Array.isArray(e.v),
      sortedAsc: e.v[0].period < lastRow.period, lastRow };
  });
  log(`cache keys: ${env.keys.join(", ")}`);
  log(`envelope suite.cache.gas.NUS.EPMR: v is processed-rows array=${env.isArray}, ${env.rows} rows, asc=${env.sortedAsc}, ` +
    `last={period:${env.lastRow.period}, value:${env.lastRow.value}, units:${env.lastRow.units}, name:"${env.lastRow.name}"} (v1 envelope shape)`);

  /* ---- 3. region + fuel selectors ---- */
  await page.selectOption("#area", "R20");
  await heroReady(page);
  await page.waitForFunction(() => document.querySelector("#dataArea .meta").textContent.includes("Midwest"), null, { timeout: 15000 });
  log(`area -> R20: hero "${await txt(page, "#dataArea .price")}" (expected ${expectPrice("R20", "EPMR", 0)}), meta "${await txt(page, "#dataArea .meta")}"`);

  await page.selectOption("#product", "EPD2D");
  await page.waitForFunction(() => Object.keys(localStorage).filter(k => /^suite\.cache\.gas\..*\.EPD2D$/.test(k)).length === 6, null, { timeout: 15000 });
  await heroReady(page);
  await regionsReady(page);
  log(`product -> EPD2D (diesel): hero "${await txt(page, "#dataArea .price")}" (expected ${expectPrice("R20", "EPD2D", 0)}), ` +
    `all-regions sub "${await txt(page, "#natlSub")}", NUS cell "${await txt(page, "#cmp_NUS")}" (expected ${expectPrice("NUS", "EPD2D", 0)})`);

  /* refresh: busts the 6 current-product caches, refetches through the route */
  const tBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.cache.gas.NUS.EPD2D")).t);
  await page.click("#refreshBtn");
  await page.waitForFunction(t0 => {
    const raw = localStorage.getItem("suite.cache.gas.NUS.EPD2D");
    return raw && JSON.parse(raw).t > t0;
  }, tBefore, { timeout: 15000 });
  await heroReady(page);
  log(`refresh: cache t renewed (${tBefore} -> ${await page.evaluate(() => JSON.parse(localStorage.getItem("suite.cache.gas.NUS.EPD2D")).t)}), hero re-rendered`);

  /* ---- 4. theme flip redraws the chart with the new palette (v1 behavior) ---- */
  const strokeLight = await page.getAttribute("#chart path[fill='none']", "stroke");
  await page.click("#themeBtn"); // Suite.theme toggles first, tool's redraw listener runs second
  await page.waitForFunction(s => {
    const l = document.querySelector("#chart path[fill='none']");
    return l && l.getAttribute("stroke") !== s;
  }, strokeLight, { timeout: 5000 });
  const strokeDark = await page.getAttribute("#chart path[fill='none']", "stroke");
  log(`theme redraw: chart line stroke ${strokeLight} (light) -> ${strokeDark} (dark --accent #6fb5ae) after theme click`);
  // (harness's own theme probe after interact() flips it back to light)

  /* ---- 5. key-rejection UX, throwaway context (keeps main-page localStorage parity-clean) ---- */
  {
    const ctx2 = await page.context().browser().newContext();
    const p2 = await ctx2.newPage();
    await p2.addInitScript(() => {
      try { localStorage.setItem("suite.theme", "light"); localStorage.setItem("suite.key.eia", "BADKEY"); } catch (e) {}
    });
    await p2.route(EIA_RE, r => r.fulfill({
      status: 403, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ error: "invalid api_key - register at https://www.eia.gov/opendata/register.php" })
    }));
    await p2.goto(page.url());
    await p2.waitForSelector("#rekey", { timeout: 15000 });
    log(`key rejected (HTTP 403): "${await txt(p2, "#dataArea .empty")}"`);
    await p2.click("#rekey");
    log(`rekey link: keycard visible=${await p2.locator("#keycard").isVisible()}, mainCard visible=${await p2.locator("#mainCard").isVisible()}`);
    await p2.screenshot({ path: join(evidenceDir, "key-rejected.png"), fullPage: true });
    await ctx2.close();
  }

  /* ---- 5b. generic network-error and empty-data states, throwaway contexts ---- */
  {
    // network down, key set, NO cache -> the v1 "Couldn't reach EIA (...)" card
    const ctx3 = await page.context().browser().newContext();
    const p3 = await ctx3.newPage();
    await p3.addInitScript(() => {
      try { localStorage.setItem("suite.theme", "light"); localStorage.setItem("suite.key.eia", "TESTKEY-LOCAL-HARNESS"); } catch (e) {}
    });
    await p3.route(/^https?:/, r => r.abort());
    await p3.goto(page.url());
    await p3.waitForFunction(() => {
      const e = document.querySelector("#dataArea .empty");
      return e && /Couldn't reach EIA/.test(e.textContent);
    }, null, { timeout: 20000 });
    log(`network error, no cache: "${await txt(p3, "#dataArea .empty")}"`);
    await ctx3.close();

    // 200 with an empty data array -> the v1 "No data returned" empty state
    const ctx4 = await page.context().browser().newContext();
    const p4 = await ctx4.newPage();
    await p4.addInitScript(() => {
      try { localStorage.setItem("suite.theme", "light"); localStorage.setItem("suite.key.eia", "TESTKEY-LOCAL-HARNESS"); } catch (e) {}
    });
    await p4.route(EIA_RE, r => r.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ response: { total: "0", data: [] }, apiVersion: "2.1.8" })
    }));
    await p4.goto(page.url());
    await p4.waitForFunction(() => {
      const e = document.querySelector("#dataArea .empty");
      return e && /No data returned/.test(e.textContent);
    }, null, { timeout: 20000 });
    log(`empty data set: "${await txt(p4, "#dataArea .empty")}"`);
    await ctx4.close();
  }

  /* ---- 6. Batch B stale-cache offline path: age envelopes 25 h, cut network, reload ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 25 * 60 * 60 * 1000; // > the 1440-min TTL
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  // NB: must be a PAGE route — page routes outrank context routes, and the EIA
  // fulfillment route above lives on the page; registered later, this wins.
  await page.route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForFunction(() => {
    const m = document.querySelector("#dataArea .msg");
    return m && /Offline — cached from/.test(m.textContent);
  }, null, { timeout: 15000 });
  await regionsReady(page);
  log(`offline stale reload: hero "${await txt(page, "#dataArea .price")}" still rendered from aged cache`);
  log(`  stale note: "${await txt(page, "#dataArea .msg")}"`);
  await page.waitForFunction(() => /Offline — cached from/.test(document.getElementById("natlMsg").textContent), null, { timeout: 15000 });
  log(`  all-regions stale note: "${await txt(page, "#natlMsg")}", NUS cell "${await txt(page, "#cmp_NUS")}"`);
  log(`  chart still rendered: ${await page.locator("#chart path").count()} paths`);
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.unroute(/^https?:/);

  writeFileSync(join(evidenceDir, "route-payload-sample.json"), eiaBody("NUS", "EPMR", 4));
}

/* Same state-writing actions on v1 (identically route-fulfilled) so localStorage
   key sets compare equal: suite.key.eia + suite.cache.gas.<6 areas>.{EPMR,EPD2D}.
   v1 has no Enter handler on the key input, so the save uses the button. */
export async function v1Interact({ page }) {
  await routeEIA(page);
  await page.fill("#keyInput", TEST_KEY);
  await page.click("#saveKey");
  await page.waitForFunction(() => Object.keys(localStorage).filter(k => /^suite\.cache\.gas\..*\.EPMR$/.test(k)).length === 6, null, { timeout: 15000 });
  await page.selectOption("#area", "R20");
  await page.selectOption("#product", "EPD2D");
  await page.waitForFunction(() => Object.keys(localStorage).filter(k => /^suite\.cache\.gas\..*\.EPD2D$/.test(k)).length === 6, null, { timeout: 15000 });
  await page.waitForFunction(() => {
    const p = document.querySelector("#dataArea .price");
    return p && /^\$\d/.test(p.textContent.trim());
  }, null, { timeout: 15000 });
}
