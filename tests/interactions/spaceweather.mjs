/* tests/interactions/spaceweather.mjs — Space Weather & Aurora Station (Batch B)
   Live-verifies all four SWPC data sources (planetary K-index, NOAA scales, solar-wind
   speed, solar-wind mag field) plus the zippopotam.us ZIP geocode, recomputes the
   expected Kp gauge band / G-level / aurora verdict from the RAW cached responses and
   compares them to what rendered, proves a second load is served entirely from the
   TTL cache (zero SWPC requests), then proves the stale-cache offline path. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", ".locbar",
  ".loclabel", ".linklike", ".panel", ".card-msg", ".field input", ".btn", "footer"
];

export const screenshotAfterInteract = true;

/* ---- expected-value model, replicated from the tool (v1-identical math) ---- */
function gLevel(kp) {
  if (kp < 5) return kp < 4 ? "Quiet / unsettled" : "Active";
  const g = Math.min(5, Math.floor(kp) - 4);
  return { 1: "G1 · Minor storm", 2: "G2 · Moderate storm", 3: "G3 · Strong storm",
    4: "G4 · Severe storm", 5: "G5 · Extreme storm" }[g];
}
const KP_LAT = { 0: 66.5, 1: 64.5, 2: 62.5, 3: 60.5, 4: 58.5, 5: 56.5, 6: 54.5, 7: 52.5, 8: 50.5, 9: 48.5 };
function expectedVerdict(kp, lat) {
  const alat = Math.abs(lat);
  if (alat >= KP_LAT[Math.max(0, Math.min(9, Math.floor(kp)))]) return "Aurora may be visible tonight";
  let needed = null;
  for (let k = 0; k <= 9; k++) { if (alat >= KP_LAT[k]) { needed = k; break; } }
  return needed == null ? "Aurora very unlikely here" : "No aurora expected right now";
}
/* Kp severity ramp: which tool CSS variable the gauge/readout should be colored with */
function kpVar(kp) {
  if (kp < 4) return "--quiet";
  if (kp < 5) return "--unsettled";
  if (kp < 6) return "--minor";
  if (kp < 8) return "--storm";
  return "--severe";
}

const seedLA = page => page.evaluate(() => {
  localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }));
});

export async function interact({ page, log, evidenceDir }) {
  /* ---- first-run state (no location yet) ---- */
  const firstRun = (await page.textContent("#main .card-msg .big")).trim();
  log(`first-run card (no suite.location): "${firstRun}"`);

  /* ---- LIVE FETCH: seed the shared LA location, reload, one real call per SWPC source ---- */
  await seedLA(page);
  await page.reload();
  await page.waitForSelector(".aurora .verdict", { timeout: 20000 });
  await page.waitForTimeout(300);

  /* raw response evidence from the per-endpoint envelopes Suite.fetchJSON just wrote */
  const raw = await page.evaluate(() => {
    const get = k => JSON.parse(localStorage.getItem("suite.cache.spaceweather." + k));
    const kp = get("kp"), scales = get("scales"), speed = get("windspeed"), mag = get("windmag");
    const rows = kp.v.filter(r => r && typeof r.Kp === "number");
    const latest = rows[rows.length - 1];
    return {
      kpLatest: latest, kpRows: rows.length,
      scales0: scales.v["0"],
      speed0: speed && speed.v[0], mag0: mag && mag.v[0]
    };
  });
  log(`LIVE noaa-planetary-k-index.json: ${raw.kpRows} numeric rows; latest = Kp ${raw.kpLatest.Kp} @ ${raw.kpLatest.time_tag}`);
  log(`LIVE noaa-scales.json (current "0"): R=${raw.scales0.R.Scale}/${raw.scales0.R.Text} S=${raw.scales0.S.Scale}/${raw.scales0.S.Text} G=${raw.scales0.G.Scale}/${raw.scales0.G.Text}`);
  log(`LIVE solar-wind-speed.json: ${JSON.stringify(raw.speed0)}`);
  log(`LIVE solar-wind-mag-field.json: ${JSON.stringify(raw.mag0)}`);

  /* Kp gauge readout vs raw value */
  const kpText = (await page.textContent(".gauge-read .kp")).trim();
  const glabel = (await page.textContent(".gauge-read .glabel")).trim();
  const gwhen = (await page.textContent(".gauge-read .gwhen")).trim();
  const kp = raw.kpLatest.Kp;
  log(`LIVE Kp readout: rendered "${kpText}" (expected to start with ${kp.toFixed(2)}) -> ${kpText.startsWith(kp.toFixed(2)) ? "MATCH" : "MISMATCH"}; ${gwhen}`);
  log(`G-level label: rendered "${glabel}", expected "${gLevel(kp)}" -> ${glabel === gLevel(kp) ? "MATCH" : "MISMATCH"}`);

  /* gauge + readout color = the Kp severity CSS variable */
  const colorCheck = await page.evaluate(v => {
    const want = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const hexToRgb = h => `rgb(${parseInt(h.slice(1,3),16)}, ${parseInt(h.slice(3,5),16)}, ${parseInt(h.slice(5,7),16)})`;
    const read = getComputedStyle(document.querySelector(".gauge-read .kp")).color;
    const arc = document.querySelectorAll(".gauge path")[1].getAttribute("stroke");
    return { want, wantRgb: hexToRgb(want), read, arc };
  }, kpVar(kp));
  log(`Kp color band: expected var(${kpVar(kp)})=${colorCheck.want}; readout color ${colorCheck.read} -> ` +
    `${colorCheck.read === colorCheck.wantRgb ? "MATCH" : "MISMATCH"}; gauge arc stroke="${colorCheck.arc}"`);

  /* sparkline: one point per Kp history row (last 24 of the 3-day series) */
  const sparkPts = await page.evaluate(() =>
    document.querySelector(".spark polyline").getAttribute("points").split(" ").length);
  const sparkLabel = (await page.textContent(".spark .sl")).trim();
  const expPts = Math.min(24, raw.kpRows);
  log(`sparkline: ${sparkPts} points (expected ${expPts}) -> ${sparkPts === expPts ? "MATCH" : "MISMATCH"}; label "${sparkLabel}"`);

  /* aurora verdict for the seeded LA latitude, recomputed from the raw Kp */
  const verdict = (await page.textContent(".aurora .verdict")).trim();
  const sub = (await page.textContent(".aurora .sub")).trim();
  log(`LIVE aurora answer (LA, lat 34.0522): "${verdict}" — "${sub}"`);
  log(`aurora verdict check: expected "${expectedVerdict(kp, 34.0522)}" for Kp ${kp} -> ${verdict === expectedVerdict(kp, 34.0522) ? "MATCH" : "MISMATCH"}`);

  /* solar wind cells vs raw summary responses */
  const cells = await page.$$eval(".wind .wcell", els =>
    els.map(e => `${e.querySelector(".k").textContent}=${e.querySelector(".v").textContent.trim().replace(/\s+/g, " ")}`));
  log(`LIVE solar wind cells: ${cells.join(" · ")}`);
  const expSpeed = raw.speed0 ? String(Math.round(raw.speed0.proton_speed)) : "—";
  const expBt = raw.mag0 ? (+raw.mag0.bt).toFixed(1) : "—";
  const expBz = raw.mag0 ? (+raw.mag0.bz_gsm).toFixed(1) : "—";
  const cellVal = c => c.slice(c.lastIndexOf("=") + 1).trim().split(" ")[0]; // labels may contain "=" ("Bz (south = active)")
  const gotSpeed = cellVal(cells[0]), gotBt = cellVal(cells[1]), gotBz = cellVal(cells[2]);
  log(`wind check: speed ${gotSpeed}/${expSpeed}, bt ${gotBt}/${expBt}, bz ${gotBz}/${expBz} (rendered/expected) -> ` +
    `${gotSpeed === expSpeed && gotBt === expBt && gotBz === expBz ? "MATCH" : "MISMATCH"}; density "—" by design (v1 never sources it)`);

  /* NOAA scale cells vs raw noaa-scales.json */
  const scs = await page.$$eval(".scales .sc", els =>
    els.map(e => `${e.querySelector(".lv").textContent}(${e.querySelector(".tx").textContent})`));
  const s0 = raw.scales0;
  const expScs = [`R${s0.R.Scale ?? "0"}(${s0.R.Text ?? "none"})`, `S${s0.S.Scale ?? "0"}(${s0.S.Text ?? "none"})`, `G${s0.G.Scale ?? "0"}(${s0.G.Text ?? "none"})`];
  log(`LIVE NOAA scales rendered: ${scs.join(" ")} — expected ${expScs.join(" ")} -> ${scs.join() === expScs.join() ? "MATCH" : "MISMATCH"}`);

  const updated = (await page.textContent("#updated")).trim();
  log(`updated line: "${updated}"`);

  /* ---- v1 blob cache kept current: write-then-read-back verification ---- */
  const blob = await page.evaluate(() => {
    const raw = localStorage.getItem("suite.cache.spaceweather");
    if (!raw) return null;
    const e = JSON.parse(raw);
    return { bytes: raw.length, t: e.t, kp: e.v.kp, histLen: e.v.kpHistory.length, hasScales: !!e.v.scales, wind: e.v.wind };
  });
  log(`v1 blob cache (suite.cache.spaceweather) read-back: ${blob ? `OK — ${blob.bytes} bytes, model kp=${blob.kp} (${blob.kp === kp ? "matches live Kp" : "MISMATCH"}), ${blob.histLen} history points, wind=${JSON.stringify(blob.wind)}` : "MISSING — write failed"}`);
  const quota = await page.evaluate(() => {
    let total = 0;
    for (const k of Object.keys(localStorage)) total += k.length + localStorage.getItem(k).length;
    return total;
  });
  log(`localStorage total footprint after live load: ${quota} chars (~${(quota/1024).toFixed(1)} KB) — no ~1 MB aurora grid: v1 never fetches ovation_aurora_latest.json (see report.md)`);

  /* ---- SECOND LOAD WITHIN TTL: must serve from cache, zero SWPC requests ---- */
  let swpcReqs = 0;
  const counter = req => { if (req.url().includes("services.swpc.noaa.gov")) swpcReqs++; };
  page.on("request", counter);
  await page.reload();
  await page.waitForSelector(".aurora .verdict", { timeout: 20000 });
  await page.waitForTimeout(500);
  page.off("request", counter);
  const kpText2 = (await page.textContent(".gauge-read .kp")).trim();
  const updated2 = (await page.textContent("#updated")).trim();
  log(`SECOND LOAD (within 10-min TTL): ${swpcReqs} requests to services.swpc.noaa.gov (expected 0 — served from suite.cache.spaceweather.* envelopes); rendered Kp "${kpText2}", updated line "${updated2}"`);

  /* ---- LIVE FETCH: zippopotam ZIP geocode via the change-location flow ---- */
  await page.click("#changeLoc");
  await page.fill("#zip", "90012");
  await page.click("#zipGo");
  await page.waitForSelector(".aurora .verdict", { timeout: 20000 });
  const zipLabel = (await page.textContent("#locLabel")).trim();
  log(`LIVE zippopotam: ZIP 90012 -> locLabel "${zipLabel}"; space-weather data re-rendered for the new latitude (SWPC still fresh in cache)`);

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
  await page.waitForSelector(".aurora .verdict", { timeout: 20000 });
  await page.waitForTimeout(300);
  const staleKp = (await page.textContent(".gauge-read .kp")).trim();
  const staleUpdated = (await page.textContent("#updated")).trim();
  log(`STALE PATH (network blocked, caches aged 24h): rendered Kp "${staleKp}" from stale cache; updated line: "${staleUpdated}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   seed the LA location and let v1 do its own live fetch into suite.cache.spaceweather. */
export async function v1Interact({ page }) {
  await seedLA(page);
  await page.reload();
  await page.waitForSelector(".aurora .verdict", { timeout: 20000 });
  await page.waitForTimeout(300);
}
