/* printables.mjs — interaction module for verify-tool.mjs
   Printable Calendar & Planner: offline, print-CSS tool. Exercises all three
   templates (month / week / habit), month changes, week-start, title, holiday
   overlay, and orientation, logging what actually renders. */

export const selectors = [
  "body",
  "header h1",
  ".panel",
  ".tabs button.on",
  ".btn",
  ".btn.ghost",
  ".previewNote",
  ".sheet",
  ".sheet .sh-title",
  "table.cal th",
  "table.cal td",
  "footer"
];

export const screenshotAfterInteract = true;
export const printShots = true;

const FIXED = new Date("2026-07-15T10:00:00");

async function sheetTitle(page) {
  return (await page.locator(".sheet .sh-title").textContent()).trim();
}
async function sheetSub(page) {
  const el = page.locator(".sheet .sh-sub");
  return (await el.count()) ? (await el.first().textContent()).trim() : "(none)";
}

export async function interact({ page, log }) {
  // Deterministic date: fix the clock, then reload so the tool's `new Date()` sees it.
  await page.clock.install({ time: FIXED });
  await page.reload();
  await page.waitForTimeout(300);

  /* ---- month template (default) ---- */
  log(`month tab: sh-title="${await sheetTitle(page)}"`);
  log(`month grid: ${await page.locator("table.cal tbody td").count()} cells, ` +
      `${await page.locator("table.cal td.today").count()} today-cell(s), ` +
      `${await page.locator("table.cal .hol").count()} holiday label(s): ` +
      (await page.locator("table.cal .hol").allTextContents()).join(" | "));
  log(`first weekday header: "${await page.locator("table.cal th").first().textContent()}"`);

  // change month to December 2026 — Christmas should appear
  await page.fill("#oMonth", "2026-12");
  await page.dispatchEvent("#oMonth", "change");
  log(`month → 2026-12: sh-title="${await sheetTitle(page)}", holidays: ` +
      (await page.locator("table.cal .hol").allTextContents()).join(" | "));

  // week starts on Monday
  await page.selectOption("#oWeekStart", "1");
  log(`weekStart=Monday: first header now "${await page.locator("table.cal th").first().textContent()}"`);

  // custom title
  await page.fill("#oTitle", "Family plan");
  await page.dispatchEvent("#oTitle", "input");
  log(`title set: sh-title="${await sheetTitle(page)}", sh-sub="${await sheetSub(page)}"`);
  await page.fill("#oTitle", "");
  await page.dispatchEvent("#oTitle", "input");

  // holidays off
  await page.uncheck("#oHol");
  log(`holidays unchecked: ${await page.locator("table.cal .hol").count()} holiday label(s) remain`);
  await page.check("#oHol");

  // orientation
  await page.selectOption("#oOrient", "landscape");
  log(`orient=landscape: sheet.landscape=${await page.locator(".sheet.landscape").count() === 1}, ` +
      `@page rule="${await page.locator("#pageStyle").textContent()}"`);
  await page.selectOption("#oOrient", "portrait");

  /* ---- weekly planner ---- */
  await page.click('#tabs button[data-t="week"]');
  await page.waitForTimeout(150);
  log(`week tab: sh-title="${await sheetTitle(page)}", sh-sub="${await sheetSub(page)}"`);
  log(`week grid: ${await page.locator(".dayblock").count()} dayblocks, first="${
      (await page.locator(".dayblock .dh b").first().textContent())}", sidebar boxes: ` +
      (await page.locator(".sidebar .box h4").allTextContents()).join(", "));
  await page.fill("#oWeekDate", "2026-11-26"); // Thanksgiving week
  await page.dispatchEvent("#oWeekDate", "change");
  log(`weekDate → 2026-11-26: sh-sub="${await sheetSub(page)}", holiday labels: ` +
      (await page.locator(".dayblock .hol").allTextContents()).join(" | "));

  /* ---- habit tracker ---- */
  await page.click('#tabs button[data-t="habit"]');
  await page.waitForTimeout(150);
  log(`habit tab: sh-title="${await sheetTitle(page)}", sh-sub="${await sheetSub(page)}"`);
  log(`habit auto-landscape: sheet.landscape=${await page.locator(".sheet.landscape").count() === 1}, ` +
      `@page rule="${await page.locator("#pageStyle").textContent()}"`);
  log(`habit rows: ` + (await page.locator("table.habit td.hname").allTextContents()).join(", ") +
      ` · day columns: ${await page.locator("table.habit thead tr").first().locator("th").count() - 1}`);
  await page.fill("#oHabits", "Stretch\nJournal");
  await page.dispatchEvent("#oHabits", "input");
  log(`habits edited: rows now "` + (await page.locator("table.habit td.hname").allTextContents()).join(", ") + `"`);

  // back to month: orientation should return to portrait
  await page.click('#tabs button[data-t="month"]');
  await page.waitForTimeout(150);
  log(`back to month: sh-title="${await sheetTitle(page)}", ` +
      `landscape=${await page.locator(".sheet.landscape").count() === 1}`);

  // Jump to today (under the fixed clock → July 2026)
  await page.click("#todayBtn");
  await page.waitForTimeout(150);
  log(`jump to today: sh-title="${await sheetTitle(page)}", oMonth value=${await page.inputValue("#oMonth")}`);

  // print button (window.print stubbed so headless run does not block)
  await page.evaluate(() => { window.print = () => { window.__printCalled = true; }; });
  await page.click("#printBtn");
  log(`print button: window.print called=${await page.evaluate(() => window.__printCalled === true)}`);
}

/* v1 writes no localStorage during interaction (suite.theme only, via the
   harness's own theme-toggle probes on both versions), so the same fixed-clock
   no-op keeps the key sets comparable. */
export async function v1Interact({ page }) {
  await page.clock.install({ time: FIXED });
  await page.reload();
  await page.waitForTimeout(300);
}
