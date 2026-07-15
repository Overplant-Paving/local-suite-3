/* dates.mjs — interaction module for Countdown & Date Calculator (offline, pure date math).
   Deterministic: the clock is fixed to 2026-07-15 12:00 local before any input, so every
   computed day-count below is a stable, checkable number. */

const FIXED = new Date("2026-07-15T12:00:00");

export const selectors = [
  "body", "header h1", ".theme-btn", ".back", ".card", ".btn",
  ".seg button.on", "input", "select", ".big", ".sub", "footer"
];

export const screenshotAfterInteract = true;

async function text(page, sel) {
  return (await page.locator(sel).first().innerText()).replace(/\s+/g, " ").trim();
}

export async function interact({ page, log }) {
  await page.clock.install({ time: FIXED });
  log(`clock fixed at ${FIXED.toISOString()} (local 2026-07-15)`);

  /* 1. saved countdown: known date -> known day count.
     2026-07-15 -> 2026-12-25 = 16+31+30+31+30+25 = 163 days */
  await page.fill("#cdName", "Launch");
  await page.fill("#cdDate", "2026-12-25");
  await page.click("#cdAdd");
  log(`countdown card count after add: ${await page.locator(".cd").count()}`);
  log(`countdown [Launch] num: "${await text(page, ".cd .num")}" (expected 163)`);
  log(`countdown [Launch] when: "${await text(page, ".cd .when")}"`);

  /* add a second countdown, then remove it via the x button (exercise removal;
     "Launch" stays so the localStorage snapshot shows the persisted key) */
  await page.fill("#cdName", "Temp");
  await page.fill("#cdDate", "2026-08-01");
  await page.click("#cdAdd");
  const afterSecond = await page.locator(".cd").count();
  // "Temp" (17 days out) sorts before "Launch" (163) — remove it by its accessible name
  await page.click('.cd .rm[aria-label="Remove countdown: Temp"]');
  log(`countdown cards: ${afterSecond} after second add, ${await page.locator(".cd").count()} after removing "Temp"`);

  /* 2. days until / since: 2026-07-22 is 7 days from the fixed today */
  await page.fill("#duDate", "2026-07-22");
  log(`days-until big: "${await text(page, "#duOut .big")}" (expected 7)`);
  log(`days-until sub: "${await text(page, "#duOut .sub")}"`);

  /* past date: 2026-07-01 is 14 days ago */
  await page.fill("#duDate", "2026-07-01");
  log(`days-since big: "${await text(page, "#duOut .big")}" (expected 14), sub: "${await text(page, "#duOut .sub")}"`);

  /* 3. business-day math across the observed July 4 holiday.
     Start Thu 2026-07-02, +3 business days. Fri Jul 3 = Independence Day observed
     (Jul 4 2026 is a Saturday), weekend skipped -> Mon 6, Tue 7, Wed 8.
     Expected: Wednesday, July 8, 2026. */
  await page.fill("#asStart", "2026-07-02");
  await page.fill("#asN", "3");
  await page.click('#asMode button[data-m="biz"]');
  log(`+3 business days from 2026-07-02: "${await text(page, "#asOut .big")}" / "${await text(page, "#asOut .sub")}" (expected Wednesday, July 8, 2026 — skips observed July 4 + weekend)`);
  log(`biz seg aria-pressed: cal=${await page.getAttribute('#asMode button[data-m="cal"]', "aria-pressed")} biz=${await page.getAttribute('#asMode button[data-m="biz"]', "aria-pressed")}`);

  /* same span in calendar mode: 2026-07-02 + 3 = Sunday, July 5, 2026 */
  await page.click('#asMode button[data-m="cal"]');
  log(`+3 calendar days from 2026-07-02: "${await text(page, "#asOut .big")}" (expected Sunday, July 5, 2026)`);

  /* 4. age calculator with fixed inputs: 1990-05-20 as of 2026-07-15
     -> 36 years, 1 month, 25 days; 13,205 total days */
  await page.fill("#ageDob", "1990-05-20");
  await page.fill("#ageAs", "2026-07-15");
  const ageParts = await page.locator("#ageOut .part b").allInnerTexts();
  log(`age parts [years, months, days]: [${ageParts.join(", ")}] (expected [36, 1, 25])`);
  log(`age sub: "${await text(page, "#ageOut .sub")}" (expected 13,205 days total)`);

  /* 5. between two dates: 2026-07-01 -> 2026-07-31 = 30 days. The span is counted
     exclusive-of-start (Jul 2..31): 8 weekend days (Sat/Sun on 4,5,11,12,18,19,25,26)
     and 22 weekdays minus the observed July 4 holiday (Fri Jul 3) = 21 business days */
  await page.fill("#wbA", "2026-07-01");
  await page.fill("#wbB", "2026-07-31");
  log(`between big: "${await text(page, "#wbOut .big")}" (expected 30 days)`);
  const wbParts = await page.locator("#wbOut .part b").allInnerTexts();
  log(`between parts [business, weekend]: [${wbParts.join(", ")}] (expected [21, 8])`);

  /* 6. Enter key in the name field submits (a11y addition) */
  await page.fill("#cdName", "EnterKey");
  await page.fill("#cdDate", "2026-09-01");
  await page.press("#cdName", "Enter");
  const cds = await page.locator(".cd").count();
  log(`Enter in name field adds a countdown: ${cds} cards now (expected 2)`);
  await page.click('.cd .rm[aria-label="Remove countdown: EnterKey"]');
  log(`removed "EnterKey" again: ${await page.locator(".cd").count()} card(s) remain — "Launch" persists for the storage snapshot`);

  /* 7. persistence: reload and confirm the saved countdown survives */
  await page.reload();
  await page.waitForTimeout(300);
  await page.clock.install({ time: FIXED });
  log(`after reload: ${await page.locator(".cd").count()} saved countdown(s); name="${await text(page, ".cd .name")}"`);
  log(`localStorage["suite.dates.countdowns"] = ${await page.evaluate(() => localStorage.getItem("suite.dates.countdowns"))}`);
}

/* same state-writing action on v1 so the localStorage key sets compare equal */
export async function v1Interact({ page }) {
  await page.clock.install({ time: FIXED });
  await page.fill("#cdName", "Launch");
  await page.fill("#cdDate", "2026-12-25");
  await page.click("#cdAdd");
}
