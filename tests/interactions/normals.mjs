/* tests/interactions/normals.mjs — Climate Normals Comparator (Batch B, CORS-open, cx L)
   Live-verifies all three data sources:
     1. NCEI normals-daily (units=standard, °F) — auto-loaded nearest station + a picker switch
     2. Open-Meteo forecast — today's actual current/hi/lo
     3. Open-Meteo archive (ERA5) — the fallback climatology, forced by blocking only NCEI
   Recomputes the v1 verdict from the raw cached responses and compares to the render,
   then proves the stale-cache offline path (caches aged past the 7-day TTL, all network
   blocked — the 24h aging in the batch addendum would still be fresh under this TTL). */

export const selectors = [
  "body", ".back", ".theme-btn", "header h1", "header .tag",
  ".stationbar .name", ".mini", ".card", ".modal", ".fld input", ".btn", "footer"
];

export const screenshotAfterInteract = true;

const seedLA = page => page.evaluate(() => {
  localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }));
});

async function readComparison(page) {
  const verdict = (await page.textContent(".verdict .headline")).trim();
  const sub = (await page.textContent(".verdict .sub")).trim();
  const cmps = await page.$$eval(".cmp", els => els.map(e =>
    `${e.querySelector(".cl").textContent}=${e.querySelector(".cv").textContent.trim()}`));
  return { verdict, sub, cmps };
}

async function waitForStation(page, id, timeout = 45000) {
  await page.waitForFunction(sid =>
    document.getElementById("stMeta").textContent.includes(sid) &&
    document.querySelector(".verdict .headline"), id, { timeout });
  await page.waitForTimeout(300);
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- first-run state: no location, no saved station -> picker auto-opens ---- */
  const pickerOpen = await page.evaluate(() => document.getElementById("backdrop").classList.contains("open"));
  const allRows = await page.$$eval("#allList .st", els => els.length);
  const nearHidden = await page.evaluate(() => document.getElementById("nearWrap").classList.contains("hidden"));
  const firstMsg = (await page.textContent("#content .msg .big")).trim();
  log(`first run (no location/station): picker auto-open=${pickerOpen}, embedded station rows=${allRows}, ` +
    `nearest-list hidden (no location)=${nearHidden}, content card="${firstMsg}"`);

  /* ---- LIVE FETCH 1+2: seed shared LA location, reload -> nearest station auto-loads ---- */
  await seedLA(page);
  await page.reload();
  await page.waitForSelector(".verdict .headline", { timeout: 45000 });
  await page.waitForTimeout(400);

  const stName = (await page.textContent("#stName")).trim();
  const stMeta = (await page.textContent("#stMeta")).trim();
  log(`auto-selected nearest station to LA seed: "${stName}" (${stMeta})`);

  let r = await readComparison(page);
  log(`LIVE comparison render: verdict="${r.verdict}" sub="${r.sub}"`);
  log(`LIVE comparison tiles: ${r.cmps.join(" · ")}`);

  /* raw response evidence from the cache envelopes Suite.fetchJSON just wrote */
  const raw = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("suite.normals.station"));
    const n = JSON.parse(localStorage.getItem("suite.cache.normals." + st.id));
    const d = new Date();
    const today = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const row = n.v.find(x => x.DATE === today) || null;
    const actKey = Object.keys(localStorage).find(k => k.startsWith("suite.cache.normals.actual."));
    const a = actKey ? JSON.parse(localStorage.getItem(actKey)) : null;
    return {
      stId: st.id, rows: n.v.length, today, todayRow: row,
      actKey, current: a && a.v.current && a.v.current.temperature_2m,
      fcHi: a && a.v.daily.temperature_2m_max[0], fcLo: a && a.v.daily.temperature_2m_min[0]
    };
  });
  log(`LIVE NCEI response (suite.cache.normals.${raw.stId}): ${raw.rows} daily rows; ` +
    `today ${raw.today}: TMAX-NORMAL=${raw.todayRow && raw.todayRow["DLY-TMAX-NORMAL"]}°F, ` +
    `TMIN-NORMAL=${raw.todayRow && raw.todayRow["DLY-TMIN-NORMAL"]}°F (units=standard, real °F not tenths)`);
  log(`LIVE Open-Meteo actual (${raw.actKey}): current=${raw.current}°F, forecast hi=${raw.fcHi}°F lo=${raw.fcLo}°F`);

  /* recompute the v1 verdict from the raw values and compare to the render */
  const nHi = parseFloat(raw.todayRow["DLY-TMAX-NORMAL"]);
  const diff = raw.fcHi - nHi, ad = Math.abs(diff);
  const expected = ad < 1.5 ? "About normal"
    : diff > 0 ? `${ad.toFixed(0)}° warmer than normal` : `${ad.toFixed(0)}° cooler than normal`;
  log(`verdict math check: forecast hi ${raw.fcHi} vs normal hi ${nHi} -> diff ${diff.toFixed(1)} -> ` +
    `expected "${expected}"; rendered "${r.verdict}" -> ${expected === r.verdict ? "MATCH" : "MISMATCH"}`);

  const chart = await page.evaluate(() => {
    const s = document.getElementById("yearChart");
    return { paths: s.querySelectorAll("path").length, circles: s.querySelectorAll("circle").length,
      texts: s.querySelectorAll("text").length };
  });
  log(`year chart drawn: ${chart.paths} paths (band+hi+lo), ${chart.circles} today markers, ${chart.texts} axis labels`);
  log(`footer: "${(await page.textContent("#footer")).trim()}"`);
  log(`updated line: "${(await page.textContent("#updated")).trim()}"; ` +
    `status dot class="${await page.getAttribute("#statusDot", "class")}"`);

  /* ---- picker: nearest list, bad-ID validation, Esc close (no network) ---- */
  await page.click("#changeStation");
  const near = await page.$$eval("#nearList .st", els => els.map(e => e.textContent.trim().replace(/\s+/g, " ")));
  log(`picker with location set — "Nearest to you": ${near.join(" | ")}`);
  await page.fill("#idIn", "xyz");
  await page.click("#idBtn");
  log(`bad-ID validation ("xyz"): pickErr="${(await page.textContent("#pickErr")).trim()}"`);
  await page.keyboard.press("Escape");
  log(`Escape closes picker: backdrop open=${await page.evaluate(() =>
    document.getElementById("backdrop").classList.contains("open"))}`);

  /* ---- station switch via row click: San Diego (second live NCEI fetch) ---- */
  await page.click("#changeStation");
  await page.click('#allList .st[data-id="USW00023188"]');
  await waitForStation(page, "USW00023188");
  r = await readComparison(page);
  log(`station switch (picker row -> San Diego Intl): stationbar="${(await page.textContent("#stName")).trim()}"; ` +
    `verdict="${r.verdict}"; tiles: ${r.cmps.join(" · ")}`);

  /* ---- LIVE FETCH 3: archive fallback, forced by blocking only NCEI ---- */
  await page.context().route(/ncei\.noaa\.gov/, rt => rt.abort());
  await page.click("#changeStation");
  await page.fill("#idIn", "USW00023174"); // LAX — in STATIONS, so coords are known
  await page.click("#idBtn");
  await page.waitForFunction(() =>
    document.getElementById("footer").textContent.includes("Open-Meteo archive") &&
    document.querySelector(".verdict .headline"), null, { timeout: 90000 });
  await page.waitForTimeout(300);
  r = await readComparison(page);
  const archKey = await page.evaluate(() =>
    Object.keys(localStorage).find(k => k.startsWith("suite.cache.normals.archive.")));
  const archToday = await page.evaluate(k => {
    const e = JSON.parse(localStorage.getItem(k));
    const d = new Date();
    const today = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { days: Object.keys(e.v.byDate).length, today: e.v.byDate[today], source: e.v.source };
  }, archKey);
  log(`ARCHIVE FALLBACK (NCEI blocked, manual ID USW00023174/LAX): verdict="${r.verdict}"; tiles: ${r.cmps.join(" · ")}`);
  log(`archive climatology cached at ${archKey}: ${archToday.days} MM-DD entries, source="${archToday.source}", ` +
    `today's computed normal hi/lo=${archToday.today && archToday.today.hi.toFixed(1)}/${archToday.today && archToday.today.lo.toFixed(1)}°F`);
  log(`footer (fallback attribution): "${(await page.textContent("#footer")).trim()}"`);
  await page.context().unroute(/ncei\.noaa\.gov/);

  /* ---- back to San Diego: NCEI cache is fresh within the 7-day TTL -> served from cache ---- */
  await page.click("#changeStation");
  await page.click('#allList .st[data-id="USW00023188"]');
  await waitForStation(page, "USW00023188");
  log(`re-selected San Diego: rendered from fresh cache (7-day TTL) — saved station for the reload test`);

  /* ---- STALE-CACHE OFFLINE PATH ----
     The addendum's 24h aging stays fresh under this tool's 7-day TTL, so age 8 days. */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      if (e && typeof e === "object" && "t" in e) {
        e.t = Date.now() - 8 * 24 * 60 * 60 * 1000;
        localStorage.setItem(k, JSON.stringify(e));
      }
    }
  });
  await page.context().route(/^https?:/, rt => rt.abort());
  await page.reload();
  await page.waitForSelector(".verdict .headline", { timeout: 30000 });
  await page.waitForTimeout(300);
  r = await readComparison(page);
  log(`STALE PATH (caches aged 8 days, all network blocked, reload): verdict="${r.verdict}" sub="${r.sub}"`);
  log(`STALE tiles (normals from stale cache, actuals honestly "—"): ${r.cmps.join(" · ")}`);
  log(`STALE updated line: "${(await page.textContent("#updated")).trim()}"; ` +
    `status dot class="${await page.getAttribute("#statusDot", "class")}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Mirror the state-writing actions on v1 so localStorage key sets compare:
   seed LA (auto-loads LA Downtown, writes suite.normals.station +
   suite.cache.normals.USW00093134), then the same picker switch to San Diego
   (writes suite.cache.normals.USW00023188). The v2-only archive + actual.*
   cache keys are explained in the report. */
export async function v1Interact({ page }) {
  await seedLA(page);
  await page.reload();
  await page.waitForSelector(".verdict .headline", { timeout: 45000 });
  await page.waitForTimeout(400);
  await page.click("#changeStation");
  await page.click('#allList .st[data-id="USW00023188"]');
  await page.waitForFunction(() =>
    document.getElementById("stMeta").textContent.includes("USW00023188") &&
    document.querySelector(".verdict .headline"), null, { timeout: 45000 });
  await page.waitForTimeout(400);
}
