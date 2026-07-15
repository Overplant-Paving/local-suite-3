/* tests/interactions/volcano.mjs — Volcano Status Board (Batch B, CORS-open fetcher)
   Live sources: volcanoes.usgs.gov HANS getElevatedVolcanoes (primary) + the vsc
   volcanoApi/elevated coordinate/threat enrichment, and api.zippopotam.us (one ZIP
   lookup driven through the location form). "All quiet" (zero elevated volcanoes)
   is a designed state — the interaction logs whichever state the live feed is in.
   Stale-cache offline path per the Batch B addendum: age the cache 24 h, abort all
   http(s) routes, reload, verify the "Offline — cached data from …" stamp renders. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".locbar", ".locchip", ".locform", ".legend", ".swatch", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };
const BOARD = "#main .vcard, #main .allquiet, #main .card-msg";

async function logBoard(page, log, tag) {
  const stats = await page.locator("#summary .stat").allInnerTexts();
  for (const s of stats) log(`${tag} stat: ${s.replace(/\s+/g, " ").trim()}`);
  const quiet = await page.locator("#main .allquiet").count();
  if (quiet) {
    log(`${tag}: ALL QUIET designed state — "${(await page.locator("#main .allquiet .big").innerText()).trim()}"`);
    return 0;
  }
  const groups = await page.locator("#main .group-h").allInnerTexts();
  log(`${tag} groups: ${groups.map(g => g.replace(/\s+/g, " ").trim()).join(" | ") || "(none)"}`);
  const cards = await page.locator("#main .vcard").count();
  log(`${tag} volcano cards rendered: ${cards}`);
  if (cards) {
    const first = page.locator("#main .vcard").first();
    log(`${tag} first card: name="${(await first.locator(".vname").innerText()).trim()}" ` +
      `badges=[${(await first.locator(".badge").allInnerTexts()).map(s => s.trim()).join(", ")}] ` +
      `obs="${(await first.locator(".vobs").innerText()).trim()}"`);
    log(`${tag} first card meta: "${(await first.locator(".vmeta").innerText()).replace(/\s+/g, " ").trim()}"`);
  }
  return cards;
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- live source 1+2: HANS elevated list + vsc coordinate enrichment ---- */
  await page.waitForSelector(BOARD, { timeout: 25000 });
  log(`locbar chip (no location yet): "${(await page.locator(".locchip").innerText()).trim()}"`);
  await logBoard(page, log, "live");
  log(`stamp: "${(await page.locator("#main .stamp").innerText()).trim()}"`);

  const cacheEv = await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("suite.cache.volcano.elevated") || "null");
    const vsc = JSON.parse(localStorage.getItem("suite.cache.volcano.vsc") || "null");
    const list = (e && e.v) || [];
    const sample = list.length ? {
      name: list[0].volcano_name, color: list[0].color_code, alert: list[0].alert_level, vnum: list[0].vnum
    } : null;
    return {
      count: list.length, cachedAt: e && new Date(e.t).toISOString(), sample,
      vscCount: vsc && Array.isArray(vsc.v) ? vsc.v.length : null,
      enrichedFirst: list.length ? { hasCoords: null } : null
    };
  });
  log(`live HANS elevated feed: ${cacheEv.count} volcanoes in cache envelope (cached at ${cacheEv.cachedAt})`);
  if (cacheEv.sample) {
    log(`sample volcano: "${cacheEv.sample.name}" — color ${cacheEv.sample.color}, alert ${cacheEv.sample.alert} (vnum ${cacheEv.sample.vnum})`);
  } else {
    log(`sample volcano: none — zero elevated volcanoes is a designed state ("All quiet")`);
  }
  log(`live vsc coordinate feed: ${cacheEv.vscCount == null ? "no cache entry" : cacheEv.vscCount + " volcanoes with coords/threat"}`);

  /* ---- location form: open/close a11y + live source 3 (zippopotam ZIP lookup) ---- */
  const chip = page.locator(".locchip");
  await chip.click();
  log(`chip click -> form open: ${await page.locator("#locform.open").count() === 1}, aria-expanded=${await chip.getAttribute("aria-expanded")}`);
  await page.keyboard.press("Escape");
  log(`Esc -> form closed: ${await page.locator("#locform.open").count() === 0}, aria-expanded=${await chip.getAttribute("aria-expanded")}`);
  await chip.click();
  await page.fill("#zipInput", "90012");
  await page.keyboard.press("Enter"); // Enter submits the text-entry+button pair
  await page.waitForFunction(() => localStorage.getItem("suite.location") !== null, null, { timeout: 25000 });
  await page.waitForSelector(BOARD, { timeout: 25000 });
  log(`ZIP 90012 lookup (Enter key) -> suite.location = ${await page.evaluate(() => localStorage.getItem("suite.location"))}`);
  log(`locbar after ZIP: "${(await page.locator("#locbar").innerText()).replace(/\s+/g, " ").trim()}"`);
  log(`form closed after ZIP save: ${await page.locator("#locform.open").count() === 0}`);

  /* ---- seed the exact shared LA location (addendum), reload, distances render ---- */
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForSelector(BOARD, { timeout: 25000 });
  const cards = await logBoard(page, log, "seeded-LA");
  if (cards) {
    const distances = await page.locator("#main .vcard .vmeta").allInnerTexts();
    const withDist = distances.filter(t => / mi away/.test(t)).length;
    log(`cards showing a distance from LA (vsc coords matched): ${withDist} of ${cards}`);
  }
  log(`locbar note: "${(await page.locator("#locbar").innerText()).replace(/\s+/g, " ").trim()}"`);

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
  await page.waitForSelector(BOARD, { timeout: 25000 });
  await page.waitForFunction(() => {
    const s = document.querySelector("#main .stamp");
    return s && s.textContent.startsWith("Offline");
  }, null, { timeout: 25000 });
  log(`offline stale stamp: "${(await page.locator("#main .stamp").innerText()).trim()}"`);
  log(`offline: board still renders ${await page.locator("#main .vcard").count()} cached cards ` +
    `(allquiet: ${await page.locator("#main .allquiet").count()}), summary stats: ` +
    `${(await page.locator("#summary .stat").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim()).join(" / ")}`);
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   seeded location -> reload -> live fetch writes suite.cache.volcano.elevated.
   (v2 additionally writes suite.cache.volcano.vsc — the policy-mandated separate
   cache for the enrichment request v1 fetched uncached; explained in report.md.) */
export async function v1Interact({ page }) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForSelector("#main .vcard, #main .allquiet, #main .card-msg", { timeout: 25000 });
  await page.waitForFunction(() => localStorage.getItem("suite.cache.volcano.elevated") !== null, null, { timeout: 25000 });
}
