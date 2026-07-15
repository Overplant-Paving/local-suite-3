/* dataviewer.mjs — interaction module for verify-tool.mjs.
   Feeds a JSON and a CSV fixture through the real file input, then exercises
   table (sort/filter, incl. keyboard), tree (collapse/expand, incl. keyboard),
   samples, close, and the untrusted-content escaping path. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const selectors = [
  "body", "header h1", ".back", ".theme-btn",
  ".drop", "#pick", ".sample", ".filebar",
  "#search", ".tbl-scroll", ".tree", "footer"
];

export const screenshotAfterInteract = true;

const FIXTURE_JSON = [
  { id: 3, name: "charlie", score: 99, tags: ["x", "y"], active: true },
  { id: 1, name: "alpha <script>alert(1)</script>", score: 42.5, tags: [], active: false },
  { id: 2, name: "bravo & \"quotes\"", score: 7, tags: null, active: true }
];
const FIXTURE_CSV =
  "city,state,population\n" +
  "Springfield,IL,114394\n" +
  "\"Fair Oaks, Ranch\",TX,10288\n" +
  "Lakewood,CO,155984\n";

export async function interact({ page, log, evidenceDir }) {
  const jsonPath = join(evidenceDir, "fixture.json");
  const csvPath = join(evidenceDir, "fixture.csv");
  writeFileSync(jsonPath, JSON.stringify(FIXTURE_JSON, null, 2));
  writeFileSync(csvPath, FIXTURE_CSV);

  /* ---- 1. JSON fixture via the real file input -> table view (default) ---- */
  await page.setInputFiles("#file", jsonPath);
  await page.waitForTimeout(250);
  log("json: fname=" + await page.textContent("#fname"));
  log("json: fmeta=" + await page.textContent("#fmeta"));
  log("json: modes=" + (await page.$$eval("#modes button", bs =>
    bs.map(b => b.textContent + (b.classList.contains("on") ? "[on]" : "")).join(" | "))));
  log("json: table rows rendered=" + await page.locator("#tbody tr").count());
  log("json: row1 cells=" + JSON.stringify(
    await page.$$eval("#tbody tr:first-child td", tds => tds.map(t => t.textContent))));

  /* escaping probe: file content is untrusted; the <script> in a cell must be inert text */
  log("escape(table): <script> elements inside #table=" + await page.locator("#table script").count());
  log("escape(table): name cell row2 textContent=" + await page.textContent("#tbody tr:nth-child(2) td:nth-child(3)"));

  /* ---- 2. filter ---- */
  await page.fill("#search", "bravo");
  await page.waitForTimeout(100);
  log("filter 'bravo': rows=" + await page.locator("#tbody tr").count() +
    ", rowInfo=" + await page.textContent("#rowInfo"));
  await page.fill("#search", "");
  await page.waitForTimeout(100);
  log("filter cleared: rows=" + await page.locator("#tbody tr").count());

  /* ---- 3. sort by score: mouse click asc, then keyboard Enter -> desc ---- */
  await page.click("#thead th:nth-child(4)"); // '#'=1, id=2, name=3, score=4
  log("sort score asc: first-row score=" + await page.textContent("#tbody tr:first-child td:nth-child(4)") +
    ", aria-sort=" + await page.getAttribute("#thead th:nth-child(4)", "aria-sort"));
  await page.focus("#thead th:nth-child(4)");
  await page.keyboard.press("Enter");
  log("sort score desc (keyboard Enter): first-row score=" + await page.textContent("#tbody tr:first-child td:nth-child(4)") +
    ", aria-sort=" + await page.getAttribute("#thead th:nth-child(4)", "aria-sort") +
    ", focus-restored=" + await page.evaluate(() =>
      document.activeElement === document.querySelectorAll("#thead th")[3]));

  /* ---- 4. tree view: twisty collapse/expand (mouse + keyboard), bulk buttons ---- */
  await page.click('#modes button[data-mode="tree"]');
  log("tree: twisties=" + await page.locator("#tree .tw").count() +
    ", <script> elements inside #tree=" + await page.locator("#tree script").count());
  log("tree: first string value=" + await page.locator("#tree .s").first().textContent());
  const childTw = page.locator("#tree .node .tw").first();
  await childTw.click();
  log("twisty click: collapsed=" + await page.locator("#tree .collapsed").count() +
    ", preview=" + (await page.textContent("#tree .collapsed .preview-inline")).trim() +
    ", aria-expanded=" + await childTw.getAttribute("aria-expanded"));
  await childTw.focus();
  await page.keyboard.press("Enter");
  log("twisty keyboard Enter: collapsed=" + await page.locator("#tree .collapsed").count() +
    ", aria-expanded=" + await childTw.getAttribute("aria-expanded"));
  await page.click("#collapseAll");
  log("collapseAll: collapsed=" + await page.locator("#tree .collapsed").count());
  await page.click("#expandAll");
  log("expandAll: collapsed=" + await page.locator("#tree .collapsed").count());

  /* ---- 5. close, sample JSON (object root -> tree-only) ---- */
  await page.click("#closeFile");
  log("close: drop visible=" + await page.locator("#drop").isVisible() +
    ", filebar visible=" + await page.locator("#filebar").isVisible());
  await page.click('.sample[data-s="json"]');
  await page.waitForTimeout(150);
  log("sample json: fmeta=" + await page.textContent("#fmeta") +
    ", modes=" + (await page.$$eval("#modes button", bs => bs.map(b => b.textContent).join(" | "))) +
    ", tree visible=" + await page.locator("#treeView").isVisible());
  await page.click("#closeFile");

  /* ---- 6. CSV fixture: delimiter sniff + quoted field with embedded comma ---- */
  await page.setInputFiles("#file", csvPath);
  await page.waitForTimeout(250);
  log("csv: fmeta=" + await page.textContent("#fmeta"));
  log("csv: rows=" + await page.locator("#tbody tr").count() +
    ", quoted cell=" + await page.textContent("#tbody tr:nth-child(2) td:nth-child(2)") +
    ", numeric cell class=" + await page.getAttribute("#tbody tr:nth-child(2) td:nth-child(4)", "class"));
  /* leave the CSV table on screen for the post-interaction screenshot */
}
