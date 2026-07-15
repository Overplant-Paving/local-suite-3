/* tests/interactions/wildfire.mjs — Wildfire Watchboard (Batch B, CORS-open fetcher)
   Live source 1: WFIGS Incident Locations Current (services3.arcgis.com, one real query).
   Live source 2: zippopotam.us ZIP lookup (one real request, first-run setup path).
   Location is then seeded to the exact shared LA spot (addendum) — July in California,
   so real incidents are expected within the default 250 km radius.
   Stale-cache offline path per the Batch B addendum: age the cache 24 h, abort all
   http(s) routes, reload, verify the cached rows + offline stamp render. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".setup", ".setup input", ".btn.primary", ".btn.ghost", ".err-inline", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

async function seedLocation(page) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForSelector("#list .fire, #list .msg", { timeout: 25000 });
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
  log(`first-run setup card visible: ${await page.locator(".setup").isVisible()}`);

  /* ---- live source 2: zippopotam.us ZIP lookup (one real request) ---- */
  await page.fill("#zip", "90012");
  await page.click("#zipBtn");
  await page.waitForSelector("#list .fire, #list .msg", { timeout: 25000 });
  log(`ZIP 90012 lookup -> locbar: "${(await page.locator("#locLabel").innerText()).trim()}", ` +
    `suite.location = ${await page.evaluate(() => localStorage.getItem("suite.location"))}`);

  /* ---- live source 1: seed the exact shared LA location (addendum), reload;
     the WFIGS query re-runs or serves the minutes-old cache within TTL ---- */
  await seedLocation(page);
  log(`locbar label after seed: "${(await page.locator("#locLabel").innerText()).trim()}"`);

  const feed = await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("suite.cache.wildfire.all"));
    const f = e && e.v && e.v.features || [];
    const sample = f.length ? {
      name: f[0].properties.IncidentName, size: f[0].properties.IncidentSize,
      contained: f[0].properties.PercentContained, state: f[0].properties.POOState
    } : null;
    return { count: f.length, cachedAt: e && new Date(e.t).toISOString(), sample };
  });
  log(`live WFIGS query: ${feed.count} incidents in cache envelope (cached at ${feed.cachedAt})`);
  log(`sample incident: "${feed.sample && feed.sample.name}" — ${feed.sample && feed.sample.size} acres, ` +
    `${feed.sample && feed.sample.contained}% contained, state ${feed.sample && feed.sample.state}`);

  for (const s of await statTexts(page)) log(`stat: ${s}`);
  log(`stamp: "${(await page.locator("#stamp").innerText()).trim()}"`);
  const cards = await page.locator("#list .fire").count();
  log(`fire cards rendered: ${cards}`);
  if (cards) {
    log(`first card (nearest): "${(await page.locator("#list .fire").first().innerText()).replace(/\s+/g, " ").trim()}"`);
    /* distance computation: card distances must ascend under "Nearest first" and sit within the radius */
    const dists = await page.locator("#list .fire .dist b").allInnerTexts();
    const nums = dists.map(Number);
    log(`distances (km, nearest-first sort): [${nums.slice(0, 8).join(", ")}${nums.length > 8 ? ", …" : ""}]`);
    log(`distances ascending: ${nums.every((d, i) => i === 0 || d >= nums[i - 1])}, all <= radius 250: ${nums.every(d => d <= 250)}`);
  } else {
    log(`no cards — calm state: "${(await page.locator("#list .msg").innerText()).replace(/\s+/g, " ").trim()}"`);
  }

  /* ---- radius slider (client-side filter, no refetch) ---- */
  await setRange(page, "#rad", "800");
  log(`radius label after slider -> 800: "${(await page.locator("#radVal").innerText()).trim()}"`);
  const wide = await statTexts(page);
  log(`after radius 800 km: stats [${wide.join(" | ")}]; cards = ${await page.locator("#list .fire").count()}`);

  /* ---- sort select ---- */
  await page.selectOption("#sortSel", "size");
  const acres = (await page.locator("#list .fire .fact .acres").allInnerTexts()).map(s => parseFloat(s.replace(/,/g, "")) || 0);
  log(`sort "Largest first": top acres [${acres.slice(0, 5).join(", ")}]; descending: ${acres.every((a, i) => i === 0 || a <= acres[i - 1])}`);
  await page.selectOption("#sortSel", "new");
  log(`sort "Newest first": first card sub "${cards ? (await page.locator("#list .fire .sub").first().innerText()).trim() : "(no cards)"}"`);
  await page.selectOption("#sortSel", "dist");

  /* persisted controls */
  log(`persisted: radius=${await page.evaluate(() => localStorage.getItem("suite.wildfire.radius"))}, ` +
    `sort=${await page.evaluate(() => localStorage.getItem("suite.wildfire.sort"))}`);

  /* restore the default radius before the offline pass */
  await setRange(page, "#rad", "250");

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
  await page.waitForSelector("#list .fire, #list .msg", { timeout: 25000 });
  await page.waitForSelector("#stamp.err", { timeout: 25000 });
  log(`offline stale stamp: "${(await page.locator("#stamp").innerText()).trim()}"`);
  log(`offline: ${await page.locator("#list .fire").count()} cached fire cards still render`);
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   seeded location -> live WFIGS fetch -> suite.cache.wildfire.all; slider + sort writes. */
export async function v1Interact({ page }) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForSelector("#list .fire, #list .msg", { timeout: 25000 });
  for (const v of ["800", "250"]) {
    await page.evaluate(v => {
      const el = document.querySelector("#rad");
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, v);
  }
  /* sort key parity: change with the network blocked so v1 makes no extra live request */
  await page.context().route(/^https?:/, r => r.abort());
  await page.selectOption("#sortSel", "size");
  await page.waitForTimeout(300);
  await page.selectOption("#sortSel", "dist");
  await page.waitForTimeout(300);
  await page.context().unroute(/^https?:/);
}
