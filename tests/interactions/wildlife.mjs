/* tests/interactions/wildlife.mjs — Wildlife Sightings Nearby (Batch B, CORS-open fetcher)
   Live source: api.inaturalist.org observations (seeded LA location per the addendum).
   Photo hosts are logged from the rendered <img> elements as manifest img-src evidence.
   The zippopotam.us ZIP path shares weather/quakes' proven code shape and is NOT hit live
   (keeps the request budget minimal and the v1/v2 cache-key sets trivially equal).
   eBird is deliberately NOT live-verified (no key): the designed no-key state is verified,
   and the paste/save/forget mechanics are driven with api.ebird.org route-aborted.
   Stale-cache offline path per the Batch B addendum. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".firstrun", ".firstrun input.txt", ".btn.primary", ".btn", ".err", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };
const RG_KEY = "suite.cache.wildlife.34.05,-118.24.rg";
const ALL_KEY = "suite.cache.wildlife.34.05,-118.24.all";

async function seedLocation(page) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForSelector("#main .obs, #main .card-msg", { timeout: 30000 });
}

export async function interact({ page, log, evidenceDir }) {
  /* fresh open (no location) shows the first-run setup card */
  log(`first-run setup card visible: ${await page.locator(".firstrun").isVisible()}`);

  /* ---- live source: iNaturalist observations for the seeded shared LA location ---- */
  await seedLocation(page);
  await page.waitForSelector("#main .stamp", { timeout: 30000 }); // fetch resolved + rendered
  log(`locbar chip: "${(await page.locator(".locchip").innerText()).trim()}"`);
  log(`count line: "${(await page.locator("#count").innerText()).trim()}"`);
  log(`stamp: "${(await page.locator("#main .stamp").innerText()).trim()}"`);
  const cards = await page.locator("#main .obs").count();
  log(`observation cards rendered (research-grade): ${cards}`);
  log(`first card: species "${(await page.locator("#main .obs .cn").first().innerText()).trim()}"` +
    `, sci "${(await page.locator("#main .obs .sn").first().innerText()).trim()}"` +
    `, badge "${(await page.locator("#main .obs .qg").first().innerText()).trim()}"` +
    `, meta "${(await page.locator("#main .obs .meta").first().innerText()).replace(/\s+/g, " ").trim()}"`);

  const env = await page.evaluate(k => {
    const e = JSON.parse(localStorage.getItem(k));
    const list = e && e.v && (Array.isArray(e.v) ? e.v : e.v.results) || [];
    const s = list[0] && list[0].taxon || {};
    return { count: list.length, cachedAt: e && new Date(e.t).toISOString(),
      sample: s.preferred_common_name || s.name || null,
      grade: list[0] && list[0].quality_grade };
  }, RG_KEY);
  log(`live iNaturalist response in cache envelope ${RG_KEY}: ${env.count} observations ` +
    `(cached at ${env.cachedAt}); sample taxon "${env.sample}" quality_grade=${env.grade}`);

  /* photos actually load — and their hosts are the manifest img-src evidence */
  await page.waitForFunction(() =>
    [...document.querySelectorAll("#main .obs .thumb img")].some(i => i.complete && i.naturalWidth > 0),
    { timeout: 30000 });
  const photos = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("#main .obs .thumb img")];
    return {
      total: imgs.length,
      loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      hosts: [...new Set(imgs.map(i => new URL(i.src).host))]
    };
  });
  log(`photos: ${photos.loaded}/${photos.total} <img> loaded (naturalWidth>0); hosts: ${photos.hosts.join(", ")}`);
  await page.screenshot({ path: evidenceDir + "/live-photos.png" }); // viewport shot: live grid with loaded photos

  /* ---- research-grade toggle: refetches under the .all cache key ---- */
  await page.click("#rgToggle");
  await page.waitForFunction(k => localStorage.getItem(k) !== null, ALL_KEY, { timeout: 30000 });
  await page.waitForSelector("#main .stamp", { timeout: 30000 });
  log(`after research-grade toggle OFF: count "${(await page.locator("#count").innerText()).trim()}", ` +
    `cards ${await page.locator("#main .obs").count()}, badge mix includes "needs ID": ` +
    `${(await page.locator("#main .obs .qg").allInnerTexts()).includes("needs ID")}`);
  log(`.all cache key written: ${await page.evaluate(k => localStorage.getItem(k) !== null, ALL_KEY)}`);

  /* ---- eBird: designed no-key state + paste-a-key mechanics (endpoint route-aborted,
     NOT live-verified — no key available; per the tool-specific instructions) ---- */
  log(`eBird section visible: ${await page.locator("#ebirdSection").isVisible()}`);
  log(`eBird no-key keycard: "${(await page.locator("#ebirdBody .keycard p").innerText()).replace(/\s+/g, " ").trim()}"`);
  log(`eBird signup link: ${await page.locator("#ebirdBody .keycard a").getAttribute("href")}`);
  await page.context().route("https://api.ebird.org/**", r => r.abort());
  await page.fill('#ebirdBody input[aria-label="eBird API token"]', "TEST-TOKEN-NOT-REAL");
  await page.click("#ebirdBody .btn.primary");
  await page.waitForSelector("#ebirdBody .card-msg .big", { timeout: 15000 });
  log(`token saved -> suite.key.ebird = ${await page.evaluate(() => localStorage.getItem("suite.key.ebird"))}; ` +
    `request (aborted by harness) error card: "${(await page.locator("#ebirdBody .card-msg .big").innerText()).trim()}"`);
  await page.click('#ebirdBody .btn:has-text("Forget token")');
  await page.waitForSelector("#ebirdBody .keycard", { timeout: 15000 });
  log(`forget token -> suite.key.ebird = ${await page.evaluate(() => localStorage.getItem("suite.key.ebird"))}, ` +
    `keycard shown again: ${await page.locator("#ebirdBody .keycard").isVisible()}`);
  await page.context().unroute("https://api.ebird.org/**");

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
  await page.waitForSelector("#main .obs, #main .card-msg", { timeout: 30000 });
  await page.waitForFunction(() => {
    const s = document.querySelector("#main .stamp");
    return s && s.textContent.includes("Offline");
  }, { timeout: 30000 });
  log(`offline stale stamp: "${(await page.locator("#main .stamp").innerText()).trim()}"`);
  log(`offline: ${await page.locator("#main .obs").count()} cached cards still render; ` +
    `photo fallback icons (images unreachable): ${await page.locator("#main .obs .noimg").count()}`);
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   seeded LA location -> live fetch caches the .rg key; toggle -> the .all key.
   (v2's transient suite.key.ebird write is removed within interact(), so it is
   absent from both final snapshots.) */
export async function v1Interact({ page }) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForSelector("#main .obs, #main .card-msg", { timeout: 30000 });
  await page.waitForFunction(k => localStorage.getItem(k) !== null, RG_KEY, { timeout: 30000 });
  await page.click("#rgToggle");
  await page.waitForFunction(k => localStorage.getItem(k) !== null, ALL_KEY, { timeout: 30000 });
}
