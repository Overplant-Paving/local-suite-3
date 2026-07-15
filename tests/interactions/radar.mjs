/* tests/interactions/radar.mjs — Radar & Satellite Viewer (Batch B, image-loop tool)
   Live sources exercised: radar.weather.gov (RIDGE loop GIFs, <img>),
   cdn.star.nesdis.noaa.gov (GOES-19 sector imagery, <img>), and one JSON fetch to
   api.zippopotam.us on the change-location path. Image loads are proven with
   img.complete && naturalWidth > 0 plus logged natural dimensions. The offline
   path is v1's designed image-failure state (.err card), not a stale cache —
   this tool keeps no suite.cache.* entries (images are cache-busted on purpose). */
import { join } from "node:path";

/* Harness screenshots run before any location is seeded, so both versions render
   the first-run "Set your location" card — these selectors cover that state. */
export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", ".locbar",
  ".tab", ".card-msg", ".card-msg .big", ".field input", ".btn", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

async function waitForImage(page, wrapSel, log, label, timeout = 45000) {
  try {
    await page.waitForFunction(sel => {
      const img = document.querySelector(sel + " img");
      return img && img.complete && img.naturalWidth > 0;
    }, wrapSel, { timeout });
    const dims = await page.evaluate(sel => {
      const img = document.querySelector(sel + " img");
      return { w: img.naturalWidth, h: img.naturalHeight, alt: img.alt, src: img.src.split("?")[0] };
    }, wrapSel);
    log(`${label}: LOADED ${dims.w}x${dims.h} px — alt="${dims.alt}" src=${dims.src}`);
    return true;
  } catch (e) {
    const state = await page.evaluate(sel =>
      (document.querySelector(sel) || {}).textContent || "(missing)", wrapSel);
    log(`${label}: DID NOT LOAD within ${timeout}ms — wrap shows: "${String(state).trim().slice(0, 120)}"`);
    return false;
  }
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. live radar loop for the seeded shared location ---- */
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForTimeout(800);
  log(`seeded suite.location = ${JSON.stringify(LA)}`);
  log(`#locLabel: "${(await page.textContent("#locLabel")).trim()}"`);
  log(`nearest-station hint: "${((await page.textContent(".hint")) || "").trim()}"`);
  const autoStation = await page.evaluate(() => document.getElementById("stnSel").value);
  log(`auto-selected station (nearest to LA): ${autoStation}; suite.radar.station=${await page.evaluate(() => localStorage.getItem("suite.radar.station"))}`);
  await waitForImage(page, "#rWrap", log, `radar loop ${autoStation} (radar.weather.gov)`);
  log(`radar caption: "${(await page.textContent("#rCapt")).trim()}" · "${(await page.textContent("#rTime")).trim()}"`);

  /* ---- 2. station switching: pick a different station, image reloads ---- */
  await page.selectOption("#stnSel", "KOKX");
  await page.waitForTimeout(300);
  log(`switched station to KOKX; suite.radar.station=${await page.evaluate(() => localStorage.getItem("suite.radar.station"))}`);
  await waitForImage(page, "#rWrap", log, "radar loop KOKX after station switch");
  log(`radar caption after switch: "${(await page.textContent("#rCapt")).trim()}"`);

  /* ---- 3. GOES satellite tab: default CONUS GeoColor ---- */
  await page.click("#tabSat");
  await page.waitForTimeout(300);
  log(`sat tab: tabSat aria-pressed=${await page.getAttribute("#tabSat", "aria-pressed")}, tabRadar aria-pressed=${await page.getAttribute("#tabRadar", "aria-pressed")}`);
  await waitForImage(page, "#sWrap", log, "GOES CONUS GEOCOLOR (cdn.star.nesdis.noaa.gov)");
  log(`sat caption: "${(await page.textContent("#sCapt")).trim()}"`);

  /* ---- 4. region + product switching (incl. the "13" JSON-parse hazard) ---- */
  await page.selectOption("#secSel", "psw");
  await page.waitForTimeout(300);
  await waitForImage(page, "#sWrap", log, "GOES psw sector after region switch");
  await page.selectOption("#prodSel", "13");
  await page.waitForTimeout(300);
  await waitForImage(page, "#sWrap", log, 'GOES psw product "13" (clean infrared)');
  log(`stored prefs: sector=${await page.evaluate(() => localStorage.getItem("suite.radar.sector"))}, product=${await page.evaluate(() => localStorage.getItem("suite.radar.product"))} (must be the bare string "13")`);
  log(`sat caption: "${(await page.textContent("#sCapt")).trim()}"`);

  /* reload: product "13" must survive Suite.store.get's JSON parse (string, not number) */
  await page.reload();
  await page.waitForTimeout(800);
  await page.click("#tabSat");
  await page.waitForTimeout(500);
  const prefs = await page.evaluate(() => ({
    sec: document.getElementById("secSel").value, prod: document.getElementById("prodSel").value
  }));
  log(`after reload, sat selects restore: sector=${prefs.sec} (expect psw), product=${prefs.prod} (expect "13")`);

  /* ---- 5. change location -> live ZIP lookup (zippopotam.us, one request) ---- */
  await page.click("#tabRadar");
  await page.waitForTimeout(300);
  await page.click("#changeLoc");
  log(`change-location card: "${(await page.textContent(".card-msg .big")).trim()}"; #locLabel="${(await page.textContent("#locLabel")).trim()}"`);
  await page.fill("#zip", "123");
  await page.click("#zipGo");
  log(`invalid ZIP "123": #locMsg="${(await page.textContent("#locMsg")).trim()}"`);
  await page.fill("#zip", "90012");
  await page.press("#zip", "Enter"); // Enter submits the ZIP field
  await page.waitForTimeout(3500);   // live zippopotam lookup + boot back into radar view
  log(`after ZIP 90012 (Enter key): #locLabel="${(await page.textContent("#locLabel")).trim()}"`);
  log(`  suite.location=${await page.evaluate(() => localStorage.getItem("suite.location"))}`);
  await waitForImage(page, "#rWrap", log, "radar loop after ZIP change (station select keeps saved KOKX)");

  /* ---- 6. offline: v1's designed image-failure state must render (not a blank) ---- */
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForTimeout(2500);
  const offRadar = await page.evaluate(() => {
    const err = document.querySelector("#rWrap .err");
    return { errShown: !!err, text: err ? err.textContent.trim() : (document.querySelector("#rWrap") || {}).textContent || "(no wrap)" };
  });
  log(`offline radar view (network blocked): .err rendered=${offRadar.errShown}; text="${String(offRadar.text).trim().slice(0, 140)}"`);
  await page.click("#tabSat");
  await page.waitForTimeout(2000);
  const offSat = await page.evaluate(() => {
    const err = document.querySelector("#sWrap .err");
    return { errShown: !!err, text: err ? err.textContent.trim() : "(none)" };
  });
  log(`offline satellite view: .err rendered=${offSat.errShown}; text="${offSat.text.slice(0, 140)}"`);
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.context().unroute(/^https?:/);

  /* ---- 7. back online: radar view for the post-interaction screenshot ---- */
  await page.click("#tabRadar");
  await waitForImage(page, "#rWrap", log, "back online, radar loop reloaded");
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   suite.location (seed + ZIP change), suite.radar.station (auto + KOKX switch),
   suite.radar.sector, suite.radar.product. Neither version caches anything
   (v1's zippopotam fetch was uncached; v2 keeps it uncached). */
export async function v1Interact({ page }) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForTimeout(800);
  await page.selectOption("#stnSel", "KOKX");
  await page.click("#tabSat");
  await page.waitForTimeout(400);
  await page.selectOption("#secSel", "psw");
  await page.waitForTimeout(300);
  await page.selectOption("#prodSel", "13");
  await page.waitForTimeout(300);
  await page.click("#tabRadar");
  await page.waitForTimeout(300);
  await page.click("#changeLoc");
  await page.fill("#zip", "90012");
  await page.click("#zipGo");
  await page.waitForTimeout(3500);
}
