/* tests/interactions/marine.mjs — Buoy & Marine Conditions (Batch B, CORS-open fetcher)
   Exercises the first-run ZIP flow end-to-end with 90012 (downtown Los Angeles) — which both
   verifies the v1 first-run feature and seeds the standard LA suite.location — then live-verifies
   the Open-Meteo marine fetch (wave height / period / swell / SST) and forecast fetch (wind),
   the nearest-NDBC-buoy link-out, and finally the stale-cache offline path per the Batch B addendum.
   Etiquette: one live exercise per source (zippopotam x1, marine-api x1, api.open-meteo x1);
   the post-"change" reload and the offline reload are both served from cache. */
import { join } from "node:path";

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".firstrun", ".firstrun h2", ".fld input", "#zipBtn", ".btn.ghost", "footer"
];

export const screenshotAfterInteract = true;

export async function interact({ page, log, evidenceDir }) {
  /* ---- first-run card shows when no suite.location exists ---- */
  log(`first-run visible on clean boot: ${await page.isVisible("#firstrun")} · app hidden: ${!await page.isVisible("#app")}`);

  /* ---- ZIP validation (local, no network) ---- */
  await page.fill("#zipIn", "12");
  await page.click("#zipBtn");
  log(`invalid ZIP "12" -> error line: "${(await page.textContent("#frErr")).trim()}"`);

  /* ---- live path: ZIP 90012 -> zippopotam lookup -> marine + wx fetch ---- */
  await page.fill("#zipIn", "90012");
  await page.keyboard.press("Enter"); // Enter submits (a11y path)
  await page.waitForSelector(".hero .tile", { timeout: 30000 });

  log(`location label: "${(await page.textContent("#locLabel")).trim()}"`);
  log(`suite.location: ${await page.evaluate(() => localStorage.getItem("suite.location"))}`);
  log(`status dot class: "${await page.getAttribute("#statusDot", "class")}" · updated: "${(await page.textContent("#updated")).trim()}"`);

  const tiles = await page.$$eval(".hero .tile", els =>
    els.map(t => t.textContent.replace(/\s+/g, " ").trim()));
  tiles.forEach((t, i) => log(`tile[${i}]: "${t}"`));

  const chart = await page.evaluate(() => {
    const s = document.getElementById("waveChart");
    return s ? { paths: s.querySelectorAll("path").length, lines: s.querySelectorAll("line").length,
                 texts: s.querySelectorAll("text").length } : null;
  });
  log(`wave chart svg contents: ${JSON.stringify(chart)} (expect 2 paths = area+line, gridlines/dividers/now, axis+day labels)`);

  log(`NDBC link-out card: "${(await page.textContent(".ndbc")).replace(/\s+/g, " ").trim()}"`);
  log(`NDBC link href: ${await page.getAttribute(".ndbc a", "href")} target=${await page.getAttribute(".ndbc a", "target")}`);

  const cacheKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith("suite.cache.marine.")).sort());
  log(`cache keys written: ${JSON.stringify(cacheKeys)}`);

  /* ---- "change" reopens first-run; reload restores the app from fresh cache (no refetch) ---- */
  await page.click("#changeLoc");
  log(`after "change": first-run visible ${await page.isVisible("#firstrun")}, app hidden ${!await page.isVisible("#app")}`);
  await page.reload();
  await page.waitForSelector(".hero .tile", { timeout: 15000 });
  log(`reload with saved location: app restored, updated: "${(await page.textContent("#updated")).trim()}" (fresh-cache read, no new fetch)`);

  /* ---- stale-cache offline path: age caches 24 h, block the network, reload ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector(".hero .tile", { timeout: 30000 });
  log(`OFFLINE reload — status dot class: "${await page.getAttribute("#statusDot", "class")}" (expect "statusdot stale")`);
  log(`OFFLINE reload — updated text: "${(await page.textContent("#updated")).trim()}" (expect "cached <~24h-ago time>")`);
  const staleTiles = await page.$$eval(".hero .tile", els => els.length);
  log(`OFFLINE reload — hero tiles still rendered from cache: ${staleTiles}`);
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare.
   (v1 caches one combined entry per location; v2 caches per request and per ZIP lookup —
   explained in report.md.) */
export async function v1Interact({ page }) {
  await page.fill("#zipIn", "90012");
  await page.click("#zipBtn");
  await page.waitForSelector(".hero .tile", { timeout: 30000 }).catch(() => {});
}
