/* tests/interactions/books.mjs — Book & Library Lookup (Batch B, cors-open)
   Live path: one real Open Library search ("The Left Hand of Darkness") with a cover
   load proven, add/remove/re-add on the read-next list (v1 key suite.books.readnext),
   one real ISBN lookup (9780441172719, Dune — now cached via Suite.fetchJSON), export
   (empty-list message + real TSV download), persistence across reload.
   Then the Batch B stale-cache offline path. NOTE: this tool's TTL is 7 days
   (reference-data class, cacheTtlMin 10080), so the addendum's standard 24 h back-date
   would NOT expire the cache — entries are back-dated 8 DAYS to force the
   expired-cache + network-down stale render. The aborted cover requests double as the
   proof that the converted onerror-listener fallback works (placeholders appear). */

export const selectors = [
  "body", ".topbar", ".suite-link", ".theme-btn", "header h1", "header .tag",
  ".search", ".mode.on", "#status", "section.saved h2", "#savedEmpty", "footer"
];

export const screenshotAfterInteract = true;

const TERM = "The Left Hand of Darkness";
const ISBN = "9780441172719"; // Dune — the v1 placeholder's own example ISBN

const resultsReady = page =>
  page.waitForFunction(() => document.querySelectorAll("#results .book").length > 0, { timeout: 30000 });

export async function interact({ page, log, evidenceDir }) {
  /* ---- export with an empty list: v1's guard message ---- */
  await page.click("#exportBtn");
  log(`export (empty list): status="${(await page.textContent("#status")).trim()}"`);

  /* ---- live search (Open Library) ---- */
  await page.fill("#q", TERM);
  await page.press("#q", "Enter");
  await resultsReady(page);
  log(`search "${TERM}": status="${(await page.textContent("#status")).trim()}"`);
  log(`result cards rendered: ${await page.evaluate(() => document.querySelectorAll("#results .book").length)}`);
  const first = await page.evaluate(() => {
    const b = document.querySelector("#results .book");
    return {
      title: b.querySelector(".title").textContent,
      author: b.querySelector(".author").textContent,
      sub: b.querySelector(".sub").textContent
    };
  });
  log(`first result: title="${first.title}" author="${first.author}" sub="${first.sub}"`);

  /* cover image actually loads from covers.openlibrary.org */
  await page.waitForFunction(() => {
    const i = document.querySelector("#results .book img.cover");
    return i && i.complete && i.naturalWidth > 0;
  }, { timeout: 30000 });
  const cover = await page.evaluate(() => {
    const i = document.querySelector("#results .book img.cover");
    return { src: i.src, w: i.naturalWidth, h: i.naturalHeight };
  });
  log(`cover loaded: ${cover.src} (${cover.w}x${cover.h} natural px)`);
  const mix = await page.evaluate(() => ({
    imgs: document.querySelectorAll("#results img.cover").length,
    phs: document.querySelectorAll("#results .cover-ph").length
  }));
  log(`covers in results: ${mix.imgs} <img>, ${mix.phs} placeholder(s) (records with no cover URL)`);

  /* ---- read-next list: add, remove, re-add (v1 key suite.books.readnext) ---- */
  await page.click("#results .book .addbtn");
  log(`add: first card button now "${(await page.textContent("#results .book .addbtn")).trim()}"`);
  log(`saved: count="${(await page.textContent("#savedCount")).trim()}" item="${(await page.textContent("#savedList .saved-item .t")).replace(/\s+/g, " ").trim()}"`);
  const savedRaw = await page.evaluate(() => localStorage.getItem("suite.books.readnext"));
  log(`localStorage["suite.books.readnext"] = ${savedRaw.slice(0, 130)}…`);

  await page.click("#savedList .saved-item .rm");
  log(`remove: savedEmpty visible=${await page.isVisible("#savedEmpty")}, stored length=${await page.evaluate(() => JSON.parse(localStorage.getItem("suite.books.readnext")).length)}`);
  await page.click("#results .book .addbtn"); // v1 semantics: card button re-adds after a removal
  log(`re-add: stored length=${await page.evaluate(() => JSON.parse(localStorage.getItem("suite.books.readnext")).length)}`);

  /* ---- live ISBN lookup ---- */
  await page.click("#modeIsbn");
  log(`mode switch: placeholder="${await page.getAttribute("#q", "placeholder")}" aria-pressed=${await page.getAttribute("#modeIsbn", "aria-pressed")}`);
  await page.fill("#q", ISBN);
  await page.press("#q", "Enter");
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.indexOf("Found by ISBN") === 0, { timeout: 30000 });
  await resultsReady(page);
  log(`ISBN ${ISBN}: status="${(await page.textContent("#status")).trim()}"`);
  const ib = await page.evaluate(() => {
    const b = document.querySelector("#results .book");
    return {
      title: b.querySelector(".title").textContent,
      author: b.querySelector(".author").textContent,
      sub: b.querySelector(".sub").textContent
    };
  });
  log(`ISBN result: title="${ib.title}" author="${ib.author}" sub="${ib.sub}"`);
  const cacheKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith("suite.cache.books.")).sort());
  log(`cache keys written: ${cacheKeys.join(", ")}`);

  /* ---- export with content: real TSV download ---- */
  try {
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }),
      page.click("#exportBtn")
    ]);
    log(`export: download fired, suggested filename "${dl.suggestedFilename()}"`);
  } catch (e) {
    log(`export: download event not captured (${String(e).slice(0, 80)}) — status="${(await page.textContent("#status")).trim()}"`);
  }

  /* ---- persistence: read-next list survives a reload ---- */
  await page.reload();
  await page.waitForTimeout(500);
  log(`after reload: saved count="${(await page.textContent("#savedCount")).trim()}" item="${(await page.textContent("#savedList .saved-item .t")).replace(/\s+/g, " ").trim()}"`);

  /* ---- stale-cache offline path (Batch B addendum; 8-day back-date, see header) ---- */
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
  await page.waitForTimeout(500);

  /* search stale: expired cache + both sources unreachable -> v1's offline card */
  await page.fill("#q", TERM);
  await page.press("#q", "Enter");
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.indexOf("Offline") === 0, { timeout: 30000 });
  log(`offline search: status="${(await page.textContent("#status")).trim()}"`);
  log(`offline search: ${await page.evaluate(() => document.querySelectorAll("#results .book").length)} cards rendered from the stale cache`);

  /* cover fallback: aborted image loads must fire the error LISTENER (the converted
     v1 inline onerror=) and swap in the placeholder */
  await page.waitForFunction(() => document.querySelectorAll("#results .cover-ph").length > 0, { timeout: 15000 });
  const ph = await page.evaluate(() => ({
    phs: document.querySelectorAll("#results .cover-ph").length,
    imgs: document.querySelectorAll("#results img.cover").length
  }));
  log(`cover fallback (error listener): ${ph.phs} placeholder(s) swapped in, ${ph.imgs} <img> remaining`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });

  /* ISBN stale: Suite.fetchJSON serves the expired cache flagged stale */
  await page.click("#modeIsbn");
  await page.fill("#q", ISBN);
  await page.press("#q", "Enter");
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.indexOf("Offline — cached ISBN result") === 0, { timeout: 30000 });
  log(`offline ISBN: status="${(await page.textContent("#status")).trim()}"`);
  await page.context().unroute(/^https?:/);

  /* restore a live-looking view for the after-shot WITHOUT refetching JSON:
     re-freshen the cache timestamps so the search serves from cache */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now();
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.reload();
  await page.waitForTimeout(500);
  await page.fill("#q", TERM);
  await page.press("#q", "Enter");
  await resultsReady(page);
  log(`restored (fresh cache, no JSON refetch): status="${(await page.textContent("#status")).trim()}"`);
  await page.waitForTimeout(1200); // let covers paint for the after-shot
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets.
   v1 writes suite.cache.books.s:<term> (search) and suite.books.readnext (add), plus
   suite.theme via the harness toggle. The ISBN lookup is exercised on v1 too, proving
   it writes NO cache keys there — v2's suite.cache.books.isbn:… and books.author:…
   keys are the policy-mandated additions explained in report.md. */
export async function v1Interact({ page }) {
  await page.fill("#q", TERM);
  await page.press("#q", "Enter");
  await page.waitForFunction(() => document.querySelectorAll("#results .book").length > 0, { timeout: 30000 });
  await page.click("#results .book .addbtn");
  await page.click("#modeIsbn");
  await page.fill("#q", ISBN);
  await page.press("#q", "Enter");
  await page.waitForFunction(() =>
    document.getElementById("status").textContent.indexOf("Found by ISBN") === 0, { timeout: 30000 });
}
