/* tests/interactions/tides.mjs — Tides & Currents Board (Batch B, CORS-open fetcher)
   Live-verifies the CO-OPS predictions fetch (hilo + 6-min curve + water temperature) for
   the station nearest the seeded suite.location (Los Angeles -> 9410840 Santa Monica, 15 mi),
   then the stale-cache offline path (caches aged 24 h, network blocked).
   Etiquette: one live exercise per source; the offline reload is served from cache. */
import { join } from "node:path";

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".stationbar", ".mini", "#content .card", ".msg", ".modal", ".btn", "footer"
];

export const screenshotAfterInteract = true;

const SEED = () => {
  localStorage.setItem("suite.location",
    JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }));
};

export async function interact({ page, log, evidenceDir }) {
  /* ---- live fetch: seed the shared location; boot auto-selects the nearest station ---- */
  await page.evaluate(SEED);
  await page.reload();
  await page.waitForSelector("#events .event", { timeout: 30000 });

  log(`station line: "${(await page.textContent("#stName")).trim()}" · "${(await page.textContent("#stMeta")).trim()}"`);
  log(`status dot class: "${await page.getAttribute("#statusDot", "class")}" · updated: "${(await page.textContent("#updated")).trim()}"`);

  const events = await page.$$eval("#events .event", els =>
    els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
  log(`next high/low events rendered: ${events.length}`);
  events.slice(0, 4).forEach((e, i) => log(`  event[${i}]: "${e}"`));

  log(`now strip: "${(await page.textContent(".now-strip")).replace(/\s+/g, " ").trim()}"`);

  const chart = await page.evaluate(() => {
    const s = document.getElementById("tideChart");
    return s ? { paths: s.querySelectorAll("path").length, circles: s.querySelectorAll("circle").length,
                 texts: s.querySelectorAll("text").length } : null;
  });
  log(`tide curve svg contents: ${JSON.stringify(chart)} (expect 2 paths = area+line, hi/lo + now markers)`);

  const temp = await page.evaluate(() => {
    const w = document.querySelector(".watertemp");
    return w ? w.textContent.replace(/\s+/g, " ").trim() : "(no .watertemp — station reported none)";
  });
  log(`water temperature card: "${temp}"`);

  const cacheKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith("suite.cache.tides.")).sort());
  log(`cache keys written: ${JSON.stringify(cacheKeys)}`);

  /* ---- station picker: nearest-first ranking + Esc close (keyboard path) ---- */
  await page.click("#changeStation");
  const near = await page.$$eval("#nearList .st", els =>
    els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
  log(`picker "nearest to you" rows: ${JSON.stringify(near)}`);
  await page.keyboard.press("Escape");
  log(`picker closed via Esc: backdrop open = ${await page.evaluate(() =>
    document.getElementById("backdrop").classList.contains("open"))}`);

  /* ---- stale-cache offline path: age caches 24 h, block the network, reload ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector("#events .event", { timeout: 30000 });
  log(`OFFLINE reload — status dot class: "${await page.getAttribute("#statusDot", "class")}" (expect "statusdot stale")`);
  log(`OFFLINE reload — updated text: "${(await page.textContent("#updated")).trim()}" (expect "cached <~24h-ago time>")`);
  const staleEvents = await page.$$eval("#events .event", els => els.length);
  log(`OFFLINE reload — events still rendered from cache: ${staleEvents}`);
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare.
   (v1 caches one combined entry per station; v2 caches per request — explained in report.md.) */
export async function v1Interact({ page }) {
  await page.evaluate(SEED);
  await page.reload();
  await page.waitForSelector("#events .event", { timeout: 30000 }).catch(() => {});
}
