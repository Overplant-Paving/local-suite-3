/* tests/interactions/timers.mjs — Stopwatch & Kitchen Timers (Batch A, offline).
   Time is driven with page.clock (installed FIRST): stopwatch laps and kitchen-timer
   completion are exercised deterministically via fastForward. The chime itself is
   inaudible in the harness; completion is verified by the rendered ringing state
   ("Time!", .ringing class, 🔔 tab title) and the persisted record. */

export const selectors = [
  "body",
  "header h1",
  ".back",
  ".theme-btn",
  ".tab",
  '.tab[data-view="stopwatch"]',
  ".newbar .name",
  "#addTimer",
  ".preset",
  ".sw-face .big",
  "#timerEmpty",
  "footer",
];

export const screenshotAfterInteract = true;

export async function interact({ page, log }) {
  await page.clock.install();

  /* ---- stopwatch: start, fast-forward, laps ---- */
  await page.click('.tab[data-view="stopwatch"]');
  log("stopwatch tab visible: " + await page.locator("#view-stopwatch").isVisible() +
      ", timers view hidden: " + !(await page.locator("#view-timers").isVisible()));
  await page.click("#swStart");
  log("stopwatch started; button reads: " + await page.locator("#swStart").innerText());
  await page.clock.fastForward(3000);
  log("display after 3.0s fast-forward: " + await page.locator("#swDisplay").innerText());
  await page.click("#swLap");
  await page.clock.fastForward(2500);
  await page.click("#swLap");
  log("display after further 2.5s: " + await page.locator("#swDisplay").innerText());
  const laps = await page.locator("#lapsWrap tbody tr").allInnerTexts();
  log("lap rows (latest first): " + JSON.stringify(laps.map(r => r.replace(/\s+/g, " ").trim())));
  await page.click("#swStart"); // stop
  log("stopped; button reads: " + await page.locator("#swStart").innerText() +
      ", lap disabled: " + await page.locator("#swLap").isDisabled());
  await page.click("#swReset");
  log("after reset display: " + await page.locator("#swDisplay").innerText() +
      ", lap table rows: " + await page.locator("#lapsWrap tr").count());

  /* ---- kitchen timers: named timer, pause/resume, run to completion ---- */
  await page.click('.tab[data-view="timers"]');
  await page.fill("#tName", "Egg test");
  await page.fill("#tH", "0");
  await page.fill("#tM", "0");
  await page.fill("#tS", "5");
  await page.click("#addTimer");
  const card = page.locator(".timer").first();
  log("timer added; name: " + await card.locator(".tname").innerText() +
      ", countdown: " + await card.locator(".big").innerText() +
      ", empty-state hidden: " + !(await page.locator("#timerEmpty").isVisible()));
  log("remove button aria-label: " + await card.locator(".x").getAttribute("aria-label"));

  await page.clock.fastForward(2000);
  log("after 2s fast-forward countdown: " + await card.locator(".big").innerText());
  await card.getByRole("button", { name: "Pause" }).click();
  const paused = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.timers.v1"))[0]);
  log("paused; persisted record: remain=" + paused.remain + "ms endAt=" + paused.endAt +
      " name=" + JSON.stringify(paused.name));
  await card.getByRole("button", { name: "Resume" }).click();
  await page.clock.fastForward(4000);
  log("run to completion; card shows: " + await card.locator(".big").innerText() +
      ", ringing class: " + await card.evaluate(el => el.classList.contains("ringing")) +
      ", tab title: " + await page.title());
  const rung = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.timers.v1"))[0]);
  log("persisted ringing state: ringing=" + rung.ringing + " dur=" + rung.dur);

  await card.getByRole("button", { name: "Dismiss" }).click();
  log("dismissed; countdown reset to: " + await card.locator(".big").innerText() +
      ", buttons: " + JSON.stringify(await card.locator(".row button").allInnerTexts()));

  /* ---- preset chip ---- */
  await page.getByRole("button", { name: /^Tea/ }).click();
  log("preset clicked; cards: " + await page.locator(".timer").count() +
      ", second card: " + await page.locator(".timer").nth(1).locator(".tname").innerText() +
      " " + await page.locator(".timer").nth(1).locator(".big").innerText());

  /* ---- persistence across reload (v1's headline claim) ---- */
  await card.getByRole("button", { name: "Start" }).click();
  await page.clock.fastForward(6000);
  log("before reload: Egg ringing=" + await card.evaluate(el => el.classList.contains("ringing")) +
      ", title: " + await page.title());
  await page.reload();
  await page.waitForTimeout(300);
  const names = await page.locator(".timer .tname").allInnerTexts();
  const bigs = await page.locator(".timer .big").allInnerTexts();
  log("after reload timers survive: names=" + JSON.stringify(names) +
      " displays=" + JSON.stringify(bigs) +
      " ringing classes=" + JSON.stringify(await page.locator(".timer").evaluateAll(
        els => els.map(el => el.classList.contains("ringing")))));

  /* ---- remove ---- */
  await page.locator(".timer").nth(1).locator(".x").click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.timers.v1")));
  log("removed second timer; cards: " + await page.locator(".timer").count() +
      ", persisted names: " + JSON.stringify(stored.map(t => t.name)));

  /* ---- Enter key adds a timer (a11y path) ---- */
  await page.fill("#tName", "Enter test");
  await page.fill("#tS", "30");
  await page.press("#tS", "Enter");
  log("Enter in seconds field adds timer; cards: " + await page.locator(".timer").count() +
      ", last card: " + await page.locator(".timer").last().locator(".tname").innerText());
}

/* Same state-writing actions on v1 so localStorage key sets compare equal
   (v1 writes only suite.timers.v1 — plus suite.theme via the harness). */
export async function v1Interact({ page }) {
  await page.clock.install();
  await page.fill("#tName", "Egg test");
  await page.fill("#tH", "0");
  await page.fill("#tM", "0");
  await page.fill("#tS", "5");
  await page.click("#addTimer");
  await page.clock.fastForward(6000);
  await page.getByRole("button", { name: /^Tea/ }).click();
}
