/* voting.html — curated static directory (zero network).
   Core feature: pick a state -> pinned card with official links; pin from the
   table; filter; the choice persists in localStorage["suite.voting.state"]. */

export const selectors = [
  "body",
  "header h1",
  ".countdown .big",
  ".banner",
  "#stateSelect",
  ".search",
  ".national .ncard",
  ".btnlink",
  "#stateTable th",
  "#stateTable td.st",
  ".pinbtn",
  "footer"
];

export async function interact({ page, log }) {
  // countdown renders at load (no interaction needed)
  const cd = (await page.locator("#countdown").innerText()).replace(/\s+/g, " ").trim();
  log(`countdown at load: "${cd}"`);

  // full table
  const rows = await page.locator("#stateTable tbody tr").count();
  log(`state table rows: ${rows} (v1 list = 50 states + DC = 51)`);

  // pick a state from the dropdown -> pinned card
  await page.selectOption("#stateSelect", "CA");
  await page.waitForTimeout(100);
  const pinH2 = (await page.locator("#pinned .pinned h2").innerText()).replace(/\s+/g, " ").trim();
  const officeHref = await page.locator("#pinned .links a").nth(0).getAttribute("href");
  const registerHref = await page.locator("#pinned .links a").nth(1).getAttribute("href");
  log(`picked CA -> pinned card h2: "${pinH2}"`);
  log(`  office link: ${officeHref}`);
  log(`  register link: ${registerHref}`);
  const hl = (await page.locator("#stateTable tr.hl td.st").innerText()).replace(/\s+/g, " ").trim();
  log(`  highlighted table row: "${hl}"`);
  const stored1 = await page.evaluate(() => localStorage.getItem("suite.voting.state"));
  log(`  localStorage["suite.voting.state"] = ${JSON.stringify(stored1)}`);

  // unpin via the "— choose —" option: v1 removes the key entirely
  await page.selectOption("#stateSelect", "");
  await page.waitForTimeout(100);
  const stored2 = await page.evaluate(() => localStorage.getItem("suite.voting.state"));
  const cardCount = await page.locator("#pinned .pinned").count();
  log(`unpinned -> key is ${stored2 === null ? "removed (null, matches v1 removeItem)" : JSON.stringify(stored2)}; pinned cards in DOM: ${cardCount}`);

  // filter the table
  await page.fill("#search", "dak");
  await page.waitForTimeout(100);
  const filtered = await page.locator("#stateTable tbody td.st").allInnerTexts();
  log(`filter "dak" -> ${filtered.length} rows: ${filtered.map(t => t.replace(/\s+/g, " ").trim()).join(" | ")}`);

  // pin from the table button (single row after filtering)
  await page.fill("#search", "texas");
  await page.waitForTimeout(100);
  await page.click("#stateTable .pinbtn");
  await page.waitForTimeout(100);
  const selVal = await page.locator("#stateSelect").inputValue();
  const btnTxt = (await page.locator("#stateTable .pinbtn").innerText()).trim();
  const stored3 = await page.evaluate(() => localStorage.getItem("suite.voting.state"));
  log(`table pin (Texas) -> select value=${selVal}, pin button now reads "${btnTxt}", stored=${JSON.stringify(stored3)}`);

  // persistence across reload (the key survives and re-pins)
  await page.reload();
  await page.waitForTimeout(400);
  const selAfter = await page.locator("#stateSelect").inputValue();
  const pinAfter = (await page.locator("#pinned .pinned h2").innerText()).replace(/\s+/g, " ").trim();
  const hlAfter = (await page.locator("#stateTable tr.hl td.st").innerText()).replace(/\s+/g, " ").trim();
  log(`after reload -> select value=${selAfter}, pinned card: "${pinAfter}", highlighted row: "${hlAfter}"`);
}

/* same state-writing action on v1 so the localStorage key sets compare equal */
export async function v1Interact({ page }) {
  await page.selectOption("#stateSelect", "TX");
  await page.waitForTimeout(100);
}

export const screenshotAfterInteract = true;
