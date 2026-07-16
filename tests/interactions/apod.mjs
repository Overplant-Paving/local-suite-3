/* tests/interactions/apod.mjs — Astronomy Picture of the Day (Batch C: keyed, rate-limited)

   DEMO_KEY BUDGET (shared 30/hr pool) — exactly 2 real api.nasa.gov requests in this run:
     1. ONE Node-side fetch of today's APOD at module load (raw body archived as
        apod-live-today.json, rate-limit headers logged).
     2. ONE genuine in-browser fetch in a route-free probe context inside interact(),
        proving the real CORS + Suite.fetchJSON + render path end-to-end.
   Every other page load (the harness's 4 capture loads of v1+v2, the interaction page,
   the v1 parity page) has api.nasa.gov route-fulfilled: today's date gets the same-day
   REAL payload from fetch #1; other dates get clearly-labeled synthetic fixtures so
   prev/random/date-pick/video/404 paths can be exercised without hammering the API.
   Media hosts (apod.nasa.gov images, img.youtube.com thumbs, youtube.com embeds for the
   v1 iframe) are also fulfilled locally for determinism; the real image bytes are
   fetched once Node-side so screenshots show the genuine picture. */

import { chromium } from "playwright";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const EV_DIR = join(import.meta.dirname, "..", "evidence", "apod");

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "h1", ".sub",
  ".keycard", ".keycard summary", ".controls", "#datePick",
  "#view", ".hero", ".body h2", ".explanation", "#stamp", "footer"
];
export const screenshotAfterInteract = true;

/* ---- dates (same local-date logic as the tool) ---- */
function dstr(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
const TODAY = dstr(new Date());
const YESTERDAY = dstr(new Date(Date.now() - 86400000));
const FIXED = "2015-10-31";      // deterministic date-picker target (synthetic fixture)
const VIDEO = "2020-02-02";      // synthetic video-day fixture
const D404 = "1995-06-17";       // real gap in the APOD archive (no APOD Jun 17-19, 1995)

const APOD_RE = /api\.nasa\.gov\/planetary\/apod/;
const APOD_IMG_RE = /apod\.nasa\.gov\/apod\/image\//;
const YT_THUMB_RE = /img\.youtube\.com/;
const YT_PAGE_RE = /youtube\.com\/(embed|watch)/;

/* ---- live request 1 of 2: today's APOD, Node side ----
   Budget guard: if an earlier run today already archived the payload, REUSE it —
   a harness rerun must not spend additional DEMO_KEY requests. */
let liveBody = null, liveMeta = null;
const bodyFile = join(EV_DIR, "apod-live-today.json");
const metaFile = join(EV_DIR, "apod-live-meta.json");
if (existsSync(bodyFile) && existsSync(metaFile)) {
  try {
    const m = JSON.parse(readFileSync(metaFile, "utf8"));
    const b = readFileSync(bodyFile, "utf8");
    if (m.date === TODAY) { liveBody = b; liveMeta = { ...m, reused: true }; }
  } catch (e) { /* fall through to a fresh fetch */ }
}
if (!liveBody) {
  const liveUrl = "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=" + TODAY + "&thumbs=true";
  const liveRes = await fetch(liveUrl, { headers: { "Accept": "application/json" } });
  liveBody = await liveRes.text();
  liveMeta = {
    url: liveUrl, status: liveRes.status, date: TODAY,
    rlLimit: liveRes.headers.get("x-ratelimit-limit"),
    rlRemaining: liveRes.headers.get("x-ratelimit-remaining"),
    fetchedAt: new Date().toISOString(), reused: false
  };
  if (!liveRes.ok) throw new Error(`live APOD fetch failed: HTTP ${liveRes.status} (rl-remaining=${liveMeta.rlRemaining}) — rerun later, do not hammer`);
  writeFileSync(bodyFile, liveBody);
  writeFileSync(metaFile, JSON.stringify(liveMeta, null, 2));
}
const liveApod = JSON.parse(liveBody);

/* real media bytes, fetched once (static hosts, not the API): the harness serves these
   to every context so screenshots show the genuine picture deterministically */
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
let mediaBuf = FALLBACK_PNG, mediaType = "image/png", mediaSrcUrl = null;
{
  const src = liveApod.media_type === "image" ? liveApod.url : liveApod.thumbnail_url;
  if (src) {
    try {
      const r = await fetch(src);
      if (r.ok) {
        mediaBuf = Buffer.from(await r.arrayBuffer());
        mediaType = r.headers.get("content-type") || "image/jpeg";
        mediaSrcUrl = src;
      }
    } catch (e) { /* fall back to the 1x1 png; logged in interact() */ }
  }
}

/* ---- synthetic fixtures (labeled as such; only the network hop is bridged) ---- */
const synthImage = date => JSON.stringify({
  date, media_type: "image", service_version: "v1",
  title: "Synthetic fixture — " + date,
  explanation: "Synthetic fixture payload served via route fulfillment to respect the shared DEMO_KEY pool (30/hr). The in-page pipeline under test — Suite.fetchJSON, cache envelope, render — is real.",
  url: "https://apod.nasa.gov/apod/image/fixture-" + date + ".jpg",
  hdurl: "https://apod.nasa.gov/apod/image/fixture-" + date + "-hd.jpg",
  copyright: "fixture"
});
const synthVideo = JSON.stringify({
  date: VIDEO, media_type: "video", service_version: "v1",
  title: "Synthetic video fixture — " + VIDEO,
  explanation: "Video-day fixture: media_type video with a YouTube watch URL and an img.youtube.com thumbnail_url, exercising the v2 link-out card (dist CSP has no frame-src) and the v1 iframe path.",
  url: "https://www.youtube.com/watch?v=fixture123",
  thumbnail_url: "https://img.youtube.com/vi/fixture123/0.jpg"
});
const body404 = JSON.stringify({ code: 404, msg: "No data available for date: " + D404, service_version: "v1" });

const reqLog = []; // every fulfilled apod API request: {date, key}
function apodRoute(route) {
  const u = new URL(route.request().url());
  const date = u.searchParams.get("date");
  reqLog.push({ date, key: u.searchParams.get("api_key") });
  if (date === TODAY) return route.fulfill({ status: 200, contentType: "application/json", body: liveBody });
  if (date === VIDEO) return route.fulfill({ status: 200, contentType: "application/json", body: synthVideo });
  if (date === D404) return route.fulfill({ status: 404, contentType: "application/json", body: body404 });
  return route.fulfill({ status: 200, contentType: "application/json", body: synthImage(date) });
}
async function addRoutes(ctx) {
  await ctx.route(APOD_RE, apodRoute);
  await ctx.route(APOD_IMG_RE, r => r.fulfill({ status: 200, contentType: mediaType, body: mediaBuf }));
  await ctx.route(YT_THUMB_RE, r => r.fulfill({ status: 200, contentType: mediaType, body: mediaBuf }));
  await ctx.route(YT_PAGE_RE, r => r.fulfill({ status: 200, contentType: "text/html", body: "<html><body>embed stub</body></html>" }));
}
const realLaunch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await realLaunch(...args);
  const realNewContext = browser.newContext.bind(browser);
  browser.newContext = async (...ca) => {
    const ctx = await realNewContext(...ca);
    await addRoutes(ctx);
    return ctx;
  };
  return browser;
};

const cacheKey = d => "suite.cache.apod." + d;
async function waitCache(page, date) {
  await page.waitForFunction(k => localStorage.getItem(k) !== null, cacheKey(date), { timeout: 15000 });
}
async function waitView(page) {
  await page.waitForSelector("#view .hero, #view .msg.err", { timeout: 15000 });
}
/* wait until the rendered hero title is exactly t (fixture titles are date-unique) */
async function waitTitle(page, t) {
  await page.waitForFunction(x => {
    const h = document.querySelector("#view .hero h2");
    return h && h.textContent === x;
  }, t, { timeout: 15000 });
}
/* wait until we are back on today with a settled stamp (load() blanks the stamp first) */
async function waitToday(page) {
  await page.waitForFunction(t =>
    document.getElementById("datePick").value === t &&
    !document.querySelector("#view .msg.err") &&
    document.getElementById("stamp").textContent !== "",
  TODAY, { timeout: 15000 });
}
/* wait for a specific settled stamp pattern (regex source string) */
async function waitStamp(page, reSrc) {
  await page.waitForFunction(s => new RegExp(s).test(document.getElementById("stamp").textContent), reSrc, { timeout: 15000 });
}
async function heroFacts(page) {
  return page.evaluate(() => {
    const q = s => document.querySelector(s);
    return {
      title: q("#view .hero h2") ? q("#view .hero h2").textContent : null,
      meta: q("#view .hero .meta") ? q("#view .hero .meta").textContent.replace(/\s+/g, " ").trim() : null,
      explLen: q("#view .explanation") ? q("#view .explanation").textContent.length : 0,
      imgSrc: q("#view .media img") ? q("#view .media img").getAttribute("src") : null,
      hdHref: q("#view a.hd") ? q("#view a.hd").getAttribute("href") : null,
      videoHref: q("#view .videocard") ? q("#view .videocard").getAttribute("href") : null,
      stamp: document.getElementById("stamp").textContent
    };
  });
}

export async function interact({ page, log, evidenceDir }) {
  log(`live fetch 1/2 (Node${liveMeta.reused ? ", REUSED from this run-day's earlier archive — no request spent" : ""}): ` +
    `${liveMeta.url} -> HTTP ${liveMeta.status}, X-RateLimit ${liveMeta.rlRemaining}/${liveMeta.rlLimit} remaining, at ${liveMeta.fetchedAt}`);
  log(`today's APOD (${liveApod.date}): media_type=${liveApod.media_type}, title="${liveApod.title}"` +
    (liveApod.copyright ? `, copyright="${String(liveApod.copyright).replace(/\s+/g, " ").trim()}"` : ""));
  log(`media bytes for deterministic screenshots: ${mediaSrcUrl ? mediaSrcUrl + ` (${mediaBuf.length} bytes, ${mediaType}, fetched once Node-side)` : "FALLBACK 1x1 png (no media url)"}`);
  log(`NOTE: all in-page api.nasa.gov requests in this harness are route-fulfilled — today's date`);
  log(`NOTE: with the real same-day payload above, other dates with labeled synthetic fixtures.`);

  /* ---- initial render (today, real payload via fulfillment) ---- */
  await waitView(page);
  let f = await heroFacts(page);
  log(`initial render: title="${f.title}", meta="${f.meta}", explanation ${f.explLen} chars ` +
    `(payload has ${(liveApod.explanation || "").length}), img src=${f.imgSrc}, hd=${f.hdHref}, videocard=${f.videoHref}`);
  log(`stamp: "${f.stamp}"`);
  if (liveApod.media_type === "video") {
    log(`TODAY IS A VIDEO DAY — hero renders the link-out videocard (no iframe: dist CSP has no frame-src); image path verified separately via the ${FIXED} fixture below.`);
  }
  const nav = await page.evaluate(() => ({
    next: document.getElementById("nextBtn").disabled, prev: document.getElementById("prevBtn").disabled,
    min: document.getElementById("datePick").min, max: document.getElementById("datePick").max,
    val: document.getElementById("datePick").value
  }));
  log(`nav state at today: nextBtn disabled=${nav.next}, prevBtn disabled=${nav.prev}, datePick min=${nav.min} max=${nav.max} value=${nav.val}`);

  /* ---- demo-key nudge (designed state) ---- */
  log(`demo-key nudge (keycard summary): "${(await page.locator("#keySummary").innerText()).trim()}"`);
  log(`keycard signup link: ${await page.locator(".keycard .note a").getAttribute("href")}`);

  /* ---- live request 2 of 2: genuine in-browser fetch, route-free context ----
     Budget guard: reuse the archived probe result on a harness rerun. */
  const probeMetaFile = join(evidenceDir, "live-browser-meta.json");
  let probeMeta = null;
  if (existsSync(probeMetaFile)) {
    try {
      const m = JSON.parse(readFileSync(probeMetaFile, "utf8"));
      if (m.date === TODAY && m.ok) probeMeta = m;
    } catch (e) {}
  }
  if (probeMeta) {
    log(`live fetch 2/2 (browser, NO route fulfillment) — REUSED from this run-day's earlier run (no request spent): ` +
      `HTTP ${probeMeta.status}, X-RateLimit-Remaining=${probeMeta.remaining}, rendered title="${probeMeta.title}", ` +
      `stamp="${probeMeta.stamp}", at ${probeMeta.at} (screenshot live-browser.png from that run)`);
  } else {
    const ctx = await page.context().browser().newContext();
    await ctx.unroute(APOD_RE); await ctx.unroute(APOD_IMG_RE);
    await ctx.unroute(YT_THUMB_RE); await ctx.unroute(YT_PAGE_RE);
    const pp = await ctx.newPage(); // note: newPage on the wrapped context obj — routes already stripped above
    let apiResp = null;
    pp.on("response", r => { if (APOD_RE.test(r.url())) apiResp = { status: r.status(), remaining: r.headers()["x-ratelimit-remaining"] }; });
    await pp.goto(page.url());
    await pp.waitForSelector("#view .hero, #view .msg.err", { timeout: 30000 });
    const isErr = await pp.locator("#view .msg.err").count();
    const stamp = (await pp.locator("#stamp").innerText()).trim();
    if (isErr) {
      log(`live fetch 2/2 (browser, NO route fulfillment): API response=${JSON.stringify(apiResp)}; ` +
        `error card rendered: "${(await pp.locator("#view .msg.err").innerText()).replace(/\s+/g, " ").trim()}" — honest failure, see concerns`);
    } else {
      const title = (await pp.locator("#view .hero h2").innerText()).trim();
      log(`live fetch 2/2 (browser, NO route fulfillment): HTTP ${apiResp && apiResp.status}, ` +
        `X-RateLimit-Remaining=${apiResp && apiResp.remaining}, rendered title="${title}", stamp="${stamp}"`);
      writeFileSync(probeMetaFile, JSON.stringify({
        date: TODAY, ok: true, status: apiResp && apiResp.status, remaining: apiResp && apiResp.remaining,
        title, stamp, at: new Date().toISOString()
      }, null, 2));
    }
    await pp.screenshot({ path: join(evidenceDir, "live-browser.png"), fullPage: true });
    await ctx.close();
    log(`genuine CORS browser path archived -> live-browser.png`);
  }

  /* ---- paste-a-key mechanics: save -> used in request URL -> clear -> demo nudge back ---- */
  await page.click("#keySummary"); // open the <details> keycard so the input is actionable
  await page.fill("#keyInput", "TESTKEY-not-real");
  await page.click("#keySave");
  await waitStamp(page, "^Loaded just now\\.$"); // no "· demo key" suffix with an own key
  const lastReq = reqLog[reqLog.length - 1];
  log(`key saved: request fired with api_key=${lastReq.key} date=${lastReq.date}; ` +
    `summary now "${(await page.locator("#keySummary").innerText()).trim()}"; ` +
    `localStorage suite.key.nasa=${await page.evaluate(() => localStorage.getItem("suite.key.nasa"))}`);
  log(`stamp with own key (no demo suffix): "${(await page.locator("#stamp").innerText()).trim()}"`);
  await page.click("#keyClear");
  await waitStamp(page, "demo key\\.$");
  log(`key cleared: summary back to "${(await page.locator("#keySummary").innerText()).trim()}", ` +
    `suite.key.nasa=${await page.evaluate(() => localStorage.getItem("suite.key.nasa"))}, ` +
    `last request api_key=${reqLog[reqLog.length - 1].key}, stamp="${(await page.locator("#stamp").innerText()).trim()}"`);

  /* ---- navigation: prev / keyboard / today / date picker / random ---- */
  await page.click("#prevBtn");
  await waitTitle(page, "Synthetic fixture — " + YESTERDAY);
  await waitCache(page, YESTERDAY);
  f = await heroFacts(page);
  log(`prev -> ${YESTERDAY}: title="${f.title}" (synthetic fixture), stamp="${f.stamp}", nextBtn re-enabled=${await page.evaluate(() => !document.getElementById("nextBtn").disabled)}`);
  await page.keyboard.press("ArrowRight"); // keyboard path back to today
  await waitToday(page);
  f = await heroFacts(page);
  log(`ArrowRight -> today from cache: title="${f.title}", stamp="${f.stamp}"`);
  await page.fill("#datePick", FIXED);
  await waitTitle(page, "Synthetic fixture — " + FIXED);
  await waitCache(page, FIXED);
  f = await heroFacts(page);
  log(`date picker -> ${FIXED}: title="${f.title}", HD link=${f.hdHref} (hdurl!=url renders the HD pill)`);
  await page.evaluate(() => { Math.random = () => 0.5; }); // deterministic 🎲 for v1 parity
  await page.click("#randBtn");
  const RAND = await page.evaluate(() => document.getElementById("datePick").value);
  await waitTitle(page, "Synthetic fixture — " + RAND);
  await waitCache(page, RAND);
  log(`random (Math.random stubbed to 0.5) -> ${RAND}: title="${(await page.locator("#view .hero h2").innerText()).trim()}"`);
  await page.click("#todayBtn");
  await waitToday(page);
  log(`today button: stamp="${(await page.locator("#stamp").innerText()).trim()}"`);

  /* ---- video day (link-out card replaces v1's iframe: dist CSP has no frame-src) ---- */
  await page.fill("#datePick", VIDEO);
  await page.waitForSelector("#view .videocard", { timeout: 15000 });
  await waitCache(page, VIDEO);
  const vc = await page.evaluate(() => {
    const a = document.querySelector("#view .videocard");
    return a ? {
      href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel"),
      aria: a.getAttribute("aria-label"), play: a.querySelector(".play").textContent,
      thumb: a.querySelector("img") ? a.querySelector("img").getAttribute("src") : null,
      iframes: document.querySelectorAll("#view iframe").length
    } : null;
  });
  log(`video day ${VIDEO}: videocard href=${vc && vc.href} target=${vc && vc.target} rel=${vc && vc.rel}, ` +
    `play badge="${vc && vc.play}", thumb=${vc && vc.thumb}, aria-label="${vc && vc.aria}", iframes in view=${vc && vc.iframes}`);
  await page.screenshot({ path: join(evidenceDir, "video-day.png"), fullPage: true });

  /* ---- 404 + deterministic 429 + backoff, on a sibling page ----
     Deliberately provoking HTTP 404/429 makes Chrome print "Failed to load resource"
     console errors — inherent to any non-2xx fetch response (v1 behaves identically)
     and NOT a script error. Running these on a sibling page keeps the main page's
     console gate meaningful; every console line here is captured and logged below. */
  const p2 = await page.context().newPage();
  const p2Console = [];
  p2.on("console", m => { if (m.type() === "error") p2Console.push(m.text()); });
  p2.on("pageerror", e => p2Console.push("PAGEERROR: " + String(e)));
  await p2.goto(page.url());
  await waitToday(p2); // today served from the fresh shared cache, no request

  /* 404: a real archive gap date (no APOD published Jun 17-19, 1995), fulfilled 404 */
  await p2.fill("#datePick", D404);
  await p2.waitForSelector("#view .msg.err", { timeout: 15000 });
  log(`404 for ${D404}: error card "${(await p2.locator("#view .msg.err").innerText()).replace(/\s+/g, " ").trim()}", ` +
    `cache key written=${await p2.evaluate(k => localStorage.getItem(k) !== null, cacheKey(D404))}`);
  await p2.click("#todayBtn");
  await waitToday(p2);

  /* deterministic 429: forced refresh against a fulfilled 429 */
  const r429 = r => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: { code: "OVER_RATE_LIMIT", message: "API key has exceeded the rate limits." } }) });
  await page.context().route(APOD_RE, r429); // registered later -> outranks the fulfillment route
  await p2.click("#refreshBtn");
  await p2.waitForSelector("#view .msg.err", { timeout: 15000 });
  log(`429 on forced refresh: error card "${(await p2.locator("#view .msg.err").innerText()).replace(/\s+/g, " ").trim()}"`);
  log(`429 cached fallback below the card: hero present=${await p2.locator("#view .hero").count()}, ` +
    `stamp="${(await p2.locator("#stamp").innerText()).trim()}"`);
  await p2.screenshot({ path: join(evidenceDir, "rl-429.png"), fullPage: true });

  /* backoff proof: rlBackoff is now 2 -> effective TTL 48 h. Age today's cache to 25 h
     (stale under the normal 24 h TTL) and reload today: must serve cache, zero requests. */
  await p2.evaluate(k => {
    const e = JSON.parse(localStorage.getItem(k));
    e.t = Date.now() - 25 * 3600000;
    localStorage.setItem(k, JSON.stringify(e));
  }, cacheKey(TODAY));
  const reqsBefore = reqLog.length;
  await p2.click("#todayBtn");
  await waitToday(p2);
  log(`backoff: cache aged to 25 h (> normal 24 h TTL), today after 429 -> api requests fired=${reqLog.length - reqsBefore} (0 = doubled TTL honored), ` +
    `stamp="${(await p2.locator("#stamp").innerText()).trim()}"`);
  await page.context().unroute(APOD_RE, r429);
  log(`sibling-page console during 404/429 provocation (expected resource-load errors only): ` +
    (p2Console.length ? p2Console.map(s => JSON.stringify(s)).join(", ") : "(none)"));
  await p2.close();

  /* ---- offline stale path (Batch B requirement): cache 25 h old, network cut, reload ---- */
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector("#view .msg.err", { timeout: 15000 });
  await page.waitForSelector("#view .hero", { timeout: 15000 });
  log(`offline stale reload: error card "${(await page.locator("#view .msg.err").innerText()).replace(/\s+/g, " ").trim()}", ` +
    `cached hero title="${(await page.locator("#view .hero h2").innerText()).trim()}", ` +
    `in-view stamp="${(await page.locator("#view .stamp").innerText()).trim()}", ` +
    `stamp="${(await page.locator("#stamp").innerText()).trim()}"`);
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 (identically route-fulfilled) so localStorage key
   sets compare equal: today + prev + fixed date + stubbed-random date + video date.
   The 404 date, key save/clear cycle, 429 and offline segments write nothing lasting. */
export async function v1Interact({ page }) {
  await page.waitForSelector("#view .hero, #view .msg.err", { timeout: 30000 });
  await page.click("#prevBtn");
  await page.waitForFunction(k => localStorage.getItem(k) !== null, "suite.cache.apod." + YESTERDAY, { timeout: 15000 });
  await page.fill("#datePick", FIXED);
  await page.waitForFunction(k => localStorage.getItem(k) !== null, "suite.cache.apod." + FIXED, { timeout: 15000 });
  await page.evaluate(() => { Math.random = () => 0.5; });
  await page.click("#randBtn");
  const RAND = await page.evaluate(() => document.getElementById("datePick").value);
  await page.waitForFunction(k => localStorage.getItem(k) !== null, "suite.cache.apod." + RAND, { timeout: 15000 });
  await page.fill("#datePick", VIDEO);
  await page.waitForFunction(k => localStorage.getItem(k) !== null, "suite.cache.apod." + VIDEO, { timeout: 15000 });
}
