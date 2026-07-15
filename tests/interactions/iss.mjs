/* tests/interactions/iss.mjs — ISS Tracker (Batch B, cors-open).
   The tool polls api.wheretheiss.at/v1/satellites/25544 every 5 s. page.clock is
   installed FIRST so the poll cycle is driven deterministically (fastForward fires
   exactly one extra tick); the fetches themselves are real network. Because the
   fake clock also fakes rAF/interval inside the page, page-side auto-waiting
   (waitForSelector/waitForFunction) can stall — waits are done harness-side with
   waitForTimeout + immediate evaluate/locator reads in a poll loop instead.
   Etiquette: 2 position fetches + 1 ZIP lookup per run (plus the harness's
   pre-interaction page loads); the stale-path fetch is route-aborted. */
import { join } from "node:path";

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

export const selectors = [
  "body",
  ".back",
  ".theme-btn",
  "header h1",
  "header .tag",
  ".locchip",
  ".locform input",
  "#zipBtn",
  ".mapcard",
  "svg.map",
  ".legend",
  "footer",
];

export const screenshotAfterInteract = true;

/* harness-side wait: safe under an installed page clock */
async function until(page, fn, what, tries = 60, step = 250) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await page.waitForTimeout(step);
  }
  throw new Error("timed out waiting for " + what);
}

export async function interact({ page, log, evidenceDir }) {
  await page.clock.install();

  /* seed the shared location so the distance stat + you-marker render */
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();

  /* ---- LIVE FETCH #1: position renders into the stat blocks ---- */
  await until(page, () => page.locator(".stat").count().then(n => n >= 5 ? n : null),
    "5 stat blocks (lat/lon/alt/speed/distance)");
  const stats1 = (await page.locator(".stat").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim());
  log("live stats rendered: " + JSON.stringify(stats1));
  const cache1 = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.cache.iss.pos")));
  log("response evidence (suite.cache.iss.pos payload): lat=" + cache1.v.latitude +
      " lon=" + cache1.v.longitude + " altitude=" + cache1.v.altitude + " km velocity=" +
      cache1.v.velocity + " km/h visibility=" + cache1.v.visibility + " t=" + cache1.t);
  log("visibility line (needs suite.location): " + JSON.stringify((await page.locator("#visInfo").innerText()).trim()));
  log("errbar while online (should be empty): " + JSON.stringify(await page.locator("#errbar").innerText()));
  const mapBits = await page.evaluate(() => ({
    landRings: document.querySelectorAll("svg.map > path").length,
    overlayPaths: document.querySelectorAll("#overlay path").length,
    overlayCircles: document.querySelectorAll("#overlay circle").length,
    footprintEllipses: document.querySelectorAll("#overlay ellipse").length,
  }));
  log("map painted: " + JSON.stringify(mapBits) +
      " (8 land rings; overlay paths = night+terminator; circles = sun + you + ISS)");

  /* ---- poll cycle #2, fired deterministically via the fake clock ----
     fastForward is instant in real time; wait ~2 real seconds first so the two
     requests hit the API at different wall-clock seconds and the position
     actually differs (otherwise the API returns an identical payload and the
     ground-track segment can't appear). */
  await page.waitForTimeout(2000);
  await page.clock.fastForward(5000);
  const cache2 = await until(page, () => page.evaluate(t0 => {
    const e = JSON.parse(localStorage.getItem("suite.cache.iss.pos"));
    return e && e.t > t0 ? e : null;
  }, cache1.t), "second poll to land");
  await page.waitForTimeout(300); // let paint() run after the cache write
  log("poll cycle 2: t " + cache1.t + " -> " + cache2.t + "; position " +
      cache1.v.latitude.toFixed(2) + "," + cache1.v.longitude.toFixed(2) + " -> " +
      cache2.v.latitude.toFixed(2) + "," + cache2.v.longitude.toFixed(2));
  const overlayPaths2 = await page.evaluate(() => document.querySelectorAll("#overlay path").length);
  log("overlay paths after 2nd poll (night + terminator + ground track = 3): " + overlayPaths2);

  /* ---- LIVE FETCH #2 source (zippopotam): ZIP lookup via the Enter key ---- */
  await page.locator(".locchip").click();
  log("locchip toggles form: open=" + await page.locator("#locform").evaluate(el => el.classList.contains("open")) +
      ", chip aria-expanded=" + await page.locator(".locchip").getAttribute("aria-expanded"));
  await page.locator("#zipInput").fill("90210");
  await page.locator("#zipInput").press("Enter");
  await until(page, () => page.locator(".locchip").innerText().then(t => t.includes("Beverly Hills") ? t : null),
    "ZIP lookup result in the location chip");
  log("after ZIP 90210 lookup chip reads: " + JSON.stringify(await page.locator(".locchip").innerText()));
  log("suite.location now: " + JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem("suite.location")))));
  log("form closed after lookup: " + !(await page.locator("#locform").evaluate(el => el.classList.contains("open"))));
  const stats2 = (await page.locator(".stat").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim());
  log("distance stat repainted for new location: " + JSON.stringify(stats2[4]));

  /* ---- Esc closes the location form (a11y path) ---- */
  await page.locator(".locchip").click();
  await page.keyboard.press("Escape");
  log("Esc closes form: open=" + await page.locator("#locform").evaluate(el => el.classList.contains("open")) +
      ", chip aria-expanded=" + await page.locator(".locchip").getAttribute("aria-expanded"));

  /* ---- STALE-CACHE OFFLINE PATH ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload(); // must render the stale/offline state, not a blank page
  await until(page, () => page.locator(".stat").count().then(n => n >= 5 ? n : null),
    "stale stats to render from cache");
  const staleErr = await until(page,
    () => page.locator("#errbar").innerText().then(t => t.trim() || null), "offline message in errbar");
  log("stale state errbar: " + JSON.stringify(staleErr));
  const staleStats = (await page.locator(".stat").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim());
  log("stale stats rendered from 24h-old cache: " + JSON.stringify(staleStats));
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so localStorage key sets compare equal.
   v1 writes suite.location (seeded) + suite.theme (harness toggle); it has no
   cache, so suite.cache.iss.pos is expected under keysOnlyInV2 (policy-added). */
export async function v1Interact({ page }) {
  await page.clock.install();
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForTimeout(1500); // let the first live render settle
}
