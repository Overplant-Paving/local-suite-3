/* tests/interactions/nearby.mjs — Nearby Finder (Batch C, cors-open, flags: rl)
   Live-verifies one real zippopotam.us ZIP geocode and real tile.openstreetmap.org tile
   loads, and attempts the one real Overpass query (seeded LA, default pharmacy category)
   gated by a Node-side health probe: during the 2026-07-16 run both v1 Overpass endpoints
   were down from this network (overpass-api.de answered HTTP 406 to everything incl.
   /api/status; kumi's nginx was up but its Overpass backend hung; a third public instance
   also hung — see overpass-outage.txt). When the probe fails, the module records the
   outage plus the tool's DESIGNED error state (via route-aborted requests, so the page
   emits only net::ERR console noise, which the harness rightly filters) and verifies the
   full render path with route-fulfilled canned responses instead — logged as such, never
   as live success. Deterministic in every run: the kumi mirror fallback (route-abort
   primary -> mirror fulfilled with a DISTINCT payload carrying an HTML-probe place name,
   proving remote names render escaped) and the stale-cache offline path.
   The 429/504 backoff note is verified by the companion standalone script rl-verify.mjs
   (output in the same evidence dir) — a fulfilled HTTP 429 inside this harness would log
   a non-net::ERR console error and trip the run's console-clean gate. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".locbar", ".card", ".cat", ".btn.primary", "#radius", ".map-wrap", ".list", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };
const seedLA = page => page.evaluate(l => {
  localStorage.setItem("suite.location", JSON.stringify(l));
}, LA);

/* Canned Overpass payloads for the deterministic tests. The mirror payload's node name
   is an HTML probe: if it ever renders as markup instead of text, escaping is broken. */
const CANNED_PHARM = {
  version: 0.6, generator: "canned-pharmacy",
  elements: [
    { type: "node", id: 11, lat: 34.0555, lon: -118.2410,
      tags: { name: "Canned Test Pharmacy", "addr:housenumber": "200", "addr:street": "S Main St" } },
    { type: "way", id: 12, center: { lat: 34.0480, lon: -118.2550 },
      tags: { name: "Second Canned Pharmacy" } }
  ]
};
const CANNED_MIRROR = {
  version: 0.6, generator: "canned-kumi-mirror",
  elements: [
    { type: "node", id: 1, lat: 34.0540, lon: -118.2500,
      tags: { name: "<b>Kumi & Mirror</b> Library", "addr:housenumber": "630",
              "addr:street": "W 5th St", opening_hours: "Mo-Su 10:00-20:00" } },
    { type: "way", id: 2, center: { lat: 34.0450, lon: -118.2600 },
      tags: { name: "Central Branch" } }
  ]
};
const fulfill = body => r => r.fulfill({
  status: 200,
  headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  body: JSON.stringify(body)
});
const href = u => (typeof u === "string" ? u : u.href);
const isPrimary = u => href(u).includes("overpass-api.de");
const isMirror = u => href(u).includes("overpass.kumi.systems");
const isOverpass = u => isPrimary(u) || isMirror(u);
const abortRoute = r => r.abort();

/* Node-side health probe (cheap /api/status GET) — decides whether a real in-page
   Overpass query is worth attempting. A down endpoint answers without CORS headers,
   which would log a non-net::ERR console error and fail the harness through no fault
   of the tool. */
async function probe(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return `HTTP ${r.status}`;
  } catch (e) {
    return e.name === "TimeoutError" ? "timeout (8 s)" : String(e.cause?.code || e.message);
  }
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- first-run state (no suite.location) ---- */
  const fr = await page.textContent("#firstrunCard .firstrun div");
  log(`first-run card (no suite.location): "${fr.trim()}"`);

  /* ---- ZIP validation (offline, no request) ---- */
  await page.fill("#zipInput", "1234");
  await page.click("#zipBtn");
  log(`invalid ZIP "1234" -> frMsg: "${(await page.textContent("#frMsg")).trim()}"`);

  /* ---- LIVE FETCH 1: zippopotam.us ZIP geocode (Enter key = a11y submit path) ---- */
  await page.fill("#zipInput", "90012");
  await page.press("#zipInput", "Enter");
  await page.waitForSelector("#mainUI:not([hidden])", { timeout: 20000 });
  log(`LIVE zippopotam (submitted via Enter): ZIP 90012 -> locbar "${(await page.textContent("#locbar")).trim()}"`);

  /* "change" link returns to the first-run card (v1 feature) */
  await page.click("#locbar .link");
  const frVisible = await page.evaluate(() => !document.getElementById("firstrunCard").hidden);
  log(`locbar "change" -> first-run card visible again: ${frVisible}`);

  /* ---- Overpass health probe, then the live query or the honest fallback ---- */
  const pPrimary = await probe("https://overpass-api.de/api/status");
  const pMirror = await probe("https://overpass.kumi.systems/api/status");
  /* live only when the PRIMARY is healthy: a dead primary answers without CORS headers,
     which logs a non-net::ERR console error even when the mirror could still serve */
  const healthy = pPrimary === "HTTP 200";
  log(`Overpass health probe (node-side /api/status): primary=${pPrimary}, mirror=${pMirror} -> ${healthy ? "attempting live query" : "OUTAGE — designed error state + canned render path instead"}`);

  await seedLA(page);
  if (healthy) {
    /* ---- the ONE real Overpass query (LA, pharmacy, 1600 m) ---- */
    await page.reload();
    await page.waitForSelector(".item", { timeout: 90000 });
    await page.waitForTimeout(600);
    const stamp = (await page.textContent("#resStamp")).trim();
    const firstName = (await page.textContent(".item .nm")).trim();
    const firstDist = (await page.textContent(".item .dist b")).trim();
    const firstWalk = (await page.textContent(".item .dist span")).trim();
    log(`LIVE Overpass (LA, pharmacy, 1600 m): resStamp="${stamp}"; nearest="${firstName}" at ${firstDist} (${firstWalk})`);
    const env = await page.evaluate(() => {
      const k = Object.keys(localStorage).find(x => x.startsWith("suite.cache.nearby."));
      const e = JSON.parse(localStorage.getItem(k));
      return { key: k, elements: (e.v.elements || []).length, t: e.t };
    });
    log(`LIVE response cached: ${env.key} -> raw Overpass payload, ${env.elements} elements, t=${new Date(env.t).toISOString()}`);
    /* designed error state, deterministically: both endpoints aborted, uncached category */
    await page.route(isOverpass, abortRoute);
    await page.click('.cat:has-text("Coffee")');
    await page.waitForFunction(() => /failed/i.test(document.getElementById("searchMsg").textContent), null, { timeout: 15000 });
    log(`designed error state (routes aborted, uncached Coffee): searchMsg="${(await page.textContent("#searchMsg")).trim()}"; list="${(await page.textContent("#list")).trim()}"`);
    await page.screenshot({ path: `${evidenceDir}/error-state.png`, fullPage: true });
    await page.unroute(isOverpass);
    /* back to the cached pharmacy render for the map/selection checks */
    await page.click('.cat:has-text("Pharmacy")');
    await page.waitForSelector(".item", { timeout: 15000 });
  } else {
    /* boot search fails fast under aborted routes -> the designed error state */
    await page.route(isOverpass, abortRoute);
    await page.reload();
    await page.waitForFunction(() => /failed/i.test(document.getElementById("searchMsg").textContent), null, { timeout: 30000 });
    log(`designed error state (boot search, endpoints aborted): searchMsg="${(await page.textContent("#searchMsg")).trim()}"; list="${(await page.textContent("#list")).trim()}"`);
    await page.screenshot({ path: `${evidenceDir}/error-state.png`, fullPage: true });
    await page.unroute(isOverpass);
    /* full render path via route-fulfilled canned response — logged as canned, not live */
    await page.route(isOverpass, fulfill(CANNED_PHARM));
    await page.click("#searchBtn");
    await page.waitForSelector(".item", { timeout: 15000 });
    await page.unroute(isOverpass);
    const stamp = (await page.textContent("#resStamp")).trim();
    const names = await page.$$eval(".item .nm", ns => ns.map(n => n.textContent));
    const dists = await page.$$eval(".item .dist b", ns => ns.map(n => n.textContent));
    log(`render path via CANNED pharmacy response (NOT live — source down): resStamp="${stamp}"; names=${JSON.stringify(names)}; dists=${JSON.stringify(dists)} (distance-sorted)`);
  }

  /* map: REAL OSM tile loads + you-dot + result dots (tiles are live either way) */
  await page.waitForTimeout(800);
  const map = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("#mapTiles img")];
    return {
      tiles: imgs.length,
      tileHostsOk: imgs.every(i => i.src.startsWith("https://tile.openstreetmap.org/")),
      tilesLoaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      here: !!document.querySelector(".dot.here"),
      dots: document.querySelectorAll(".dot.result").length,
      attr: document.querySelector(".map-attr").textContent.trim()
    };
  });
  log(`map: ${map.tiles} tile imgs, all tile.openstreetmap.org=${map.tileHostsOk}, LIVE-loaded ok=${map.tilesLoaded}; you-dot=${map.here}, result dots=${map.dots}, attribution="${map.attr}"`);

  /* selection sync: mouse on item 1, then KEYBOARD (focus+Enter) on last item */
  await page.click(".item >> nth=0");
  const sel1 = await page.evaluate(() => ({
    item: document.querySelector(".item.sel .nm")?.textContent,
    dotSel: !!document.querySelector(".dot.result.sel")
  }));
  log(`mouse select item 1: list .sel="${sel1.item}", map dot .sel=${sel1.dotSel}`);
  await page.locator(".item").last().focus();
  await page.keyboard.press("Enter");
  const sel2 = await page.evaluate(() => document.querySelector(".item.sel .nm")?.textContent);
  log(`keyboard select last item (focus+Enter): list .sel="${sel2}"`);

  /* ---- MIRROR FALLBACK, deterministic: abort primary -> mirror answers ----
     distinct payload, so the wait below can only be satisfied by the mirror response */
  const attempts = [];
  const onReq = req => {
    if (isPrimary(req.url())) attempts.push("primary(overpass-api.de)");
    if (isMirror(req.url())) attempts.push("mirror(overpass.kumi.systems)");
  };
  page.on("request", onReq);
  await page.route(isPrimary, abortRoute);
  await page.route(isMirror, fulfill(CANNED_MIRROR));
  await page.click('.cat:has-text("Library")'); // uncached category -> new fetch
  await page.waitForFunction(() => {
    const n = document.querySelector(".item .nm");
    return n && n.textContent.includes("Kumi");
  }, null, { timeout: 15000 });
  page.off("request", onReq);
  log(`MIRROR FALLBACK: request sequence = [${attempts.join(" -> ")}] (primary route-aborted, mirror fulfilled a distinct canned 2-element response)`);
  const mirror = await page.evaluate(() => ({
    stamp: document.getElementById("resStamp").textContent.trim(),
    names: [...document.querySelectorAll(".item .nm")].map(n => n.textContent),
    dets: [...document.querySelectorAll(".item .det")].map(n => n.textContent),
    dists: [...document.querySelectorAll(".item .dist b")].map(n => n.textContent),
    injectedBold: !!document.querySelector(".item .nm b"),
    dotTitle: document.querySelector(".dot.result")?.title || ""
  }));
  log(`mirror render: resStamp="${mirror.stamp}"; names=${JSON.stringify(mirror.names)} dists=${JSON.stringify(mirror.dists)} (distance-sorted: node ~620 m before way ~1.7 km); det="${mirror.dets[0]}"`);
  log(`escaping probe: name "<b>Kumi & Mirror</b> Library" rendered as TEXT, injected <b> element present=${mirror.injectedBold}; dot title="${mirror.dotTitle}"`);
  await page.unroute(isPrimary);
  await page.unroute(isMirror);

  /* ---- STALE-CACHE OFFLINE PATH: age caches 24 h, block all network, reload ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector(".item", { timeout: 20000 });
  await page.waitForFunction(() => document.getElementById("searchMsg").textContent.includes("Offline"), null, { timeout: 20000 });
  const staleMsg = (await page.textContent("#searchMsg")).trim();
  const staleStamp = (await page.textContent("#resStamp")).trim();
  log(`STALE PATH (network blocked, cache aged 24 h): rendered from cache, resStamp="${staleStamp}", searchMsg="${staleMsg}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so localStorage key sets compare equal —
   v1's Overpass POSTs are route-fulfilled with the canned response (no extra
   real Overpass traffic; both endpoints were down during the run anyway). */
export async function v1Interact({ page }) {
  await page.route(isOverpass, fulfill(CANNED_PHARM));
  await seedLA(page);
  await page.reload();
  await page.waitForSelector(".item", { timeout: 15000 });
  await page.click(".cat >> nth=4"); // Library — writes the second cache key
  await page.waitForTimeout(800);
  await page.unroute(isOverpass);
}
