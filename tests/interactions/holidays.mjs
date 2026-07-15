/* holidays.html — interaction module for verify-tool.mjs.
   Pure date-math tool (zero network). A fixed clock (2026-07-15) makes the
   countdowns, past/next row classes and DST deltas deterministic. */

export const selectors = [
  "body",
  "header h1",
  ".theme-btn",
  ".back",
  ".yearbar .yr",
  "#prevYear",
  ".hero",
  ".hero .big",
  "#fedTable",
  ".tag-obs",
  ".badge.closed",
  ".minicard",
  "footer",
];

export const screenshotAfterInteract = true;

const FIXED = new Date(2026, 6, 15, 12, 0, 0); // Wed Jul 15 2026, local

async function snapshotYear(page, log, tag) {
  const year = await page.locator("#yearLabel").textContent();
  log(`[${tag}] year label: ${year}`);

  // federal table: every row as "name | date | observed"
  const fedRows = await page.$$eval("#fedTable tbody tr", trs =>
    trs.map(tr => {
      const tds = [...tr.querySelectorAll("td")].map(td => td.innerText.replace(/\s+/g, " ").trim());
      return `${tds.join(" | ")}${tr.className ? `  [class: ${tr.className.trim()}]` : ""}`;
    }));
  log(`[${tag}] federal holidays (${fedRows.length} rows):`);
  fedRows.forEach(r => log(`  ${r}`));

  // market table: closures + early closes
  const mktRows = await page.$$eval("#mktTable tbody tr", trs =>
    trs.map(tr => [...tr.querySelectorAll("td")].map(td => td.innerText.replace(/\s+/g, " ").trim()).join(" | ")));
  log(`[${tag}] market calendar (${mktRows.length} rows):`);
  mktRows.forEach(r => log(`  ${r}`));

  // DST cards
  const dst = await page.$$eval("#dstCards .minicard", cards =>
    cards.map(c => c.innerText.replace(/\s+/g, " ").trim()));
  log(`[${tag}] DST cards:`);
  dst.forEach(c => log(`  ${c}`));
}

export async function interact({ page, log }) {
  await page.clock.install({ time: FIXED });
  await page.reload();
  await page.waitForTimeout(300);
  log(`clock fixed at ${FIXED.toString()}`);

  // hero: next-holiday + long-weekend countdowns
  const hero = await page.$$eval("#hero .hcol", cols =>
    cols.map(c => c.innerText.replace(/\s+/g, " ").trim()));
  log(`hero countdown columns (${hero.length}):`);
  hero.forEach(h => log(`  ${h}`));

  await snapshotYear(page, log, "2026");

  // year navigation: forward, back to current via "this year", then previous year
  await page.click("#nextYear");
  await snapshotYear(page, log, "next(2027)");
  await page.click("#thisYear");
  log(`after "this year": year label = ${await page.locator("#yearLabel").textContent()}`);
  await page.click("#prevYear");
  const dst2025 = await page.$$eval("#dstCards .minicard .v", vs => vs.map(v => v.textContent.trim()));
  log(`prev(2025) DST dates: spring=${dst2025[0]}, fall=${dst2025[1]}`);
  await page.click("#thisYear"); // leave the tool on the current year for the screenshot
  log(`final year label: ${await page.locator("#yearLabel").textContent()}`);

  // a11y probes
  const live = await page.getAttribute("#yearLabel", "aria-live");
  log(`#yearLabel aria-live: ${live}`);
  const prevLabel = await page.getAttribute("#prevYear", "aria-label");
  const nextLabel = await page.getAttribute("#nextYear", "aria-label");
  log(`year buttons aria-labels: prev="${prevLabel}", next="${nextLabel}"`);
}
