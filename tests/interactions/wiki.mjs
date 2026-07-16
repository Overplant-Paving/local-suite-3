/* tests/interactions/wiki.mjs — Wikipedia Reader (Batch B, cors-open, EA flag)
   Live path: the auto-opened "Wikipedia" summary (title + extract + thumbnail from
   upload.wikimedia.org), the featured-today and on-this-day feeds, one typeahead
   suggestion fetch, a direct summary lookup (Ada Lovelace) saved to the reading list,
   and one Random roll. Then the Batch B stale-cache offline path: back-date every
   suite.cache.* entry, abort all http(s), reload — the saved article + both feeds must
   render their "Offline — cached from <time>" states, not a blank page.

   localStorage parity note: both versions cache the Random roll under
   suite.cache.wiki.s:<random title>, so keysOnlyInV1/V2 each contain exactly one key
   whose name is random by nature — explained in report.md. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".search", ".btn.primary", ".card", ".side h3", "footer"
];

export const screenshotAfterInteract = true;

const articleReady = page => page.waitForFunction(() =>
  document.querySelector("#article .article h2") ||
  document.querySelector("#article .msg.err"), { timeout: 25000 });

const articleTitled = (page, title) => page.waitForFunction(t => {
  const h = document.querySelector("#article .article h2");
  return h && h.textContent === t;
}, title, { timeout: 25000 });

export async function interact({ page, log, evidenceDir }) {
  /* ---- live fetch 1: summary (auto-opened "Wikipedia") ---- */
  await articleReady(page);
  log(`initial article h2: "${(await page.textContent("#article .article h2")).trim()}"`);
  log(`  extract (first 140 chars): "${(await page.textContent("#article .article .extract")).slice(0, 140).replace(/\s+/g, " ")}…"`);

  /* article thumbnail — proves the upload.wikimedia.org img-src host loads */
  const imgInfo = await page.evaluate(async () => {
    const img = document.querySelector("#article img.thumb");
    if (!img) return null;
    if (!img.complete) await new Promise(res => {
      img.addEventListener("load", res); img.addEventListener("error", res);
      setTimeout(res, 10000);
    });
    return { src: img.currentSrc || img.src, w: img.naturalWidth, h: img.naturalHeight };
  });
  log(imgInfo
    ? `thumbnail: ${new URL(imgInfo.src).host} → natural ${imgInfo.w}x${imgInfo.h}px ${imgInfo.w > 0 ? "(loaded)" : "(FAILED to load)"}`
    : "thumbnail: none in this summary");

  /* ---- live fetch 2 + 3: featured today + on this day ---- */
  await page.waitForFunction(() =>
    document.querySelector("#featured .featured-mini") ||
    document.querySelector("#featured .empty-side"), { timeout: 25000 });
  log(`featured today: "${(await page.textContent("#featured")).replace(/\s+/g, " ").trim().slice(0, 160)}"`);

  await page.waitForFunction(() =>
    document.querySelector("#onthisday .feeditem") ||
    document.querySelector("#onthisday .empty-side"), { timeout: 25000 });
  const otd = await page.evaluate(() =>
    [...document.querySelectorAll("#onthisday .feeditem")].slice(0, 2)
      .map(d => d.textContent.replace(/\s+/g, " ").trim().slice(0, 120)));
  log(`on this day: ${otd.length ? otd.length + " visible items" : "empty state"}`);
  otd.forEach(t => log(`  otd item: "${t}"`));

  /* ---- live fetch 4: typeahead suggestions ---- */
  await page.fill("#q", "Ada Lovelace");
  try {
    await page.waitForFunction(() =>
      !document.getElementById("suggest").hidden &&
      document.querySelectorAll("#suggest > div").length > 0, { timeout: 10000 });
    const sugg = await page.evaluate(() =>
      [...document.querySelectorAll("#suggest > div")].map(d => d.querySelector("span").textContent));
    log(`suggestions for "Ada Lovelace": ${sugg.length} shown, first: "${sugg[0]}"`);
  } catch (e) {
    log(`suggestions: none rendered within 10 s (search endpoint slow/down?) — continuing`);
  }
  /* Esc closes the overlay (a11y check). Note: Escape in an <input type=search> also
     natively clears the value, so we re-type before submitting. */
  await page.press("#q", "Escape");
  log(`suggest hidden after Escape: ${await page.evaluate(() => document.getElementById("suggest").hidden)}`);

  /* ---- live fetch 5: direct summary lookup, submitted with Enter ---- */
  await page.fill("#q", "Ada Lovelace");
  await page.waitForFunction(() =>
    !document.getElementById("suggest").hidden &&
    document.querySelectorAll("#suggest > div").length > 0, { timeout: 10000 })
    .catch(() => {});   /* wait out the debounce either way */
  await page.press("#q", "Enter");   /* no active item -> opens the typed title */
  await articleTitled(page, "Ada Lovelace");
  log(`opened via Search: h2="${(await page.textContent("#article .article h2")).trim()}", desc="${(await page.textContent("#article .article .desc")).trim()}"`);
  log(`  extract (first 140 chars): "${(await page.textContent("#article .article .extract")).slice(0, 140).replace(/\s+/g, " ")}…"`);

  /* ---- reading list: save, verify the key ---- */
  await page.click("#article .article .actions button");
  log(`save button now reads: "${(await page.textContent("#article .article .actions button")).trim()}"`);
  log(`suite.wiki.readlist = ${await page.evaluate(() => localStorage.getItem("suite.wiki.readlist"))}`);
  log(`reading-list panel: "${(await page.textContent("#readlist")).replace(/\s+/g, " ").trim()}"`);

  /* ---- live fetch 6: the Random button (one roll) ---- */
  await page.click("#rand");
  await page.waitForFunction(() => {
    const h = document.querySelector("#article .article h2");
    return h && h.textContent && h.textContent !== "Ada Lovelace";
  }, { timeout: 25000 });
  const randTitle = (await page.textContent("#article .article h2")).trim();
  log(`random roll: h2="${randTitle}"`);
  log(`  cached as suite.cache.wiki.s:<title>: ${await page.evaluate(t =>
    localStorage.getItem("suite.cache.wiki.s:" + t) !== null, randTitle)}`);

  /* ---- stale-cache offline path (Batch B addendum) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now() - 24 * 60 * 60 * 1000;
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  /* init reopens readlist[0] = "Ada Lovelace" from the back-dated cache */
  await articleReady(page);
  const staleDescs = await page.evaluate(() =>
    [...document.querySelectorAll("#article .article .desc")].map(d => d.textContent.trim()));
  log(`offline stale article: h2="${(await page.textContent("#article .article h2")).trim()}"`);
  log(`  stale line: "${staleDescs[staleDescs.length - 1]}"`);
  await page.waitForFunction(() =>
    document.querySelector("#featured .featured-mini, #featured .empty-side"), { timeout: 25000 });
  log(`offline featured panel: "${(await page.textContent("#featured")).replace(/\s+/g, " ").trim().slice(0, 160)}"`);
  const otdStale = await page.evaluate(() => {
    const notes = [...document.querySelectorAll("#onthisday .empty-side")];
    return {
      items: document.querySelectorAll("#onthisday .feeditem").length,
      note: notes.length ? notes[notes.length - 1].textContent.trim() : "(none)"
    };
  });
  log(`offline on-this-day: ${otdStale.items} items from cache, note: "${otdStale.note}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* restore a live-looking view for the after-interaction shot WITHOUT refetching:
     re-freshen the cache timestamps so the reload serves fresh-from-cache */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith("suite.cache.")) {
        const e = JSON.parse(localStorage.getItem(k));
        e.t = Date.now();
        localStorage.setItem(k, JSON.stringify(e));
      }
  });
  await page.reload();
  await articleReady(page);
  log(`restored (fresh cache, no refetch): h2="${(await page.textContent("#article .article h2")).trim()}"`);

  /* ---- Phase 4 adversarial escaping probe ----
     Route-fulfil the summary endpoint with a hostile payload: script/onerror markup in
     every text field (including extract_html, which the tool must never render),
     javascript: URLs in thumbnail.source and content_urls.desktop.page. Prove:
     (1) markup renders inert as literal text, (2) no element is ever created from
     remote strings, (3) the Read-full-article href is scheme-guarded, (4) no payload
     executes (alert/confirm/prompt trapped + harness pageerror listener). */
  await page.evaluate(() => {
    window.__xssFired = false;
    for (const f of ["alert", "confirm", "prompt"]) window[f] = () => { window.__xssFired = true; };
  });
  const HOSTILE = {
    title: "Escape Probe",
    displaytitle: "<script>window.__xssFired=true</scr" + "ipt>Escape Probe",
    description: "<img src=x onerror=\"window.__xssFired=true\"> hostile description",
    extract: "<script>window.__xssFired=true</scr" + "ipt><img src=x onerror=\"window.__xssFired=true\"> plain-field payload",
    extract_html: "<p><script>window.__xssFired=true</scr" + "ipt><img src=x onerror=\"window.__xssFired=true\"> rich-field payload</p>",
    thumbnail: { source: "javascript:window.__xssFired=true" },
    content_urls: { desktop: { page: "javascript:window.__xssFired=true" } }
  };
  await page.context().route("**/api/rest_v1/page/summary/**", r => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(HOSTILE)
  }));
  await page.evaluate(() => openArticle("Escape Probe"));
  await articleTitled(page, "Escape Probe");
  await page.waitForTimeout(500);   /* let any onerror/img fallout settle */
  const probe = await page.evaluate(() => {
    const extract = document.querySelector("#article .article .extract");
    const a = document.querySelector("#article .article .actions a");
    return {
      h2: document.querySelector("#article .article h2").textContent,
      extractText: extract.textContent,
      extractElementChildren: extract.children.length,
      injectedNodes: document.querySelectorAll(
        "#article script, #article .extract img, #article .desc img").length,
      readHref: a ? a.href : "(missing)",
      thumbCount: document.querySelectorAll("#article img.thumb").length,
      xssFired: window.__xssFired
    };
  });
  log(`escape probe: h2="${probe.h2}"`);
  log(`  extract rendered as literal text: ${probe.extractText.includes("<script>") && probe.extractText.includes("onerror")} (element children: ${probe.extractElementChildren}, injected script/img nodes: ${probe.injectedNodes})`);
  log(`  read-link href (javascript: supplied): "${probe.readHref}" — scheme-guarded: ${probe.readHref.startsWith("https://en.wikipedia.org/wiki/")}`);
  log(`  javascript: thumbnail imgs remaining: ${probe.thumbCount}`);
  log(`  payload executed (alert/confirm/prompt trap): ${probe.xssFired}`);
  if (probe.xssFired || probe.injectedNodes > 0 || probe.extractElementChildren > 0 ||
      !probe.readHref.startsWith("https://en.wikipedia.org/wiki/"))
    throw new Error("ESCAPE PROBE FAILED: hostile payload was not rendered inert");
  await page.screenshot({ path: `${evidenceDir}/escape-probe.png`, fullPage: true });

  /* cleanup: unroute, drop the probe's cache entry (keeps localStorage parity clean),
     and restore the Ada Lovelace view from fresh cache (no refetch) */
  await page.context().unroute("**/api/rest_v1/page/summary/**");
  await page.evaluate(() => localStorage.removeItem("suite.cache.wiki.s:Escape Probe"));
  await page.evaluate(() => openArticle("Ada Lovelace"));
  await articleTitled(page, "Ada Lovelace");
  log(`post-probe restore: h2="${(await page.textContent("#article .article h2")).trim()}"`);
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   auto-open writes s:Wikipedia + feat: + otd:, Search writes s:Ada Lovelace, save
   writes suite.wiki.readlist, Random writes s:<its own random title>. */
export async function v1Interact({ page }) {
  await page.waitForFunction(() =>
    document.querySelector("#article .article h2"), { timeout: 25000 });
  await page.fill("#q", "Ada Lovelace");
  await page.click("#go");
  await page.waitForFunction(() => {
    const h = document.querySelector("#article .article h2");
    return h && h.textContent === "Ada Lovelace";
  }, { timeout: 25000 });
  await page.click("#article .article .actions button");
  await page.click("#rand");
  await page.waitForFunction(() => {
    const h = document.querySelector("#article .article h2");
    return h && h.textContent && h.textContent !== "Ada Lovelace";
  }, { timeout: 25000 });
}
