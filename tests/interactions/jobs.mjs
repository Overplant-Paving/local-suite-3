/* tests/interactions/jobs.mjs — Jobs & Unemployment Snapshot (Batch C, network "blocked",
   embedded BLS data per ADR D5 / API-AND-RELAY.md §4).

   What gets exercised:
   1. Embedded render on load: data stamp (reference month), all three stat cards +
      sparklines, the 4-year unemployment SVG chart.
   2. Zero-network proof: abort every http(s) request, reload — the tool must render
      identically from the embedded object (this tool makes no network requests at all
      by default; there is no cache and no stale path to verify).
   3. Theme-toggle chart redraw (v1 feature: chart colors are re-read from CSS vars).
   4. Paste-merge path: merge two user rows into the unemp series -> headline stat and
      chart note move to the merged month; suite.data.jobs written (v1 key, v1 shape).
   5. Clear path: overrides removed, display returns to embedded-only.
   6. Relay path (Suite.relay contract): set a fake relay base, page.route-fulfill the
      rewritten <base>?url=<encoded> URLs with BLS-shaped JSON, assert the contract URL,
      the merged render, and the suite.relay.url write. No real BLS traffic. */
import { join } from "node:path";

export const selectors = [
  "body", ".back", ".theme-btn", "header h1", "header .tag",
  ".stats .stat.s1", ".stat b", ".card", ".linkchip", "details summary", ".btn", "footer"
];

export const screenshotAfterInteract = true;

const text = (page, sel) => page.textContent(sel).then(s => s.replace(/\s+/g, " ").trim());

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. embedded render on load ---- */
  await page.waitForSelector(".stats .stat.s1 b");
  log(`data stamp: "${await text(page, "#dataStamp")}"`);
  const stats = await page.$$eval(".stats .stat", els => els.map(e => ({
    lbl: e.querySelector(".lbl").textContent.trim(),
    v: e.querySelector("b").textContent.trim(),
    sub: e.querySelector(".sub").textContent.trim(),
    spark: !!e.querySelector(".spk svg path")
  })));
  for (const s of stats) log(`stat: ${s.lbl} = ${s.v} (${s.sub}) sparkline=${s.spark}`);
  log(`chart note: "${await text(page, "#chartNote")}"`);
  const chart = await page.evaluate(() => ({
    paths: document.querySelectorAll("#chart path").length,
    gridlines: document.querySelectorAll("#chart line").length,
    labels: document.querySelectorAll("#chart text").length
  }));
  log(`unemployment chart: ${chart.paths} paths, ${chart.gridlines} gridlines, ${chart.labels} text labels`);

  /* ---- 2. zero-network proof ---- */
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector(".stats .stat.s1 b");
  log(`offline reload (all http/https aborted): headline = ${await text(page, ".stat.s1 b")} ` +
    `(${await text(page, ".stat.s1 .sub")}) — embedded data renders with zero network`);
  await page.screenshot({ path: join(evidenceDir, "offline-embedded.png"), fullPage: true });
  await page.context().unroute(/^https?:/);

  /* ---- 3. theme-toggle chart redraw ---- */
  const stroke = () => page.evaluate(() =>
    document.querySelector("#chart path[stroke]:not([stroke-width='1'])").getAttribute("stroke"));
  const before = await stroke();
  await page.click("#themeBtn");
  const after = await stroke();
  log(`chart line stroke re-read on theme toggle: light="${before}" dark="${after}" (redrawn: ${before !== after})`);
  await page.click("#themeBtn"); // back to light for the rest of the run

  /* ---- 4. paste-merge (error path first, then the real merge) ---- */
  await page.click("#updatePanel summary");
  await page.fill("#paste", "no parsable rows here");
  await page.click("#mergeBtn");
  log(`paste error path: "${await text(page, "#pasteMsg")}"`);
  await page.click("#relayBtn"); // relay input still empty
  log(`relay empty-input path: "${await text(page, "#relayMsg")}"`);
  await page.selectOption("#series", "unemp");
  await page.fill("#paste", "2026 M07 9.9\n2026-08,9.8");
  await page.click("#mergeBtn");
  log(`paste msg: "${await text(page, "#pasteMsg")}"`);
  log(`headline after merge: ${await text(page, ".stat.s1 b")} (${await text(page, ".stat.s1 .sub")})`);
  log(`chart note after merge: "${await text(page, "#chartNote")}"`);
  log(`suite.data.jobs = ${await page.evaluate(() => localStorage.getItem("suite.data.jobs"))}`);

  /* ---- 5. clear ---- */
  await page.click("#clearBtn");
  log(`clear msg: "${await text(page, "#pasteMsg")}"`);
  log(`headline after clear: ${await text(page, ".stat.s1 b")} (${await text(page, ".stat.s1 .sub")})`);
  log(`suite.data.jobs after clear: ${await page.evaluate(() => JSON.stringify(localStorage.getItem("suite.data.jobs")))}`);

  /* ---- 6. relay path (contract: <base>?url=<encoded>, see relay/worker.js) ---- */
  const requested = [];
  const relayPred = u => u.href.startsWith("https://relay.test");
  await page.route(relayPred, route => {
    const href = route.request().url();
    requested.push(href);
    const inner = decodeURIComponent(href.split("?url=")[1] || "");
    const id = (inner.match(/data\/(\w+)$/) || [])[1];
    const val = { LNS14000000: "3.3", LNS11300000: "63.0", CES0000000001: "160000" }[id] || "0";
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ Results: { series: [{ data: [{ year: "2026", period: "M07", value: val }] }] } })
    });
  });
  await page.fill("#relay", "https://relay.test");
  await page.click("#relayBtn");
  await page.waitForFunction(() =>
    /merged|failed/.test(document.getElementById("relayMsg").textContent), { timeout: 15000 });
  log(`relay msg: "${await text(page, "#relayMsg")}"`);
  for (const id of ["LNS14000000", "LNS11300000", "CES0000000001"]) {
    /* Suite.relay emits <base>?url=<encoded>; the fetch stack normalizes the bare
       host to include the root path ("/"), so compare normalized URLs. */
    const expected = new URL("https://relay.test?url=" +
      encodeURIComponent(`https://api.bls.gov/publicAPI/v1/timeseries/data/${id}`)).href;
    log(`relay contract ${id}: requested-as-expected=${requested.includes(expected)}`);
  }
  log(`relay requests observed: ${requested.length} — ${requested.join(" | ")}`);
  log(`headline after relay merge: ${await text(page, ".stat.s1 b")} (${await text(page, ".stat.s1 .sub")})`);
  log(`payroll stat after relay merge: ${await text(page, ".stat.s3 b")} (${await text(page, ".stat.s3 .sub")})`);
  log(`suite.relay.url = ${await page.evaluate(() => localStorage.getItem("suite.relay.url"))}`);
  await page.unroute(relayPred);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   v1 writes suite.data.jobs on merge and suite.relay on the relay attempt (its fetch
   through the fake base is aborted — the write happens before the fetch). The known,
   explained asymmetry: v1 uses suite.relay (raw prefix), v2 uses the suite-wide
   suite.relay.url (Suite.relay contract); v2 still reads the legacy key as a prefill. */
export async function v1Interact({ page }) {
  await page.click("#updatePanel summary");
  await page.fill("#paste", "2026 M07 9.9\n2026-08,9.8");
  await page.click("#mergeBtn");
  const relayPred = u => u.href.startsWith("https://relay.test");
  await page.route(relayPred, r => r.abort());
  await page.fill("#relay", "https://relay.test/?url=");
  await page.click("#relayBtn");
  await page.waitForFunction(() =>
    /failed|merged/.test(document.getElementById("relayMsg").textContent), { timeout: 30000 });
  await page.unroute(relayPred);
}
