/* tests/interactions/asteroids.mjs — Near-Earth Asteroid Watch
   NeoWs RE-SOURCE VERIFICATION (Batch C, orchestrator-ruled)

   Context: ssd-api.jpl.nasa.gov/cad.api dropped its CORS headers ~Jul 2026 (archived in
   cors-live-failure.txt from the Batch B run); the tool was re-sourced to NASA NeoWs
   (api.nasa.gov/neo/rest/v1/feed, ACAO * live-verified — neows-live-headers.txt).

   Strategy, fully disclosed (DEMO_KEY is a shared 30/hr pool — budget: ONE live request):
   1. Every harness context route-fulfills NeoWs requests from the archived real 7-day
      payload (neows-live-d7.json, fetched live 2026-07-16 by the re-source probe),
      date-normalized to the run date. The paged 30-day window's later chunks are the same
      real data date-shifted forward — synthetic fixtures, clearly labeled, used only to
      exercise the paging/merge logic deterministically.
   2. interact() makes exactly ONE real in-browser NeoWs request (the refresh click with
      routing set to pass through) — the full live CORS + render pipeline from file:// —
      and archives the body + headers (neows-live-run-d7.json / -headers.txt).
   3. The 429 rate-limit path (flags: ["rl"]) is verified deterministically via
      route-fulfilled 429s; the real API is never hammered.
   4. v1 (../Local Suite) still fetches cad.api; its requests are route-fulfilled from the
      archived cad-live-d7/d30.json so the localStorage-parity pass can run at all. */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "h1", ".sub",
  ".controls", "#window", "#refreshBtn", "#stamp", ".foot-note", "footer"
];

export const screenshotAfterInteract = true;

const AU_KM = 149597870.7, LD_KM = 384400, AU_LD = AU_KM / LD_KM; // tool's constants (389.1725 LD/AU)
const NEOWS_RE = /api\.nasa\.gov\/neo\/rest\/v1\/feed/;
const CAD_RE = /ssd-api\.jpl\.nasa\.gov\/cad\.api/;
const EV_DIR = join(import.meta.dirname, "..", "evidence", "asteroids");
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* archived real payloads */
const base = JSON.parse(readFileSync(join(EV_DIR, "neows-live-d7.json"), "utf8"));
const baseDates = Object.keys(base.near_earth_objects).sort(); // 8 date buckets
const cadBodies = {
  7: readFileSync(join(EV_DIR, "cad-live-d7.json"), "utf8"),
  30: readFileSync(join(EV_DIR, "cad-live-d30.json"), "utf8")
};

/* Build a NeoWs feed body for [startStr..endStr] (inclusive) from the archived real data:
   bucket i of the archive is remapped onto date start+i, close-approach timestamps shifted
   by the same delta. Chunk 0 is thus the real payload date-normalized to the run date;
   chunks 1-3 of the 30-day window are the same real data shifted forward (synthetic). */
function bodyFor(startStr, endStr) {
  const start = Date.parse(startStr + "T00:00:00Z");
  const nDays = Math.round((Date.parse(endStr + "T00:00:00Z") - start) / 86400000);
  const out = { element_count: 0, near_earth_objects: {} };
  for (let i = 0; i <= nDays && i < baseDates.length; i++) {
    const nd = new Date(start + i * 86400000).toISOString().slice(0, 10);
    const shiftMs = Date.parse(nd + "T00:00:00Z") - Date.parse(baseDates[i] + "T00:00:00Z");
    out.near_earth_objects[nd] = base.near_earth_objects[baseDates[i]].map(neo => {
      const c = JSON.parse(JSON.stringify(neo));
      c.close_approach_data = (c.close_approach_data || []).map(ca => {
        const t = new Date((ca.epoch_date_close_approach || 0) + shiftMs);
        ca.epoch_date_close_approach = t.getTime();
        ca.close_approach_date = t.toISOString().slice(0, 10);
        ca.close_approach_date_full = t.getUTCFullYear() + "-" + MON[t.getUTCMonth()] + "-" +
          String(t.getUTCDate()).padStart(2, "0") + " " +
          String(t.getUTCHours()).padStart(2, "0") + ":" + String(t.getUTCMinutes()).padStart(2, "0");
        return ca;
      });
      return c;
    });
    out.element_count += out.near_earth_objects[nd].length;
  }
  return out;
}

/* ---- route modes (module-level so interact() can flip them) ---- */
let liveMode = false;   // pass the next NeoWs request through to the real API (the ONE budgeted request)
let rlMode = false;     // fulfill NeoWs with a synthetic 429 (deterministic rl verification)
const neowsUrls = [];   // every NeoWs request the routes saw, in order
let fulfilled = 0;      // how many were served from the archived fixture

async function routeAll(ctx) {
  await ctx.route(CAD_RE, route => { // v1 only
    const u = new URL(route.request().url());
    const span = Math.round((Date.parse(u.searchParams.get("date-max")) -
      Date.parse(u.searchParams.get("date-min"))) / 86400000);
    const body = cadBodies[span];
    if (body) return route.fulfill({ status: 200, contentType: "application/json", body });
    return route.abort();
  });
  await ctx.route(NEOWS_RE, route => {
    const u = new URL(route.request().url());
    neowsUrls.push(route.request().url());
    if (liveMode) return route.continue(); // real network — the ONE budgeted request
    if (rlMode) return route.fulfill({ status: 429, contentType: "application/json",
      body: JSON.stringify({ error: { code: "OVER_RATE_LIMIT", message: "synthetic throttle (deterministic rl test)" } }) });
    fulfilled++;
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(bodyFor(u.searchParams.get("start_date"), u.searchParams.get("end_date"))) });
  });
}
const realLaunch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await realLaunch(...args);
  const realNewContext = browser.newContext.bind(browser);
  browser.newContext = async (...ca) => {
    const ctx = await realNewContext(...ca);
    await routeAll(ctx);
    return ctx;
  };
  return browser;
};

async function waitForView(page) {
  await page.waitForSelector("#view .hero, #view .msg:not(.skeleton)", { timeout: 30000 });
}
const stamp = page => page.locator("#stamp").innerText().then(s => s.trim());

export async function interact({ page, log, evidenceDir }) {
  log("NOTE: RE-SOURCED to NASA NeoWs (cad.api dropped CORS ~Jul 2026 — see cors-live-failure.txt).");
  log("NOTE: NeoWs requests are route-fulfilled from the archived real payload neows-live-d7.json");
  log("NOTE: (date-normalized; 30-day chunks 2-4 are that data date-shifted — synthetic, paging-only).");
  log("NOTE: Exactly ONE real DEMO_KEY request is made below (shared 30/hr pool — budget honored).");

  /* ---- initial 7-day load (route-fulfilled) + demo-key nudge ---- */
  await waitForView(page);
  log(`stamp after fulfilled load: "${await stamp(page)}"`);
  const nudge = (await page.locator("#keySummary").innerText()).trim();
  if (!/demo key/.test(nudge)) throw new Error("demo-key nudge missing: " + nudge);
  log(`demo-key nudge (designed state): "${nudge}"`);

  /* ---- THE ONE LIVE REQUEST: refresh with routing passed through ----
     Phase 4 adjustment: runs in its OWN context (the rl-probe pattern below, same
     justification): Chrome unconditionally logs a console error for ANY non-2xx fetch
     response, so when the shared DEMO_KEY pool is exhausted at run time (observed
     2026-07-16: HTTP 429 with retry-after ~18 h) that browser noise — not a tool
     defect; the tool renders its designed fallback — would fail the console gate on
     the gated page. The probe's console is captured and logged in full below. Still
     exactly ONE real request per run. */
  {
    const liveCtx = await page.context().browser().newContext();
    const lp = await liveCtx.newPage();
    const liveConsole = [];
    lp.on("console", m => { if (m.type() === "error") liveConsole.push(m.text()); });
    await lp.goto(page.url());
    await waitForView(lp); // initial load route-fulfilled, as on the gated page
    liveMode = true;
    const respP = lp.waitForResponse(r => NEOWS_RE.test(r.url()), { timeout: 30000 });
    await lp.click("#refreshBtn");
    const resp = await respP;
    liveMode = false;
    const h = resp.headers();
    const liveStatus = resp.status();
    let liveBody = null;
    try { liveBody = await resp.text(); } catch (e) { /* body unavailable on failure */ }
    log(`LIVE NeoWs fetch (in-browser from file://, DEMO_KEY): HTTP ${liveStatus}, ` +
      `Access-Control-Allow-Origin: ${h["access-control-allow-origin"] || "ABSENT"}, ` +
      `X-Ratelimit-Limit: ${h["x-ratelimit-limit"]}, X-Ratelimit-Remaining: ${h["x-ratelimit-remaining"]}`);
    writeFileSync(join(evidenceDir, "neows-live-run-headers.txt"),
      `url: ${resp.url()}\nstatus: ${liveStatus}\nfetched: ${new Date().toISOString()}\n` +
      Object.entries(h).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n");
    if (liveStatus === 200 && liveBody) {
      writeFileSync(join(evidenceDir, "neows-live-run-d7.json"), liveBody);
      await lp.waitForFunction(() => /^Loaded just now/.test(document.getElementById("stamp").textContent), { timeout: 15000 });
      log(`live render: stamp "${await stamp(lp)}" — full browser CORS + render pipeline, real data`);
    } else {
      // Shared pool exhausted at run time: the rl designed state IS the correct behavior; say so.
      await lp.waitForFunction(() => /rate-limiting|Live fetch failed/.test(document.getElementById("stamp").textContent), { timeout: 15000 });
      log(`LIVE REQUEST NOT 200 (shared DEMO_KEY pool) — designed fallback rendered: "${await stamp(lp)}"`);
      log(`the live-CORS claim then rests on neows-live-headers.txt (archived probe) — flag for the orchestrator`);
    }
    log(`live probe console (browser noise expected for any non-2xx fetch response): ` +
      (liveConsole.length ? liveConsole.map(s => JSON.stringify(s)).join(", ") : "(none)"));
    await liveCtx.close();
  }

  /* ---- LD math: recompute independently from what the page actually cached/rendered ---- */
  const feed = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.cache.asteroids.d7")).v);
  const approaches = [];
  for (const d of Object.keys(feed.near_earth_objects)) {
    for (const neo of feed.near_earth_objects[d]) {
      for (const ca of neo.close_approach_data || []) {
        approaches.push({
          name: (neo.name || "").trim(), pha: !!neo.is_potentially_hazardous_asteroid,
          h: neo.absolute_magnitude_h, au: parseFloat(ca.miss_distance.astronomical),
          lunarApi: parseFloat(ca.miss_distance.lunar), kmApi: parseFloat(ca.miss_distance.kilometers),
          cd: ca.close_approach_date_full
        });
      }
    }
  }
  approaches.sort((a, b) => a.au - b.au);
  const top = approaches[0];
  const ldComputed = top.au * AU_LD;
  const kmComputed = Math.round(top.au * AU_KM);
  const heroName = (await page.locator(".hero .name").innerText()).trim();
  const heroLD = parseFloat((await page.locator("#hLD").innerText()).trim());
  const heroKM = (await page.locator("#hKM").innerText()).replace(/\s+/g, " ").trim();
  const heroWhen = (await page.locator(".hero .when").innerText()).trim();
  log(`hero: "${heroName}" (expected "${top.name}"), when="${heroWhen}"`);

  /* ---- Phase 4 audit fix: honest time labeling. The hero "when" is labeled "UTC",
     so the clock shown must be the payload's UTC close-approach time — computed here
     independently with an explicit timeZone:"UTC" — not the local rendering of it
     (the preserved v1 quirk showed local time under the UTC label). ---- */
  const expectWhen = await page.evaluate(cd => {
    const m = cd.match(/(\d{4})-(\w{3})-(\d{2})\s+(\d{2}):(\d{2})/);
    const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(m[2]);
    const d = new Date(Date.UTC(+m[1], mo, +m[3], +m[4], +m[5]));
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
  }, top.cd);
  log(`honest-UTC label check: payload cd="${top.cd}" -> expected "${expectWhen}"; ` +
    `rendered "${heroWhen}" (machine tz offset ${new Date().getTimezoneOffset()} min from UTC)`);
  if (!heroWhen.startsWith(expectWhen)) throw new Error(`hero "when" is not the UTC time its label claims: "${heroWhen}" vs "${expectWhen}"`);
  log(`LD recompute (independent): ${top.au} AU × ${AU_LD.toFixed(4)} = ${ldComputed.toFixed(4)} LD; ` +
    `NeoWs miss_distance.lunar=${top.lunarApi}; rendered #hLD=${heroLD}`);
  log(`LD constant note: NeoWs lunar/astronomical = ${(top.lunarApi / top.au).toFixed(4)} (flat 389 LD/AU); ` +
    `tool keeps v1's 384,400 km LD (389.1725) — delta ${(Math.abs(ldComputed - top.lunarApi) / top.lunarApi * 100).toFixed(3)}%`);
  log(`km cross-check: computed ${kmComputed.toLocaleString("en-US")} km, NeoWs kilometers=${Math.round(top.kmApi).toLocaleString("en-US")}, rendered "${heroKM}"`);
  if (heroName !== top.name) throw new Error("hero is not the closest approach");
  if (Math.abs(heroLD - ldComputed) > 0.006) throw new Error(`hero LD mismatch: ${heroLD} vs ${ldComputed}`);
  if (Math.abs(ldComputed - top.lunarApi) / top.lunarApi > 0.001) throw new Error("LD cross-check vs NeoWs lunar failed (>0.1%)");

  /* ---- PHA badges: real data now (cad.api never supplied the flag) ---- */
  const phaExpected = approaches.filter(a => a.pha).length;
  const phaRendered = await page.locator(".pha").count();
  log(`PHA badges: ${phaRendered} rendered vs ${phaExpected} is_potentially_hazardous_asteroid=true in the payload ` +
    `(v1's dead pha:false code path is live again)`);
  if (phaRendered !== phaExpected) throw new Error("PHA badge count mismatch");

  /* ---- table + closer-than-Moon highlight ---- */
  const rowCount = await page.locator("#view tbody tr").count();
  const closeRows = await page.locator("#view tbody tr.close").count();
  const closeExpected = approaches.filter(a => a.au * AU_LD < 1).length;
  log(`table: ${rowCount} rows (payload has ${approaches.length} approaches); h2 "${(await page.locator("#view h2").innerText()).trim()}"`);
  log(`closer-than-Moon highlight: ${closeRows} tr.close vs ${closeExpected} under 1 LD in the payload`);
  if (rowCount !== approaches.length || closeRows !== closeExpected) throw new Error("table/highlight mismatch");
  log(`first table row: "${(await page.locator("#view tbody tr").first().innerText()).replace(/\s+/g, " | ").trim()}"`);

  /* ---- 30-day window: NeoWs caps a request at 7 days -> expect 4 paged requests ---- */
  const beforeN = neowsUrls.length;
  await page.selectOption("#window", "30");
  await waitForView(page);
  await page.waitForFunction(() => localStorage.getItem("suite.cache.asteroids.d30") !== null, { timeout: 30000 });
  const pagedUrls = neowsUrls.slice(beforeN).map(u => {
    const p = new URL(u).searchParams; return p.get("start_date") + ".." + p.get("end_date");
  });
  log(`window -> 30 days: ${pagedUrls.length} paged requests (7-day cap): ${pagedUrls.join(", ")}`);
  if (pagedUrls.length !== 4) throw new Error("expected 4 paged requests for the 30-day window");
  const d30 = await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("suite.cache.asteroids.d30"));
    return { t: e.t, count: e.v.element_count, buckets: Object.keys(e.v.near_earth_objects).length };
  });
  log(`merged d30 cache: element_count=${d30.count}, ${d30.buckets} date buckets (8+8+8+7=31 expected), ` +
    `rendered rows=${await page.locator("#view tbody tr").count()}, stamp "${await stamp(page)}"`);
  if (d30.buckets !== 31) throw new Error("30-day merge produced " + d30.buckets + " buckets");

  /* back to 7 days: fresh cache serves without any request */
  const beforeBack = neowsUrls.length;
  await page.selectOption("#window", "7");
  await waitForView(page);
  log(`window -> back to 7 days: stamp "${await stamp(page)}", new requests=${neowsUrls.length - beforeBack} (expect 0)`);
  if (neowsUrls.length !== beforeBack) throw new Error("7-day cache should have served without a request");

  /* ---- key card mechanics: saved key reaches the request URL; clear returns to DEMO_KEY ---- */
  await page.click("#keycard summary");
  await page.fill("#keyInput", "TESTKEY_ROUTED_ONLY");
  await page.click("#keySave"); // forces a (route-fulfilled) reload with the new key
  await page.waitForFunction(() => /^Loaded just now/.test(document.getElementById("stamp").textContent), { timeout: 15000 });
  const savedUrlKey = new URL(neowsUrls[neowsUrls.length - 1]).searchParams.get("api_key");
  log(`key saved: request used api_key=${savedUrlKey}; summary "${(await page.locator("#keySummary").innerText()).trim()}"; ` +
    `suite.key.nasa=${await page.evaluate(() => localStorage.getItem("suite.key.nasa"))}`);
  if (savedUrlKey !== "TESTKEY_ROUTED_ONLY") throw new Error("saved key did not reach the request URL");
  await page.click("#keyClear");
  await page.waitForFunction(() => /^Loaded just now/.test(document.getElementById("stamp").textContent), { timeout: 15000 });
  const clearedUrlKey = new URL(neowsUrls[neowsUrls.length - 1]).searchParams.get("api_key");
  log(`key cleared: request back to api_key=${clearedUrlKey}; suite.key.nasa=${await page.evaluate(() => localStorage.getItem("suite.key.nasa"))}`);
  if (clearedUrlKey !== "DEMO_KEY") throw new Error("clearing the key did not restore DEMO_KEY");

  /* ---- rl backoff (flags: ["rl"]), deterministic via route-fulfilled 429 ----
     Age the d7 cache to 30 h (> 24 h TTL, < 48 h doubled TTL), throttle the route:
     load #1 attempts a fetch, gets 429, doubles the backoff, serves the cache with the note;
     load #2 must serve the same cache silently WITHOUT a network attempt.
     Runs in its OWN context (the Batch B CORS-probe pattern): Chrome unconditionally logs
     "Failed to load resource: ... 429" for any 4xx fetch response — that's the browser, not
     the tool (which handles the 429 by design) — and it would fail the console gate on the
     gated page. The probe's console is captured and logged below, nothing hidden. */
  {
    const rlCtx = await page.context().browser().newContext();
    const rp = await rlCtx.newPage();
    const rlConsole = [];
    rp.on("console", m => { if (m.type() === "error") rlConsole.push(m.text()); });
    await rp.goto(page.url()); // fresh context -> fresh cache, seeded by one fulfilled request
    await waitForView(rp);
    await rp.evaluate(() => {
      const k = "suite.cache.asteroids.d7";
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 30 * 3600 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    });
    rlMode = true;
    const beforeRl = neowsUrls.length;
    await rp.evaluate(() => document.getElementById("window").dispatchEvent(new Event("change"))); // load(false)
    await rp.waitForFunction(() => /rate-limiting/.test(document.getElementById("stamp").textContent), { timeout: 15000 });
    log(`429 fulfilled (${neowsUrls.length - beforeRl} attempt): stamp "${await stamp(rp)}", ` +
      `cached rows still rendered: ${await rp.locator("#view tbody tr").count()}`);
    const afterFirst = neowsUrls.length;
    await rp.evaluate(() => document.getElementById("window").dispatchEvent(new Event("change")));
    await rp.waitForFunction(() => /^Cached · updated/.test(document.getElementById("stamp").textContent), { timeout: 15000 });
    log(`backoff proof: second non-forced load made ${neowsUrls.length - afterFirst} network attempts (expect 0 — ` +
      `effective TTL doubled to 48 h covers the 30 h cache); stamp "${await stamp(rp)}"`);
    if (neowsUrls.length !== afterFirst) throw new Error("rl backoff did not suppress the refetch");
    rlMode = false;
    log(`rl probe console (expected browser noise for a 4xx fetch response): ` +
      (rlConsole.length ? rlConsole.map(s => JSON.stringify(s)).join(", ") : "(none)"));
    await rlCtx.close();
  }

  /* ---- Batch B offline paths on the gated page: age caches 24 h, cut the network ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort()); // registered later -> outranks fulfillment routes
  await page.click("#refreshBtn"); // forced fetch falls back to the aged cache
  await page.waitForFunction(() => /cached data/.test(document.getElementById("stamp").textContent), { timeout: 15000 });
  log(`refresh while offline: stamp "${await stamp(page)}", table still renders ${await page.locator("#view tbody tr").count()} rows`);

  await page.reload(); // stale-cache reload path
  await waitForView(page);
  await page.waitForFunction(() => /cached data/.test(document.getElementById("stamp").textContent), { timeout: 15000 });
  log(`offline stale reload: stamp "${await stamp(page)}", hero "${(await page.locator(".hero .name").innerText()).trim()}", ` +
    `rows ${await page.locator("#view tbody tr").count()}`);
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });

  await page.selectOption("#window", "3"); // never-cached window -> designed error card
  await page.waitForSelector("#view .msg.err", { timeout: 15000 });
  log(`offline uncached window (3 days): error card "${(await page.locator("#view .msg.err").innerText()).replace(/\s+/g, " ").trim()}"`);
  await page.selectOption("#window", "7");
  await waitForView(page);
  log(`offline back to 7 days: recovered ${await page.locator("#view tbody tr").count()} cached rows from the aged envelope`);
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 (cad.api route-fulfilled from the archived payloads)
   so the localStorage key sets compare equal: d7 on load, d30 on the window switch. */
export async function v1Interact({ page }) {
  await page.waitForSelector("#view .hero, #view .msg:not(.skeleton)", { timeout: 30000 });
  await page.selectOption("#window", "30");
  await page.waitForFunction(() => localStorage.getItem("suite.cache.asteroids.d30") !== null, { timeout: 30000 });
  await page.selectOption("#window", "7");
  await page.waitForSelector("#view .hero, #view .msg:not(.skeleton)", { timeout: 30000 });
}
