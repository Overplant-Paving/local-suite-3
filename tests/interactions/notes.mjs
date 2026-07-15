/* notes.mjs — interaction module for verify-tool.mjs (Notepad That Stays).
   Exercises: create note → type markdown → autosave → reload survival →
   export .md → export all → import JSON → delete note → preview toggle. */
import { writeFileSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const selectors = [
  "body", "header", "header h1", ".back", ".theme-btn", "#togglePreview",
  ".saved", ".sidebar", "#newNote", "#editor", ".preview", "footer",
];

export const screenshotAfterInteract = true;

const NOTE_TITLE = "Migration test note";
const NOTE_BODY = [
  "# Heading one",
  "",
  "Some **bold**, *italic* and `inline code` plus plain digits 123 456.",
  "",
  "- list item A",
  "- list item B",
  "",
  "> a quote",
  "",
  "[a link](https://example.com)",
  "",
  "```",
  "fenced 789",
  "```",
].join("\n");

async function createTestNote(page) {
  await page.click("#newNote");
  await page.fill("#noteTitle", NOTE_TITLE);
  await page.fill("#editor", NOTE_BODY);
  await page.waitForTimeout(900); // > 600 ms debounce → autosave fires
}

export async function interact({ page, log, evidenceDir }) {
  const dialogs = [];
  page.on("dialog", d => { dialogs.push(`${d.type()}: ${d.message()}`); d.accept(); });

  // initial state
  log(`initial note list: ${JSON.stringify(await page.locator(".note-list li .nm").allTextContents())}`);
  log(`initial saved indicator: "${await page.textContent("#saved")}"`);

  // 1. create a note, type markdown, autosave
  await createTestNote(page);
  log(`saved indicator after 900ms: "${await page.textContent("#saved")}"`);
  log(`word count: "${await page.textContent("#wordCount")}"`);
  const previewHtml = await page.innerHTML("#preview");
  log(`preview html (${previewHtml.length} chars): ${previewHtml.slice(0, 300)}...`);
  const lsLen = await page.evaluate(() => (localStorage.getItem("suite.notes") || "").length);
  log(`localStorage suite.notes length after autosave: ${lsLen}`);

  // 2. reload — autosaved content must survive
  await page.reload();
  await page.waitForTimeout(400);
  const titlesAfterReload = await page.locator(".note-list li .nm").allTextContents();
  log(`note list after reload: ${JSON.stringify(titlesAfterReload)}`);
  // select the test note (sorted most-recent-first, so it is the first list item)
  await page.locator(".note-list li", { hasText: NOTE_TITLE }).first().click();
  const editorValue = await page.inputValue("#editor");
  log(`editor content after reload matches typed body: ${editorValue === NOTE_BODY} (${editorValue.length} chars)`);
  log(`title input after reload: "${await page.inputValue("#noteTitle")}"`);

  // 3. export .md (current note)
  {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportMd")]);
    const p = join(evidenceDir, "exported-note.md");
    await dl.saveAs(p);
    const body = readFileSync(p, "utf8");
    log(`export .md: suggested="${dl.suggestedFilename()}", ${statSync(p).size} bytes, content matches editor: ${body === NOTE_BODY}`);
  }

  // 4. export all (JSON backup)
  {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#exportAll")]);
    const p = join(evidenceDir, "exported-all.json");
    await dl.saveAs(p);
    const arr = JSON.parse(readFileSync(p, "utf8"));
    log(`export all: suggested="${dl.suggestedFilename()}", ${arr.length} notes, titles=${JSON.stringify(arr.map(n => n.title))}`);
  }

  // 5. import a fixture JSON
  const fixture = join(evidenceDir, "import-fixture.json");
  writeFileSync(fixture, JSON.stringify([
    { title: "Imported fixture note", body: "Imported body with **bold**.", updated: 1730000000000 },
  ], null, 2));
  await page.setInputFiles("#importFile", fixture);
  await page.waitForTimeout(300);
  log(`note list after import: ${JSON.stringify(await page.locator(".note-list li .nm").allTextContents())}`);

  // 6. delete the imported note (confirm dialog auto-accepted)
  const fixtureLi = page.locator(".note-list li", { hasText: "Imported fixture note" });
  await fixtureLi.hover();
  await fixtureLi.locator(".del").click();
  await page.waitForTimeout(200);
  log(`note list after delete: ${JSON.stringify(await page.locator(".note-list li .nm").allTextContents())}`);

  // 7. keyboard path: Tab to a list item and select with Enter
  await page.locator(".note-list li").last().focus();
  await page.keyboard.press("Enter");
  log(`keyboard-selected note title: "${await page.inputValue("#noteTitle")}"`);

  // 8. preview toggle off/on
  await page.click("#togglePreview");
  log(`preview display after toggle off: "${await page.evaluate(() => getComputedStyle(document.getElementById("preview")).display)}", aria-pressed=${await page.getAttribute("#togglePreview", "aria-pressed")}`);
  await page.click("#togglePreview");
  log(`preview display after toggle on: "${await page.evaluate(() => getComputedStyle(document.getElementById("preview")).display)}", aria-pressed=${await page.getAttribute("#togglePreview", "aria-pressed")}`);

  // 9. Ctrl+S flush path
  await page.locator("#editor").focus();
  await page.keyboard.press("Control+s");
  log(`saved indicator after Ctrl+S: "${await page.textContent("#saved")}"`);

  log(`dialogs seen: ${JSON.stringify(dialogs)}`);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal. */
export async function v1Interact({ page }) {
  page.on("dialog", d => d.accept());
  await createTestNote(page);
}
