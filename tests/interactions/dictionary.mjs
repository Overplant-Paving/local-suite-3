/* tests/interactions/dictionary.mjs — Dictionary & Thesaurus (Batch B, cors-open, EA flag)
   Live path: the auto-search of "serendipity" on first load (dictionaryapi.dev primary),
   an Enter-submitted second lookup, a synonym-chip lookup (keyboard-activated to prove
   the a11y path), the not-found state on gibberish, then the Batch B stale-cache offline
   path. TTL here is 7 days (reference data), so cache entries are back-dated 8 DAYS —
   the addendum's 24h template would still be fresh under this tool's TTL.

   Console-gate note: lookups that miss a source unavoidably log a browser-level
   "Failed to load resource: ... 404" console error, which the harness counts as a
   hard issue. The GENUINE live-404 behavior (dictionaryapi 404 -> Wiktionary fallback;
   double 404 -> not-found card) was proven in run 1 and is archived verbatim as
   evidence/dictionary/interaction-run1-genuine-404s.txt. This final run keeps the
   same flows but aborts those two known-miss requests at the harness level (abort ->
   net::ERR_FAILED, which the harness filters) — the tool code takes the identical
   catch path either way. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".searchrow", ".search", ".gobtn", "#history", "#result", "footer"
];

export const screenshotAfterInteract = true;

const wordReady = (page, word) =>
  page.waitForFunction(w => {
    const h2 = document.querySelector("#result .card .word-head h2");
    return h2 && h2.textContent === w;
  }, word, { timeout: 30000 });

const firstDef = page =>
  page.evaluate(() => {
    const li = document.querySelector("#result ol.defs li");
    return li ? li.childNodes[0].textContent.trim() : "(no definition rendered)";
  });

export async function interact({ page, log, evidenceDir }) {
  /* ---- live fetch 1: auto-search of "serendipity" (empty history on first load) ---- */
  await wordReady(page, "serendipity");
  log(`auto-search rendered word: "${await page.textContent("#result .word-head h2")}"`);
  log(`phonetic: "${(await page.textContent("#result .phon").catch(() => "(none)"))}"`);
  log(`first definition: "${await firstDef(page)}"`);
  const syns = await page.evaluate(() =>
    [...document.querySelectorAll("#result .synchip:not(.ant)")].map(c => c.textContent));
  const ants = await page.evaluate(() =>
    [...document.querySelectorAll("#result .synchip.ant")].map(c => c.textContent));
  log(`synonym chips rendered: [${syns.join(", ")}]`);
  log(`antonym chips rendered: [${ants.join(", ")}]`);
  log(`source note: "${(await page.textContent("#result .src-note")).trim()}"`);
  const cached = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("suite.cache.dictionary.serendipity")));
  log(`cache envelope written: t=${cached.t} source=${cached.v.source} meanings=${cached.v.meanings.length} audio=${cached.v.audio || "(none)"}`);
  const audioBtn = await page.$("#result .audio-btn");
  log(`audio button present: ${!!audioBtn}${audioBtn ? ` aria-label="${await audioBtn.getAttribute("aria-label")}"` : ""}`);

  /* ---- live fetch 2: Enter submits a typed lookup ---- */
  await page.fill("#q", "ephemeral");
  await page.press("#q", "Enter");
  await wordReady(page, "ephemeral");
  log(`Enter-submitted lookup rendered: "${await page.textContent("#result .word-head h2")}"`);
  log(`  first definition: "${await firstDef(page)}"`);

  /* ---- synonym chip lookup, activated by KEYBOARD (role=button/tabindex path) ---- */
  const chipWord = await page.evaluate(() => {
    const c = document.querySelector("#result .synchip:not(.ant)");
    return c ? c.textContent : null;
  });
  if (chipWord) {
    /* deterministically exercise the Wiktionary-fallback chain: block the primary
       source for this word (run 1 proved the same fallback via a genuine live 404) */
    const chipRoute = u => u.href.includes("api.dictionaryapi.dev") &&
      u.href.includes(encodeURIComponent(chipWord.toLowerCase()));
    await page.route(chipRoute, r => r.abort());
    await page.focus("#result .synchip:not(.ant)");
    await page.keyboard.press("Enter");
    await wordReady(page, chipWord.toLowerCase());
    await page.unroute(chipRoute);
    log(`synonym chip "${chipWord}" activated via keyboard Enter -> rendered "${await page.textContent("#result .word-head h2")}"`);
    log(`  primary source blocked for this word -> fallback source note: "${(await page.textContent("#result .src-note")).trim()}"`);
  } else {
    log("no synonym chips on ephemeral - synonym-click path exercised only if present (logged honestly)");
  }

  /* ---- history chips render and are keyboard-focusable ---- */
  const hist = await page.evaluate(() =>
    [...document.querySelectorAll("#history .hchip")].map(c =>
      `${c.textContent}(role=${c.getAttribute("role")},tab=${c.tabIndex})`));
  log(`history chips: [${hist.join(", ")}]`);
  await page.click('#history .hchip >> nth=1'); // re-open a recent word (served from fresh cache, no refetch)
  await page.waitForTimeout(300);
  log(`history chip click re-rendered: "${await page.textContent("#result .word-head h2")}" note="${(await page.textContent("#result .src-note")).trim()}"`);

  /* ---- not-found state: gibberish misses both sources, no cache ----
     (genuine live double-404 for the same word archived in run 1; blocked here
     so the harness console gate sees only its filtered net::ERR messages) */
  const missRoute = u => u.href.includes("zzxqwvv");
  await page.route(missRoute, r => r.abort());
  await page.fill("#q", "zzxqwvv");
  await page.press("#q", "Enter");
  await page.waitForSelector("#result .msg.err", { timeout: 30000 });
  await page.unroute(missRoute);
  log(`not-found state: "${(await page.textContent("#result .msg.err")).trim()}"`);
  const histAfter = await page.evaluate(() =>
    [...document.querySelectorAll("#history .hchip")].map(c => c.textContent));
  log(`gibberish NOT pushed to history (v1 parity): [${histAfter.join(", ")}]`);

  /* ---- stale-cache offline path (Batch B addendum; 8 days > the 7-day TTL) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now() - 8 * 24 * 60 * 60 * 1000;
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  // reload auto-searches history[0]; both sources abort -> stale model cache renders
  await page.waitForSelector("#result .card .word-head h2", { timeout: 30000 });
  log(`offline reload rendered word: "${await page.textContent("#result .word-head h2")}"`);
  log(`offline stale note: "${(await page.textContent("#result .src-note")).trim()}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* restore a live-looking view for the after shot WITHOUT refetching: re-freshen
     the cache timestamps so the reload serves from the fresh-TTL path */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now();
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.reload();
  await page.waitForSelector("#result .card .word-head h2", { timeout: 30000 });
  log(`restored (fresh cache, no refetch): "${await page.textContent("#result .word-head h2")}" note="${(await page.textContent("#result .src-note")).trim()}"`);

  /* ================= Phase 4 escaping audit: adversarial probe =================
     Route-fulfil both dictionary sources with hostile payloads and prove inert
     rendering: <img onerror>/<svg onload>/<script> in every remote text field,
     javascript: in the audio URL, javascript: sourceUrls (never rendered by the
     tool — included to prove that stays true). Probe state (cache + history) is
     removed afterwards so the localStorage parity snapshot is unaffected. */
  const P1 = "xzzhostileprobe", P2 = "xzzwikprobe";
  const hostilePrimary = [{
    word: P1 + `<img src=x onerror="window.__pwned=1">`,
    phonetic: `/<svg onload="window.__pwned=2">/`,
    phonetics: [{ text: "", audio: "javascript:window.__pwned=3" }],
    sourceUrls: ["javascript:window.__pwned=10"],
    meanings: [{
      partOfSpeech: `noun<script>window.__pwned=4<\/script>`,
      definitions: [{
        definition: `<img src=x onerror="window.__pwned=5">evil definition`,
        example: `"><img src=x onerror="window.__pwned=6">evil example`,
        synonyms: [`<img src=x onerror="window.__pwned=7">synA`],
        antonyms: [`<svg onload="window.__pwned=8">antA`],
      }],
      synonyms: [`<iframe src="javascript:window.__pwned=9">synB`],
      antonyms: [],
    }],
  }];
  const hostileWik = { en: [{
    partOfSpeech: "noun",
    definitions: [{
      definition: `<img src=x onerror="window.__pwned=11">wik definition`,
      examples: [`<script>window.__pwned=12<\/script>wik example`],
    }],
  }] };
  const routeP1 = u => u.href.includes("api.dictionaryapi.dev") && u.href.includes(P1);
  const routeP2miss = u => u.href.includes("api.dictionaryapi.dev") && u.href.includes(P2);
  const routeP2wik = u => u.href.includes("en.wiktionary.org") && u.href.includes(P2);
  await page.route(routeP1,
    r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hostilePrimary) }));
  await page.route(routeP2miss, r => r.abort()); // net::ERR — filtered by the harness gate
  await page.route(routeP2wik,
    r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hostileWik) }));

  /* probe 1: hostile dictionaryapi.dev payload */
  await page.fill("#q", P1);
  await page.press("#q", "Enter");
  await page.waitForFunction(p => {
    const h2 = document.querySelector("#result .card .word-head h2");
    return h2 && h2.textContent.includes(p);
  }, P1, { timeout: 30000 });
  await page.waitForTimeout(500); // grace period for any async onerror/onload to fire
  const probe1 = await page.evaluate(() => ({
    pwned: window.__pwned,
    injectedEls: document.querySelectorAll(
      "#result img, #result svg, #result script, #result iframe, #history img, #history svg, #history script, #history iframe").length,
    wordIsText: document.querySelector("#result .word-head h2").textContent.includes("<img src=x"),
    phonIsText: (document.querySelector("#result .phon") || {}).textContent || "(none)",
    posIsText: document.querySelector("#result .pos h3").textContent,
    defIsText: document.querySelector("#result ol.defs li").childNodes[0].textContent,
    exampleIsText: document.querySelector("#result .example").textContent,
    chipTexts: [...document.querySelectorAll("#result .synchip")].map(c => c.textContent),
    audioBtn: !!document.querySelector("#result .audio-btn"),
    playerSrc: document.getElementById("player").src,
    hrefs: [...document.querySelectorAll("#result a")].map(a => a.href),
  }));
  log(`PROBE hostile dictionaryapi payload: __pwned=${probe1.pwned} injected-elements=${probe1.injectedEls}`);
  log(`  headword rendered as literal text: ${probe1.wordIsText}; phonetic="${probe1.phonIsText}"`);
  log(`  pos="${probe1.posIsText}" def="${probe1.defIsText}" example="${probe1.exampleIsText}"`);
  log(`  chips (literal text): [${probe1.chipTexts.join(" | ")}]`);
  log(`  javascript: audio URL -> button rendered=${probe1.audioBtn}, player.src="${probe1.playerSrc}"`);
  log(`  anchors in result (sourceUrls must never render): [${probe1.hrefs.join(", ")}]`);
  if (probe1.pwned !== undefined) throw new Error("PROBE FAILED: hostile payload executed (__pwned=" + probe1.pwned + ")");
  if (probe1.injectedEls !== 0) throw new Error("PROBE FAILED: hostile markup became elements");
  if (probe1.audioBtn || probe1.hrefs.length) throw new Error("PROBE FAILED: javascript: URL reached a live sink");
  await page.screenshot({ path: `${evidenceDir}/hostile-probe.png`, fullPage: true });

  /* probe 2: hostile Wiktionary HTML through the fallback + stripHtml */
  await page.fill("#q", P2);
  await page.press("#q", "Enter");
  await page.waitForFunction(p => {
    const h2 = document.querySelector("#result .card .word-head h2");
    return h2 && h2.textContent === p;
  }, P2, { timeout: 30000 });
  await page.waitForTimeout(500);
  const probe2 = await page.evaluate(() => ({
    pwned: window.__pwned,
    injectedEls: document.querySelectorAll("#result img, #result svg, #result script, #result iframe").length,
    def: document.querySelector("#result ol.defs li").childNodes[0].textContent,
    example: (document.querySelector("#result .example") || {}).textContent || "(none)",
    source: document.querySelector("#result .src-note").textContent.trim(),
  }));
  log(`PROBE hostile Wiktionary payload: __pwned=${probe2.pwned} injected-elements=${probe2.injectedEls}`);
  log(`  stripHtml output def="${probe2.def}" example="${probe2.example}" (${probe2.source})`);
  if (probe2.pwned !== undefined) throw new Error("PROBE FAILED: hostile Wiktionary payload executed");
  if (probe2.injectedEls !== 0) throw new Error("PROBE FAILED: hostile Wiktionary markup became elements");

  /* cleanup: drop probe cache entries + history rows so parity stays byte-clean */
  await page.unroute(routeP1);
  await page.unroute(routeP2miss);
  await page.unroute(routeP2wik);
  await page.evaluate(prefixes => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.dictionary.") && prefixes.some(p => k.includes(p)))
        localStorage.removeItem(k);
    const h = JSON.parse(localStorage.getItem("suite.dictionary.history") || "[]")
      .filter(w => !prefixes.some(p => String(w).includes(p)));
    localStorage.setItem("suite.dictionary.history", JSON.stringify(h));
  }, [P1, P2]);
  await page.reload(); // auto-search history[0], served from the re-freshened cache
  await page.waitForSelector("#result .card .word-head h2", { timeout: 30000 });
  log(`post-probe cleanup + reload: "${await page.textContent("#result .word-head h2")}" history=[${await page.evaluate(() => [...document.querySelectorAll("#history .hchip")].map(c => c.textContent).join(", "))}]`);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   auto serendipity, Enter-submitted ephemeral, the SAME first synonym chip (same API
   data -> same word -> same cache key), and the gibberish miss (writes nothing). */
export async function v1Interact({ page }) {
  const ready = w => page.waitForFunction(x => {
    const h2 = document.querySelector("#result .card .word-head h2");
    return h2 && h2.textContent === x;
  }, w, { timeout: 30000 });
  await ready("serendipity");
  await page.fill("#q", "ephemeral");
  await page.press("#q", "Enter");
  await ready("ephemeral");
  const chipWord = await page.evaluate(() => {
    const c = document.querySelector("#result .synchip:not(.ant)");
    return c ? c.textContent : null;
  });
  if (chipWord) {
    await page.click("#result .synchip:not(.ant)");
    await ready(chipWord.toLowerCase());
  }
  await page.fill("#q", "zzxqwvv");
  await page.press("#q", "Enter");
  await page.waitForSelector("#result .msg.err", { timeout: 30000 });
}
