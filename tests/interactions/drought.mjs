/* tests/interactions/drought.mjs — Drought Monitor (Batch B, CORS-open fetcher)
   Live-verifies all three data sources: Esri Living Atlas ArcGIS US_Drought_Intensity_v1
   (layer 3 current category + layer 2 weekly history), the FCC census-block county lookup,
   and the zippopotam.us ZIP geocode in the first-run flow. Checks the rendered category
   against the raw dm value in the cache envelope, then proves the stale-cache offline path. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".setup", "input[type=text]", ".btn.primary", ".btn.ghost", ".err-inline", "footer"
];

export const screenshotAfterInteract = true;

/* USDM category table as rendered by the tool (v1 CATS) — used to compute the EXPECTED
   category/color for whatever dm the live API returns, then compared to what rendered. */
const CATS = [
  { dm: -1, code: "None", name: "No Drought",          col: "#e9ecec" },
  { dm: 0,  code: "D0",   name: "Abnormally Dry",      col: "#ffff00" },
  { dm: 1,  code: "D1",   name: "Moderate Drought",    col: "#fcd37f" },
  { dm: 2,  code: "D2",   name: "Severe Drought",      col: "#ffaa00" },
  { dm: 3,  code: "D3",   name: "Extreme Drought",     col: "#e60000" },
  { dm: 4,  code: "D4",   name: "Exceptional Drought", col: "#730000" }
];
const hexToRgb = h => `rgb(${parseInt(h.slice(1,3),16)}, ${parseInt(h.slice(3,5),16)}, ${parseInt(h.slice(5,7),16)})`;

const seedLA = page => page.evaluate(() => {
  localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }));
});

const cacheEnvelope = page => page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.drought.")) {
    const e = JSON.parse(localStorage.getItem(k));
    if (e && e.v && "curDm" in e.v) return {
      key: k, t: e.t, curDm: e.v.curDm, latestPeriod: e.v.latestPeriod,
      county: e.v.county, trendLen: e.v.trend.length,
      trendFirst: e.v.trend[0], trendLast: e.v.trend[e.v.trend.length - 1],
      dmCounts: e.v.trend.reduce((a, w) => (a[w.dm] = (a[w.dm] || 0) + 1, a), {})
    };
  }
  return null;
});

export async function interact({ page, log, evidenceDir }) {
  /* ---- first-run state (no suite.location yet) ---- */
  const firstRun = (await page.textContent(".setup h2")).trim();
  log(`first-run card (no suite.location): "${firstRun}"`);

  /* ---- LIVE FETCH: zippopotam ZIP geocode via the first-run flow (Enter submits) ---- */
  await page.fill("#zip", "90012");
  await page.press("#zip", "Enter");
  await page.waitForSelector("#hero .hero", { timeout: 30000 });
  const zipLabel = (await page.textContent("#locLabel")).trim();
  const zipLoc = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.location")));
  log(`LIVE zippopotam: ZIP 90012 -> suite.location {lat:${zipLoc.lat}, lon:${zipLoc.lon}, label:"${zipLoc.label}"}; locbar shows "${zipLabel}"`);

  /* ---- LIVE FETCH: seed the shared LA location, reload -> ArcGIS current + history + FCC county ---- */
  await seedLA(page);
  await page.reload();
  await page.waitForSelector("#hero .hero", { timeout: 30000 });
  await page.waitForTimeout(300);

  /* raw response evidence from the composite cache envelope the tool just wrote */
  const raw = await cacheEnvelope(page);
  log(`LIVE response (${raw.key}): curDm=${raw.curDm}, latestPeriod=${raw.latestPeriod}, ` +
    `county=${JSON.stringify(raw.county)}, trend weeks=${raw.trendLen}, ` +
    `first=${JSON.stringify(raw.trendFirst)}, last=${JSON.stringify(raw.trendLast)}, dm histogram=${JSON.stringify(raw.dmCounts)}`);

  const heroCat = (await page.textContent(".hero .cat")).trim();
  const heroCounty = (await page.textContent(".hero .county")).trim();
  const heroValid = (await page.textContent(".hero .valid")).trim();
  const heroBg = await page.evaluate(() => getComputedStyle(document.querySelector(".hero")).backgroundColor);
  log(`LIVE drought category (Los Angeles): hero="${heroCat}", county line="${heroCounty}", validity="${heroValid}", hero background=${heroBg}`);

  /* category check: expected CATS entry for the RAW dm value vs what rendered */
  const expected = CATS.find(c => c.dm === raw.curDm) || CATS[0];
  const expectedText = expected.dm >= 0 ? `${expected.code} · ${expected.name}` : expected.name;
  log(`USDM category check: raw dm=${raw.curDm} -> expected "${expectedText}" ${expected.col} (${hexToRgb(expected.col)}); ` +
    `rendered "${heroCat}" bg ${heroBg} -> ${heroCat === expectedText && heroBg === hexToRgb(expected.col) ? "MATCH" : "MISMATCH"}`);

  /* county check: FCC lookup should render a county, not the raw label */
  log(`FCC county check: cache county=${raw.county ? `"${raw.county.name}, ${raw.county.state}" (FIPS ${raw.county.fips})` : "null"}; ` +
    `hero county line "${heroCounty}" -> ${raw.county && heroCounty.startsWith(raw.county.name) ? "MATCH (rendered from FCC)" : "check"}`);

  /* trend chart: one bar per week, last-bar color matches its dm category */
  const barCount = await page.$$eval("svg.spark rect", els => els.length);
  const lastBarFill = await page.$$eval("svg.spark rect", els => els[els.length - 1].getAttribute("fill"));
  const lastExpected = (CATS.find(c => c.dm === raw.trendLast.dm) || CATS[0]).col;
  const trendTitle = await page.$$eval("svg.spark rect title", els => els[els.length - 1].textContent);
  log(`trend chart: ${barCount} bars for ${raw.trendLen} weeks -> ${barCount === raw.trendLen ? "MATCH" : "MISMATCH"}; ` +
    `last bar fill=${lastBarFill} expected ${lastExpected} -> ${lastBarFill === lastExpected ? "MATCH" : "MISMATCH"}; last tooltip "${trendTitle}"`);
  const scaleItems = await page.$$eval(".scale .item", els => els.map(e => e.textContent.trim()).join(" "));
  const stamp = (await page.textContent("#stamp")).trim();
  log(`legend: ${scaleItems}; stamp: "${stamp}"`);

  /* "change" returns to the setup card (location kept) */
  await page.click("#changeLoc");
  const backToSetup = (await page.textContent(".setup h2")).trim();
  log(`change-location button -> setup card again: "${backToSetup}"`);

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
  await page.waitForSelector("#hero .hero", { timeout: 30000 });
  await page.waitForTimeout(500); // let the failed refresh settle into the err stamp
  const staleCat = (await page.textContent(".hero .cat")).trim();
  const staleStamp = (await page.textContent("#stamp")).trim();
  const staleStampClass = await page.getAttribute("#stamp", "class");
  log(`STALE PATH (network blocked, cache aged 24h): hero still renders "${staleCat}" from cache; ` +
    `stamp [${staleStampClass}]: "${staleStamp}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   ZIP 90012 through the first-run card, then the seeded LA location's own live fetch —
   both composite cache keys (ZIP coords + LA coords) end up in both versions. */
export async function v1Interact({ page }) {
  await page.waitForSelector(".setup h2", { timeout: 15000 });
  await page.fill("#zip", "90012");
  await page.press("#zip", "Enter");
  await page.waitForSelector("#hero .hero", { timeout: 30000 });
  await seedLA(page);
  await page.reload();
  await page.waitForSelector("#hero .hero", { timeout: 30000 });
  await page.waitForTimeout(300);
}
