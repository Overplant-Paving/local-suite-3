/* tests/interactions/zip.mjs — ZIP & Area Code Lookup (Batch B, CORS-open fetcher)
   Live paths (api.zippopotam.us): ZIP -> place (90012 -> Los Angeles), city -> ZIPs
   (CA / Beverly Hills), plus the zchip jump back to the ZIP tab. Offline path: the
   embedded NANP area-code table (213 -> Los Angeles (downtown), California).
   Stale-cache path per the Batch B addendum — note the tool's TTL is 10080 min
   (7 days), so the cache is aged 8 DAYS (not the addendum's example 24 h, which
   would still be TTL-fresh and would never exercise the network-failure branch). */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".pill.on", "#zipCard", "#zipIn", "#zipGo", "#acCard", "footer"
];

export const screenshotAfterInteract = true;

export async function interact({ page, log, evidenceDir }) {
  /* ---- LIVE FETCH 1: ZIP -> place, submitted with Enter (a11y pair) ---- */
  await page.fill("#zipIn", "90012");
  await page.press("#zipIn", "Enter");
  await page.waitForSelector("#zipOut .big", { timeout: 20000 });
  log(`ZIP 90012 (live fetch, Enter-submitted): expected "Los Angeles, CA"`);
  log(`  observed .big  = "${(await page.textContent("#zipOut .big")).trim()}"`);
  log(`  observed .sub  = "${(await page.textContent("#zipOut .sub")).trim()}"`);
  const facts = await page.$$eval("#zipOut .fact", els =>
    els.map(e => `${e.querySelector("span").textContent}=${e.querySelector("b").textContent}`));
  log(`  observed facts = ${facts.join(" | ")}`);
  log(`  maplink href   = "${await page.getAttribute("#zipOut a.maplink", "href")}"`);

  /* ---- save as suite location ---- */
  await page.click("#zipOut .savebtn");
  log(`save location: button now "${(await page.textContent("#zipOut .savebtn")).trim()}", ` +
      `disabled=${await page.$eval("#zipOut .savebtn", b => b.disabled)}`);
  log(`  suite.location = ${await page.evaluate(() => localStorage.getItem("suite.location"))}`);
  log(`  cache envelope keys for z90012: ${await page.evaluate(() => {
    const raw = localStorage.getItem("suite.cache.zip.z90012");
    return raw ? Object.keys(JSON.parse(raw)).join(",") : "MISSING";
  })}`);

  /* ---- LIVE FETCH 2: city -> ZIPs ---- */
  await page.click('.pills button:nth-child(2)');
  log(`city tab: cityCard hidden=${await page.$eval("#cityCard", e => e.hidden)}, ` +
      `zipCard hidden=${await page.$eval("#zipCard", e => e.hidden)}`);
  await page.fill("#stIn", "CA");
  await page.fill("#cityIn", "Beverly Hills");
  await page.press("#cityIn", "Enter");
  await page.waitForSelector("#cityOut .big", { timeout: 20000 });
  log(`city CA/Beverly Hills (live fetch, Enter-submitted):`);
  log(`  observed .big = "${(await page.textContent("#cityOut .big")).trim()}"`);
  log(`  observed .sub = "${(await page.textContent("#cityOut .sub")).trim()}"`);
  const chips = await page.$$eval("#cityOut .zchip", els => els.map(e => e.textContent));
  log(`  observed zchips = [${chips.join(", ")}]`);

  /* ---- zchip click jumps back to the ZIP tab and looks that ZIP up ---- */
  await page.click("#cityOut .zchip");
  await page.waitForSelector("#zipOut .big", { timeout: 20000 });
  log(`zchip "${chips[0]}" clicked: zip tab shown=${await page.$eval("#zipCard", e => !e.hidden)}, ` +
      `#zipIn="${await page.inputValue("#zipIn")}", ` +
      `result .big="${(await page.textContent("#zipOut .big")).trim()}"`);

  /* ---- area code lookup: fully offline, embedded table ---- */
  await page.click('.pills button:nth-child(3)');
  await page.fill("#acIn", "213");
  log(`area code 213 (offline, embedded table): expected 213 / Los Angeles (downtown) / California`);
  log(`  observed .big = "${(await page.textContent("#acOut .big")).trim()}"`);
  log(`  observed .ac-region = "${(await page.textContent("#acOut .ac-region")).trim()}"`);
  log(`  observed .sub = "${(await page.textContent("#acOut .sub")).trim()}"`);
  await page.fill("#acIn", "999");
  log(`area code 999 (not a US geographic code): observed = "${(await page.textContent("#acOut .msg")).trim()}"`);
  await page.fill("#acIn", "213");   // leave a real result on screen

  /* ---- STALE-CACHE OFFLINE PATH (Batch B addendum) ----
     TTL is 7 days, so age the cache 8 days to force a network attempt. */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 8 * 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector("#zipIn", { timeout: 10000 });
  await page.fill("#zipIn", "90012");
  await page.press("#zipIn", "Enter");
  await page.waitForSelector("#zipOut .note", { timeout: 20000 });
  log(`offline + 8-day-old cache, ZIP 90012 again:`);
  log(`  observed .big  = "${(await page.textContent("#zipOut .big")).trim()}"`);
  log(`  observed stale note = "${(await page.textContent("#zipOut .note")).trim()}"`);
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   suite.cache.zip.z90012, suite.location, suite.cache.zip.cCA-beverly hills,
   and the first Beverly Hills zchip's cache entry. */
export async function v1Interact({ page }) {
  await page.fill("#zipIn", "90012");
  await page.press("#zipIn", "Enter");
  await page.waitForSelector("#zipOut .big", { timeout: 20000 });
  await page.click("#zipOut .savebtn");
  await page.click('.pills button:nth-child(2)');
  await page.fill("#stIn", "CA");
  await page.fill("#cityIn", "Beverly Hills");
  await page.press("#cityIn", "Enter");
  await page.waitForSelector("#cityOut .big", { timeout: 20000 });
  await page.click("#cityOut .zchip");
  await page.waitForSelector("#zipOut .big", { timeout: 20000 });
}
