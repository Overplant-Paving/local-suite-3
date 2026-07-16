/* tests/interactions/air.mjs — Air Quality & UV Panel (Batch B, CORS-open fetcher)
   Live-verifies the single data source (Open-Meteo air-quality API: AQI + pollutants +
   UV in one call) and the zippopotam.us ZIP geocode, checks the EPA color-scale band
   against the observed AQI value, then proves the stale-cache offline path. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", ".locbar",
  ".loclabel", ".linklike", ".panel", ".card-msg", ".field input", ".btn", "footer"
];

export const screenshotAfterInteract = true;

/* EPA AQI bands as rendered by the tool (v1 table) — used to compute the EXPECTED
   band for whatever AQI the live API returns, then compared to what rendered.
   Phase 4 a11y: the tool now renders the hero NUMBER/CATEGORY text in a theme-aware
   AA-contrast variant of each band color (`text` below, light-theme value — the harness
   runs the interaction pass in light theme); the pill/badge backgrounds keep the exact
   EPA color (`col`). */
const BANDS = [
  { max: 50, cat: "Good", col: "#4caf50", text: "#39833c" },
  { max: 100, cat: "Moderate", col: "#cbb733", text: "#827521" },
  { max: 150, cat: "Unhealthy for Sensitive Groups", col: "#e08b2f", text: "#a66723" },
  { max: 200, cat: "Unhealthy", col: "#d34a3d", text: "#cd483b" },
  { max: 300, cat: "Very Unhealthy", col: "#8e63c0", text: "#8b61bc" },
  { max: 9999, cat: "Hazardous", col: "#7a3b45", text: "#7a3b45" }
];
const UVBANDS = [
  { max: 2, cat: "Low", col: "#4caf50" },
  { max: 5, cat: "Moderate", col: "#cbb733" },
  { max: 7, cat: "High", col: "#e08b2f" },
  { max: 10, cat: "Very High", col: "#d34a3d" },
  { max: 99, cat: "Extreme", col: "#8e63c0" }
];
const hexToRgb = h => `rgb(${parseInt(h.slice(1,3),16)}, ${parseInt(h.slice(3,5),16)}, ${parseInt(h.slice(5,7),16)})`;

const seedLA = page => page.evaluate(() => {
  localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }));
});

export async function interact({ page, log, evidenceDir }) {
  /* ---- first-run state (no location yet) ---- */
  const firstRun = (await page.textContent("#main .card-msg .big")).trim();
  log(`first-run card (no suite.location): "${firstRun}"`);

  /* ---- LIVE FETCH: seed the shared LA location, reload, one real Open-Meteo call ---- */
  await seedLA(page);
  await page.reload();
  await page.waitForSelector(".hero .num", { timeout: 20000 });
  await page.waitForTimeout(300);

  /* raw response evidence from the cache envelope Suite.fetchJSON just wrote */
  const raw = await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("suite.cache.air"));
    return { key: e.key, t: e.t, current: e.v.current };
  });
  log(`LIVE response (suite.cache.air, key=${raw.key}): current=${JSON.stringify(raw.current)}`);

  const aqiText = (await page.textContent(".hero .num")).trim();
  const aqiCat = (await page.evaluate(() =>
    document.querySelector(".hero .cat").childNodes[0].textContent)).trim();
  const aqiColor = await page.evaluate(() => getComputedStyle(document.querySelector(".hero .num")).color);
  const pinLeft = await page.evaluate(() => document.querySelector(".scale .pin").style.left);
  log(`LIVE AQI (Los Angeles): rendered value=${aqiText}, category="${aqiCat}", hero color=${aqiColor}, scale pin left=${pinLeft}`);

  /* EPA color-scale check: expected band for the RAW API value vs what rendered
     (the tool bands the unrounded value, so the check uses it too) */
  const aqi = raw.current.us_aqi;
  const expected = BANDS.find(b => aqi <= b.max);
  log(`EPA band check: raw AQI ${aqi} -> expected "${expected.cat}", text color ${expected.text} (${hexToRgb(expected.text)}); ` +
    `rendered category "${aqiCat}", color ${aqiColor} -> ` +
    `${aqiCat === expected.cat && aqiColor === hexToRgb(expected.text) ? "MATCH" : "MISMATCH"}`);
  /* compare numerically — the browser serializes style.left to ~6 significant digits,
     so a string compare false-MISMATCHes on any AQI whose percentage isn't short */
  const expectedPin = Math.min(100, (aqi / 350) * 100);
  log(`scale pin check: expected left=${expectedPin}% for raw AQI ${aqi}; rendered ${pinLeft} -> ${Math.abs(parseFloat(pinLeft) - expectedPin) < 0.001 ? "MATCH" : "MISMATCH"}`);

  /* pollutant breakdown (same response) */
  const polls = await page.$$eval(".polls .poll", els =>
    els.map(e => `${e.querySelector(".k").textContent}=${e.querySelector(".v").textContent.trim().replace(/\s+/g, " ")}`));
  log(`LIVE pollutants: ${polls.join(" · ")}`);

  /* UV (same response — v1 sources UV from the Open-Meteo air-quality API, not EPA) */
  const uvText = (await page.textContent(".uv-pill")).trim();
  const uvCat = (await page.evaluate(() =>
    document.querySelector(".uv-cat").childNodes[0].textContent)).trim();
  const uvColor = await page.evaluate(() => getComputedStyle(document.querySelector(".uv-pill")).backgroundColor);
  const uvExpected = UVBANDS.find(b => raw.current.uv_index <= b.max);
  log(`LIVE UV: rendered value=${uvText} (raw ${raw.current.uv_index}), category="${uvCat}", pill background=${uvColor}`);
  log(`UV band check: raw UV ${raw.current.uv_index} -> expected "${uvExpected.cat}" ${hexToRgb(uvExpected.col)} -> ` +
    `${uvCat === uvExpected.cat && uvColor === hexToRgb(uvExpected.col) ? "MATCH" : "MISMATCH"}`);

  const outlookRows = await page.$$eval(".outlook .day", els => els.length);
  const updated = (await page.textContent("#updated")).trim();
  log(`multi-day outlook rows (AQI+UV): ${outlookRows}; updated line: "${updated}"`);

  /* ---- LIVE FETCH: zippopotam ZIP geocode via the change-location flow ---- */
  await page.click("#changeLoc");
  await page.fill("#zip", "90012");
  await page.click("#zipGo");
  await page.waitForSelector(".hero .num", { timeout: 20000 });
  const zipLabel = (await page.textContent("#locLabel")).trim();
  const zipAqi = (await page.textContent(".hero .num")).trim();
  log(`LIVE zippopotam: ZIP 90012 -> locLabel "${zipLabel}"; re-fetched AQI=${zipAqi} (location-keyed cache was purged and refilled)`);

  /* ---- STALE-CACHE OFFLINE PATH ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector(".hero .num", { timeout: 20000 });
  await page.waitForTimeout(300);
  const staleUpdated = (await page.textContent("#updated")).trim();
  const staleAqi = (await page.textContent(".hero .num")).trim();
  log(`STALE PATH (network blocked, cache aged 24h): rendered AQI=${staleAqi} from cache; updated line: "${staleUpdated}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   seed the LA location and let v1 do its own live fetch into suite.cache.air. */
export async function v1Interact({ page }) {
  await seedLA(page);
  await page.reload();
  await page.waitForSelector(".hero .num", { timeout: 20000 });
  await page.waitForTimeout(300);
}
