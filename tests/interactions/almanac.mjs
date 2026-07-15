/* tests/interactions/almanac.mjs — Sun & Moon Almanac (Batch A, offline math +
   one optional zippopotam.us ZIP lookup in the first-run location UI). */

export const selectors = [
  "body", "header h1", ".back", ".theme-btn",
  ".firstrun", ".firstrun input", ".btn", ".btn.ghost",
  ".card", ".mini", ".datepick", "footer"
];

export const screenshotAfterInteract = true;

async function setZip(page) {
  await page.fill("#zipIn", "92101");
  await page.click("#zipBtn");
  await page.waitForSelector("#app:not(.hidden)", { timeout: 20000 });
}

async function rows(page, sel) {
  const t = await page.locator(sel + " .row").allInnerTexts();
  return t.map(s => s.replace(/\s+/g, " ").trim());
}

export async function interact({ page, log }) {
  /* first-run location UI */
  log(`firstrun visible on fresh open: ${await page.locator("#firstrun").isVisible()}`);
  await setZip(page); // live ZIP lookup (api.zippopotam.us, one request)
  log(`location label after ZIP 92101: ${await page.locator("#locLabel").innerText()}`);
  log(`suite.location = ${await page.evaluate(() => localStorage.getItem("suite.location"))}`);

  /* computed sun values for today */
  log(`sun date label: ${await page.locator("#sunDateLbl").innerText()}`);
  for (const r of await rows(page, "#sunKeyRows")) log(`sun row: ${r}`);
  for (const r of await rows(page, "#twilightRows")) log(`twilight row: ${r}`);
  const arc = await page.locator("#sunArc").innerHTML();
  log(`sun arc svg: ${arc.length} chars, ${(arc.match(/<circle/g) || []).length} circles, ` +
    `${(arc.match(/<text/g) || []).length} text labels`);

  /* moon phase */
  log(`moon: ${await page.locator("#moonName").innerText()} · ` +
    `${await page.locator("#moonPct").innerText()} illuminated · ` +
    `${await page.locator("#moonAge").innerText()}`);
  for (const r of await rows(page, "#moonRows")) log(`moon row: ${r}`);
  const lit = await page.evaluate(() => {
    const cv = document.getElementById("moonCanvas");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] > 150) n++;
    return n;
  });
  log(`moon canvas: ${lit} bright (lit) pixels painted`);

  /* solstice / equinox countdowns */
  const seasons = await page.locator("#seasonGrid .count").allInnerTexts();
  for (const s of seasons) log(`season: ${s.replace(/\s+/g, " ").trim()}`);
  log(`season countdown cards rendered: ${seasons.length}`);

  /* date picker: winter solstice day, then back to today */
  await page.fill("#dateIn", "2026-12-21");
  log(`after date -> 2026-12-21: label "${await page.locator("#sunDateLbl").innerText()}"`);
  for (const r of await rows(page, "#sunKeyRows")) log(`sun row (Dec 21): ${r}`);
  log(`moon (Dec 21): ${await page.locator("#moonName").innerText()} · ` +
    `${await page.locator("#moonPct").innerText()}`);
  await page.click("#todayBtn");
  log(`after "today": label "${await page.locator("#sunDateLbl").innerText()}", ` +
    `date input = ${await page.inputValue("#dateIn")}`);

  /* change-location flow returns to first-run, then re-set */
  await page.click("#changeLoc");
  log(`after "change": firstrun visible = ${await page.locator("#firstrun").isVisible()}`);
  await page.click("#zipBtn"); // zip input still holds 92101
  await page.waitForSelector("#app:not(.hidden)", { timeout: 20000 });
  log(`re-set location, app visible again: ${await page.locator("#app").isVisible()}`);

  /* Enter key submits the ZIP field (a11y path) — exercised via keyboard */
  await page.click("#changeLoc");
  await page.focus("#zipIn");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#app:not(.hidden)", { timeout: 20000 });
  log("Enter in ZIP field submitted and restored the app view");
}

/* same state-writing actions on v1 so the localStorage key sets compare equal */
export async function v1Interact({ page }) {
  await setZip(page);
}
