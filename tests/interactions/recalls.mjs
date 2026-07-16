/* tests/interactions/recalls.mjs — Recall Radar (Batch B, CORS-open fetcher, THREE sources)
   Live sources exercised once each:
     1. openFDA food enforcement  — api.fda.gov (state derived from seeded suite.location)
     2. NHTSA recallsByVehicle    — api.nhtsa.gov (one vehicle added via the UI)
     3. CPSC recall REST service  — www.saferproducts.gov (fires on boot, national feed)
   Then the Batch B addendum stale-cache offline path (all sources), plus a per-source
   degradation pass (only api.fda.gov blocked; NHTSA/CPSC panels must keep rendering). */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".locrow", "#stateSel", ".panel > h2", ".card-msg", "button.primary", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

/* terminal state per panel: a .rec card, or a .card-msg that is not the "Loading…" message */
function settled(id) {
  return `(() => {
    const l = document.getElementById("${id}");
    if (!l) return false;
    if (l.querySelector(".rec")) return true;
    const m = l.querySelector(".card-msg");
    return !!m && !m.textContent.startsWith("Loading");
  })()`;
}
async function waitPanel(page, id, timeout = 30000) {
  await page.waitForFunction(settled(id), null, { timeout });
}
async function waitCarBody(page, idx, timeout = 30000) {
  await page.waitForFunction(`(() => {
    const b = document.getElementById("carbody-${idx}");
    return !!b && (!!b.querySelector(".rec") || !!b.querySelector(".card-msg"));
  })()`, null, { timeout });
}
const text = (page, sel) => page.locator(sel).first().innerText().then(s => s.replace(/\s+/g, " ").trim());

export async function interact({ page, log, evidenceDir }) {
  /* ---- fresh-open state: no state chosen, no cars; CPSC (source 3) fetches on boot ---- */
  await waitPanel(page, "prodList");
  log(`first-run food panel: "${await text(page, "#foodList .card-msg")}"`);
  log(`first-run vehicle panel: "${await text(page, "#carList .card-msg")}"`);

  log(`CPSC (live, boot): prodN = "${await text(page, "#prodN")}"`);
  log(`CPSC first card: "${(await text(page, "#prodList .rec")).slice(0, 220)}"`);
  const cpsc = await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("suite.cache.recalls.cpsc"));
    const r = e && e.v && e.v[0];
    return { count: e && e.v.length, cachedAt: e && new Date(e.t).toISOString(),
      sample: r && { title: r.Title, date: r.RecallDate, hazard: (r.Hazards || []).map(h => h.Name)[0] || null, url: r.URL } };
  });
  log(`CPSC cache envelope: ${cpsc.count} recalls cached at ${cpsc.cachedAt}`);
  log(`CPSC sample recall: ${JSON.stringify(cpsc.sample)}`);

  /* ---- source 1: openFDA. Seed the shared location (addendum) — the tool derives
     the state (CA) from the label, proving the suite.location -> state feature ---- */
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await waitPanel(page, "foodList");
  log(`state derived from suite.location: stateSel = "${await page.locator("#stateSel").inputValue()}" (expect CA)`);
  log(`FDA (live): foodN = "${await text(page, "#foodN")}"`);
  log(`FDA first card: "${(await text(page, "#foodList .rec")).slice(0, 260)}"`);
  const fda = await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("suite.cache.recalls.food.CA"));
    const r = e && e.v && e.v[0];
    return { count: e && e.v.length, cachedAt: e && new Date(e.t).toISOString(),
      sample: r && { classification: r.classification, firm: r.recalling_firm,
        product: (r.product_description || "").slice(0, 100), initiated: r.recall_initiation_date, status: r.status } };
  });
  log(`FDA cache envelope: ${fda.count} results cached at ${fda.cachedAt}`);
  log(`FDA sample recall: ${JSON.stringify(fda.sample)}`);

  /* picking the state persists it (served from the fresh cache — no second FDA request) */
  await page.selectOption("#stateSel", "CA");
  await waitPanel(page, "foodList");
  log(`suite.state after manual pick: ${await page.evaluate(() => localStorage.getItem("suite.state"))}`);

  /* ---- source 2: NHTSA. Add one vehicle via the UI (one live request) ---- */
  /* validation first: all three fields required — empty click adds nothing */
  await page.click("#addCar");
  log(`add clicked with empty fields: suite.cars = ${await page.evaluate(() => localStorage.getItem("suite.cars"))} (expect null), panel = "${await text(page, "#carList .card-msg")}"`);
  await page.fill("#carMake", "Honda");
  await page.fill("#carModel", "Odyssey");
  await page.fill("#carYear", "2020");
  await page.click("#addCar");
  await waitCarBody(page, 0);
  log(`vehicle added: vehN = "${await text(page, "#vehN")}", header = "${await text(page, ".carhead .cn")}"`);
  log(`NHTSA (live): carcount-0 = "${await text(page, "#carcount-0")}"`);
  const firstVehCard = await page.locator("#carbody-0 .rec, #carbody-0 .card-msg").first().innerText();
  log(`NHTSA first card: "${firstVehCard.replace(/\s+/g, " ").trim().slice(0, 260)}"`);
  const veh = await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("suite.cache.recalls.veh.honda|odyssey|2020"));
    const r = e && e.v && e.v[0];
    return { count: e && e.v.length, cachedAt: e && new Date(e.t).toISOString(),
      sample: r && { campaign: r.NHTSACampaignNumber, component: r.Component,
        received: r.ReportReceivedDate, summary: (r.Summary || "").slice(0, 100) } };
  });
  log(`NHTSA cache envelope: ${veh.count} recalls cached at ${veh.cachedAt}`);
  log(`NHTSA sample recall: ${JSON.stringify(veh.sample)}`);
  log(`suite.cars = ${await page.evaluate(() => localStorage.getItem("suite.cars"))}`);

  /* remove + re-add via Enter key (a11y path); the re-add is served from the 24 h
     vehicle cache, so no extra NHTSA request is made */
  await page.click('button.x[aria-label="Remove 2020 Honda Odyssey"]');
  log(`after remove: vehicle panel = "${await text(page, "#carList .card-msg")}", suite.cars = ${await page.evaluate(() => localStorage.getItem("suite.cars"))}`);
  await page.fill("#carMake", "Honda");
  await page.fill("#carModel", "Odyssey");
  await page.fill("#carYear", "2020");
  await page.press("#carYear", "Enter");
  await waitCarBody(page, 0);
  log(`re-added via Enter key (cache hit, no refetch): carcount-0 = "${await text(page, "#carcount-0")}"`);

  /* ---- Batch B addendum: stale-cache offline path, all three sources ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await waitPanel(page, "foodList");
  await waitPanel(page, "prodList");
  await waitCarBody(page, 0);
  log(`offline stale — food: foodN = "${await text(page, "#foodN")}", rows = ${await page.locator("#foodList .rec").count()}`);
  log(`offline stale — vehicle: carcount-0 = "${await text(page, "#carcount-0")}", rows = ${await page.locator("#carbody-0 .rec").count()}`);
  log(`offline stale — CPSC: prodN = "${await text(page, "#prodN")}", rows = ${await page.locator("#prodList .rec").count()}`);
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });
  await page.context().unroute(/^https?:/);

  /* ---- per-source degradation: only api.fda.gov down, no cached copy for it.
     NHTSA/CPSC panels render from (re-freshened) cache — zero extra requests.
     The food cache is stashed and restored afterwards so the final localStorage
     snapshot keeps the full v1-parity key set. ---- */
  const foodCache = await page.evaluate(() => localStorage.getItem("suite.cache.recalls.food.CA"));
  await page.evaluate(() => {
    localStorage.removeItem("suite.cache.recalls.food.CA");
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now();
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/https?:\/\/api\.fda\.gov/, r => r.abort());
  await page.reload();
  await waitPanel(page, "foodList");
  await waitPanel(page, "prodList");
  await waitCarBody(page, 0);
  log(`FDA-only outage — food panel: "${await text(page, "#foodList .card-msg")}"`);
  log(`FDA-only outage — vehicle panel still renders: carcount-0 = "${await text(page, "#carcount-0")}", rows = ${await page.locator("#carbody-0 .rec").count()}`);
  log(`FDA-only outage — CPSC panel still renders: prodN = "${await text(page, "#prodN")}", rows = ${await page.locator("#prodList .rec").count()}`);
  await page.screenshot({ path: evidenceDir + "/fda-down.png", fullPage: true });
  await page.context().unroute(/https?:\/\/api\.fda\.gov/);
  await page.evaluate(fc => { if (fc) localStorage.setItem("suite.cache.recalls.food.CA", fc); }, foodCache);
  log("food cache restored after the FDA-outage pass (parity snapshot keeps the full key set)");

  /* NOTE: the FDA 404 -> "No food recalls on record ... Reassuring." semantics (v1 read
     e.status === 404; v2 reads Suite.fetchJSON's "HTTP 404" message) were proven with a
     routed 404 response — evidence preserved in interaction-supplemental-404-path.txt.
     The pass is not in this standing module because Chrome's own console line for any
     non-2xx fetch ("Failed to load resource: ... 404") is counted as a hard console
     issue by the harness (it doesn't match the net::ERR exemption), failing the run
     even though the tool handles the 404 correctly — exactly as v1 does. */

  /* ---- CPSC outage with NO cache -> the v1 link-out card to cpsc.gov (all network
     blocked, so this pass makes zero requests; cpsc cache stashed and restored) ---- */
  const cpscCache = await page.evaluate(() => localStorage.getItem("suite.cache.recalls.cpsc"));
  await page.evaluate(() => { localStorage.removeItem("suite.cache.recalls.cpsc"); });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await waitPanel(page, "prodList");
  log(`CPSC outage, no cache — panel = "${await text(page, "#prodList .card-msg")}", ` +
    `link-out href = ${await page.locator("#prodList .card-msg a").getAttribute("href")}`);
  await page.context().unroute(/^https?:/);
  await page.evaluate(cc => { if (cc) localStorage.setItem("suite.cache.recalls.cpsc", cc); }, cpscCache);
  log("cpsc cache restored after the link-out pass (parity snapshot keeps the full key set)");

  /* ---- Phase 4 audit fix: CPSC URL scheme guard. Route-fulfil the CPSC endpoint with a
     hostile payload (zero real requests; everything else stays blocked): javascript: URLs
     (plain and case/whitespace-disguised) must render as PLAIN TEXT titles, never an href;
     a normal https URL must still become a link. Cache stashed/restored as usual. ---- */
  await page.evaluate(() => { localStorage.removeItem("suite.cache.recalls.cpsc"); });
  await page.context().route(/^https?:/, r => r.abort());
  await page.context().route(/www\.saferproducts\.gov/, r => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify([
      { RecallDate: "2026-07-03", Title: "HOSTILE javascript recall", URL: "javascript:alert(document.domain)", Hazards: [], Products: [] },
      { RecallDate: "2026-07-02", Title: "HOSTILE disguised recall", URL: "  JaVaScRiPt:alert(1)", Hazards: [], Products: [] },
      { RecallDate: "2026-07-01", Title: "Legit https recall", URL: "https://www.cpsc.gov/Recalls/2026/example", Hazards: [], Products: [] }
    ])
  }));
  await page.reload();
  await waitPanel(page, "prodList");
  const guard = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#prodList .rec h3")).map(h => {
      const a = h.querySelector("a");
      return { text: h.textContent.trim(), href: a ? a.getAttribute("href") : null };
    }));
  log(`URL scheme guard probe (hostile CPSC payload): ${JSON.stringify(guard)}`);
  if (guard.length !== 3) throw new Error("scheme-guard probe expected 3 rendered recalls, got " + guard.length);
  const hostileLinked = guard.filter(g => g.href && !/^https?:\/\//i.test(g.href));
  if (hostileLinked.length) throw new Error("scheme guard FAILED — non-http(s) URL reached an href: " + JSON.stringify(hostileLinked));
  if (guard[0].href !== null || guard[1].href !== null) throw new Error("scheme guard FAILED — hostile recall rendered as a link");
  if (guard[2].href !== "https://www.cpsc.gov/Recalls/2026/example") throw new Error("scheme guard over-blocked the legit https URL: " + JSON.stringify(guard[2]));
  log("scheme guard verified: both javascript: variants rendered as plain text, https link intact");
  await page.context().unroute(/www\.saferproducts\.gov/);
  await page.context().unroute(/^https?:/);
  await page.evaluate(cc => {
    localStorage.removeItem("suite.cache.recalls.cpsc");
    if (cc) localStorage.setItem("suite.cache.recalls.cpsc", cc);
  }, cpscCache);
  log("cpsc cache restored after the scheme-guard probe (parity snapshot keeps the real payload)");
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   seeded location -> live FDA fetch (CA) -> manual state pick -> suite.state;
   one vehicle added -> live NHTSA fetch; CPSC cached from boot. */
export async function v1Interact({ page }) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForFunction(settled("foodList"), null, { timeout: 30000 });
  await page.waitForFunction(settled("prodList"), null, { timeout: 30000 });
  await page.selectOption("#stateSel", "CA");
  await page.waitForFunction(settled("foodList"), null, { timeout: 30000 });
  await page.fill("#carMake", "Honda");
  await page.fill("#carModel", "Odyssey");
  await page.fill("#carYear", "2020");
  await page.click("#addCar");
  await page.waitForFunction(`(() => {
    const b = document.getElementById("carbody-0");
    return !!b && (!!b.querySelector(".rec") || !!b.querySelector(".card-msg"));
  })()`, null, { timeout: 30000 });
}
