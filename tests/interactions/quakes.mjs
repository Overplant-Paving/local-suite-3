/* tests/interactions/quakes.mjs — Earthquake Monitor (Batch B, CORS-open fetcher)
   Live source: earthquake.usgs.gov all_day GeoJSON feed (one real fetch).
   Location is seeded (LA) so the first-run setup card is skipped and distance
   filtering is exercisable; the zippopotam.us ZIP path is NOT hit live.
   Stale-cache offline path per the Batch B addendum: age the cache 24 h,
   abort all http(s) routes, reload, verify the cached/offline stamp renders. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".card.setup", ".setup input", ".btn.primary", ".btn.ghost", ".err-inline", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

async function seedLocation(page) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForSelector("#list .q, #list .msg", { timeout: 25000 });
}

async function setRange(page, sel, value) {
  await page.evaluate(({ sel, value }) => {
    const el = document.querySelector(sel);
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, { sel, value });
}

const statTexts = page => page.locator("#stats .stat").allInnerTexts()
  .then(a => a.map(s => s.replace(/\s+/g, " ").trim()));

export async function interact({ page, log, evidenceDir }) {
  /* fresh open (no location) shows the first-run setup card */
  log(`first-run setup card visible: ${await page.locator(".card.setup").isVisible()}`);

  /* ---- live source 2: zippopotam.us ZIP lookup (one real request) ---- */
  await page.fill("#zip", "90012");
  await page.click("#zipBtn");
  await page.waitForSelector("#list .q, #list .msg", { timeout: 25000 });
  log(`ZIP 90012 lookup -> locbar: "${(await page.locator("#locLabel").innerText()).trim()}", ` +
    `suite.location = ${await page.evaluate(() => localStorage.getItem("suite.location"))}`);

  /* ---- live source 1: seed the exact shared LA location (addendum), reload,
     all_day GeoJSON renders (fresh cache from the ZIP boot may be reused within TTL) ---- */
  await seedLocation(page);
  log(`locbar label: "${(await page.locator("#locLabel").innerText()).trim()}"`);

  const feed = await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("suite.cache.quakes.all_day"));
    const f = e && e.v && e.v.features || [];
    const sample = f.length ? {
      mag: f[0].properties.mag, place: f[0].properties.place,
      time: new Date(f[0].properties.time).toISOString()
    } : null;
    return { count: f.length, cachedAt: e && new Date(e.t).toISOString(), sample };
  });
  log(`live all_day feed: ${feed.count} quakes in cache envelope (cached at ${feed.cachedAt})`);
  log(`sample quake: M${feed.sample && feed.sample.mag} — "${feed.sample && feed.sample.place}" at ${feed.sample && feed.sample.time}`);

  for (const s of await statTexts(page)) log(`stat: ${s}`);
  log(`stamp: "${(await page.locator("#stamp").innerText()).trim()}"`);
  const listCount = await page.locator("#list .q").count();
  log(`list rows rendered: ${listCount} (list caps at 250)`);
  log(`first list row: "${(await page.locator("#list .q").first().innerText()).replace(/\s+/g, " ").trim()}"`);

  /* map rendering: dots, home marker, legend */
  log(`map svg present: ${await page.locator("svg.map").count() === 1}`);
  log(`map quake dots: ${await page.locator("svg.map circle.qdot").count()}`);
  log(`home (you) marker parts: ${await page.locator("svg.map .home").count()} (expect 3: 2 lines + circle)`);
  log(`legend swatches: ${await page.locator(".legend .sw").count()} (expect 6 magnitude bands)`);

  /* ---- magnitude filter (client-side, no refetch) ---- */
  const allShown = (await statTexts(page))[0];
  await setRange(page, "#minMag", "4.5");
  log(`minMag label after slider -> 4.5: "${(await page.locator("#minMagVal").innerText()).trim()}"`);
  const magStats = await statTexts(page);
  log(`after minMag 4.5: shown ${magStats[0]} (was ${allShown}); list rows = ${await page.locator("#list .q").count()}`);

  /* ---- distance filter (uses seeded LA via haversine) ---- */
  await setRange(page, "#minMag", "0");
  await setRange(page, "#maxDist", "1000");
  log(`maxDist label after slider -> 1000: "${(await page.locator("#maxDistVal").innerText()).trim()}"`);
  const distStats = await statTexts(page);
  log(`after maxDist 1000 km of LA: shown ${distStats[0]}, nearest ${distStats[2]}; list rows = ${await page.locator("#list .q").count()}`);
  const distRow = await page.locator("#list .q").count()
    ? (await page.locator("#list .q .meta").first().innerText()).trim() : "(no rows)";
  log(`first row meta under distance filter: "${distRow}"`);

  /* combined filters persisted to localStorage */
  log(`persisted filters: feed=${await page.evaluate(() => localStorage.getItem("suite.quakes.feed"))}, ` +
    `minMag=${await page.evaluate(() => localStorage.getItem("suite.quakes.minMag"))}, ` +
    `maxDist=${await page.evaluate(() => localStorage.getItem("suite.quakes.maxDist"))}`);

  /* restore the wide view before the offline pass */
  await setRange(page, "#maxDist", "20000");

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
  await page.waitForSelector("#list .q, #list .msg", { timeout: 25000 });
  await page.waitForSelector("#stamp.err", { timeout: 25000 });
  log(`offline stale stamp: "${(await page.locator("#stamp").innerText()).trim()}"`);
  log(`offline: list still renders ${await page.locator("#list .q").count()} cached rows, ` +
    `map dots ${await page.locator("svg.map circle.qdot").count()}`);
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });

  /* feed switch while offline: 2.5_week has no cache -> v1 behavior is to keep the
     previous feed's rows and surface the connection issue in the stamp */
  await page.selectOption("#feedSel", "2.5_week");
  await page.waitForTimeout(1000);
  log(`offline feed switch to 2.5_week (uncached): stamp "${(await page.locator("#stamp").innerText()).trim()}", ` +
    `rows still ${await page.locator("#list .q").count()}`);
  await page.selectOption("#feedSel", "all_day");
  await page.waitForTimeout(1000);
  log(`back to all_day (cached): rows ${await page.locator("#list .q").count()}, ` +
    `persisted feed = ${await page.evaluate(() => localStorage.getItem("suite.quakes.feed"))}`);
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   seeded location -> live all_day fetch -> cache + seen; slider moves -> filter keys. */
export async function v1Interact({ page }) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForSelector("#list .q, #list .msg", { timeout: 25000 });
  for (const [sel, v] of [["#minMag", "4.5"], ["#minMag", "0"], ["#maxDist", "1000"], ["#maxDist", "20000"]]) {
    await page.evaluate(({ sel, v }) => {
      const el = document.querySelector(sel);
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, { sel, v });
  }
  /* feed key parity: switch feeds with the network blocked so v1 makes no extra live request */
  await page.context().route(/^https?:/, r => r.abort());
  await page.selectOption("#feedSel", "2.5_week");
  await page.waitForTimeout(800);
  await page.selectOption("#feedSel", "all_day");
  await page.waitForTimeout(800);
  await page.context().unroute(/^https?:/);
}
