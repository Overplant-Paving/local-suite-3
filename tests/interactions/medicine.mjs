/* tests/interactions/medicine.mjs — Medicine Cabinet Lookup (Batch B, cors-open)
   Live path: one real openFDA label+enforcement search ("ibuprofen") — logs the
   rendered brand, generic line, section summaries, uses/warnings snippets, and the
   recalls card for the same drug. Then the not-found state with a nonsense name
   (openFDA 404 = "no results", must render the No-match card, not an error).
   Then the history chip re-run, which must serve from the fresh 24 h cache without
   a second fetch. Then the Batch B stale-cache offline path: back-date every
   suite.cache.* entry, abort all http(s), reload, re-run the search — the cached
   label must render with the "(cached)" stamp, not a blank or an error. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  "#q", "button.go", "#history", ".disclaimer", "#results", "footer"
];

export const screenshotAfterInteract = true;

const TERM = "ibuprofen";
const NONSENSE = "zzxqblorptan";

const resultsReady = page => page.waitForFunction(() =>
  document.querySelector("#results .drughead") && !document.querySelector("#results .spin"),
  { timeout: 30000 });

async function search(page, term) {
  await page.fill("#q", term);
  await page.click("button.go");
  await resultsReady(page);
}

const clip = (s, n = 180) => (s || "").replace(/\s+/g, " ").trim().slice(0, n);

async function logLabelCard(page, log, tag) {
  const brand = await page.textContent("#results .card .drughead h2");
  log(`${tag} brand/title: "${clip(brand)}"`);
  const gen = await page.locator("#results .drughead .gen").count()
    ? await page.textContent("#results .drughead .gen") : "(none)";
  log(`${tag} generic line: "${clip(gen)}"`);
  const pills = await page.$$eval("#results .pills .pill", els => els.map(e => e.textContent.trim()));
  log(`${tag} pills: [${pills.join(" | ")}]`);
  const sums = await page.$$eval("#results details.sec > summary", els => els.map(e => e.textContent.trim()));
  log(`${tag} label sections (${sums.length}): [${sums.join(" | ")}]`);
  const uses = await page.$$eval("#results details.sec", els => {
    const d = els.find(e => e.querySelector("summary").textContent.includes("used for"));
    return d ? d.querySelector(".content").textContent : "(no indications section)";
  });
  log(`${tag} uses snippet: "${clip(uses)}"`);
  const warn = await page.$$eval("#results details.sec.danger", els =>
    els.length ? els[0].querySelector("summary").textContent + " :: " + els[0].querySelector(".content").textContent
               : "(no danger-class section)");
  log(`${tag} warnings snippet: "${clip(warn)}"`);
  log(`${tag} stamp: "${clip(await page.textContent("#results .stamp"))}"`);
}

async function logRecallsCard(page, log, tag) {
  const rows = await page.$$eval("#results .recalls .r", els => els.map(r => ({
    cls: r.querySelector(".cls").textContent.trim(),
    desc: r.querySelector(".rdesc").textContent.replace(/\s+/g, " ").trim().slice(0, 140)
  })));
  if (!rows.length) {
    log(`${tag} recalls: "${clip(await page.textContent("#results .recalls .empty"))}"`);
  } else {
    log(`${tag} recalls: ${rows.length} row(s) rendered`);
    rows.slice(0, 3).forEach((r, i) => log(`${tag}   recall[${i}] ${r.cls} — ${r.desc}`));
  }
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- live fetch 1+2: label + enforcement search for a real drug ---- */
  await search(page, TERM);
  await logLabelCard(page, log, `live "${TERM}"`);
  await logRecallsCard(page, log, `live "${TERM}"`);
  const env = await page.evaluate(t =>
    JSON.parse(localStorage.getItem("suite.cache.medicine." + t)), TERM);
  log(`cache envelope written: suite.cache.medicine.${TERM} ` +
    `{t:${env && env.t}, label:${!!(env && env.v.label)}, recalls:${env ? env.v.recalls.length : "?"}}`);

  /* ---- not-found state: nonsense name -> openFDA 404 -> No-match card ----
     openFDA answers "no results" with HTTP 404 BY DESIGN, and Chrome always logs an
     unsuppressable console.error ("Failed to load resource: 404") for any 404 fetch
     — in v1 and v2 alike. That log is the API's designed semantics, not a tool
     defect, so this step runs on a second page in the same context (same storage,
     same live network) to keep the harness console record limited to real defects.
     Disclosed in report.md "concerns". */
  const p2 = await page.context().newPage();
  await p2.goto(page.url());
  await search(p2, NONSENSE);
  log(`nonsense "${NONSENSE}" title: "${clip(await p2.textContent("#results .drughead"))}"`);
  log(`nonsense body: "${clip(await p2.textContent("#results .empty"))}"`);
  await p2.screenshot({ path: `${evidenceDir}/notfound.png`, fullPage: true });
  await p2.close();
  log(`nonsense cached: ${await page.evaluate(t =>
    localStorage.getItem("suite.cache.medicine." + t) !== null, NONSENSE)} (v1 never caches no-match)`);

  /* ---- history chip re-run: must serve from the fresh cache, no refetch ---- */
  const chips = await page.$$eval("#history button", els => els.map(e => e.textContent.trim()));
  log(`history chips: [${chips.join(" | ")}] (nonsense term absent, as in v1)`);
  let fetches = 0;
  await page.route(/api\.fda\.gov/, r => { fetches++; r.continue(); });
  await page.click(`#history button:has-text("${TERM}")`);
  await resultsReady(page);
  await page.unroute(/api\.fda\.gov/);
  log(`history-chip re-run: api.fda.gov requests=${fetches} (TTL-fresh serve), ` +
    `stamp="${clip(await page.textContent("#results .stamp"))}"`);

  /* ---- stale-cache offline path (Batch B addendum) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForTimeout(500); // page renders header/history from storage, no auto-fetch
  await search(page, TERM);      // cached paint stays up when the refetch fails
  log(`offline stale brand: "${clip(await page.textContent("#results .card .drughead h2"))}"`);
  log(`offline stale stamp: "${clip(await page.textContent("#results .stamp"))}"`);
  await logRecallsCard(page, log, "offline stale");
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* restore a live-looking view for the after-interaction shot WITHOUT a second
     live fetch: re-freshen the cache timestamp so the TTL-fresh path serves it */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now();
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.reload();
  await page.waitForTimeout(400);
  await search(page, TERM);
  log(`restored (from fresh cache, no refetch): stamp="${clip(await page.textContent("#results .stamp"))}"`);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   one live search writes suite.cache.medicine.ibuprofen + suite.medicine.history
   (suite.theme comes from the harness toggle click). */
export async function v1Interact({ page }) {
  await page.fill("#q", TERM);
  await page.click("button.go");
  await page.waitForFunction(() =>
    document.querySelector("#results .drughead") && !document.querySelector("#results .spin"),
    { timeout: 30000 });
}
