/* tests/interactions/nutrition.mjs — Nutrition Lookup (Batch C, keyed: usda demo tier, RL flag)
   DEMO_KEY budget (shared pool): exactly ONE real request in this whole verification —
   the v2 live search. Its response body is captured and route-fulfilled into v1 for
   localStorage parity, so v1Interact makes no real request.

   Console-gate note: the deterministic 429-backoff verification (route-fulfill status
   429 -> "USDA is rate-limiting" note + cached render + doubled-TTL backoff) unavoidably
   logs a browser-level "Failed to load resource: ... 429" console error, which the
   harness counts as a hard issue (only net::ERR is filtered). Per the dictionary.mjs
   precedent it runs as a separate archived pass — tests/evidence/nutrition/
   rl-429-backoff.txt + rl-429-state.png, produced by a standalone script that seeds the
   cache from the captured live response (zero additional real requests). This harness
   run covers: demo nudge, key save/clear, live search, compare A/B, basis toggle,
   slot removal, and the abort-based stale/offline path (net::ERR -> filtered). */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  "form", "input[type=search]", "button.go", ".keyrow", "#keyState", "footer"
];

export const screenshotAfterInteract = true;

let capturedBody = null; // v2 live response, replayed into v1 (interact runs first)

const resultsReady = page =>
  page.waitForFunction(() => document.querySelectorAll("#results .res").length > 0, { timeout: 30000 });
const stampText = page => page.textContent("#results .stamp").then(s => s.trim());

export async function interact({ page, log, evidenceDir }) {
  /* ---- demo-key designed state: nudge + signup link (Batch C addendum) ---- */
  log(`key state on load: "${(await page.textContent("#keyState")).trim()}"`);
  const nudge = await page.evaluate(() => {
    const n = document.getElementById("demoNudge");
    const a = n.querySelector("a");
    return { hidden: n.hidden, text: n.textContent.trim(), href: a && a.href };
  });
  log(`demo nudge visible: ${!nudge.hidden} · text="${nudge.text}" · signup href=${nudge.href}`);

  /* ---- paste-a-key mechanics: save -> own-key state, clear -> back to demo ---- */
  await page.click("#keyToggle");
  log(`keybox opened: aria-expanded=${await page.getAttribute("#keyToggle", "aria-expanded")}, visible=${await page.isVisible("#keyBox")}`);
  await page.fill("#keyInput", "TEST-KEY-NOT-REAL");
  await page.click("#keySave");
  log(`after save: keyState="${(await page.textContent("#keyState")).trim()}" nudgeHidden=${await page.evaluate(() => document.getElementById("demoNudge").hidden)} stored=${await page.evaluate(() => localStorage.getItem("suite.key.usda"))}`);
  await page.click("#keyToggle");
  await page.click("#keyClear");
  log(`after clear: keyState="${(await page.textContent("#keyState")).trim()}" nudgeHidden=${await page.evaluate(() => document.getElementById("demoNudge").hidden)} stored=${await page.evaluate(() => localStorage.getItem("suite.key.usda"))}`);
  /* Esc closes the still-open keybox (a11y overlay rule), focus returns to the toggle */
  await page.focus("#keyInput");
  await page.keyboard.press("Escape");
  log(`Escape closes keybox: visible=${await page.isVisible("#keyBox")}, focus on=${await page.evaluate(() => document.activeElement.id)}`);

  /* ---- THE live fetch (real request 1 of 1): Enter-submitted search ---- */
  await page.fill("#q", "banana");
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes("api.nal.usda.gov"), { timeout: 30000 }),
    page.press("#q", "Enter")
  ]);
  capturedBody = await resp.text();
  log(`live USDA response: HTTP ${resp.status()} · ${capturedBody.length} bytes · url=${resp.url().replace(/api_key=[^&]*/, "api_key=DEMO_KEY")}`);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(`${evidenceDir}/live-response.json`, capturedBody);
  await resultsReady(page);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("#results .res")].map(r => ({
      nm: r.querySelector(".nm").textContent,
      meta: r.querySelector(".meta").textContent
    })));
  log(`results rendered: ${rows.length} rows · stamp="${await stampText(page)}"`);
  log(`  row 1: "${rows[0].nm}" (${rows[0].meta})`);
  log(`  row 2: "${rows[1].nm}" (${rows[1].meta})`);
  const env = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith("suite.cache.nutrition."));
    const e = JSON.parse(localStorage.getItem(k));
    return { k, t: e.t, n: e.v.length };
  });
  log(`cache envelope written: ${env.k} · t=${env.t} · ${env.n} slimmed foods`);

  /* ---- compare: slot A + slot B from the same result list (no extra fetch) ---- */
  await page.click("#results .res >> nth=0 >> .pick button.a");
  await page.click("#results .res >> nth=1 >> .pick button.b");
  log(`slot buttons: A aria-pressed=${await page.getAttribute("#results .res >> nth=0 >> .pick button.a", "aria-pressed")}, B aria-pressed=${await page.getAttribute("#results .res >> nth=1 >> .pick button.b", "aria-pressed")}`);
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll("#compare .food")].map(c => ({
      slot: c.className.match(/slot(\w)/)[1],
      h3: c.querySelector("h3").textContent,
      cal: c.querySelector(".cal").textContent.trim(),
      rows: c.querySelectorAll("table.nut tr").length
    })));
  log(`compare grid two-up: ${await page.evaluate(() => document.getElementById("compare").className)}`);
  cards.forEach(c => log(`  card ${c.slot}: "${c.h3}" · ${c.cal} · ${c.rows} table rows`));

  /* ---- basis toggle (per serving), where the API data offers one ---- */
  const servBtn = await page.$("#compare .food .basis button:not(:first-child)");
  if (servBtn) {
    const before = await page.evaluate(b => b.closest(".food").querySelector(".cal").textContent.trim(), servBtn);
    const label = await servBtn.textContent();
    await servBtn.click();
    const after = await page.evaluate(() => {
      const b = document.querySelector("#compare .food .basis button:not(:first-child)");
      return { cal: b.closest(".food").querySelector(".cal").textContent.trim(), pressed: b.getAttribute("aria-pressed") };
    });
    log(`basis toggle "${label.trim()}": "${before}" -> "${after.cal}" (aria-pressed=${after.pressed})`);
  } else {
    log("basis toggle: no result in this live set carries serving-size data — per-100g only (logged honestly)");
  }

  /* ---- remove a slot, then restore it for the after-shot ---- */
  await page.click("#compare .food.slotB .rmslot");
  log(`removed slot B: ${await page.evaluate(() => document.querySelectorAll("#compare .food").length)} card(s) left, grid class="${await page.evaluate(() => document.getElementById("compare").className)}"`);
  await page.click("#results .res >> nth=1 >> .pick button.b");
  log(`re-added slot B: ${await page.evaluate(() => document.querySelectorAll("#compare .food").length)} cards`);

  /* ---- stale-cache offline path (Batch B addendum; 15 d > the 7 d TTL) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now() - 15 * 24 * 60 * 60 * 1000;
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.fill("#q", "banana");
  await page.press("#q", "Enter");
  await page.waitForFunction(() =>
    document.querySelector("#results .msg") &&
    document.querySelector("#results .msg").textContent.startsWith("Offline"), { timeout: 30000 });
  log(`offline stale note: "${(await page.textContent("#results .msg")).trim()}"`);
  log(`offline stale rows still render: ${await page.evaluate(() => document.querySelectorAll("#results .res").length)} · stamp="${await stampText(page)}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* restore a live-looking view for the after-shot WITHOUT a second real request:
     re-freshen the cache timestamp so the re-search serves from the fresh-TTL path */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now();
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.reload();
  await page.fill("#q", "banana");
  await page.press("#q", "Enter");
  await resultsReady(page);
  await page.click("#results .res >> nth=0 >> .pick button.a");
  await page.click("#results .res >> nth=1 >> .pick button.b");
  log(`restored from fresh cache (no refetch): stamp="${await stampText(page)}" · ${await page.evaluate(() => document.querySelectorAll("#compare .food").length)} compare cards`);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   one banana search writing suite.cache.nutrition.banana|d — served from the captured
   v2 response via route-fulfill, so the shared DEMO_KEY pool is hit exactly once. */
export async function v1Interact({ page }) {
  await page.route(u => u.href.includes("api.nal.usda.gov"), r => r.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: capturedBody
  }));
  await page.fill("#q", "banana");
  await page.press("#q", "Enter");
  await page.waitForFunction(() => document.querySelectorAll("#results .res").length > 0, { timeout: 30000 });
}
