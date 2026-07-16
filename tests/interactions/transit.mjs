/* tests/interactions/transit.mjs — Transit Departure Board (Batch C, remediation)
   Live path: real BART station list + real ETD departures (public key via Suite.key).
   Then the two remediations are exercised:
     1. key externalization — the demo-key nudge renders (no suite.key.bart set);
     2. the .example custom feed is gone — the "My agency" link-out card is saved and
        rendered, and the preserved custom-feed fetch is verified twice with a
        route-fulfilled GTFS-realtime-as-JSON payload: once direct, once through
        Suite.relay (contract: <base>?url=<encoded>).
   Finally the Batch B stale-cache offline path: back-date suite.cache.*, abort all
   http(s), reload — the board must render cached departures with the
   "Offline — cached from <time>" stamp, not a blank. One Refresh-click recovery
   fetch at the end so the after-interaction shot shows the live state.

   Etiquette note: real api.bart.gov requests — interaction pass: 1 stations +
   3 ETD (initial, station change, recovery); plus the harness's four screenshot
   page-loads (v1/v2 x light/dark) and the v1 parity pass each perform their own
   stations+ETD load exactly as a user opening the page would (~12 requests for
   the whole run). BART's ETD API is built for 30-second polling; no loops, no
   retries. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".card", ".seg", ".seg button.on", ".btn", ".hint", ".board-head .stn",
  ".board-head .upd", "#board", "footer"
];

export const screenshotAfterInteract = true;

const FEED_URL = "https://feed.test/departures.json";
const RELAY_BASE = "https://relay.test/w";
const NOW_S = () => Math.floor(Date.now() / 1000);

/* GTFS-realtime-as-JSON (heuristic 1 in the tool) — the route-fulfilled payload */
const gtfsPayload = () => JSON.stringify({
  header: { gtfs_realtime_version: "2.0" },
  entity: [
    { id: "1", trip_update: { trip: { route_id: "Red Line" }, stop_time_update: [{ stop_id: "STN-04", departure: { time: NOW_S() + 240 } }] } },
    { id: "2", trip_update: { trip: { route_id: "Blue Line" }, stop_time_update: [{ stop_id: "STN-04", arrival: { time: NOW_S() + 660 } }] } },
    { id: "3", trip_update: { trip: { trip_id: "trip-77" }, stop_time_update: [{ stop_id: "STN-09", departure: { time: NOW_S() + 1200 } }] } }
  ]
});
/* plain-array shape (heuristic 2) for the relay pass, so both shapes are proven */
const arrayPayload = () => JSON.stringify({
  departures: [
    { destination: "Airport", minutes: 7, platform: 2 },
    { headsign: "Downtown", time: NOW_S() + 540 }
  ]
});

const bartReady = page => page.waitForFunction(() => {
  const b = document.querySelector("#board");
  if (!b) return false;
  if (b.querySelector(".dep")) return true;                    // departures rendered
  const h = b.querySelector(".hint");
  return !!(h && h.textContent.trim() !== "Pick a station to see departures." && h.textContent.trim() !== "Loading…");
}, { timeout: 30000 });

const stationsReady = page => page.waitForFunction(
  () => document.querySelectorAll("#bartStn option").length > 10, { timeout: 30000 });

async function logBoard(page, log, tag) {
  const stn = (await page.textContent("#boardStn")).trim();
  const upd = (await page.textContent("#boardUpd")).trim();
  const deps = await page.$$eval("#board .dep", els => els.map(el => {
    const dest = el.querySelector(".dest").textContent.trim();
    const times = Array.from(el.querySelectorAll(".t")).map(t => t.textContent.replace(/\s+/g, " ").trim()).join(", ");
    const meta = (el.querySelector(".meta") || { textContent: "" }).textContent.trim();
    return `${dest} -> [${times}]${meta ? ` (${meta})` : ""}`;
  }));
  if (deps.length) {
    log(`${tag} station "${stn}" · "${upd}" · ${deps.length} destinations:`);
    deps.slice(0, 6).forEach(d => log(`${tag}   ${d}`));
  } else {
    const hint = ((await page.$eval("#board", el => el.textContent)) || "").replace(/\s+/g, " ").trim();
    log(`${tag} station "${stn}" · "${upd}" · no .dep rows; board says: "${hint.slice(0, 160)}"`);
  }
  return deps.length;
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. live BART load (stations + ETD, real fetches, public key) ---- */
  await stationsReady(page);
  await bartReady(page);
  const stnCount = await page.$$eval("#bartStn option", o => o.length);
  log(`live: BART station list loaded — ${stnCount} stations in the select`);
  await logBoard(page, log, "live:");

  /* remediation 1 evidence: demo-key nudge (no suite.key.bart set -> isDemo) */
  const nudge = await page.$eval("#keyNudge", el => ({
    hidden: el.hidden, text: el.textContent.replace(/\s+/g, " ").trim(),
    href: el.querySelector("a") && el.querySelector("a").href
  }));
  log(`key nudge: hidden=${nudge.hidden} text="${nudge.text}" signup=${nudge.href}`);
  const keyProbe = await page.evaluate(() => ({
    stored: localStorage.getItem("suite.key.bart"),
    resolved: Suite.key("bart")
  }));
  log(`Suite.key("bart"): stored=${keyProbe.stored} -> value=${keyProbe.resolved.value} isDemo=${keyProbe.resolved.isDemo}`);
  log(`source grep: the literal BART key is ${await page.content().then(c =>
    c.includes("MW9S-E7SL-26DU-VV8V") ? "STILL IN THE TOOL (FAIL)" : "not in the tool markup/script (core supplies it)")}`);

  /* ---- 2. station change: writes suite.transit.bartStation + one live ETD ---- */
  await page.selectOption("#bartStn", "EMBR");
  await page.waitForFunction(() =>
    document.querySelector("#boardStn").textContent.trim() !== "—" &&
    document.querySelector("#boardStn").textContent.toLowerCase().includes("embarcadero") ||
    document.querySelector("#board .hint.err"), { timeout: 30000 });
  await bartReady(page);
  await logBoard(page, log, "live EMBR:");
  log(`stored station: suite.transit.bartStation=${await page.evaluate(() => localStorage.getItem("suite.transit.bartStation"))}`);

  /* ---- 3. remediation 2 evidence: the "My agency" link-out card ---- */
  await page.click('#srcSeg button[data-s="custom"]');
  await page.fill("#agencyUrl", "https://www.transitchicago.com/traintracker/");
  await page.click("#agencySave");
  const card = await page.$eval("#agencyCard .linkcard", a => ({
    href: a.href, title: a.querySelector("b").textContent.trim(), host: a.querySelector("span").textContent.trim(),
    target: a.target, rel: a.rel
  }));
  log(`agency link-out card: "${card.title}" -> ${card.href} (host label "${card.host}", target=${card.target}, rel=${card.rel})`);
  await page.screenshot({ path: `${evidenceDir}/agency-linkout.png`, fullPage: true });

  /* ---- 3b. link-out directory pane (v1 feature, unchanged) ---- */
  await page.click('#srcSeg button[data-s="links"]');
  const links = await page.$$eval("#linkGrid .linkcard", els =>
    els.map(a => `${a.querySelector("b").textContent} -> ${new URL(a.href).hostname}`));
  log(`links pane: ${links.length} agency cards, boardCard display="${await page.$eval("#boardCard", el => el.style.display)}"`);
  links.forEach(l => log(`links pane:   ${l}`));
  await page.click('#srcSeg button[data-s="custom"]');

  /* ---- 4. preserved custom feed, direct (CORS-open agency), route-fulfilled ---- */
  await page.route(FEED_URL, r => r.fulfill({ contentType: "application/json", body: gtfsPayload() }));
  await page.fill("#customUrl", FEED_URL);
  await page.click("#customGo");
  await page.waitForFunction(() => document.querySelectorAll("#board .dep").length >= 3, { timeout: 10000 });
  await logBoard(page, log, "custom direct (GTFS-rt JSON):");

  /* ---- 5. preserved custom feed through Suite.relay(<base>?url=<encoded>) ---- */
  let relayHit = null;
  const relayMatch = u => u.href.startsWith(RELAY_BASE + "?url=");
  await page.route(relayMatch, r => {
    relayHit = r.request().url();
    r.fulfill({ contentType: "application/json", body: arrayPayload() });
  });
  await page.evaluate(base => localStorage.setItem("suite.relay.url", base), RELAY_BASE);
  await page.click("#customGo");
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("#board .dep .dest")).some(d => d.textContent === "Airport"),
    { timeout: 10000 });
  log(`relay request observed: ${relayHit}`);
  log(`relay contract ok: ${relayHit === RELAY_BASE + "?url=" + encodeURIComponent(FEED_URL)}`);
  log(`relay upd stamp: "${(await page.textContent("#boardUpd")).trim()}"`);
  await logBoard(page, log, "custom via relay (plain array):");
  /* cleanup: relay key out of the parity snapshot; routes off */
  await page.evaluate(() => localStorage.removeItem("suite.relay.url"));
  await page.unroute(FEED_URL);
  await page.unroute(relayMatch);

  /* ---- 5b. unrecognized-shape fallback: raw JSON shown honestly (v1 feature) ---- */
  await page.route(FEED_URL, r => r.fulfill({ contentType: "application/json", body: '{"hello":"world","not":"a departure shape"}' }));
  await page.click("#customGo");
  await page.waitForFunction(() => !!document.querySelector("#board pre"), { timeout: 10000 });
  log(`raw fallback: hint="${(await page.$eval("#board .hint", el => el.textContent)).replace(/\s+/g, " ").trim().slice(0, 90)}…" pre="${(await page.$eval("#board pre", el => el.textContent)).replace(/\s+/g, " ").trim()}"`);
  await page.unroute(FEED_URL);
  /* back to the BART tab so the stale-path reload starts from v1-boot state */
  await page.click('#srcSeg button[data-s="bart"]');

  /* ---- 6. stale-cache offline path (Batch B addendum) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now() - 24 * 60 * 60 * 1000;
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await stationsReady(page);   // station select must repopulate from the (expired) cache
  await bartReady(page);       // board must render stale departures, not a blank
  const staleUpd = (await page.textContent("#boardUpd")).trim();
  log(`offline-stale upd stamp: "${staleUpd}" (class: ${await page.getAttribute("#boardUpd", "class")})`);
  await logBoard(page, log, "offline-stale:");
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* ---- 7. recovery: one Refresh click -> live board again for the final shot ---- */
  await page.click("#bartRefresh");
  await page.waitForFunction(() =>
    document.querySelector("#boardUpd").textContent.trim().startsWith("Updated") ||
    document.querySelector("#board .hint.err"), { timeout: 30000 });
  log(`recovery after unroute: "${(await page.textContent("#boardUpd")).trim()}"`);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   v1 writes suite.cache.transit.bartstations on load, suite.transit.bartStation on
   station change, suite.transit.customUrl on a custom-feed load (routed here so v1
   makes no real custom fetch). v2-only keys (suite.cache.transit.etd.*,
   suite.transit.agencyLink) are the two documented additions — see report.md. */
export async function v1Interact({ page }) {
  await page.waitForFunction(() => document.querySelectorAll("#bartStn option").length > 10, { timeout: 30000 });
  await page.waitForFunction(() => {
    const b = document.querySelector("#board");
    return b && (b.querySelector(".dep") || (b.querySelector(".hint") &&
      b.querySelector(".hint").textContent.trim() !== "Pick a station to see departures."));
  }, { timeout: 30000 });
  await page.selectOption("#bartStn", "EMBR");
  await page.waitForTimeout(2500);
  await page.route(FEED_URL, r => r.fulfill({ contentType: "application/json", body: gtfsPayload() }));
  await page.click('#srcSeg button[data-s="custom"]');
  await page.fill("#customUrl", FEED_URL);
  await page.click("#customGo");
  await page.waitForFunction(() => document.querySelectorAll("#board .dep").length >= 1, { timeout: 10000 });
  await page.unroute(FEED_URL);
}
