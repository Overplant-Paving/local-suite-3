/* tests/interactions/worldclock.mjs — World Clock & Meeting Planner
   Deterministic clock via page.clock.install(); exercises: add city, add free
   IANA zone (Enter path), meeting slider, reference change, remove clock,
   persistence across reload. v1Interact mirrors the state-writing actions so
   the localStorage snapshots compare over identical final state. */

const FIXED_TIME = new Date("2026-07-15T12:34:56");

export const selectors = [
  "body",
  "header h1",
  "#citySel",
  "#addCity",
  "#freeZone",
  ".clock",
  ".clock .time",
  ".gridwrap",
  "table.grid",
  "#hourSlider",
  ".readout .r",
  "footer"
];

export const screenshotAfterInteract = true;

/* the same state-writing steps on either version */
async function addAndRemoveZones(page) {
  // add a city from the embedded list
  await page.selectOption("#citySel", "Asia/Tokyo");
  await page.click("#addCity");
  // add a free IANA zone via the Enter-key path
  await page.fill("#freeZone", "Asia/Kolkata");
  await page.press("#freeZone", "Enter");
  // remove the Kolkata clock again (leaves [local, Tokyo] persisted)
  await page.click('.clock:has(.zone:text-is("Asia/Kolkata")) .rm');
}

export async function interact({ page, log }) {
  await page.clock.install({ time: FIXED_TIME });

  const clocks0 = await page.locator(".clock").count();
  log(`initial clocks: ${clocks0} (local zone default)`);
  log(`local zone label: ${await page.locator(".clock .label").first().textContent()}`);

  // --- add a city from the select ---
  await page.selectOption("#citySel", "Asia/Tokyo");
  await page.click("#addCity");
  const tokyo = page.locator('.clock:has(.zone:text-is("Asia/Tokyo"))');
  log(`after Add: clocks=${await page.locator(".clock").count()}, ` +
      `Tokyo label="${await tokyo.locator(".label").textContent()}", ` +
      `time="${await tokyo.locator(".time").textContent()}", ` +
      `date="${await tokyo.locator(".date").textContent()}", ` +
      `sun="${await tokyo.locator(".sun").textContent()}"`);

  // --- add a free IANA zone via the Enter key ---
  await page.fill("#freeZone", "Asia/Kolkata");
  await page.press("#freeZone", "Enter");
  const kolkata = page.locator('.clock:has(.zone:text-is("Asia/Kolkata"))');
  log(`after free-zone Enter: clocks=${await page.locator(".clock").count()}, ` +
      `Kolkata label="${await kolkata.locator(".label").textContent()}", ` +
      `time="${await kolkata.locator(".time").textContent()}", ` +
      `input cleared="${await page.inputValue("#freeZone")}"`);

  // --- invalid free zone shows the v1 alert and adds nothing ---
  let alertText = "";
  page.once("dialog", d => { alertText = d.message(); return d.dismiss(); });
  await page.fill("#freeZone", "Not/A_Zone");
  await page.click("#addFree");
  log(`invalid zone alert: "${alertText.split("\n")[0]}", clocks still ${await page.locator(".clock").count()}`);

  // --- meeting planner: grid + slider ---
  log(`planner rows: ${await page.locator("table.grid tbody tr").count()}, ` +
      `cells/row: ${await page.locator("table.grid tbody tr").first().locator("td.cell").count()}`);
  const slider = page.locator("#hourSlider");
  await slider.focus();
  await slider.press("Home"); // keyboard path: hour 0
  log(`slider Home: hourLabel="${await page.locator("#hourLabel").textContent()}", ` +
      `selected cells=${await page.locator("table.grid td.cell.sel").count()}`);
  for (let i = 0; i < 9; i++) await slider.press("ArrowRight"); // hour 9
  log(`slider at 9: hourLabel="${await page.locator("#hourLabel").textContent()}"`);
  const readouts = await page.locator(".readout .r").allTextContents();
  log(`readout (${readouts.length} zones): ${readouts.map(s => s.replace(/\s+/g, " ").trim()).join(" | ")}`);

  // --- reference zone change ---
  await page.selectOption("#refSel", "1"); // Tokyo
  log(`reference -> Tokyo: hourLabel="${await page.locator("#hourLabel").textContent()}"`);

  // --- remove a clock ---
  await page.click('.clock:has(.zone:text-is("Asia/Kolkata")) .rm');
  log(`after remove Kolkata: clocks=${await page.locator(".clock").count()}, ` +
      `planner rows=${await page.locator("table.grid tbody tr").count()}`);

  // --- persistence: saved zone list survives a reload ---
  const saved = await page.evaluate(() => localStorage.getItem("suite.worldclock.zones"));
  log(`localStorage["suite.worldclock.zones"] = ${saved}`);
  await page.reload();
  await page.waitForTimeout(400);
  const zonesAfter = await page.locator(".clock .zone").allTextContents();
  log(`after reload: clocks=${zonesAfter.length}, zones=[${zonesAfter.join(", ")}]`);
}

export async function v1Interact({ page }) {
  await page.clock.install({ time: FIXED_TIME });
  await addAndRemoveZones(page);
}
