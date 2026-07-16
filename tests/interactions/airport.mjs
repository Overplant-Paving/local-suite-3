/* tests/interactions/airport.mjs — Airport & Flight-Weather Board (Batch C, CORS-blocked tool)
   No live network: aviationweather.gov blocks browser scripts (network "blocked",
   endpoints []). What gets verified instead:
     1. the offline paste-a-METAR decoder (sample, custom LIFR, clear, error path),
     2. the designed link-out card (saved airports -> official METAR/TAF/FAA links),
        screenshotted in BOTH themes,
     3. the Suite.relay path, route-fulfilled against the v2 contract
        <base>?url=<encoded upstream URL> (relay/worker.js),
     4. the stale-cache offline path (aged cache + aborted network -> stale stamp),
     5. legacy v1 suite.relay detection (surfaced, never silently migrated). */
import { join } from "node:path";

/* Initial load (no saved airports) renders the decoder, empty board panel and
   relay panel in both versions — these selectors cover that state. */
export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "h1", ".panel",
  "#pasteBox", "button.primary", "button.ghost", "#icaoInput", "input.relay", "footer"
];

export const screenshotAfterInteract = true;

const RELAY_BASE = "https://relay.test.invalid/w";
const UPSTREAM = "https://aviationweather.gov/api/data/metar?format=json&ids=KSFO";
const METAR_KSFO = "KSFO 141856Z 28016KT 10SM FEW015 BKN200 19/12 A3001 RMK AO2 SLP162";
const RELAY_BODY = JSON.stringify([{
  icaoId: "KSFO", rawOb: METAR_KSFO,
  name: "San Francisco Intl, CA, US", reportTime: "2026-07-14 18:56:00"
}]);

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. offline METAR decoder ---- */
  await page.click("#sampleBtn");
  log(`sample decode: station="${(await page.textContent(".decoded .id")).trim()}", ` +
      `category="${(await page.textContent(".decoded .cat")).trim()}"`);
  const cells = await page.$$eval(".decoded .cell", els =>
    els.map(e => e.querySelector(".k").textContent + "=" + e.querySelector(".v").textContent));
  log("sample decode grid: " + cells.join(" | "));

  await page.click("#clearBtn");
  log(`after Clear: pasteBox="${await page.inputValue("#pasteBox")}", ` +
      `decodeOut="${(await page.textContent("#decodeOut")).trim()}" (both empty expected)`);

  await page.fill("#pasteBox", "KJFK 141851Z 21014G22KT 1/4SM FG VV002 17/16 A2992");
  await page.click("#decodeBtn");
  log(`custom decode: category="${(await page.textContent(".decoded .cat")).trim()}" (expect Low IFR)`);
  const cells2 = await page.$$eval(".decoded .cell", els =>
    els.map(e => e.querySelector(".k").textContent + "=" + e.querySelector(".v").textContent));
  log("custom decode grid: " + cells2.join(" | "));

  await page.fill("#pasteBox", "this is not a metar");
  await page.click("#decodeBtn");
  log(`decoder error path: .err="${(await page.textContent("#decodeOut .err")).trim()}"`);

  /* ---- 2. link-out board (the default, zero-setup product) ---- */
  await page.fill("#icaoInput", "ksfo");          // lowercase: must be uppercased
  await page.press("#icaoInput", "Enter");        // Enter submits
  await page.fill("#icaoInput", "KJFK");
  await page.click("#addBtn");
  await page.waitForTimeout(200);
  log(`suite.airports after adds: ${await page.evaluate(() => localStorage.getItem("suite.airports"))}`);
  log(`board mode line: "${(await page.textContent("#boardMode")).trim()}"`);
  const linkouts = await page.$$eval(".station.linkout", cards => cards.map(c => ({
    id: c.querySelector(".id").textContent,
    sub: c.querySelector(".lo-sub").textContent,
    links: [...c.querySelectorAll("a")].map(a => a.textContent.trim() + " -> " + a.href)
  })));
  log("link-out cards: " + JSON.stringify(linkouts, null, 1));

  await page.screenshot({ path: join(evidenceDir, "linkout-card-light.png"), fullPage: true });
  await page.click(".theme-btn");
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(evidenceDir, "linkout-card-dark.png"), fullPage: true });
  await page.click(".theme-btn");
  await page.waitForTimeout(200);
  log("link-out card screenshotted in both themes (linkout-card-light.png / linkout-card-dark.png)");

  /* invalid ICAO must be rejected (no chip, no write) */
  await page.fill("#icaoInput", "12");
  await page.click("#addBtn");
  await page.waitForTimeout(100);
  log(`after invalid code "12": suite.airports=${await page.evaluate(() => localStorage.getItem("suite.airports"))} (unchanged expected)`);

  /* remove a chip */
  await page.click('.aChip button[aria-label="Remove KJFK"]');
  await page.waitForTimeout(200);
  log(`after removing KJFK: suite.airports=${await page.evaluate(() => localStorage.getItem("suite.airports"))}, ` +
      `cards on board=${await page.$$eval(".station", els => els.length)}`);

  /* ---- 3. relay path: route-fulfilled against the v2 ?url= contract ---- */
  const relayCalls = [];
  await page.context().route("https://relay.test.invalid/**", r => {
    relayCalls.push(r.request().url());
    return r.fulfill({ contentType: "application/json", body: RELAY_BODY });
  });
  await page.fill("#relayInput", RELAY_BASE);
  await page.click("#relaySave");
  await page.waitForTimeout(700);
  log(`relay request observed: ${relayCalls[0]}`);
  log(`contract expected:      ${RELAY_BASE}?url=${encodeURIComponent(UPSTREAM)}`);
  log(`contract fulfilled: ${relayCalls[0] === RELAY_BASE + "?url=" + encodeURIComponent(UPSTREAM)}`);
  log(`board mode line: "${(await page.textContent("#boardMode")).trim()}"`);
  const live = await page.evaluate(() => {
    const s = document.querySelector(".station");
    return {
      className: s.className,
      id: s.querySelector(".id").textContent,
      cat: s.querySelector(".cat").textContent,
      name: (s.querySelector(".name") || {}).textContent,
      rows: [...s.querySelectorAll(".rows .r")].map(r => r.textContent.trim()),
      raw: (s.querySelector(".raw") || {}).textContent
    };
  });
  log("live station card via relay: " + JSON.stringify(live, null, 1));
  log(`board stamp: "${(await page.textContent("#boardStamp")).trim()}"`);
  await page.screenshot({ path: join(evidenceDir, "relay-live.png"), fullPage: true });

  /* refresh button forces a second relay fetch */
  await page.click("#loadBoardBtn");
  await page.waitForTimeout(500);
  log(`after Refresh board: relay calls total=${relayCalls.length} (expect 2), ` +
      `stamp="${(await page.textContent("#boardStamp")).trim()}"`);

  /* ---- 4. stale-cache offline path ---- */
  await page.evaluate(() => {
    const k = "suite.cache.airport.metars";
    const e = JSON.parse(localStorage.getItem(k));
    e.t = Date.now() - 24 * 60 * 60 * 1000;
    localStorage.setItem(k, JSON.stringify(e));
  });
  await page.context().unroute("https://relay.test.invalid/**");
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForTimeout(1800);
  log(`offline reload (relay unreachable, cache aged 24 h):`);
  log(`  stale stamp: "${(await page.textContent("#boardStamp")).trim()}"`);
  log(`  cards rendered from stale cache=${await page.$$eval(".station", els => els.length)}, ` +
      `first card cat="${(await page.textContent(".station .cat")).trim()}"`);
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.context().unroute(/^https?:/);

  /* ---- 5. relay clear -> back to link-out mode ---- */
  await page.click("#relayClear");
  await page.waitForTimeout(300);
  log(`after Remove relay: suite.relay.url=${await page.evaluate(() => localStorage.getItem("suite.relay.url"))}, ` +
      `relayInput="${await page.inputValue("#relayInput")}"`);
  log(`  mode line: "${(await page.textContent("#boardMode")).trim()}"`);
  log(`  link-out cards back=${await page.$$eval(".station.linkout", els => els.length)}`);

  /* ---- 6. legacy v1 suite.relay is surfaced, never silently migrated ---- */
  await page.evaluate(() => localStorage.setItem("suite.relay", "https://old-v1-worker.invalid/"));
  await page.reload();
  await page.waitForTimeout(500);
  log(`legacy v1 relay key set; note hidden=${await page.evaluate(() => document.getElementById("relayLegacyNote").hidden)}`);
  log(`  note text: "${(await page.textContent("#relayLegacyNote")).trim().slice(0, 160)}…"`);
  log(`  relayInput prefilled="${await page.inputValue("#relayInput")}"`);
  log(`  suite.relay.url=${await page.evaluate(() => localStorage.getItem("suite.relay.url"))} (must stay null — user must Save explicitly)`);
  await page.evaluate(() => localStorage.removeItem("suite.relay"));
  await page.reload();
  await page.waitForTimeout(400);
  log(`final state: link-out board, saved airports=${await page.evaluate(() => localStorage.getItem("suite.airports"))}`);
}

/* Same state-writing actions on v1 so localStorage key sets compare equal:
   suite.airports (add KSFO), suite.cache.airport.metars (one route-fulfilled
   relay fetch — v1 contract RELAY?ids=…&format=json), and the relay key saved
   then cleared (v1 removes suite.relay; v2 removes suite.relay.url — neither
   remains). suite.theme comes from the harness toggle in both. */
export async function v1Interact({ page }) {
  await page.context().route("https://relay.test.invalid/**", r =>
    r.fulfill({ contentType: "application/json", body: RELAY_BODY }));
  await page.fill("#icaoInput", "KSFO");
  await page.press("#icaoInput", "Enter");
  await page.fill("#relayInput", RELAY_BASE);
  await page.click("#relaySave");
  await page.waitForTimeout(800);          // v1 fetches + writes suite.cache.airport.metars
  await page.click("#relayClear");         // removes suite.relay
  await page.waitForTimeout(200);
}
