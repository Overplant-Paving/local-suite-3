/* tests/interactions/passes.mjs — Satellite Pass Predictor (Batch D, cors-open, embedded-data).
   Determinism: page.clock is installed at a FIXED instant T (2026-07-16T04:00:00Z — evening
   twilight over Los Angeles) and the TLE cache is seeded with a FIXED 30-satellite fixture
   (archived below; captured from CelesTrak GROUP=visual on 2026-07-15), so the pass
   computation is reproducible on this machine (times render in the host's local zone).
   Etiquette: exactly ONE live CelesTrak fetch (the "Refresh satellite data" button) and one
   zippopotam ZIP lookup per run; failure/stale paths are route-stubbed, never re-fetched.
   Under the fake clock, run()'s 30 ms spinner yield only fires via clock.fastForward, and
   page-side auto-waiting can stall — waits are harness-side polls (waitForTimeout + evaluate). */
import { join } from "node:path";

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };
const T = Date.UTC(2026, 6, 16, 4, 0, 0); // 2026-07-16T04:00:00Z

/* Fixed TLE fixture: 30 of the 157 CelesTrak visual-group sats (ISS, HST, CSS (Tianhe)
   guaranteed, remainder an even spread), epochs 2026-07-15 (day 26196). Stored in the
   tool's own slim cache shape {name, l1, l2}. */
const FIXTURE = [
{ name: "HST", l1: "1 20580U 90037B   26196.50035387  .00003469  00000+0  10488-3 0  9994", l2: "2 20580  28.4723 247.0189 0002191 106.0764 254.0074 15.31063070792917" },
{ name: "ISS (ZARYA)", l1: "1 25544U 98067A   26196.76640667  .00004078  00000+0  82095-4 0  9992", l2: "2 25544  51.6311 158.6576 0006718 300.0875  59.9447 15.49019038576187" },
{ name: "CSS (TIANHE)", l1: "1 48274U 21035A   26196.53543323  .00001219  00000+0  20014-4 0  9991", l2: "2 48274  41.4690 149.7716 0002229 300.3824  59.6794 15.58093729297592" },
{ name: "ATLAS CENTAUR 2", l1: "1 00694U 63047A   26196.12653081  .00000552  00000+0  55387-4 0  9992", l2: "2 00694  30.3511 203.1409 0545680 123.9150 241.4565 14.12564752149651" },
{ name: "OAO 2", l1: "1 03597U 68110A   26196.20051268  .00000087  00000+0  28574-4 0  9992", l2: "2 03597  34.9932 273.2648 0005043 144.8528 215.2496 14.47361771 37585" },
{ name: "SL-8 R/B", l1: "1 05730U 71119B   26196.50885086  .00004246  00000+0  21835-3 0  9995", l2: "2 05730  73.8885 296.3648 0542743 236.6298 118.1806 14.39737222673871" },
{ name: "SEASAT 1", l1: "1 10967U 78064A   26196.46003169  .00000014  00000+0  42491-4 0  9999", l2: "2 10967 108.0180  33.6410 0001087 255.8860 104.2165 14.46260244524980" },
{ name: "SL-3 R/B", l1: "1 12465U 81046B   26196.88974981  .00007034  00000+0  14896-3 0  9999", l2: "2 12465  81.2318 135.4782 0015722 294.5266  65.4339 15.44789821458202" },
{ name: "SL-14 R/B", l1: "1 13553U 82092B   26196.93460329  .00000213  00000+0  21057-4 0  9992", l2: "2 13553  82.5669  21.3984 0019035 233.0925 240.3422 14.86765101347981" },
{ name: "SL-8 R/B", l1: "1 15483U 85006B   26196.96889560  .00000119  00000+0  48056-4 0  9992", l2: "2 15483  74.0454  25.0972 0019256 268.0412 201.3692 14.37845580172466" },
{ name: "COSMOS 1743", l1: "1 16719U 86034A   26196.73165927  .00043247  00000+0  36371-3 0  9991", l2: "2 16719  82.5282 298.3228 0005393 175.2370 184.8944 15.69664907200263" },
{ name: "COSMOS 1833", l1: "1 17589U 87027A   26196.91950671  .00000074  00000+0  65101-4 0  9993", l2: "2 17589  70.9212  56.4778 0024282   7.5382 352.6099 14.13066813 28437" },
{ name: "COSMOS 1867", l1: "1 18187U 87060A   26196.70631790 -.00000071  00000+0  11161-4 0  9995", l2: "2 18187  65.0119 308.1886 0017162 282.0240  77.8921 14.31518536 38268" },
{ name: "COSMOS 1953", l1: "1 19210U 88050A   26196.92302634  .00003915  00000+0  13203-3 0  9996", l2: "2 19210  82.5059  29.0449 0011469  37.6442 322.5599 15.30343243 57385" },
{ name: "INTERCOSMOS 24", l1: "1 20261U 89080A   26196.92476442  .00000125  00000+0  32728-4 0  9991", l2: "2 20261  82.6050  20.9393 1187149 355.2528   3.8050 12.59692197682947" },
{ name: "COSMOS 2058", l1: "1 20465U 90010A   26196.78933045  .00001709  00000+0  97362-4 0  9997", l2: "2 20465  82.4672 281.1461 0007969 247.4979 112.5408 15.12158485961595" },
{ name: "SL-6 R/B(2)", l1: "1 20666U 90055D   26196.90393806  .00000991  00000+0  84463-4 0  9998", l2: "2 20666  62.7806 177.6488 0045269   9.0960 351.0948 15.04089660957473" },
{ name: "SL-14 R/B", l1: "1 21423U 91042B   26196.78231085  .00000182  00000+0  19944-4 0  9997", l2: "2 21423  82.4932 100.0810 0017024 174.9905 185.1483 14.81918278872041" },
{ name: "SL-8 R/B", l1: "1 21938U 92020B   26196.56848810  .00000013  00000+0 -15449-5 0  9992", l2: "2 21938  82.9280  58.7729 0027943 302.4251 121.9465 13.75550220718716" },
{ name: "SL-16 R/B", l1: "1 22285U 92093B   26196.93421259 -.00000248  00000+0 -10237-3 0  9992", l2: "2 22285  71.0217  95.0440 0002247 132.9289 227.2023 14.15465528731303" },
{ name: "ARIANE 40 R/B", l1: "1 22830U 93061H   26196.76501541  .00000072  00000+0  42214-4 0  9992", l2: "2 22830  98.4806 263.0265 0009497 263.8588  96.1514 14.32918680712441" },
{ name: "ARIANE 40+ R/B", l1: "1 23561U 95021B   26196.83447345  .00000115  00000+0  50441-4 0  9990", l2: "2 23561  98.4401 266.4939 0007916 114.7731 359.7657 14.39847770637683" },
{ name: "SL-16 R/B", l1: "1 25407U 98045B   26196.48885999 -.00000184  00000+0 -68746-4 0  9997", l2: "2 25407  71.0109 272.8110 0008168 206.2295 153.8416 14.16205258445193" },
{ name: "HELIOS 1B", l1: "1 25977U 99064A   26196.28633954  .00000650  00000+0  77122-4 0  9995", l2: "2 25977  98.1585 102.2367 0001921  54.1371 306.0023 14.88075271704236" },
{ name: "IDEFIX & ARIANE 42P R/B", l1: "1 27422U 02021B   26196.79549863  .00000088  00000+0  49884-4 0  9999", l2: "2 27422  98.5942 133.9694 0011926 164.7365 195.4180 14.31093901262348" },
{ name: "CZ-4B R/B", l1: "1 28059U 03049C   26196.90565151  .00000124  00000+0  40044-4 0  9998", l2: "2 28059  98.6910 196.8971 0047691 199.0638 160.8775 14.55116335205244" },
{ name: "ARIANE 5 R/B", l1: "1 28499U 04049H   26196.89262599  .00000208  00000+0  29962-4 0  9994", l2: "2 28499  98.2741  10.2590 0082616 295.9962  63.2760 14.85479344164821" },
{ name: "CZ-4B R/B", l1: "1 29507U 06046C   26196.73162734  .00002512  00000+0  12542-3 0  9992", l2: "2 29507  97.5436 241.2512 0032651 180.2561 179.8661 15.17984393 79460" },
{ name: "KORONAS-FOTON", l1: "1 33504U 09003A   26196.88082474  .00007914  00000+0  15934-3 0  9997", l2: "2 33504  82.4312 142.3153 0012118  60.3216 299.9238 15.46309035965533" },
{ name: "ALOS-2", l1: "1 39766U 14029A   26196.95076909 -.00000009  00000+0  56584-5 0  9998", l2: "2 39766  97.9235 293.7030 0001576  91.4209 268.7183 14.79466124655832" },
];

export const selectors = [
  "body",
  ".back",
  ".theme-btn",
  "header h1",
  "header .tag",
  "#locCard",
  "#locCard h2",
  "#zip",
  "#zipBtn",
  "#geoBtn",
  "#locErr",
  "footer",
];

export const screenshotAfterInteract = true;

/* harness-side wait: safe under an installed page clock */
async function until(page, fn, what, tries = 80, step = 250) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await page.waitForTimeout(step);
  }
  throw new Error("timed out waiting for " + what);
}

function seedScript(fixture, t) {
  return `
    localStorage.setItem("suite.location", ${JSON.stringify(JSON.stringify(LA))});
    localStorage.setItem("suite.cache.passes.visual",
      JSON.stringify({ t: ${t}, v: ${JSON.stringify(fixture)} }));
  `;
}

export async function interact({ page, log, evidenceDir }) {
  await page.clock.install({ time: T });

  /* ---- deterministic compute from the archived fixture (no network) ---- */
  await page.evaluate(seedScript(FIXTURE, T - 3600000)); // cache 1 h old => fresh, no fetch
  await page.reload();
  await page.clock.fastForward(1000); // fire run()'s 30 ms spinner yield
  await until(page, () => page.locator("#results .pass").count().then(n => n > 0 ? n : null),
    "deterministic pass rows");
  const stats = (await page.locator("#stats .stat").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim());
  log("deterministic stats (fixture, minEl 10): " + JSON.stringify(stats));
  log("status line: " + JSON.stringify((await page.locator("#status").innerText()).trim()));
  const rows = (await page.locator("#results .pass").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim());
  log("pass rows rendered: " + rows.length);
  rows.slice(0, 8).forEach((r, i) => log("  pass[" + i + "]: " + r));
  const nights = (await page.locator("#results .night h3").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim());
  log("night groups: " + JSON.stringify(nights));

  /* precise pass list straight from the tool's own findPasses at exactly T
     (input for the independent recomputation cross-check) */
  const precise = await page.evaluate(t0 => {
    const sats = buildFromLines(JSON.parse(localStorage.getItem("suite.cache.passes.visual")).v);
    return findPasses(sats, jdFromDate(new Date(t0)), 72, 10).slice(0, 12).map(p => ({
      name: p.name, satnum: p.satnum,
      startJd: p.startJd, maxJd: p.maxJd, endJd: p.endJd,
      maxEl: +p.maxEl.toFixed(3), maxAz: +p.maxAz.toFixed(2), visible: p.visible,
    }));
  }, T);
  log("precise passes (findPasses at exactly T, minEl 10): " + JSON.stringify(precise));

  /* ---- minimum-elevation control + Recompute button ---- */
  await page.locator("#minEl").fill("30");
  await page.locator("#refreshBtn").click();
  await page.clock.fastForward(1000);
  await until(page, async () => {
    const s = (await page.locator("#stats .stat").allInnerTexts()).join(" ");
    return s !== stats.join(" ") ? s : null;
  }, "stats to change after minEl 30 recompute");
  const stats30 = (await page.locator("#stats .stat").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim());
  log("stats after minEl 30 recompute: " + JSON.stringify(stats30));
  await page.locator("#minEl").fill("10");

  /* ---- location change via ZIP (live zippopotam fetch; Enter submits) ---- */
  await page.locator(".linkbtn").click(); // "change"
  log("change link reopens location card: hidden=" +
    await page.locator("#locCard").evaluate(el => el.classList.contains("hidden")));
  await page.locator("#zip").fill("90210");
  await page.locator("#zip").press("Enter");
  await until(page, () => page.locator("#locbar").innerText().then(t => t.includes("Beverly Hills") ? t : null),
    "ZIP 90210 lookup to update the locbar");
  await page.clock.fastForward(1000); // recompute for the new observer (cache still fresh — no TLE fetch)
  log("locbar after ZIP lookup: " + JSON.stringify((await page.locator("#locbar").innerText()).replace(/\s+/g, " ").trim()));
  log("suite.location now: " + await page.evaluate(() => localStorage.getItem("suite.location")));
  await until(page, () => page.locator("#results .pass").count().then(n => n > 0 ? n : null),
    "recomputed passes for Beverly Hills");
  log("passes recomputed for new observer: " + await page.locator("#results .pass").count() + " rows");

  /* ---- THE one live CelesTrak fetch: "Refresh satellite data" (forceNet) ---- */
  await page.locator("#reloadTle").click();
  const liveStatus = await until(page, async () => {
    await page.clock.fastForward(400); // keep firing the spinner yield while the real fetch lands
    const cnt = await page.evaluate(() => {
      const e = JSON.parse(localStorage.getItem("suite.cache.passes.visual") || "null");
      return e ? e.v.length : 0;
    });
    if (cnt <= FIXTURE.length) return null;
    const s = (await page.locator("#status").innerText()).trim();
    return /satellites tracked/.test(s) ? s : null;
  }, "live CelesTrak fetch + recompute", 120, 500);
  const liveCache = await page.evaluate(() => localStorage.getItem("suite.cache.passes.visual"));
  const liveInfo = JSON.parse(liveCache);
  log("LIVE CelesTrak fetch: " + liveInfo.v.length + " satellites in cache; first name=" +
    JSON.stringify(liveInfo.v[0].name) + "; sample l1=" + JSON.stringify(liveInfo.v[0].l1));
  log("live status line: " + JSON.stringify(liveStatus));
  log("live stats: " + JSON.stringify((await page.locator("#stats .stat").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim())));

  /* ---- failure path, no cache (stubbed empty-200 responses; clean console) ---- */
  await page.evaluate(() => localStorage.removeItem("suite.cache.passes.visual"));
  await page.context().route(/^https?:/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.reload();
  const errText = await until(page, () =>
    page.locator("#status .card.err").innerText().then(t => t.trim() || null).catch(() => null),
    "no-cache failure card");
  log("failure card (no cache, empty feed): " + JSON.stringify(errText.replace(/\s+/g, " ")));
  await page.context().unroute(/^https?:/);

  /* ---- stale-cache offline path (24 h+ old cache, network aborted) ---- */
  await page.evaluate(([raw, t0]) => {
    const e = JSON.parse(raw);
    e.t = t0 - 25 * 3600 * 1000; // 25 h old => past CACHE_MAX_MS
    localStorage.setItem("suite.cache.passes.visual", JSON.stringify(e));
  }, [liveCache, T]);
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload(); // must render the stale/offline state, not a blank page
  const staleStatus = await until(page, async () => {
    await page.clock.fastForward(400);
    const s = (await page.locator("#status").innerText()).trim();
    return /Network failed/.test(s) ? s : null;
  }, "stale-cache status note", 120, 500);
  log("stale status: " + JSON.stringify(staleStatus));
  log("stale stats: " + JSON.stringify((await page.locator("#stats .stat").allInnerTexts()).map(s => s.replace(/\s+/g, " ").trim())));
  log("stale pass rows still rendered: " + await page.locator("#results .pass").count());
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.context().unroute(/^https?:/);

  /* a11y spot-log */
  log("aria-live: status=" + await page.locator("#status").getAttribute("aria-live") +
    " results=" + await page.locator("#results").getAttribute("aria-live") +
    " locErr=" + await page.locator("#locErr").getAttribute("aria-live"));
}

/* Same state-writing actions on v1 so localStorage key sets compare equal:
   suite.location + suite.cache.passes.visual seeded, suite.theme via harness toggle. */
export async function v1Interact({ page }) {
  await page.clock.install({ time: T });
  await page.evaluate(seedScript(FIXTURE, T - 3600000));
  await page.reload();
  await page.clock.fastForward(1000);
  await page.waitForTimeout(2500); // let the fixture compute + render settle
}
