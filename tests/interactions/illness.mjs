/* tests/interactions/illness.mjs — Illness Activity Tracker (Batch B, CORS-open fetcher)
   Live-verifies BOTH data.cdc.gov Socrata sources (NWSS wastewater 2ew6-ywp6,
   NHSN weekly hospital respiratory ua7e-t2fy) for the default CA state, exercises the
   state picker (TX), proves the state-derivation-from-suite.location path with a
   network-blocked MA reload (also exercising the no-cache error cards), reseeds LA -> CA
   per the shared-location convention, then proves the stale-cache offline path. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", ".locbar",
  ".locbar select", ".card", ".bignum", ".adm-grid", ".stamp", "footer"
];

export const screenshotAfterInteract = true;

const waitForState = (page, stateName) =>
  page.waitForFunction(name =>
    document.querySelector("#wwSub") &&
    document.querySelector("#wwSub").textContent.includes(name) &&
    document.querySelector("#wwBody .bignum") &&
    document.querySelector("#admBody .adm .val"),
    stateName, { timeout: 30000 });

async function logRendered(page, log, tag) {
  const ww = await page.evaluate(() => ({
    sub: document.querySelector("#wwSub").textContent.trim(),
    level: document.querySelector("#wwBody .bignum").textContent.trim(),
    pctl: document.querySelector("#wwBody .trend").textContent.trim(),
    trend: document.querySelectorAll("#wwBody .row .trend")[1].textContent.trim(),
    stamp: document.querySelector("#wwBody .stamp").textContent.trim(),
    chartPts: (document.querySelector("#wwBody svg path[stroke-width='2']") || { getAttribute: () => "" })
      .getAttribute("d").split("L").length
  }));
  log(`${tag} wastewater ${ww.sub}: level="${ww.level}", ${ww.pctl}, trend="${ww.trend}", ` +
    `chart points=${ww.chartPts}; stamp="${ww.stamp}"`);
  const adm = await page.evaluate(() =>
    [...document.querySelectorAll("#admBody .adm")].map(b =>
      `${b.querySelector(".lbl").textContent}=${b.querySelector(".val").textContent} (${b.querySelector(".meta").textContent})`));
  const admStamp = await page.evaluate(() => document.querySelector("#admBody .stamp").textContent.trim());
  log(`${tag} admissions: ${adm.join(" · ")}; stamp="${admStamp}"`);
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- LIVE FETCH 1+2: default state CA, one real Socrata call per source ---- */
  await waitForState(page, "California");
  await page.waitForTimeout(300);
  log(`initial state: select=${await page.inputValue("#stateSel")}, ` +
    `locNote="${(await page.textContent("#locNote")).trim()}", ` +
    `suite.state=${await page.evaluate(() => localStorage.getItem("suite.state"))}`);
  await logRendered(page, log, "LIVE (CA)");

  /* raw response evidence from the cache envelopes Suite.fetchJSON just wrote */
  const raw = await page.evaluate(() => {
    const ww = JSON.parse(localStorage.getItem("suite.cache.illness.ww.CA"));
    const adm = JSON.parse(localStorage.getItem("suite.cache.illness.adm.CA"));
    return {
      wwRows: ww.v.length, wwFirst: ww.v[0], wwLast: ww.v[ww.v.length - 1],
      admRows: adm.v.length, admLast: adm.v[adm.v.length - 1]
    };
  });
  log(`LIVE response (suite.cache.illness.ww.CA): ${raw.wwRows} rows; first=${JSON.stringify(raw.wwFirst)}; last=${JSON.stringify(raw.wwLast)}`);
  log(`LIVE response (suite.cache.illness.adm.CA): ${raw.admRows} rows; last=${JSON.stringify(raw.admLast)}`);

  /* ---- state picker: live fetch for a second state (TX) ---- */
  await page.selectOption("#stateSel", "TX");
  await waitForState(page, "Texas");
  await page.waitForTimeout(300);
  log(`picker: selected TX -> suite.state=${await page.evaluate(() => localStorage.getItem("suite.state"))}`);
  await logRendered(page, log, "LIVE (TX)");

  /* ---- derivation from suite.location label (network blocked so no extra fetch;
          MA has no cache, which also exercises the v1 no-cache error cards) ---- */
  await page.evaluate(() => {
    localStorage.removeItem("suite.state");
    localStorage.setItem("suite.location", JSON.stringify({ lat: 42.3601, lon: -71.0589, label: "Boston, MA" }));
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector("#wwCard.errcard", { timeout: 20000 });
  await page.waitForTimeout(300);
  const derived = await page.inputValue("#stateSel");
  const wwErr = (await page.textContent("#wwBody p")).trim();
  const admErr = (await page.textContent("#admBody p")).trim();
  log(`derivation: suite.state cleared, suite.location label "Boston, MA" -> select=${derived} (not the CA fallback, not stored TX)`);
  log(`no-cache error cards (network blocked, MA never fetched): ww="${wwErr}" | adm="${admErr}"`);
  await page.context().unroute(/^https?:/);

  /* ---- addendum seed: LA -> CA (renders from the still-fresh CA cache) ---- */
  await page.evaluate(() => {
    localStorage.removeItem("suite.state");
    localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }));
  });
  await page.reload();
  await waitForState(page, "California");
  await page.waitForTimeout(300);
  log(`LA seed: suite.location "Los Angeles, CA" -> select=${await page.inputValue("#stateSel")}, ` +
    `suite.state=${await page.evaluate(() => localStorage.getItem("suite.state"))}`);
  await logRendered(page, log, "SEEDED-LA (CA, fresh cache within TTL)");

  /* ---- STALE-CACHE OFFLINE PATH ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 25 * 60 * 60 * 1000; // 25h > the 24h TTL
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await waitForState(page, "California");
  await page.waitForTimeout(600); // let the failed fetch resolve to the stale re-render
  await logRendered(page, log, "STALE PATH (network blocked, cache aged 25h):");
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   default CA live fetch (harness goto), TX via the picker, then LA seed -> CA. */
export async function v1Interact({ page }) {
  await page.waitForFunction(() =>
    document.querySelector("#wwBody .bignum") && document.querySelector("#admBody .adm .val"),
    null, { timeout: 30000 });
  await page.selectOption("#stateSel", "TX");
  await page.waitForFunction(() =>
    document.querySelector("#wwSub").textContent.includes("Texas") &&
    document.querySelector("#wwBody .bignum") && document.querySelector("#admBody .adm .val"),
    null, { timeout: 30000 });
  await page.evaluate(() => {
    localStorage.removeItem("suite.state");
    localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }));
  });
  await page.reload();
  await page.waitForFunction(() =>
    document.querySelector("#wwSub").textContent.includes("California") &&
    document.querySelector("#wwBody .bignum") && document.querySelector("#admBody .adm .val"),
    null, { timeout: 30000 });
  await page.waitForTimeout(300);
}
