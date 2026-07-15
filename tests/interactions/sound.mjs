/* sound.mjs — interaction module for the Sound Machine (tools/sound.html).
   Audio is inaudible in the harness, so we verify STATE: UI reflects playing,
   AudioContext reachable via page.evaluate (top-level let bindings are global
   lexical bindings, visible to evaluate), active-node graph, volume plumbing,
   and the sleep timer via the mocked clock. */

export const selectors = [
  "body",
  "header h1",
  ".back",
  ".theme-btn",
  ".tag",
  ".master",
  ".master .play",
  ".sounds",
  ".snd",
  ".snd .state",
  ".timer",
  "#timerStatus",
  "footer",
];

export const screenshotAfterInteract = true;

const engineState = () => ({
  ctxState: (typeof ctx !== "undefined" && ctx) ? ctx.state : "no-ctx",
  playing: typeof playing !== "undefined" ? playing : "unreachable",
  nodes: (typeof nodes !== "undefined") ? Object.keys(nodes) : "unreachable",
  masterGain: (typeof masterGain !== "undefined" && masterGain)
    ? +masterGain.gain.value.toFixed(3) : null,
});

export async function interact({ page, log }) {
  await page.clock.install(); // timer tool — mock Date.now/setInterval first

  const masterBtn = page.locator("#masterBtn");
  const status = page.locator("#timerStatus");
  const card = (n) => page.locator(".snd").nth(n); // 0 white, 1 pink, 2 brown

  log(`initial: masterBtn="${await masterBtn.textContent()}" engine=${JSON.stringify(await page.evaluate(engineState))}`);
  log(`initial: 6 sound cards rendered = ${await page.locator(".snd").count() === 6}, first state text = "${await card(0).locator(".state").textContent()}"`);

  /* 1. click a noise card -> auto-play: card .on, state text, master button flips */
  await card(0).click(); // white noise
  await page.waitForTimeout(300);
  log(`after white-card click: card class="${await card(0).getAttribute("class")}" aria-pressed=${await card(0).getAttribute("aria-pressed")} state="${await card(0).locator(".state").textContent()}"`);
  log(`after white-card click: masterBtn="${await masterBtn.textContent()}" aria-pressed=${await masterBtn.getAttribute("aria-pressed")} engine=${JSON.stringify(await page.evaluate(engineState))}`);

  /* 2. switch noise types: pink on (mix), then white off -> only pink runs */
  await card(1).click(); // pink on
  log(`pink added: engine=${JSON.stringify(await page.evaluate(engineState))}`);
  await card(0).click(); // white off
  log(`white removed: card class="${await card(0).getAttribute("class")}" state="${await card(0).locator(".state").textContent()}" engine=${JSON.stringify(await page.evaluate(engineState))}`);

  /* 3. keyboard path on a card (a11y): Enter toggles brown on, then off */
  await card(2).focus();
  await page.keyboard.press("Enter");
  log(`brown toggled ON via keyboard Enter: state="${await card(2).locator(".state").textContent()}" engine=${JSON.stringify(await page.evaluate(engineState))}`);
  await page.keyboard.press("Enter");
  log(`brown toggled OFF via keyboard Enter: state="${await card(2).locator(".state").textContent()}" engine=${JSON.stringify(await page.evaluate(engineState))}`);

  /* 4. master volume: arrow keys (real user path on a range input), 70 -> 65 */
  await page.locator("#masterVol").focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300); // let setTargetAtTime settle on the real audio clock
  log(`master volume 70->: input value=${await page.locator("#masterVol").inputValue()} engine=${JSON.stringify(await page.evaluate(engineState))}`);

  /* 5. per-sound volume: pink slider 60 -> 55 */
  const pinkSlider = card(1).locator(".vol input");
  await pinkSlider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  log(`pink slider value=${await pinkSlider.inputValue()} vols.pink=${await page.evaluate(() => vols.pink)} pink node gain target=${await page.evaluate(() => nodes.pink ? +nodes.pink.gain.gain.value.toFixed(3) : null)}`);

  /* 6. sleep timer: set 15 min, fast-forward, verify countdown then auto-stop */
  await page.getByRole("button", { name: "15 min" }).click();
  log(`timer set 15 min: status="${await status.textContent()}" btn.on=${await page.getByRole("button", { name: "15 min" }).getAttribute("class")}`);
  await page.clock.fastForward("10:00");
  log(`after +10:00: status="${await status.textContent()}"`);
  await page.clock.fastForward("05:30");
  await page.waitForTimeout(200);
  log(`after +05:30 (timer expired): status="${await status.textContent()}"`);
  log(`after expiry: masterBtn="${await masterBtn.textContent()}" engine=${JSON.stringify(await page.evaluate(engineState))} Off-btn class="${await page.getByRole("button", { name: "Off" }).getAttribute("class")}"`);

  /* 7. persistence: the one v1 key, suite.sound */
  log(`localStorage["suite.sound"] = ${await page.evaluate(() => localStorage.getItem("suite.sound"))}`);
}

/* Same state-writing actions on v1, so the localStorage key sets compare equal. */
export async function v1Interact({ page }) {
  await page.clock.install();
  const card = (n) => page.locator(".snd").nth(n);
  await card(0).click();               // white on (auto-play, writes suite.sound)
  await card(1).click();               // pink on
  await card(0).click();               // white off
  await page.locator("#masterVol").focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  const pinkSlider = card(1).locator(".vol input");
  await pinkSlider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "15 min" }).click();
}
