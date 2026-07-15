/* tests/interactions/elevation.mjs — Elevation Profiler (Batch B, CORS-open fetcher)
   Live sources: USGS EPQS (single point, GET) and Open-Elevation (profile batch, POST).
   Location is seeded (LA) per the addendum so Point A prefills from suite.location.
   Etiquette: exactly ONE point lookup and ONE profile run (60 samples = a single
   Open-Elevation POST — v1's chunk size 100 is preserved, so no fetch loops).
   Stale path: the tool's TTL is 7 days (terrain), so the cache is aged 8 DAYS
   (not the generic 24 h, which would still be fresh), then the network is blocked. */

export const selectors = [
  "body", ".top", ".back", ".theme-btn", "header h1", "header .tag",
  ".card", ".card h2", ".unit-tog", "button.go", "input[type=number]", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };
const B = { lat: "34.2257", lon: "-118.0596" }; // Mount Wilson area, ~32 km from downtown LA

export async function interact({ page, log, evidenceDir }) {
  /* fresh open: no saved location -> locbar hidden, inputs empty */
  log(`fresh open: locbar hidden = ${await page.locator("#locbar").evaluate(el => el.classList.contains("hidden"))}, ` +
    `latA = "${await page.inputValue("#latA")}"`);

  /* seed the shared location (addendum) and reload */
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForTimeout(600);
  log(`locbar after seeding LA: "${(await page.locator("#locbar").innerText()).replace(/\s+/g, " ").trim()}"`);
  log(`Point A prefilled from suite.location: lat=${await page.inputValue("#latA")}, lon=${await page.inputValue("#lonA")}`);

  /* ---- live source 1: USGS EPQS — one real single-point lookup (seeded LA) ---- */
  await page.click("#pointBtn");
  await page.waitForSelector("#pointResult .bignum b", { timeout: 45000 });
  const ptVal = (await page.locator("#pointResult .bignum b").innerText()).trim();
  const ptUnit = (await page.locator("#pointResult .bignum .u").innerText()).trim();
  const ptBadge = (await page.locator("#pointResult .srcbadge").innerText()).trim();
  const ptAlt = (await page.locator("#pointResult .msg").first().innerText()).trim();
  log(`live point elevation (LA 34.0522,-118.2437): ${ptVal} ${ptUnit} (${ptAlt}) — source badge "${ptBadge}"`);
  log(`cache entry: suite.cache.elevation.34.05220,-118.24370 = ` +
    `${await page.evaluate(() => localStorage.getItem("suite.cache.elevation.34.05220,-118.24370"))}`);

  /* unit toggle re-renders the same result in meters, then back */
  await page.click('#unitTog button[data-u="m"]');
  log(`after meters toggle: ${(await page.locator("#pointResult .bignum b").innerText()).trim()} ` +
    `${(await page.locator("#pointResult .bignum .u").innerText()).trim()}, ` +
    `aria-pressed(m)=${await page.getAttribute('#unitTog button[data-u="m"]', "aria-pressed")}`);
  await page.click('#unitTog button[data-u="ft"]');

  /* ---- live source 2: Open-Elevation — ONE profile run (single POST, 60 samples) ---- */
  await page.fill("#latB", B.lat);
  await page.fill("#lonB", B.lon);
  await page.click("#profBtn");
  await page.waitForSelector("#profResult svg.profile", { timeout: 60000 });
  log(`profile hint: "${(await page.locator("#profResult .hint").innerText()).trim()}"`);
  const stats = await page.locator("#profResult .stat").allInnerTexts();
  for (const s of stats) log(`profile stat: ${s.replace(/\s+/g, " ").trim()}`);
  log(`chart: profline paths = ${await page.locator("#profResult svg.profile path.profline").count()}, ` +
    `area = ${await page.locator("#profResult svg.profile path.profarea").count()}, ` +
    `gridlines = ${await page.locator("#profResult svg.profile line.gridline").count()}, ` +
    `axis labels = ${await page.locator("#profResult svg.profile text.axlabel").count()}`);
  const cacheCount = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith("suite.cache.elevation.")).length);
  log(`per-point cache entries after point + profile: ${cacheCount} (60 unique — A coincides with sample 0)`);

  /* hover readout (mouse path) — locator.hover scrolls the chart into view first */
  const svgLoc = page.locator("#profResult svg.profile");
  const box = await svgLoc.boundingBox();
  await svgLoc.hover({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  log(`hover readout mid-chart: "${(await page.locator("#readout").innerText()).trim()}"`);

  /* keyboard readout (a11y addition: arrow keys mirror hover) */
  await page.locator("#profResult svg.profile").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log(`keyboard readout after focus + 2×ArrowRight: "${(await page.locator("#readout").innerText()).trim()}"`);

  /* unit toggle re-renders the profile (stats + axis in meters) */
  await page.click('#unitTog button[data-u="m"]');
  log(`profile min stat after meters toggle: ` +
    `${(await page.locator("#profResult .stat").first().innerText()).replace(/\s+/g, " ").trim()}`);
  await page.click('#unitTog button[data-u="ft"]');

  /* swap A<->B and back */
  await page.click("#swapBtn");
  log(`after swap: A=(${await page.inputValue("#latA")}, ${await page.inputValue("#lonA")}) ` +
    `B=(${await page.inputValue("#latB")}, ${await page.inputValue("#lonB")})`);
  await page.click("#swapBtn");

  /* validation path (no fetch): empty B -> inline form error */
  await page.fill("#latB", "");
  await page.fill("#lonB", "");
  await page.click("#profBtn");
  log(`validation with empty B: "${(await page.locator("#formErr").innerText()).trim()}"`);

  /* ---- stale-cache offline path: age past the 7-day TTL, block the network ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days > 7-day TTL
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForTimeout(600);

  /* stale single point: expired cache serves as fallback, marked offline */
  await page.click("#pointBtn");
  await page.waitForSelector("#pointResult .bignum b", { timeout: 45000 });
  log(`offline stale point: ${(await page.locator("#pointResult .bignum b").innerText()).trim()} ` +
    `${(await page.locator("#pointResult .bignum .u").innerText()).trim()} — ` +
    `badge "${(await page.locator("#pointResult .srcbadge").innerText()).trim()}"`);
  log(`offline stale point note: "${(await page.locator("#pointResult .msg").last().innerText()).trim()}"`);

  /* stale profile: all 60 samples served from expired cache, marked offline */
  await page.fill("#latB", B.lat);
  await page.fill("#lonB", B.lon);
  await page.click("#profBtn");
  await page.waitForSelector("#profResult svg.profile", { timeout: 45000 });
  log(`offline stale profile hint: "${(await page.locator("#profResult .hint").innerText()).trim()}"`);
  log(`offline stale profile note: "${(await page.locator("#profResult .card > .msg").first().innerText()).trim()}"`);
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });

  /* offline + truly uncached point -> honest error card (no fake data) */
  await page.fill("#latA", "48.8584");
  await page.fill("#lonA", "2.2945"); // Paris — non-US, never cached
  await page.click("#pointBtn");
  await page.waitForSelector("#pointResult .card.err", { timeout: 45000 });
  log(`offline uncached point -> error card: "${(await page.locator("#pointResult .card.err h2").innerText()).trim()}"`);

  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so localStorage key sets compare equal:
   seeded LA -> one live point lookup -> one live profile run (same coords ->
   identical toFixed(5) cache keys from the identical slerp math). */
export async function v1Interact({ page }) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForTimeout(600);
  await page.click("#pointBtn");
  await page.waitForSelector("#pointResult .bignum b", { timeout: 45000 });
  await page.fill("#latB", B.lat);
  await page.fill("#lonB", B.lon);
  await page.click("#profBtn");
  await page.waitForSelector("#profResult svg.profile", { timeout: 60000 });
}
