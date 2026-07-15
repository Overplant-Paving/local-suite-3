/* flashcards.mjs — interaction module for verify-tool.mjs.
   Exercises: deck creation, card entry, CSV import, JSON export (download captured),
   JSON re-import, a full study session (flip + grade, mouse and keyboard),
   and schedule persistence across reload. */
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const selectors = [
  "body", "header h1", "header .tag", ".back", ".theme-btn",
  ".toolbar", "#newDeck", ".btn", ".btn.ghost", ".empty",
  ".flashcard", "footer",
];

export const screenshotAfterInteract = true;

const LS_KEY = "suite.flashcards.v1";

async function decksFromLS(page) {
  return page.evaluate(k => {
    try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; }
  }, LS_KEY);
}

export async function interact({ page, log, evidenceDir }) {
  const dialogs = [];
  page.on("dialog", async d => { dialogs.push(`${d.type()}: ${d.message()}`); await d.accept(); });

  /* ---- create a deck ---- */
  log(`initial deck tiles: ${await page.locator(".deck").count()}`);
  await page.fill("#newDeck", "Spanish Verbs");
  await page.click("#addDeck");
  log(`after create: deck tiles = ${await page.locator(".deck").count()}, first tile = "${(await page.locator(".deck h3").first().textContent())}"`);

  /* ---- add cards by hand ---- */
  await page.click(".deck");
  await page.fill("#cardFront", "hablar");
  await page.fill("#cardBack", "to speak");
  await page.click("#addCard");
  await page.fill("#cardFront", "comer");
  await page.fill("#cardBack", "to eat");
  await page.click("#addCard");
  log(`after 2 manual cards, stats: ${(await page.locator("#deckStats").innerText()).replace(/\s+/g, " ").trim()}`);

  /* ---- CSV import (fixture includes a quoted comma + header row to skip) ---- */
  const csvPath = join(evidenceDir, "csv-fixture.csv");
  writeFileSync(csvPath, 'front,back\nvivir,to live\n"ser, estar","to be, to be (state)"\n');
  await page.setInputFiles("#fileCsv", csvPath);
  await page.waitForTimeout(300);
  log(`csv import dialog: ${dialogs[dialogs.length - 1] || "(none)"}`);
  log(`card rows after CSV import: ${await page.locator(".cardrow").count()}`);
  log(`quoted-comma row rendered as: "${(await page.locator(".cardrow").nth(3).locator(".side").first().textContent())}" / "${(await page.locator(".cardrow").nth(3).locator(".side").nth(1).textContent())}"`);
  log(`stats after CSV: ${(await page.locator("#deckStats").innerText()).replace(/\s+/g, " ").trim()}`);

  /* ---- JSON export: capture the download ---- */
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportDeck"),
  ]);
  const exportedPath = join(evidenceDir, "exported-deck.json");
  await download.saveAs(exportedPath);
  const exported = JSON.parse(readFileSync(exportedPath, "utf8"));
  log(`export: suggested filename "${download.suggestedFilename()}", payload name="${exported.name}", cards=${exported.cards.length}`);

  /* ---- study session: flip + grade all 4 (mouse for #1, keyboard for the rest) ---- */
  log(`study button: "${await page.locator("#studyBtn").textContent()}"`);
  await page.click("#studyBtn");
  log(`session counter: "${await page.locator("#studyBody .muted").first().textContent()}"`);
  log(`front shown: "${await page.locator(".face.front .content").textContent()}"`);
  await page.click("#flashcard");                       // mouse flip
  await page.waitForTimeout(200);
  log(`after flip, back shown: "${await page.locator(".face.back .content").textContent()}", hint: "${await page.locator("#hint").textContent()}"`);
  log(`grade previews: ${(await page.locator(".grades").innerText()).replace(/\s+/g, " ").trim()}`);
  await page.click(".grade.good");                      // mouse grade
  for (let i = 0; i < 3; i++) {                         // keyboard path for the rest
    await page.keyboard.press("Space");                 // flip
    await page.waitForTimeout(150);
    await page.keyboard.press("3");                     // grade Good
    await page.waitForTimeout(150);
  }
  log(`done screen: "${(await page.locator(".done").innerText()).replace(/\s+/g, " ").trim()}"`);

  /* ---- scheduler state written to localStorage ---- */
  let decks = await decksFromLS(page);
  const c0 = decks[0].cards[0];
  log(`localStorage ${LS_KEY}: decks=${decks.length}, cards=${decks[0].cards.length}`);
  log(`card[0] after Good: ease=${c0.ease}, interval=${c0.interval}, reps=${c0.reps}, due>now=${c0.due > Date.now()}`);

  /* ---- persistence across reload ---- */
  await page.reload();
  await page.waitForTimeout(400);
  log(`after reload: deck tiles=${await page.locator(".deck").count()}, tile meta="${(await page.locator(".deck .meta").first().innerText()).replace(/\s+/g, " ").trim()}"`);
  await page.click(".deck");
  log(`after reload, stats: ${(await page.locator("#deckStats").innerText()).replace(/\s+/g, " ").trim()}, study button: "${await page.locator("#studyBtn").textContent()}"`);
  decks = await decksFromLS(page);
  log(`after reload, card[0] schedule persisted: ease=${decks[0].cards[0].ease}, interval=${decks[0].cards[0].interval}, reps=${decks[0].cards[0].reps}`);

  /* ---- JSON re-import of the exported deck ---- */
  await page.click("#crumbBack");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.click("#importJson"),
  ]);
  await chooser.setFiles(exportedPath);
  await page.waitForTimeout(300);
  log(`json import dialog: ${dialogs[dialogs.length - 1] || "(none)"}`);
  log(`deck tiles after JSON re-import: ${await page.locator(".deck").count()}`);
  decks = await decksFromLS(page);
  const imp = decks[decks.length - 1];
  log(`imported deck: name="${imp.name}", cards=${imp.cards.length}, card[0] kept schedule: ease=${imp.cards[0].ease}, interval=${imp.cards[0].interval}, reps=${imp.cards[0].reps}`);
}

/* Mirror the state-writing actions on v1 so the localStorage key sets compare equal. */
export async function v1Interact({ page }) {
  page.on("dialog", d => d.accept());
  await page.fill("#newDeck", "Spanish Verbs");
  await page.click("#addDeck");
  await page.click(".deck");
  await page.fill("#cardFront", "hablar");
  await page.fill("#cardBack", "to speak");
  await page.click("#addCard");
  await page.click("#studyBtn");
  await page.click("#flashcard");
  await page.waitForTimeout(200);
  await page.click(".grade.good");
}
