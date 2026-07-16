/* tests/interactions/launches.mjs — Rocket Launch Schedule (Batch C, cors-open + rl).
   Live source: ll.thespacedevs.com Launch Library 2, throttled at 15 req/hr, so the
   budget here is ONE live request in the interaction flow: the harness's initial
   page.goto fires it (empty cache -> load fetches). Everything after runs from the
   1-hour cache or behind route-fulfilled/aborted network.

   page.clock: the tool is a countdown/timer tool, but installing the clock before
   the cache lands would force a reload mid-fetch and spend a second live request.
   So interact() first waits (harness-side polling — safe under a fake clock) for
   the initial live fetch to land in suite.cache.launches.upcoming, THEN installs
   the clock and reloads; the reload paints from the fresh cache with no request.

   429 backoff segment runs on a SIBLING PAGE in the same context (shared file://
   localStorage): Chrome logs every HTTP-4xx resource load as a console error, and
   the harness fails on non-net::ERR console errors — the fulfilled 429 is the
   deliberate fixture, not a defect, so it is kept off the harness's listener.
   The offline segment stays on the main page (net::ERR_FAILED is filtered). */
import { join } from "node:path";

export const selectors = [
  "body",
  ".topbar",
  ".back",
  ".theme-btn",
  "h1",
  ".sub",
  "#refreshBtn",
  ".throttle-note",
  "#listHead",
  ".list",
  ".stamp",
  "footer",
];

export const screenshotAfterInteract = true;

/* harness-side wait: safe under an installed page clock */
async function until(page, fn, what, tries = 80, step = 250) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await page.waitForTimeout(step);
  }
  throw new Error("timed out waiting for " + what);
}

const HOUR = 3600000;
const cacheEnvelope = page => page.evaluate(() => {
  const raw = localStorage.getItem("suite.cache.launches.upcoming");
  return raw ? JSON.parse(raw) : null;
});
const text = (page, sel) => page.locator(sel).first().innerText().then(t => t.replace(/\s+/g, " ").trim());

export async function interact({ page, log, evidenceDir }) {
  /* ---- LIVE FETCH: the harness's initial goto fired the one real request;
     wait for the payload to land in the v1 cache key ---- */
  const env = await until(page, () => cacheEnvelope(page), "live LL2 payload in suite.cache.launches.upcoming");
  const items = Array.isArray(env.v) ? env.v : (env.v.results || []);
  const first = items[0] || {};
  log("live fetch evidence (suite.cache.launches.upcoming): " + items.length +
      " launches cached at " + new Date(env.t).toISOString() +
      "; payload shape = " + (Array.isArray(env.v) ? "slim array (v1)" : "raw LL2 (v2 fetchJSON)"));
  log("first cached launch: " + JSON.stringify({
    name: first.name, net: first.net,
    status: first.status && (first.status.abbrev || first.status.name),
    precision: first.net_precision ? first.net_precision.name : first.precision
  }));

  /* now the fake clock: reload repaints from the fresh cache — no network spent */
  await page.clock.install();
  await page.reload();
  await until(page, () => page.locator(".next .rname").count().then(n => n || null), "next-launch card");
  log("next mission card: rname=" + JSON.stringify(await text(page, ".next .rname")) +
      " prov=" + JSON.stringify(await text(page, ".next .prov")) +
      " badge=" + JSON.stringify(await page.locator(".next .badge").count()
        ? await text(page, ".next .badge") : "(none)"));
  log("stamp after cache-served reload: " + JSON.stringify(await text(page, "#stamp")) +
      " (fresh cache within the 1 h TTL — no request spent)");
  log("list rows rendered: " + await page.locator(".launch").count() +
      "; listHead visible: " + await page.locator("#listHead").isVisible());
  log("first list row: " + JSON.stringify(await text(page, ".launch")));
  const blurbCount = await page.locator(".launch .blurb").count();
  log("mission blurbs rendered (textContent, so remote text is inert): " + blurbCount +
      (blurbCount ? "; first blurb starts " + JSON.stringify((await text(page, ".launch .blurb")).slice(0, 80)) : ""));

  /* ---- countdown ticks under page.clock ---- */
  let hasCd = await page.locator("#cdBox").count();
  if (!hasCd) {
    /* live next launch has a coarse NET (no countdown by design — v1 shows the
       "Targeting <date>" line instead). Log that designed state, then pin a
       precise-NET fixture into the cache to verify the tick machinery. */
    log("no #cdBox: next launch NET is imprecise; approx line = " + JSON.stringify(await text(page, ".approx")));
    await page.evaluate(h => {
      const e = JSON.parse(localStorage.getItem("suite.cache.launches.upcoming"));
      const arr = Array.isArray(e.v) ? e.v : e.v.results;
      const it = arr[0];
      if (it.net_precision) it.net_precision.name = "Second"; else it.precision = "Second";
      it.net = new Date(Date.now() + 3 * 24 * h).toISOString();
      localStorage.setItem("suite.cache.launches.upcoming", JSON.stringify(e));
    }, HOUR);
    await page.reload();
    await until(page, () => page.locator("#cdBox").count().then(n => n || null), "countdown box (fixture NET)");
    log("countdown fixture: first cached item pinned to precision=Second, NET=now+3d (logged as fixture, not live data)");
  }
  const cdRead = () => page.locator("#cdBox .v").allInnerTexts();
  const cd1 = await cdRead();
  await page.clock.fastForward(3000);
  const cd2 = await cdRead();
  await page.clock.fastForward(57000);
  const cd3 = await cdRead();
  log("countdown ticks under page.clock: t0=" + JSON.stringify(cd1) +
      " +3s=" + JSON.stringify(cd2) + " +60s=" + JSON.stringify(cd3));
  log("when line: " + JSON.stringify(await page.locator(".next .when").count()
      ? await text(page, ".next .when") : "(none — imprecise NET)"));

  /* ---- deterministic 429: rate-limit note + cached render + backoff ----
     Run on a sibling page so the intentional 429 console error stays off the
     harness's fail-on-console listener (see header comment). */
  const p2 = await page.context().newPage();
  await p2.clock.install();
  let hits = 0;
  await p2.route(/ll\.thespacedevs\.com/, r => {
    hits++;
    r.fulfill({ status: 429, contentType: "application/json",
      body: JSON.stringify({ detail: "Request was throttled. Expected available in 3600 seconds." }) });
  });
  await p2.goto(page.url());
  await until(p2, () => p2.locator(".launch").count().then(n => n || null), "cache-served paint on p2");
  log("429 segment: p2 first paint served from fresh cache, API hits so far = " + hits + " (expect 0)");
  /* age the cache past the 1 h TTL so the next load spends a request -> 429 */
  await p2.evaluate(h => {
    const e = JSON.parse(localStorage.getItem("suite.cache.launches.upcoming"));
    e.t = Date.now() - 2 * h;
    localStorage.setItem("suite.cache.launches.upcoming", JSON.stringify(e));
  }, HOUR);
  await p2.reload();
  await until(p2, () => p2.locator("#stamp").innerText().then(t => t.includes("Rate limit reached") ? t : null),
    "429 rate-limit stamp");
  log("429 response -> stamp: " + JSON.stringify(await text(p2, "#stamp")) +
      "; cached rows still rendered: " + await p2.locator(".launch").count() +
      "; API hits = " + hits + " (expect 1)");
  const backoff = await p2.evaluate(() => localStorage.getItem("suite.launches.backoffUntil"));
  const backoffMs = +backoff - await p2.evaluate(() => Date.now());
  log("backoff written: suite.launches.backoffUntil=" + backoff +
      " (~" + Math.round(backoffMs / 60000) + " min ahead = TTL doubled to 2 h effective)");
  log("static throttle note visible: " + JSON.stringify(await text(p2, ".throttle-note")));
  await p2.screenshot({ path: join(evidenceDir, "rate-limited-429.png"), fullPage: true });
  /* backoff honored: reload with the cache still stale must NOT spend a request */
  await p2.reload();
  await until(p2, () => p2.locator("#stamp").innerText().then(t => t.includes("rate-limiting") ? t : null),
    "backoff-skip stamp");
  log("backoff honored on reload: stamp=" + JSON.stringify(await text(p2, "#stamp")) +
      "; API hits still = " + hits + " (no new request inside the backoff window)");
  await p2.unroute(/ll\.thespacedevs\.com/);
  await p2.close();

  /* ---- STALE-CACHE OFFLINE PATH (main page) ----
     Let the backoff window (written on p2, shared storage) expire via the fake
     clock, age the cache ~24 h, cut the network, reload. */
  await page.clock.fastForward(61 * 60 * 1000);
  await page.evaluate(h => {
    const e = JSON.parse(localStorage.getItem("suite.cache.launches.upcoming"));
    e.t = Date.now() - 24 * h;
    localStorage.setItem("suite.cache.launches.upcoming", JSON.stringify(e));
  }, HOUR);
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload(); // must render the stale/offline state, not a blank page
  await until(page, () => page.locator("#stamp").innerText().then(t => t.includes("Live fetch failed") ? t : null),
    "offline stale stamp");
  log("offline stale stamp: " + JSON.stringify(await text(page, "#stamp")));
  log("offline: next card still renders " + JSON.stringify(await text(page, ".next .rname")) +
      "; cached rows " + await page.locator(".launch").count());
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  /* the ↻ refresh button forces a fetch even offline -> same honest failure */
  await page.locator("#refreshBtn").click();
  await until(page, () => page.locator("#stamp").innerText().then(t => t.includes("Live fetch failed") ? t : null),
    "refresh-button offline stamp");
  log("refresh button offline: stamp=" + JSON.stringify(await text(page, "#stamp")) +
      " (button listener exercised; cache-first paint kept the schedule visible)");
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so localStorage key sets compare equal:
   v1 writes suite.cache.launches.upcoming on its own boot fetch (same key) and
   suite.theme via the harness toggle. suite.launches.backoffUntil is v2-only
   (policy-added rl backoff, declared in the manifest) and expected under
   keysOnlyInV2. No clock needed here — nothing time-sensitive is asserted. */
export async function v1Interact({ page }) {
  for (let i = 0; i < 80; i++) {
    const hit = await page.evaluate(() => !!localStorage.getItem("suite.cache.launches.upcoming"));
    if (hit) return;
    await page.waitForTimeout(250);
  }
  throw new Error("v1 live fetch never landed in suite.cache.launches.upcoming");
}
