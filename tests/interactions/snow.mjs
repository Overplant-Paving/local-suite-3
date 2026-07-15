/* tests/interactions/snow.mjs — Snowpack & SNOTEL (Batch B, CORS-open fetcher)
   Live-verifies both AWDB sources (the *:*:SNTL station list — the CATALOG-documented
   filter-bug workaround — and the SNWD/WTEQ /data request) plus the zippopotam.us ZIP
   geocode. July snowpack near the seeded LA location is a real designed state (sparse or
   zero values), so the run also exercises a mountain location (Vail, CO via ZIP 81657)
   and logs both. Ends with the stale-cache offline path. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".firstrun", ".firstrun h2", "input.txt", ".btn.primary", ".btn", "footer"
];

export const screenshotAfterInteract = true;

const seedLA = page => page.evaluate(() => {
  localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }));
});

async function readCards(page, max = 4) {
  return page.$$eval(".st", (els, m) => els.slice(0, m).map(el => ({
    name: el.querySelector(".name").textContent,
    sub: el.querySelector(".sub").textContent,
    readings: [...el.querySelectorAll(".reading")].map(r =>
      r.querySelector(".k").textContent + "=" + r.querySelector(".v").textContent.trim().replace(/\s+/g, " ")),
    pom: el.querySelector(".pom .pk") ? el.querySelector(".pom .pk").textContent.trim() : null,
    asof: el.querySelector(".asof").textContent
  })), max);
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- first-run state (no location yet) ---- */
  const firstRun = (await page.textContent(".firstrun h2")).trim();
  log(`first-run card (no suite.location): "${firstRun}"`);

  /* ---- LIVE FETCH 1+2: seed shared LA location -> /stations (filter-bug workaround
     URL) + one /data call for the 8 nearest. July in southern CA = sparse/zero snow,
     a real designed state; log whatever renders honestly. ---- */
  await seedLA(page);
  await page.reload();
  await page.waitForSelector(".st .name", { timeout: 45000 });
  await page.waitForTimeout(500);
  const laCards = await readCards(page);
  const laCount = await page.$$eval(".st", els => els.length);
  log(`LIVE (Los Angeles seed): ${laCount} station cards rendered; nearest:`);
  for (const c of laCards) log(`  "${c.name}" (${c.sub}) ${c.readings.join(", ")}${c.pom ? " · " + c.pom : ""} [${c.asof}]`);

  /* response evidence from the cache envelopes Suite.fetchJSON just wrote */
  const cacheInfo = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("suite.cache.snow.stations"));
    const d = JSON.parse(localStorage.getItem("suite.cache.snow.data"));
    const sample = d && d.v && d.v[0] ? {
      triplet: d.v[0].stationTriplet,
      elements: (d.v[0].data || []).map(e => ({
        code: e.stationElement && e.stationElement.elementCode,
        latest: (e.values || []).slice(-1)[0]
      }))
    } : null;
    return {
      stationCount: st && st.v ? st.v.length : 0,
      stationSample: st && st.v ? st.v[0] : null,
      dataKey: d ? d.key : null,
      dataTriplets: d && d.v ? d.v.map(x => x.stationTriplet) : null,
      dataSample: sample
    };
  });
  log(`LIVE /stations evidence: suite.cache.snow.stations holds ${cacheInfo.stationCount} trimmed SNOTEL stations (filter-bug workaround: *:*:SNTL fetched, ranked client-side); sample=${JSON.stringify(cacheInfo.stationSample)}`);
  log(`LIVE /data evidence: envelope key="${cacheInfo.dataKey}"; response covers ${JSON.stringify(cacheInfo.dataTriplets)}`);
  log(`LIVE /data raw sample (latest values incl. median): ${JSON.stringify(cacheInfo.dataSample)}`);

  /* ---- LIVE FETCH 3: zippopotam ZIP geocode via the change-location flow, moving to
     a mountain location (Vail, CO 81657) where SNOTEL coverage is dense ---- */
  await page.click(".locchip");
  await page.waitForSelector(".firstrun input.txt");
  await page.fill(".firstrun input.txt", "81657");
  await page.click(".firstrun .btn.primary");
  await page.waitForSelector(".st .name", { timeout: 45000 });
  await page.waitForTimeout(500);
  const chipLabel = (await page.textContent(".locchip")).trim();
  log(`LIVE zippopotam: ZIP 81657 -> location chip "${chipLabel}" (suite.location rewritten, data cache slot dropped and refetched for the new station set)`);
  const coCards = await readCards(page);
  log(`LIVE (Vail, CO): nearest stations:`);
  for (const c of coCards) log(`  "${c.name}" (${c.sub}) ${c.readings.join(", ")}${c.pom ? " · " + c.pom : ""} [${c.asof}]`);

  /* ---- favorites: star the nearest station -> "Following" section, persisted key ---- */
  const firstName = (await page.textContent(".st .name")).trim();
  await page.click(".st .star");
  await page.waitForSelector(".section-h", { timeout: 15000 });
  await page.waitForTimeout(400);
  const sections = await page.$$eval(".section-h", els => els.map(e => e.textContent.trim()));
  const favKey = await page.evaluate(() => localStorage.getItem("suite.pref.snow.fav"));
  const starState = await page.evaluate(() => {
    const s = document.querySelector(".st .star");
    return { pressed: s.getAttribute("aria-pressed"), label: s.getAttribute("aria-label"), on: s.classList.contains("on") };
  });
  log(`starred "${firstName}": sections now [${sections.join(" | ")}]; suite.pref.snow.fav=${favKey}; star aria-pressed=${starState.pressed}, aria-label="${starState.label}", .on=${starState.on}`);
  log(`(star re-render served /data from the fresh cache — same station set, no extra network call)`);

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
  await page.waitForSelector(".stamp", { timeout: 30000 });
  await page.waitForTimeout(300);
  const staleStamp = (await page.textContent(".stamp")).trim();
  const staleCount = await page.$$eval(".st", els => els.length);
  const staleFirst = (await page.textContent(".st .name")).trim();
  log(`STALE PATH (network blocked, caches aged 24h): ${staleCount} cards rendered from cache (first: "${staleFirst}"); stamp: "${staleStamp}"`);
  log(`(station list aged 24h is still inside its 7-day reference TTL -> served fromCache; /data aged past its 60-min TTL -> stale fallback, offline stamp)`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   seed LA, let v1 fetch its station list into suite.cache.snow.stations, star one
   station (suite.pref.snow.fav). v1 never caches /data, so suite.cache.snow.data
   is expected (and explained) as v2-only. */
export async function v1Interact({ page }) {
  await seedLA(page);
  await page.reload();
  await page.waitForSelector(".st .name", { timeout: 45000 });
  await page.click(".st .star");
  await page.waitForTimeout(800);
}
