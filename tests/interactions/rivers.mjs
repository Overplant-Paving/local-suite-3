/* tests/interactions/rivers.mjs — River & Streamflow Gauges (Batch B, CORS-open fetcher)
   Live source: NEW USGS Water Data API (api.waterdata.usgs.gov/ogcapi/v0) —
   latest-continuous + monitoring-locations for nearby, latest-continuous by id for
   favorites. ZIP setup path hits api.zippopotam.us live once.
   Stale-cache offline path per the Batch B addendum: age caches 24 h, abort all
   http(s) routes, reload, verify the cached rows + "connection issue" stamp render. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".setup", ".setup input", ".btn.primary", ".btn.ghost", ".err-inline", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

const waitForBoard = page =>
  page.waitForSelector("#nearSec .gauge, #nearSec .msg", { timeout: 30000 });

export async function interact({ page, log, evidenceDir }) {
  /* fresh open (no location) shows the first-run setup card */
  log(`first-run setup card visible: ${await page.locator(".setup").isVisible()}`);

  /* ---- live source 2: zippopotam.us ZIP lookup (one real request) ---- */
  await page.fill("#zip", "90012");
  await page.click("#zipBtn");
  await waitForBoard(page);
  log(`ZIP 90012 lookup -> locbar: "${(await page.locator(".locbar").innerText()).replace(/\s+/g, " ").trim()}", ` +
    `suite.location = ${await page.evaluate(() => localStorage.getItem("suite.location"))}`);

  /* ---- live source 1: seed the exact shared LA location (addendum), reload,
     latest-continuous + monitoring-locations render nearby gauges ---- */
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await waitForBoard(page);
  log(`locbar after LA seed: "${(await page.locator(".locbar").innerText()).replace(/\s+/g, " ").trim()}"`);
  log(`stamp: "${(await page.locator("#stamp").innerText()).trim()}"`);
  log(`section header: "${(await page.locator("#nearSec h2.sec").innerText()).replace(/\s+/g, " ").trim()}"`);

  const nGauges = await page.locator("#nearSec .gauge").count();
  log(`nearby gauge cards rendered: ${nGauges} (render caps at 60)`);
  if (nGauges) {
    const first = page.locator("#nearSec .gauge").first();
    log(`first gauge name: "${(await first.locator("h3").innerText()).trim()}"`);
    log(`first gauge sub: "${(await first.locator(".g-sub").innerText()).trim()}"`);
    for (const r of await first.locator(".reading").allInnerTexts())
      log(`first gauge reading: "${r.replace(/\s+/g, " ").trim()}"`);
    log(`first gauge read-time: "${(await first.locator(".g-time").innerText()).trim()}"`);
    log(`gauge links to waterdata.usgs.gov page: ${await first.locator("h3 a").getAttribute("href")}`);
  }
  log(`flood-stage context note: "${(await page.locator(".note").innerText()).replace(/\s+/g, " ").trim().slice(0, 120)}…"`);

  const near = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith("suite.cache.rivers.near_"));
    const e = k && JSON.parse(localStorage.getItem(k));
    return k ? { key: k, count: e.v.length, cachedAt: new Date(e.t).toISOString() } : null;
  });
  log(`nearby cache envelope: ${near && near.key} — ${near && near.count} gauges (cached at ${near && near.cachedAt})`);

  /* ---- favorites: star the first gauge, reload -> live per-favorite fetch ---- */
  if (nGauges) {
    await page.locator("#nearSec .gauge .starbtn").first().click();
    await page.waitForSelector("#favSec .gauge", { timeout: 10000 });
    log(`after star: favorites header "${(await page.locator("#favSec h2.sec").innerText()).replace(/\s+/g, " ").trim()}", ` +
      `placeholder card time: "${(await page.locator("#favSec .gauge .g-time").first().innerText()).trim()}"`);
    log(`star aria-pressed: ${await page.locator("#favSec .gauge .starbtn").first().getAttribute("aria-pressed")}`);
    log(`suite.rivers.favs = ${await page.evaluate(() => localStorage.getItem("suite.rivers.favs"))}`);

    await page.reload();
    await waitForBoard(page);
    await page.waitForSelector("#favSec .gauge", { timeout: 30000 });
    /* the favorites fetch is done once its policy-added cache envelope lands */
    await page.waitForFunction(() =>
      Object.keys(localStorage).some(k => k.startsWith("suite.cache.rivers.fav_")), { timeout: 30000 });
    await page.waitForTimeout(400); // let the re-render settle
    const fav = page.locator("#favSec .gauge").first();
    log(`favorite after reload (live by-id fetch): name "${(await fav.locator("h3").innerText()).trim()}"`);
    for (const r of await fav.locator(".reading").allInnerTexts())
      log(`favorite reading: "${r.replace(/\s+/g, " ").trim()}"`);
    log(`favorite read-time: "${(await fav.locator(".g-time").innerText()).trim()}"`);
    const favCache = await page.evaluate(() => {
      const k = Object.keys(localStorage).find(x => x.startsWith("suite.cache.rivers.fav_"));
      const e = k && JSON.parse(localStorage.getItem(k));
      return k ? { key: k, features: e.v.features.length, cachedAt: new Date(e.t).toISOString() } : null;
    });
    log(`favorite cache envelope (policy-added): ${favCache && favCache.key} — ` +
      `${favCache && favCache.features} features (cached at ${favCache && favCache.cachedAt})`);
  }

  /* ---- stale-cache offline path (Batch B addendum) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await waitForBoard(page);
  await page.waitForSelector("#stamp.err", { timeout: 30000 });
  log(`offline stale stamp: "${(await page.locator("#stamp").innerText()).trim()}"`);
  log(`offline: nearby still renders ${await page.locator("#nearSec .gauge").count()} cached cards`);
  if (await page.locator("#favSec .gauge").count()) {
    await page.waitForTimeout(800);
    log(`offline favorite card time: "${(await page.locator("#favSec .gauge .g-time").first().innerText()).trim()}" ` +
      `(stale cache served; ">3 h" amber marker expected)`);
  }
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   ZIP boot (near_34.06 cache) -> LA seed (near_34.05 cache) -> star first gauge
   (suite.rivers.favs) -> reload (v1 fetches favorites live but does NOT cache them —
   the suite.cache.rivers.fav_* key is v2's policy-added cache, explained in report.md).

   HARNESS ACCOMMODATION (documented in report.md concerns): the OGC API now rejects
   v1's "&application=local-suite" query param with HTTP 400 (verified 2026-07-15), so
   unmodified v1 can no longer fetch or write its cache keys at all. The route below
   strips ONLY that param so v1's real fetch/group/cache code runs against the live
   API — reproducing the key set a v1 user acquired before the API-side change. */
export async function v1Interact({ page }) {
  await page.context().route(/api\.waterdata\.usgs\.gov/, r =>
    r.continue({ url: r.request().url().replace("&application=local-suite", "") }));
  await page.fill("#zip", "90012");
  await page.click("#zipBtn");
  await page.waitForSelector("#nearSec .gauge, #nearSec .msg", { timeout: 30000 });
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForSelector("#nearSec .gauge, #nearSec .msg", { timeout: 30000 });
  if (await page.locator("#nearSec .gauge").count()) {
    await page.locator("#nearSec .gauge .starbtn").first().click();
    await page.reload();
    await page.waitForSelector("#nearSec .gauge, #nearSec .msg", { timeout: 30000 });
    await page.waitForTimeout(1500);
  }
  await page.context().unroute(/api\.waterdata\.usgs\.gov/);
}
