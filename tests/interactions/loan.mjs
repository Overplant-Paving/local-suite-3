/* tests/interactions/loan.mjs — Mortgage & Loan Workbench (zero-network, Batch A)
   Exercises: known-loan amortization (expected vs actual math), schedule table,
   extra-payment what-if, refinance compare, CSV export. */
import { join } from "node:path";
import { readFileSync } from "node:fs";

export const selectors = [
  "body", "header h1", ".theme-btn", ".back",
  ".tabs .tab", ".card", ".stats .stat b",
  "table.sched", ".btn.ghost", ".legend", "footer", ".field .in"
];

export const screenshotAfterInteract = true;

/* The same state-writing actions on both versions so localStorage parity
   (suite.loan.v1 key set) compares equal. */
async function driveLoan(page) {
  await page.fill("#start", "2026-01");
  await page.fill("#principal", "300000");
  await page.fill("#apr", "6.5");
  await page.fill("#term", "30");
  await page.waitForTimeout(150);
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- known loan: $300,000 at 6.5% for 30 years ---- */
  await driveLoan(page);

  const stats = await page.$$eval("#stats .stat", els =>
    els.map(e => ({ v: e.querySelector("b").textContent, k: e.querySelector("span").textContent })));
  log("stats after $300,000 @ 6.5% / 30 yr, start 2026-01:");
  stats.forEach(s => log(`  ${s.k} = ${s.v}`));
  const pni = stats.find(s => /Monthly P&I/i.test(s.k));
  log(`monthly P&I expected ~$1,896.20 | actual ${pni ? pni.v : "(missing)"}`);

  /* ---- amortization table: row count, first and last rows ---- */
  const rowCount = await page.$$eval("#sched tbody tr", r => r.length);
  const firstRow = await page.$$eval("#sched tbody tr:first-child td", t => t.map(x => x.textContent));
  const lastRow = await page.$$eval("#sched tbody tr:last-child td", t => t.map(x => x.textContent));
  log(`schedule rows: expected 360 | actual ${rowCount}`);
  log(`first row (expect interest $1,625.00, principal $271.20, bal $299,728.80): ${firstRow.join(" | ")}`);
  log(`last row (expect month 360, Dec 2055, balance $0.00): ${lastRow.join(" | ")}`);

  /* ---- CSV export (download captured as evidence) ---- */
  const dlPromise = page.waitForEvent("download");
  await page.click("#csvBtn");
  const dl = await dlPromise;
  const csvPath = join(evidenceDir, "amortization.csv");
  await dl.saveAs(csvPath);
  const csvLines = readFileSync(csvPath, "utf8").trim().split("\n");
  log(`CSV export: ${dl.suggestedFilename()}, ${csvLines.length} lines (header + ${csvLines.length - 1} rows)`);
  log(`CSV header: ${csvLines[0]}`);
  log(`CSV row 1: ${csvLines[1]}`);
  log(`CSV last row: ${csvLines[csvLines.length - 1]}`);

  /* ---- extra payments: $200/mo on the same loan ---- */
  await page.click('.tab[data-view="extra"]');
  await page.fill("#exMonthly", "200");
  await page.waitForTimeout(120);
  log("extra-payment what-if ($200/mo extra):");
  log(`  savings line: ${(await page.textContent("#exSavings")).trim()}`);
  const exKv = await page.$$eval("#exCompare .kv", els =>
    els.map(e => e.querySelector("span").textContent + " = " + e.querySelector("b").textContent));
  log(`  compare: ${exKv.join(" ; ")}`);

  /* ---- refinance compare: 330k @6.5 28yr left vs 330k @5.25 30yr, $6,000 costs ---- */
  await page.click('.tab[data-view="refi"]');
  await page.fill("#rCurBal", "330000");
  await page.fill("#rCurApr", "6.5");
  await page.fill("#rCurTerm", "28");
  await page.fill("#rNewBal", "330000");
  await page.fill("#rNewApr", "5.25");
  await page.fill("#rNewTerm", "30");
  await page.fill("#rCosts", "6000");
  await page.waitForTimeout(120);
  const refiKv = await page.$$eval("#refiOut .kv", els =>
    els.map(e => e.querySelector("span").textContent + " = " + e.querySelector("b").textContent));
  log("refinance compare (330k @6.5%/28yr -> 330k @5.25%/30yr, $6,000 costs):");
  log(`  ${refiKv.join(" ; ")}`);
  log(`  verdict: ${(await page.textContent("#refiVerdict")).trim()}`);

  /* back to the loan tab so the after-interaction screenshot shows chart + table */
  await page.click('.tab[data-view="loan"]');
  await page.waitForTimeout(200);
}

/* same state-writing actions on v1 so both versions persist suite.loan.v1 with
   the same fields (extra + refi inputs are saved too — save() runs on loan input) */
export async function v1Interact({ page }) {
  await driveLoan(page);
  await page.click('.tab[data-view="extra"]');
  await page.fill("#exMonthly", "200");
  await page.click('.tab[data-view="refi"]');
  await page.fill("#rCurBal", "330000");
  await page.fill("#rCurApr", "6.5");
  await page.fill("#rCurTerm", "28");
  await page.fill("#rNewBal", "330000");
  await page.fill("#rNewApr", "5.25");
  await page.fill("#rNewTerm", "30");
  await page.fill("#rCosts", "6000");
  await page.click('.tab[data-view="loan"]');
  /* refi/extra edits persist only when a loan input re-renders — mirror that */
  await page.fill("#principal", "300000");
  await page.waitForTimeout(150);
}
