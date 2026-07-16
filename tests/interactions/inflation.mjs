/* inflation.html — embedded-BLS tool (network "blocked", ADR D5).
   Core feature: render headline/core CPI YoY + category cards from the embedded
   @suite:bls object, fully offline from file://. Also exercises the paste-merge
   override flow (suite.data.cpi) and the optional Suite.relay live-fetch path
   (deterministic: route-fulfilled fake relay, no real network). */

export const selectors = [
  "body", "header h1", ".stats", ".stat.headline", ".stat.core",
  "svg.chart", ".spark", ".catcard", "details summary", "#paste", ".btn", "footer"
];

export const screenshotAfterInteract = true;

async function readStats(page) {
  const h = (await page.locator(".stat.headline b").textContent()).trim();
  const hSub = (await page.locator(".stat.headline .sub").textContent()).trim();
  const c = (await page.locator(".stat.core b").textContent()).trim();
  const cSub = (await page.locator(".stat.core .sub").textContent()).trim();
  return { h, hSub, c, cSub };
}

export async function interact({ page, log, evidenceDir }) {
  // ---- 1. initial render, straight from the embedded object (no network at all) ----
  const stamp = (await page.locator("#stamp").textContent()).trim();
  log(`stamp: "${stamp}"`);
  let s = await readStats(page);
  log(`initial stats: headline ${s.h} (${s.hSub}) | core ${s.c} (${s.cSub})`);
  log(`chartNote: "${(await page.locator("#chartNote").textContent()).trim()}"`);
  const paths = await page.locator("#chart path").count();
  const gridlines = await page.locator("#chart line").count();
  log(`chart: ${paths} line paths, ${gridlines} gridlines rendered in the SVG`);
  const cats = await page.locator(".catcard").evaluateAll(els =>
    els.map(e => e.querySelector(".k").textContent + " " + e.querySelector(".v").textContent));
  log(`categories: ${cats.join(" | ")}`);

  // ---- 2. explicit offline proof: block ALL http(s), reload, embedded data still renders ----
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForTimeout(600);
  s = await readStats(page);
  log(`offline (all http(s) aborted) after reload: headline ${s.h} (${s.hSub}) | core ${s.c} — embedded data renders with zero network`);
  await page.screenshot({ path: evidenceDir + "/offline-embedded.png", fullPage: true });
  await page.context().unroute(/^https?:/);

  // ---- 3. paste-merge override flow (suite.data.cpi) ----
  await page.locator("#updatePanel summary").click();
  await page.locator("#paste").fill("2026 M07 337.9");
  await page.locator("#mergeBtn").click();
  log(`merge msg: "${(await page.locator("#pasteMsg").textContent()).trim()}"`);
  s = await readStats(page);
  log(`after merging 2026 M07 337.9 into headline: ${s.h} (${s.hSub})`);
  log(`suite.data.cpi now: ${await page.evaluate(() => localStorage.getItem("suite.data.cpi"))}`);

  // clear my updates -> back to embedded only
  await page.locator("#clearBtn").click();
  log(`clear msg: "${(await page.locator("#pasteMsg").textContent()).trim()}"`);
  s = await readStats(page);
  log(`after clear (embedded only again): ${s.h} (${s.hSub})`);
  log(`suite.data.cpi after clear: ${await page.evaluate(() => localStorage.getItem("suite.data.cpi"))}`);

  // merge once more so the final localStorage snapshot contains the key (parity vs v1)
  await page.locator("#paste").fill("2026 M07 337.9");
  await page.locator("#mergeBtn").click();

  // ---- 4. relay path, deterministic (Suite.relay contract: <base>?url=<encoded>) ----
  const relayRequests = [];
  await page.route("**://relay.test/**", async route => {
    const u = new URL(route.request().url());
    relayRequests.push(route.request().url());
    const target = u.searchParams.get("url") || "";
    const isCore = target.includes("SA0L1E");
    const body = JSON.stringify({ Results: { series: [{ data: [
      { year: "2026", period: "M07", value: isCore ? "339.5" : "338.2" }
    ] }] } });
    await route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" }, body
    });
  });
  await page.locator("#relay").fill("https://relay.test");
  await page.locator("#relayBtn").click();
  await page.waitForTimeout(800);
  log(`relay msg: "${(await page.locator("#relayMsg").textContent()).trim()}"`);
  for (const u of relayRequests) log(`relay request observed: ${u}`);
  s = await readStats(page);
  log(`after relay merge: headline ${s.h} (${s.hSub}) | core ${s.c} (${s.cSub})`);
  log(`suite.relay.url stored: ${await page.evaluate(() => localStorage.getItem("suite.relay.url"))}`);
  await page.unroute("**://relay.test/**");
}

/* Same state-writing actions on v1 so the localStorage snapshots compare like for like.
   (v1 writes suite.relay — a prefix; v2 writes suite.relay.url — the Suite.relay base.
   That one spec-mandated rename is documented in the report.) */
export async function v1Interact({ page }) {
  await page.locator("#updatePanel summary").click();
  await page.locator("#paste").fill("2026 M07 337.9");
  await page.locator("#mergeBtn").click();
  await page.locator("#clearBtn").click();
  await page.locator("#paste").fill("2026 M07 337.9");
  await page.locator("#mergeBtn").click();

  await page.route("**://relay.test/**", async route => {
    const u = new URL(route.request().url());
    const target = u.searchParams.get("url") || "";
    const isCore = target.includes("SA0L1E");
    const body = JSON.stringify({ Results: { series: [{ data: [
      { year: "2026", period: "M07", value: isCore ? "339.5" : "338.2" }
    ] }] } });
    await route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" }, body
    });
  });
  await page.locator("#relay").fill("https://relay.test/?url=");
  await page.locator("#relayBtn").click();
  await page.waitForTimeout(800);
  await page.unroute("**://relay.test/**");
}
