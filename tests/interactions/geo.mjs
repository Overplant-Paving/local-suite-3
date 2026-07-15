/* tests/interactions/geo.mjs — Geocoder & Coordinate Toolbox (Batch B, cors-open)
   Offline math first (DMS round-trip with known values, LA->SF distance/bearing),
   then one live fetch per data source: Open-Meteo forward geocode ("Denver"),
   Census JSONP forward geocode (one US street address) plus a plain-fetch CORS
   probe against the Census endpoint recorded from the page, Nominatim reverse
   geocode (throttled, one request). Then the Batch B stale-cache offline path:
   back-date suite.cache.*, abort all http(s), reload, and re-run all three
   lookups — each must render from its cache with the "Offline — showing cached
   results from …" note, not a blank. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  "#locBar", ".card", ".card h2", "#fwdQ", ".btn.primary", "footer"
];

export const screenshotAfterInteract = true;

const SEED = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

async function firstResult(page, boxSel) {
  await page.waitForFunction(sel =>
    document.querySelector(`${sel} .r`) || document.querySelector(`${sel} .hint.err`) ||
    (document.querySelector(`${sel} .hint`) && !document.querySelector(sel).textContent.includes("…")),
    boxSel, { timeout: 25000 });
  return page.evaluate(sel => {
    const r = document.querySelector(`${sel} .r`);
    if (!r) return { text: document.querySelector(sel).textContent.trim() };
    return {
      name: r.querySelector(".name").textContent,
      sub: r.querySelector(".sub").textContent,
      co: r.querySelector(".co").textContent,
      tag: r.querySelector(".src-tag").textContent,
      note: (document.querySelector(`${sel} > .hint:last-child`) || {}).textContent || ""
    };
  }, boxSel);
}

export async function interact({ page, log, evidenceDir }) {
  /* seed the shared location so the loc bar renders with data (parity with v1Interact) */
  await page.evaluate(s => { localStorage.setItem("suite.location", JSON.stringify(s)); }, SEED);
  await page.reload();
  await page.waitForTimeout(400);
  log(`loc bar after seeding suite.location: "${(await page.textContent("#locBar")).trim()}"`);

  /* ---- offline math: decimal -> DMS -> decimal round trip (White House) ---- */
  await page.fill("#decLat", "38.8977");
  await page.fill("#decLon", "-77.0365");
  await page.click("#toDMS");
  const dmsLat = await page.inputValue("#dmsLat");
  const dmsLon = await page.inputValue("#dmsLon");
  log(`DMS conversion: 38.8977, -77.0365 -> lat "${dmsLat}" lon "${dmsLon}"`);
  log(`  (expected 38° 53' 51.72" N / 77° 2' 11.40" W)`);
  await page.click("#toDec");
  log(`DMS round-trip back to decimal: lat "${await page.inputValue("#decLat")}" lon "${await page.inputValue("#decLon")}"`);
  log(`  conv-out: "${(await page.textContent("#convOut")).trim()}"`);

  /* ---- offline math: LA -> SF distance & bearing (known ~559 km, ~324° NW) ---- */
  await page.fill("#ptA", "34.0522, -118.2437");
  await page.fill("#ptB", "37.7749, -122.4194");
  await page.click("#dbGo");
  log(`distance/bearing LA->SF: "${(await page.textContent("#dbOut")).replace(/\s+/g, " ").trim()}"`);
  log(`  (expected 559.12 km / 347.4 mi; initial forward azimuth 318.96° ~ 319.0° NW by hand calculation)`);

  /* ---- live fetch 1: Open-Meteo forward geocode ---- */
  await page.fill("#fwdQ", "Denver");
  await page.selectOption("#fwdSrc", "openmeteo");
  await page.click("#fwdGo");
  let r = await firstResult(page, "#fwdRes");
  log(`Open-Meteo live geocode "Denver": name="${r.name}" sub="${r.sub}" coords=${r.co} tag=${r.tag}`);

  /* "use in tools" wiring: coordinates flow to the DMS + distance sections */
  await page.click("#fwdRes .r:first-child button:has-text('use in tools')");
  log(`"use in tools": decLat=${await page.inputValue("#decLat")} decLon=${await page.inputValue("#decLon")} ptA="${await page.inputValue("#ptA")}"`);

  /* "save as suite location": writes the shared suite.location key */
  await page.click("#fwdRes .r:first-child button:has-text('save as suite location')");
  await page.waitForTimeout(200);
  const savedLoc = await page.evaluate(() => localStorage.getItem("suite.location"));
  log(`"save as suite location": suite.location = ${savedLoc}`);
  log(`  loc bar now: "${(await page.textContent("#locBar")).trim()}"`);

  /* ---- Census CORS probe: does a PLAIN fetch work from a browser page today?
     Run on a second page in the same context so the expected CORS console error
     doesn't count against the tool page (the block itself is the finding). */
  const probePage = await page.context().newPage();
  await probePage.goto(page.url());
  const probe = await probePage.evaluate(async () => {
    const u = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" +
      encodeURIComponent("1600 Pennsylvania Ave NW, Washington, DC");
    try { const r = await fetch(u); return "fetch OK, HTTP " + r.status; }
    catch (e) { return "fetch FAILED: " + (e.message || e); }
  });
  await probePage.close();
  log(`Census plain-fetch CORS probe (from a file:// page): ${probe}`);

  /* ---- live fetch 2: Census forward geocode via JSONP (the v1 path) ---- */
  await page.fill("#fwdQ", "1600 Pennsylvania Ave NW, Washington, DC");
  await page.selectOption("#fwdSrc", "census");
  await page.click("#fwdGo");
  r = await firstResult(page, "#fwdRes");
  log(`Census JSONP live geocode: ${r.name ? `name="${r.name}" coords=${r.co} tag=${r.tag}` : `NO RESULT: "${r.text}"`}`);

  /* ---- live fetch 3: Nominatim reverse geocode (one request, throttled) ---- */
  await page.fill("#revQ", "38.8977, -77.0365");
  await page.click("#revGo");
  r = await firstResult(page, "#revRes");
  log(`Nominatim live reverse geocode 38.8977,-77.0365: name="${r.name}" coords=${r.co} tag=${r.tag}`);
  log(`  sub="${(r.sub || "").slice(0, 120)}"`);

  /* ---- stale-cache offline path (Batch B addendum) ----
     geo's TTL is 7 days (reference data), so back-date 8 days to get past it —
     the addendum's 24 h would still be TTL-fresh here. */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 8 * 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, rt => rt.abort());
  await page.reload();
  await page.waitForTimeout(400);

  /* Open-Meteo query from stale cache */
  await page.fill("#fwdQ", "Denver");
  await page.selectOption("#fwdSrc", "openmeteo");
  await page.click("#fwdGo");
  r = await firstResult(page, "#fwdRes");
  log(`offline stale Open-Meteo "Denver": name="${r.name}" coords=${r.co}`);
  log(`  stale note: "${r.note}"`);

  /* Nominatim reverse from stale cache */
  await page.fill("#revQ", "38.8977, -77.0365");
  await page.click("#revGo");
  r = await firstResult(page, "#revRes");
  log(`offline stale Nominatim reverse: name="${r.name}" coords=${r.co}`);
  log(`  stale note: "${r.note}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });

  /* Census from stale cache (manual envelope) — logged after the screenshot so the
     shot shows both fetchJSON-cached sections */
  await page.fill("#fwdQ", "1600 Pennsylvania Ave NW, Washington, DC");
  await page.selectOption("#fwdSrc", "census");
  await page.click("#fwdGo");
  r = await firstResult(page, "#fwdRes");
  log(`offline stale Census JSONP: ${r.name ? `name="${r.name}" coords=${r.co}` : `NO RESULT: "${r.text}"`}`);
  log(`  stale note: "${r.note}"`);
  await page.context().unroute(/^https?:/);
}

/* v1 writes no cache keys (it never cached); the only state keys are suite.location
   (seeded identically here) and suite.theme (harness toggle). The v2-only
   suite.cache.geo.* keys are the policy-mandated caching addition — explained in
   report.md. No network actions on v1 = zero extra load on the shared APIs. */
export async function v1Interact({ page }) {
  await page.evaluate(s => { localStorage.setItem("suite.location", JSON.stringify(s)); },
    { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" });
  await page.reload();
  await page.waitForTimeout(400);
}
