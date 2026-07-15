/* tests/interactions/foodrecalls.mjs — Food Recall Alerts (Batch B, cors-open fetcher)
   Single live source: api.fda.gov/food/enforcement.json. The state filter is seeded
   from suite.location (LA -> CA derivation proven), then the picker itself is driven
   once (NY) — two modest requests total. There is no all-states view in this tool
   (every view is one state + nationwide), so none is exercised. */
import { join } from "node:path";

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".controls select", ".filters button", ".summary", ".legend", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. suite.location -> state derivation + live CA fetch ---- */
  await page.evaluate(l => {
    localStorage.removeItem("suite.state");           // force the derivation path
    localStorage.removeItem("suite.cache.foodrecalls.CA"); // force a real network fetch
    localStorage.setItem("suite.location", JSON.stringify(l));
  }, LA);
  await page.reload();
  await page.waitForTimeout(4000); // live openFDA fetch + render
  log(`seeded suite.location = ${JSON.stringify(LA)}, suite.state removed`);
  log(`state select derived from location label: ${await page.inputValue("#stateSel")} (expected CA)`);
  log(`suite.state after load: ${await page.evaluate(() => localStorage.getItem("suite.state"))}`);
  log(`live #summary: "${(await page.textContent("#summary")).trim()}"`);
  const liveCount = await page.locator("#list .r").count();
  log(`live recall cards rendered for CA: ${liveCount}`);
  if (liveCount) {
    const first = page.locator("#list .r").first();
    log(`sample card badge: "${(await first.locator(".badge").textContent()).trim()}"`);
    log(`sample card date: "${(await first.locator(".date").textContent()).trim()}"`);
    log(`sample product (textContent, esc'd by DOM construction): "${(await first.locator(".desc").textContent()).trim().slice(0, 200)}"`);
    const reason = await first.locator(".reason").count()
      ? (await first.locator(".reason").textContent()).trim() : "(no reason field)";
    log(`sample reason: "${reason.slice(0, 250)}"`);
    /* remote data enters via createElement/textContent only — prove markup stays inert */
    const inert = await first.locator(".desc").evaluate(d => d.children.length === 0);
    log(`.desc has zero child elements (remote text rendered inert): ${inert}`);
    /* details expansion */
    await first.locator("summary").click();
    log(`"More detail" expanded: "${(await first.locator("details .kv").textContent()).trim().slice(0, 250)}"`);
  }
  log(`live #list .stamp: "${(await page.textContent("#list .stamp")).trim()}"`);
  const envelope = await page.evaluate(() => {
    try {
      const e = JSON.parse(localStorage.getItem("suite.cache.foodrecalls.CA"));
      return { t: e.t, payloadShape: Array.isArray(e.v) ? "array (v1 shape)" : typeof e.v,
               results: e.v && e.v.results ? e.v.results.length : (Array.isArray(e.v) ? e.v.length : null) };
    } catch (e) { return null; }
  });
  log(`suite.cache.foodrecalls.CA envelope after live load: ${JSON.stringify(envelope)}`);
  log(`note: no all-states view exists in this tool (every view is one state + nationwide)`);

  /* ---- 2. class filters (local, no fetch) ---- */
  await page.click('#filters button[data-c="1"]');
  log(`filter Class I: #summary="${(await page.textContent("#summary")).trim()}", cards=${await page.locator("#list .r").count()}`);
  log(`filter buttons aria-pressed: ${JSON.stringify(await page.$$eval("#filters button", bs => bs.map(b => b.dataset.c + "=" + b.getAttribute("aria-pressed"))))}`);
  await page.click('#filters button[data-c="all"]');
  log(`filter back to All: cards=${await page.locator("#list .r").count()}`);

  /* ---- 3. state picker -> second live fetch (NY) + suite.state persistence ---- */
  await page.selectOption("#stateSel", "NY");
  await page.waitForTimeout(4000);
  log(`state changed to NY: suite.state=${await page.evaluate(() => localStorage.getItem("suite.state"))}`);
  log(`NY #summary: "${(await page.textContent("#summary")).trim()}", cards=${await page.locator("#list .r").count()}`);
  log(`NY stamp: "${(await page.textContent("#list .stamp")).trim()}"`);

  /* ---- 4. stale-cache offline path (Batch B Definition of Done) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000; // > 12 h TTL -> forces a fetch, which is blocked
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForTimeout(2500);
  log(`offline reload (cache aged 24h, network blocked):`);
  log(`  #summary="${(await page.textContent("#summary")).trim()}"`);
  log(`  cards rendered from stale cache: ${await page.locator("#list .r").count()} (not a blank page)`);
  log(`  stale stamp: "${(await page.textContent("#list .stamp")).trim()}"`);
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.context().unroute(/^https?:/);

  /* ---- 5. back online: fresh load for the post-interaction screenshot ---- */
  await page.reload();
  await page.waitForTimeout(4000);
  log(`back online: #summary="${(await page.textContent("#summary")).trim()}", stamp="${(await page.textContent("#list .stamp")).trim()}"`);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   suite.location (seed), suite.state (derived CA, then NY),
   suite.cache.foodrecalls.CA and .NY. */
export async function v1Interact({ page }) {
  await page.evaluate(l => {
    localStorage.removeItem("suite.state");
    localStorage.removeItem("suite.cache.foodrecalls.CA");
    localStorage.setItem("suite.location", JSON.stringify(l));
  }, LA);
  await page.reload();
  await page.waitForTimeout(4000);
  await page.selectOption("#stateSel", "NY");
  await page.waitForTimeout(4000);
}
