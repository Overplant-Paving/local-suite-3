/* tests/interactions/random.mjs — Decision Maker (dice / coin / spinner / pick / number)
   Exercises every panel end-to-end and logs concrete observed values.
   The spinner is rAF-animated (4200 ms), so the fake clock is installed first
   and advanced with page.clock.runFor(). */

export const selectors = [
  "body", "header h1", ".back", ".theme-btn", ".tag",
  ".tab", "#p-dice", "button.go", "button.mini",
  "#diceTotal", "#coin", "footer",
];

export const screenshotAfterInteract = true;

async function clickTab(page, text) {
  await page.locator(".tab", { hasText: text }).click();
}

export async function interact({ page, log }) {
  await page.clock.install(); // FIRST: spinner animation runs on rAF + performance.now

  /* ---- DICE: several rolls, verify range and total ---- */
  await page.fill("#diceCount", "5");
  await page.selectOption("#diceSides", "6");
  for (let roll = 1; roll <= 3; roll++) {
    await page.click("#rollDice");
    const faces = await page.$$eval("#diceFaces .die", els => els.map(e => Number(e.textContent)));
    const total = Number(await page.textContent("#diceTotal"));
    const sum = faces.reduce((a, b) => a + b, 0);
    const inRange = faces.every(f => Number.isInteger(f) && f >= 1 && f <= 6);
    log(`dice roll ${roll}: 5d6 -> [${faces.join(", ")}] total shown=${total} sum=${sum} ` +
        `allIn1..6=${inRange} totalMatches=${total === sum}`);
  }
  await page.fill("#diceCount", "1");
  await page.selectOption("#diceSides", "20");
  await page.click("#rollDice");
  const d20 = Number(await page.textContent("#diceTotal"));
  log(`dice roll 4: 1d20 -> ${d20} in1..20=${d20 >= 1 && d20 <= 20}`);
  log(`dice sub line: "${await page.textContent("#diceSub")}"`);

  /* ---- COIN: five flips, tally + streak dots, then reset ---- */
  await clickTab(page, "Coin");
  const flips = [];
  for (let i = 0; i < 5; i++) {
    await page.click("#flipCoin");
    flips.push(await page.textContent("#coin"));
  }
  const tally = await page.textContent("#coinTally");
  const dots = await page.$$eval("#coinStreak span", els => els.map(e => e.textContent).join(""));
  const m = tally.match(/Heads (\d+) · Tails (\d+)/);
  log(`coin flips: [${flips.join(", ")}] tally="${tally}" streak="${dots}" ` +
      `facesValid=${flips.every(f => f === "H" || f === "T")} ` +
      `tallySumsTo5=${m ? Number(m[1]) + Number(m[2]) === 5 : false} streakLen5=${dots.length === 5}`);
  await page.click("#resetCoin");
  log(`coin after reset: face="${await page.textContent("#coin")}" tally="${await page.textContent("#coinTally")}" ` +
      `streakDots=${await page.locator("#coinStreak span").count()}`);

  /* ---- SPINNER: custom labels, animated spin under the fake clock ---- */
  await clickTab(page, "Spinner");
  const wheelLabels = ["Red", "Green", "Blue", "Yellow"];
  await page.fill("#spinLabels", wheelLabels.join("\n"));
  await page.click("#drawWheel");
  await page.click("#spinBtn");
  await page.clock.runFor(4500); // animation lasts 4200 ms
  const spinText = (await page.textContent("#spinResult")).trim();
  const spinWinner = spinText.replace(/^🎉\s*/, "");
  log(`spinner: labels=[${wheelLabels.join(", ")}] result="${spinText}" ` +
      `winnerInList=${wheelLabels.includes(spinWinner)}`);

  /* ---- PICK: custom list, no-repeat clamp, with-repeat sampling ---- */
  await clickTab(page, "Pick from list");
  const pickOpts = ["Mercury", "Venus", "Earth", "Mars", "Jupiter"];
  await page.fill("#pickList", pickOpts.join("\n"));
  await page.fill("#pickN", "3");
  await page.click("#pickBtn");
  let picked = await page.$$eval("#pickResult li", els => els.map(e => e.textContent));
  log(`pick 3 (no repeats): [${picked.join(", ")}] count=${picked.length} ` +
      `allFromList=${picked.every(p => pickOpts.includes(p))} unique=${new Set(picked).size === picked.length}`);
  // asking for more than the list has, with no-repeat on, clamps to the list size
  await page.fill("#pickN", "9");
  await page.click("#pickBtn");
  picked = await page.$$eval("#pickResult li", els => els.map(e => e.textContent));
  log(`pick 9-clamped: input now=${await page.inputValue("#pickN")} got=${picked.length} ` +
      `unique=${new Set(picked).size === picked.length}`);
  // repeats allowed: can draw more than the list size
  await page.uncheck("#noRepeat");
  await page.fill("#pickN", "8");
  await page.click("#pickBtn");
  picked = await page.$$eval("#pickResult li", els => els.map(e => e.textContent));
  log(`pick 8 (repeats allowed): [${picked.join(", ")}] count=${picked.length} ` +
      `allFromList=${picked.every(p => pickOpts.includes(p))}`);
  await page.check("#noRepeat");

  /* ---- NUMBER: range picks, swapped bounds, Enter-to-submit ---- */
  await clickTab(page, "Number");
  await page.fill("#numMin", "10");
  await page.fill("#numMax", "20");
  const nums = [];
  for (let i = 0; i < 5; i++) {
    await page.click("#numBtn");
    nums.push(Number(await page.textContent("#numResult")));
  }
  log(`number 10..20 x5: [${nums.join(", ")}] allInRange=${nums.every(n => n >= 10 && n <= 20)}`);
  await page.fill("#numMin", "30");
  await page.fill("#numMax", "25");
  await page.click("#numBtn");
  const swapped = Number(await page.textContent("#numResult"));
  log(`number swapped bounds 30/25 -> ${swapped} in25..30=${swapped >= 25 && swapped <= 30}`);
  await page.focus("#numMin");
  await page.keyboard.press("Enter");
  const viaEnter = Number(await page.textContent("#numResult"));
  log(`Enter in #numMin triggers pick: result=${viaEnter} in25..30=${viaEnter >= 25 && viaEnter <= 30}`);

  /* ---- LOG: entries accumulated, clear works ---- */
  const logCount = await page.locator("#logList li").count();
  const newest = await page.textContent("#logList li:first-child");
  log(`results log: ${logCount} entries, newest="${newest.trim()}"`);
  await page.click("#clearLog");
  log(`log after clear: "${(await page.textContent("#logList")).trim()}" ` +
      `(${await page.locator("#logList li").count()} placeholder row)`);

  /* leave a populated dice panel for the after-interaction screenshot */
  await clickTab(page, "Dice");
  await page.fill("#diceCount", "3");
  await page.selectOption("#diceSides", "6");
  await page.click("#rollDice");
  log(`final state for screenshot: dice panel, 3d6 total=${await page.textContent("#diceTotal")}`);

  /* persistence: v1 writes no tool-specific localStorage (lists/log are session-only);
     v2 must match — checked by the harness localStorage parity snapshot */
  const keys = await page.evaluate(() => Object.keys(localStorage));
  log(`localStorage keys after full interaction: [${keys.join(", ")}] (expect only suite.theme)`);
}
