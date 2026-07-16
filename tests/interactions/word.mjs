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
