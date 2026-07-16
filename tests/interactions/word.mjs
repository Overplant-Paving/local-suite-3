/* tests/interactions/word.mjs — Word of the Day & Etymology Desk (Batch D: embedded-data + EA)

   Deterministic proof plan (batchD-common: functional proof on top of byte parity):
   - page.clock fixed to 2026-07-29 -> the FNV-1a scheme picks "candid" (recomputed
     independently outside the browser; see report.md), same date reloads repeat it,
     and advancing the clock to 2026-07-30 yields "tundra" — next date, next word.
   - Math.random stubbed to 0.5 -> "Another word" deterministically picks "anthology"
     (floor(0.5 * 374) = 187).
   - ONE live dictionaryapi.dev lookup max (the word "candid"); every other network
     touch in this run is route-aborted (net::ERR_* is filtered by the harness).
   - Lookup-failure path: route-abort with no cache -> the designed embedded-list
     state (card keeps the embedded definition/origin; quiet fetchnote below).
   - Stale-cache path per batchB-common: cache back-dated 48 h (> the 24 h TTL),
     all network blocked -> cached fuller definition + "Offline — cached ..." note. */

export const selectors = [
  "body", ".topbar", ".suite-link", ".theme-btn", "header h1", "header .tag",
  "#wordCard", ".word", ".pos", ".origin", "button.act", "#metList", "footer"
];

export const screenshotAfterInteract = true;

const cardWord = page => page.textContent("#wordCard .word");
const waitCard = page => page.waitForSelector("#wordCard .word", { timeout: 15000 });
const fullerDone = page => page.waitForFunction(() => {
  const b = document.getElementById("fuller");
  return b && b.textContent.trim().length > 0 && !b.textContent.includes("Looking up");
}, undefined, { timeout: 25000 });

export async function interact({ page, log, evidenceDir }) {
  /* ---- deterministic clock FIRST; reload so boot runs under it ---- */
  await page.clock.install({ time: new Date(2026, 6, 29, 12, 0, 0) });
  await page.reload();
  await waitCard(page);
  log(`fixed date 2026-07-29 -> word of the day: "${await cardWord(page)}" (independent FNV-1a recomputation predicts "candid")`);
  log(`  label: "${await page.textContent("#wordCard .label")}"`);
  log(`  pos: "${await page.textContent("#wordCard .pos")}" def: "${(await page.textContent("#wordCard .def")).slice(0, 60)}..."`);
  log(`  origin: "${(await page.textContent("#wordCard .origin")).slice(0, 70)}..."`);

  /* ---- same date = same word ---- */
  await page.reload();
  await waitCard(page);
  log(`same-date reload -> "${await cardWord(page)}" (deterministic repeat)`);

  /* ---- "Another word" with stubbed randomness ---- */
  await page.evaluate(() => { Math.random = () => 0.5; });
  await page.click("#anotherBtn");
  log(`"Another word" with Math.random stubbed to 0.5 -> "${await cardWord(page)}" (predicts "anthology", index 187 of 374)`);

  /* ---- "Today's word" returns to the daily pick ---- */
  await page.click("#todayBtn");
  log(`"Today's word" -> "${await cardWord(page)}" (back to the 2026-07-29 word)`);

  /* ---- ONE live dictionaryapi.dev lookup: "candid" ---- */
  await page.click("#fullerBtn");
  await fullerDone(page);
  const phon = await page.evaluate(() => {
    const p = document.querySelector("#fuller .phon");
    return p ? p.textContent : "(no phonetic)";
  });
  const sense = await page.evaluate(() => {
    const s = document.querySelector("#fuller .sense");
    return s ? s.textContent.slice(0, 100) : "(no sense rendered: " + document.getElementById("fuller").textContent.trim() + ")";
  });
  log(`LIVE lookup "candid" -> phonetic: "${phon}"`);
  log(`  first sense: "${sense}..."`);
  const env = await page.evaluate(() => {
    const raw = localStorage.getItem("suite.cache.word.candid");
    if (!raw) return null;
    const e = JSON.parse(raw);
    return { t: e.t, entries: Array.isArray(e.v) ? e.v.length : "not-array", word: e.v && e.v[0] && e.v[0].word };
  });
  log(`  cache envelope suite.cache.word.candid: ${JSON.stringify(env)}`);

  /* ---- "words I've met": content + persistence across reload ---- */
  const met1 = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.word.met")));
  log(`suite.word.met after visits: ${JSON.stringify(met1)}`);
  await page.reload();
  await waitCard(page);
  const met2 = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.word.met")));
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll("#metList .met-chip")].map(c => c.textContent));
  log(`after reload — met persisted: ${JSON.stringify(met2)}; chips: [${chips.join(", ")}]; count badge: "${await page.textContent("#metCount")}"`);
  await page.click('#metList .met-chip[data-w="anthology"]');
  log(`met chip "anthology" click -> card shows "${await cardWord(page)}"`);

  /* ---- next date = next word ---- */
  await page.clock.setFixedTime(new Date(2026, 6, 30, 12, 0, 0));
  await page.click("#todayBtn");
  log(`clock advanced to 2026-07-30, "Today's word" -> "${await cardWord(page)}" (independent recomputation predicts "tundra")`);

  /* ---- lookup-failure path: route-abort, NO cache -> designed embedded state ---- */
  const apiRoute = u => u.href.includes("api.dictionaryapi.dev");
  await page.route(apiRoute, r => r.abort());
  await page.click("#fullerBtn"); // "tundra" has no cache entry
  await fullerDone(page);
  log(`route-abort (no cache) -> designed state note: "${(await page.textContent("#fuller .fetchnote")).trim()}"`);
  log(`  embedded card still stands — def: "${(await page.textContent("#wordCard .def")).slice(0, 50)}..." origin: "${(await page.textContent("#wordCard .origin")).slice(0, 50)}..."`);
  await page.unroute(apiRoute);

  /* ---- stale-cache offline path (batchB-common): back-date 48 h > 24 h TTL ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now() - 48 * 60 * 60 * 1000;
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.click('#metList .met-chip[data-w="candid"]');
  await page.click("#fullerBtn");
  await fullerDone(page);
  const staleNote = await page.evaluate(() =>
    [...document.querySelectorAll("#fuller .fetchnote")].map(n => n.textContent.trim()).join(" | "));
  const staleSense = await page.evaluate(() => {
    const s = document.querySelector("#fuller .sense");
    return s ? s.textContent.slice(0, 60) : "(no cached sense rendered)";
  });
  log(`offline + stale cache -> cached sense renders: "${staleSense}..."`);
  log(`  stale note: "${staleNote}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* ---- Phase 4 adversarial escaping probe (element context) ----
     route-FULFIL a hostile dictionaryapi.dev payload: markup injection in every
     rendered field (phonetic, partOfSpeech, definition, example) plus
     javascript: sourceUrls/audio (never rendered by the tool — proven inert
     here). No live traffic; must throw if anything executes or materializes. */
  const HOSTILE = {
    word: "anthology",
    phonetic: '<img src=x onerror="window.__xss=1">',
    phonetics: [{ text: '<svg onload="window.__xss=2">', audio: "javascript:window.__xss=3" }],
    sourceUrls: ["javascript:window.__xss=4"],
    meanings: [{
      partOfSpeech: "<script>window.__xss=5<\/script>",
      definitions: [{
        definition: '"><iframe srcdoc="<script>parent.__xss=6<\/script>"></iframe>',
        example: '" onmouseover="window.__xss=7',
      }],
    }],
  };
  await page.route(apiRoute, r => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify([HOSTILE]) }));
  await page.evaluate(() => { Math.random = () => 0.5; }); // reload above cleared the stub
  await page.click("#anotherBtn");                          // -> "anthology" (no cache entry)
  await page.click("#fullerBtn");
  await fullerDone(page);
  const probe1 = await page.evaluate(() => ({
    xss: window.__xss === undefined ? null : window.__xss,
    injectedEls: document.querySelectorAll("#fuller img, #fuller svg, #fuller script, #fuller iframe, #fuller a").length,
    hostileAttrs: [...document.querySelectorAll("#fuller *")].filter(el =>
      [...el.attributes].some(a => a.name.startsWith("on") || /^\s*javascript:/i.test(a.value))).length,
    phonText: (document.querySelector("#fuller .phon") || {}).textContent || "",
    senseText: (document.querySelector("#fuller .sense") || {}).textContent || "",
  }));
  if (probe1.xss !== null || probe1.injectedEls || probe1.hostileAttrs ||
      !probe1.phonText.includes("<img src=x") || !probe1.senseText.includes('"><iframe'))
    throw new Error("ADVERSARIAL PROBE (element context) FAILED: " + JSON.stringify(probe1));
  log(`ADVERSARIAL fulfil (hostile definitions + javascript: sourceUrls) -> inert: __xss=${probe1.xss}, injected els=${probe1.injectedEls}, on*/javascript: attrs=${probe1.hostileAttrs}`);
  log(`  hostile markup rendered as text — phon: "${probe1.phonText.slice(0, 40)}..." sense: "${probe1.senseText.slice(0, 60)}..."`);
  await page.unroute(apiRoute);
  // scrub the hostile cache envelope so it can't taint later evidence/snapshots
  await page.evaluate(() => localStorage.removeItem("suite.cache.word.anthology"));

  /* ---- Phase 4 adversarial escaping probe (attribute context) ----
     hostile word in suite.word.met (localStorage is user-influenced): the
     met chip interpolates it into data-w="..." — a quote-escape must hold. */
  const EVIL = '"><img src=x onerror=window.__xss=8>';
  await page.evaluate(w => {
    const m = JSON.parse(localStorage.getItem("suite.word.met") || "[]");
    m.unshift(w); localStorage.setItem("suite.word.met", JSON.stringify(m));
  }, EVIL);
  await page.reload();          // fresh window.__xss; boot renders the met list
  await waitCard(page);
  const probe2 = await page.evaluate(w => ({
    xss: window.__xss === undefined ? null : window.__xss,
    injectedImgs: document.querySelectorAll("#metList img").length,
    chipIntact: [...document.querySelectorAll("#metList .met-chip")]
      .some(c => c.dataset.w === w && c.textContent === w),
  }), EVIL);
  if (probe2.xss !== null || probe2.injectedImgs || !probe2.chipIntact)
    throw new Error("ADVERSARIAL PROBE (attribute context) FAILED: " + JSON.stringify(probe2));
  log(`ADVERSARIAL met-list word (data-w attribute context) -> inert: __xss=${probe2.xss}, injected imgs=${probe2.injectedImgs}, chip attribute round-trips intact=${probe2.chipIntact}`);
  await page.screenshot({ path: `${evidenceDir}/hostile-probe.png`, fullPage: true });
  // restore the met list so remaining evidence stays representative
  await page.evaluate(w => {
    const m = JSON.parse(localStorage.getItem("suite.word.met") || "[]").filter(x => x !== w);
    localStorage.setItem("suite.word.met", JSON.stringify(m));
  }, EVIL);
  await page.reload();
  await waitCard(page);

  /* ---- restore a fresh-cache view for the after shot (no refetch) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now();
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.click('#metList .met-chip[data-w="candid"]');
  await page.click("#fullerBtn");
  await fullerDone(page);
  log(`restored (fresh cache, served without refetch): "${await cardWord(page)}" fuller present: ${await page.evaluate(() => !!document.querySelector("#fuller .more"))}`);
}

/* v1 writes suite.theme (harness toggle) and suite.word.met on plain load — the same
   key set v2 uses. v2 additionally writes suite.cache.word.* (policy-mandated caching,
   API-AND-RELAY.md §2); that key is explained in report.md, so no v1Interact needed. */
