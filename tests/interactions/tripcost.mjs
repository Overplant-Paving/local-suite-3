/* tests/interactions/tripcost.mjs — Trip Cost Estimator (Batch A, offline core + optional helpers)
   Core feature verified with known numbers:
     400 mi one-way, 25 MPG, $3.50/gal → 16 gal one way, $56.00 one way, $112.00 round trip.
   Optional network paths (OSRM routing, EIA gas average) are exercised with the network
   BLOCKED to prove their failure mode is graceful — they are helpers, not the feature. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".card", ".card h2", ".seg button.on", ".btn", "#dist", "#results", "footer"
];

export const screenshotAfterInteract = true;

const BLOCKED = ["router.project-osrm.org", "api.eia.gov"];

async function blockNetwork(page) {
  for (const host of BLOCKED) {
    await page.route(`https://${host}/**`, route => route.abort());
  }
}

export async function interact({ page, log }) {
  await blockNetwork(page);

  /* ---- core offline math: distance + MPG + price -> cost ---- */
  await page.fill("#dist", "400");
  await page.fill("#price", "3.50");
  await page.fill("#people", "2");
  await page.fill("#veh0name", "Sedan");
  await page.fill("#veh0eff", "25");          // vehicle B stays at the default 45 MPG

  const v0cost = (await page.textContent("#veh0cost")).trim();
  const v0res = (await page.textContent("#veh0res")).replace(/\s+/g, " ").trim();
  log(`core math A: 400 mi / 25 mpg x $3.50/gal -> expected round trip $112.00, one way $56.00, 32.00 gal round`);
  log(`  observed #veh0cost = "${v0cost}"`);
  log(`  observed #veh0res  = "${v0res}"`);

  const v1cost = (await page.textContent("#veh1cost")).trim();
  log(`core math B: 400 mi / 45 mpg x $3.50/gal -> expected round trip $62.22`);
  log(`  observed #veh1cost = "${v1cost}"`);

  const winner = (await page.textContent("#winner")).replace(/\s+/g, " ").trim();
  log(`winner: expected "Vehicle B is cheaper by $49.78 round trip (44% less)."`);
  log(`  observed = "${winner}"`);

  /* ---- unit conversions ---- */
  await page.selectOption("#distUnit", "km");
  await page.fill("#dist", "100");
  log(`km conversion: 100 km (=62.14 mi) / 25 mpg x $3.50 -> expected round trip $17.40; observed #veh0cost = "${(await page.textContent("#veh0cost")).trim()}"`);
  await page.selectOption("#distUnit", "mi");
  await page.fill("#dist", "400");

  await page.selectOption("#priceUnit", "L");
  await page.fill("#price", "1.00");
  log(`litre price: $1.00/L (=$3.785/gal), 400 mi / 25 mpg -> expected round trip $121.13; observed #veh0cost = "${(await page.textContent("#veh0cost")).trim()}"`);
  await page.selectOption("#priceUnit", "gal");
  await page.fill("#price", "3.50");

  await page.selectOption("#veh1unit", "l100");
  await page.fill("#veh1eff", "8");
  log(`L/100km: 8 L/100km over 400 mi (643.74 km = 51.50 L = 13.60 gal) x $3.50 -> expected round trip $95.23; observed #veh1cost = "${(await page.textContent("#veh1cost")).trim()}"`);
  await page.selectOption("#veh1unit", "kml");
  await page.fill("#veh1eff", "15");
  log(`km/L: 15 km/L over 400 mi (643.74 km = 42.92 L = 11.34 gal) x $3.50 -> expected round trip $79.36; observed #veh1cost = "${(await page.textContent("#veh1cost")).trim()}"`);
  await page.selectOption("#veh1unit", "mpg");
  await page.fill("#veh1eff", "45");

  /* ---- two-points pane: offline haversine estimate ---- */
  await page.click('#distMode button[data-m="points"]');
  await page.fill("#p1", "34.0522, -118.2437");   // Los Angeles
  await page.fill("#p2", "37.7749, -122.4194");   // San Francisco
  await page.click("#calcHaversine");
  log(`haversine LA->SF: great-circle 347.4 mi x 1.25 -> expected ~434.3 mi; observed #ptsMsg = "${(await page.textContent("#ptsMsg")).trim()}", #dist = "${await page.inputValue("#dist")}"`);

  /* ---- Enter key runs the offline estimate (a11y addition) ---- */
  await page.fill("#p2", "36.1699, -115.1398");   // Las Vegas
  await page.press("#p2", "Enter");
  log(`Enter in #p2 (LA->Vegas): observed #ptsMsg = "${(await page.textContent("#ptsMsg")).trim()}"`);

  /* ---- OSRM path with network blocked: must fail gracefully ---- */
  await page.click("#calcOSRM");
  await page.waitForTimeout(800);
  log(`OSRM blocked: expected "Routing failed (Failed to fetch). Try the offline estimate."; observed #ptsMsg = "${(await page.textContent("#ptsMsg")).trim()}"`);

  /* ---- EIA path: empty key message, then blocked fetch fails gracefully ---- */
  await page.click("details summary");   // open the collapsed EIA panel
  await page.click("#eiaFetch");
  log(`EIA no key: expected "Paste a key first."; observed #eiaMsg = "${(await page.textContent("#eiaMsg")).trim()}"`);
  await page.fill("#eiaKey", "TESTKEY-NOT-REAL");
  await page.click("#eiaFetch");
  await page.waitForTimeout(800);
  log(`EIA blocked: expected "Request blocked/failed. Enter the price manually."; observed #eiaMsg = "${(await page.textContent("#eiaMsg")).trim()}"`);

  /* ---- saved vehicles: save, chip render, load, remove ---- */
  await page.click('#vehGrid [data-save="0"]');
  const chip = (await page.textContent("#savedChips .vchip")).replace(/\s+/g, " ").trim();
  log(`saved chip after "Save this vehicle": expected "Sedan · 25 MPG ×"; observed = "${chip}"`);
  await page.fill("#veh0name", "Changed");
  await page.click('#savedChips .vchip span[role="button"]');   // load chip back into Vehicle 1
  log(`chip load: expected #veh0name back to "Sedan"; observed = "${await page.inputValue("#veh0name")}"`);

  /* restore a deterministic direct-distance view for the screenshot */
  await page.fill("#dist", "400");
  const finalWinner = (await page.textContent("#winner")).replace(/\s+/g, " ").trim();
  log(`final winner line: "${finalWinner}"`);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal.
   The EIA fetch is blocked here too (never hit the live API with a fake key). */
export async function v1Interact({ page }) {
  for (const host of BLOCKED) {
    await page.route(`https://${host}/**`, route => route.abort());
  }
  await page.fill("#dist", "400");
  await page.fill("#price", "3.50");
  await page.fill("#people", "2");
  // v1 has no per-input ids on vehicle cards; address by data attributes
  await page.fill('#vehGrid [data-i="0"][data-f="name"]', "Sedan");
  await page.fill('#vehGrid [data-i="0"][data-f="eff"]', "25");
  await page.click('#vehGrid [data-save="0"]');
  await page.click("details summary");   // open the collapsed EIA panel
  await page.fill("#eiaKey", "TESTKEY-NOT-REAL");
  await page.click("#eiaFetch");
  await page.waitForTimeout(500);
}
