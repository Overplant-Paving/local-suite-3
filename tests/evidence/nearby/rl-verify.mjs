/* rl-verify.mjs — standalone deterministic verification of nearby.html's rate-limit
   backoff (flags: rl): both Overpass endpoints route-fulfilled with HTTP 429, a 90-min-old
   cache seeded (older than the 60-min TTL, younger than the doubled 120-min TTL).
   Expected: (1) the throttle note "Overpass is rate-limiting — showing cached data from
   <time>." renders over the cached results after one 429 per endpoint; (2) the effective
   TTL doubles, so a subsequent Search accepts the same cache with ZERO further requests.
   Run from tests/ (playwright resolved from tests/node_modules); output lands in
   tests/evidence/nearby/. Kept out of the verify-tool.mjs harness because a fulfilled
   HTTP 429 logs a non-net::ERR console error, which would trip the harness's
   console-clean gate — here that console error is the EXPECTED evidence. */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { writeFileSync } from "node:fs";

const ROOT = "C:/Users/henry/Developement/Local Suite 2";
const require = createRequire(ROOT + "/tests/");
const { chromium } = require("playwright");
const EV = resolve(ROOT, "tests", "evidence", "nearby");
const url = pathToFileURL(resolve(ROOT, "tools", "nearby.html")).href;

const CANNED = {
  version: 0.6, generator: "rl-seeded-cache",
  elements: [{ type: "node", id: 21, lat: 34.0555, lon: -118.2410,
    tags: { name: "Cached Corner Pharmacy", "addr:street": "S Main St" } }]
};

const out = [];
const log = s => { out.push(s); console.log(s); };

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });
await page.addInitScript(() => { try { localStorage.setItem("suite.theme", "light"); } catch (e) {} });

let overpassRequests = 0;
await page.route(u => u.href.includes("overpass-api.de") || u.href.includes("overpass.kumi.systems"), r => {
  overpassRequests++;
  return r.fulfill({ status: 429, headers: { "Access-Control-Allow-Origin": "*" }, body: "rate limited" });
});
/* keep the run hermetic: tiles already proven live in the harness run */
await page.route(u => u.href.startsWith("https://tile.openstreetmap.org"), r => r.abort());

await page.goto(url);
await page.evaluate(c => {
  localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }));
  localStorage.setItem("suite.cache.nearby.pharmacy.34.0522_-118.2437_1600",
    JSON.stringify({ t: Date.now() - 90 * 60 * 1000, v: c })); // 90 min old: stale at 60-min TTL, fresh at doubled 120-min TTL
}, CANNED);
log("setup: both Overpass endpoints route-fulfilled HTTP 429; pharmacy cache seeded 90 min old (TTL 60 min, doubled 120 min)");

await page.reload(); // boot doSearch: cache older than TTL -> fetch -> 429 primary -> 429 mirror -> throttle note + cached render
await page.waitForFunction(() => document.getElementById("searchMsg")?.textContent.includes("rate-limiting"), null, { timeout: 20000 });
const msg = (await page.textContent("#searchMsg")).trim();
const stamp = (await page.textContent("#resStamp")).trim();
const name = (await page.textContent(".item .nm")).trim();
log(`after boot search: ${overpassRequests} Overpass request(s) (primary 429 -> mirror 429)`);
log(`throttle note rendered: searchMsg="${msg}"`);
log(`cached data still rendered: resStamp="${stamp}", first item="${name}"`);
await page.screenshot({ path: join(EV, "rl-note.png"), fullPage: true });

/* backoff proof: with ttl doubled, the same 90-min-old cache is now accepted fresh —
   a second Search must make NO network request and render the cache without the note */
const before = overpassRequests;
await page.click("#searchBtn");
await page.waitForTimeout(1500);
const after = overpassRequests;
const msg2 = (await page.textContent("#searchMsg")).trim();
const stamp2 = (await page.textContent("#resStamp")).trim();
log(`backoff proof: Search clicked again -> Overpass requests ${before} -> ${after} (${after - before} new); ` +
    `cache (90 min old) accepted under doubled 120-min TTL; resStamp="${stamp2}", searchMsg="${msg2}"`);
const err429 = consoleErrors.filter(e => e.includes("429"));
log(`expected console errors from the fulfilled 429s (why this runs outside the harness): ${err429.length} x "${err429[0] || ""}" (+ ${consoleErrors.length - err429.length} net::ERR from route-aborted tiles)`);
log(`VERDICT: throttle note ${msg.includes("rate-limiting") ? "OK" : "MISSING"}; cached render ${name ? "OK" : "MISSING"}; ` +
    `doubled-TTL backoff ${after === before ? "OK (no new request)" : "FAILED (" + (after - before) + " new requests)"}`);

writeFileSync(join(EV, "rl-backoff.txt"), out.join("\n") + "\n");
await browser.close();
