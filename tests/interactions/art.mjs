/* tests/interactions/art.mjs — Museum Postcard (Batch B, cors-open, EA flag)
   Live paths exercised:
     1. boot on the embedded Met set — the daily pick renders and its image loads
        live from images.metmuseum.org (plain <img>, no fetch);
     2. Another / Today's pick controls; favorite an artwork (suite.art.favorites);
     3. the AIC tab — one real fetch of the weekly pool from api.artic.edu, the
        rendered work's image loads live from www.artic.edu (iiif);
     4. one search fetch (api.artic.edu /artworks/search) via the search box.
   Then the Batch B stale-cache offline path: back-date suite.cache.*, abort all
   http(s), reload, click the AIC tab — the pool must render from the stale cache
   with the "Offline — cached from <time>" label, not a blank or error card. */

export const selectors = [
  "body", ".topbar", ".suite-link", ".theme-btn", "header h1", "header .tag",
  ".tabs", ".tab", ".search", ".postcard", "section.favs h2", "footer"
];

export const screenshotAfterInteract = true;

const captionReady = page =>
  page.waitForFunction(() => !!document.querySelector("#postcard .caption h2"), { timeout: 25000 });
/* Resolves when the postcard image either loads or lands in the v1-style "couldn't
   be loaded" state, and reports which. AIC's iiif host (www.artic.edu) bot-blocks
   HEADLESS Chrome with a 403 (verified: same URL is 200 image/jpeg via curl and
   loads with naturalWidth=843 in headed Chrome — see report.md concerns), so the
   harness must tolerate the declined state without faking success. */
const imageSettled = async (page, timeout = 30000) => {
  await page.waitForFunction(() => {
    const img = document.querySelector("#postcard .frame img");
    const broken = document.querySelector("#postcard .frame .broken");
    return (img && img.complete && img.naturalWidth > 0 && img.style.display !== "none") || !!broken;
  }, { timeout });
  return page.evaluate(() => {
    const img = document.querySelector("#postcard .frame img");
    const broken = document.querySelector("#postcard .frame .broken");
    return broken ? { loaded: false, broken: broken.textContent }
                  : { loaded: true, naturalWidth: img.naturalWidth };
  });
};

async function logWork(page, log, tag) {
  const w = await page.evaluate(() => ({
    label: document.querySelector("#postcard .label")?.textContent,
    title: document.querySelector("#postcard .caption h2")?.textContent,
    artist: document.querySelector("#postcard .artist")?.textContent,
    meta: document.querySelector("#postcard .meta")?.textContent,
    src: document.querySelector("#postcard .src")?.textContent,
    imgSrc: document.querySelector("#postcard .frame img")?.src || null
  }));
  log(`${tag}: label="${w.label}" title="${w.title}" artist="${w.artist}"`);
  log(`  meta="${w.meta}" · ${w.src} · img=${w.imgSrc}`);
  return w;
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. boot: Met daily pick renders, image loads live from images.metmuseum.org ---- */
  await captionReady(page);
  const today = await logWork(page, log, "boot (Met, today's pick)");
  log(`  Met image (images.metmuseum.org): ${JSON.stringify(await imageSettled(page))}`);

  /* ---- 2. Another -> Today's pick round-trip (deterministic day hash) ---- */
  await page.click("#anotherBtn");
  await captionReady(page);
  const another = await logWork(page, log, "after Another (Met)");
  await page.click("#todayBtn");
  await captionReady(page);
  const back = await logWork(page, log, "after Today's pick");
  log(`  today's pick deterministic: same title as boot = ${back.title === today.title}`);

  /* ---- favorite the current work ---- */
  await page.click("#favBtn");
  const favState = await page.evaluate(() => ({
    btn: document.getElementById("favBtn").textContent,
    count: document.getElementById("favCount").textContent,
    items: document.querySelectorAll("#favGrid .fav-item").length,
    stored: JSON.parse(localStorage.getItem("suite.art.favorites") || "[]").map(f => f.id)
  }));
  log(`favorite toggled: btn="${favState.btn}" count="${favState.count}" grid items=${favState.items} stored ids=${JSON.stringify(favState.stored)}`);
  log(`  fav item keyboard path: role=${await page.getAttribute("#favGrid .fav-item", "role")} tabindex=${await page.getAttribute("#favGrid .fav-item", "tabindex")}`);

  /* ---- 3. AIC tab: live pool fetch from api.artic.edu ---- */
  await page.click("#tabAic");
  await captionReady(page);
  await logWork(page, log, "AIC tab (live weekly pool, today's pick)");
  const poolCache = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith("suite.cache.art.pool:"));
    if (!k) return null;
    const e = JSON.parse(localStorage.getItem(k));
    const rows = Array.isArray(e.v) ? e.v : (e.v.data || []);
    return { key: k, fetchedAt: new Date(e.t).toISOString(), records: rows.length };
  });
  log(`pool cache written: ${JSON.stringify(poolCache)}`);
  log(`  AIC iiif image (www.artic.edu, 403s under HEADLESS automation only): ${JSON.stringify(await imageSettled(page))}`);

  /* ---- 4. search: one live search fetch ---- */
  await page.fill("#q", "sunflowers");
  await page.keyboard.press("Enter"); // a11y addition: Enter fires the search immediately
  await page.waitForFunction(() => {
    const l = document.querySelector("#postcard .label");
    return (l && l.textContent.startsWith("Search:")) ||
           document.querySelector("#postcard .broken");
  }, { timeout: 25000 });
  await logWork(page, log, 'search "sunflowers"');
  const searchKey = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith("suite.cache.art.search:")));
  log(`search cache keys (policy-mandated, v2-only): ${JSON.stringify(searchKey)}`);

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
  await captionReady(page); // boots on the embedded Met set — must render offline
  await logWork(page, log, "offline reload (Met set, zero network)");
  await page.click("#tabAic"); // network aborted -> Suite.fetchJSON serves the stale pool
  await page.waitForFunction(() => {
    const l = document.querySelector("#postcard .label");
    return l && l.textContent.includes("Offline — cached from");
  }, { timeout: 25000 });
  await logWork(page, log, "offline AIC tab (stale pool)");
  await page.waitForTimeout(1200); // let the (blocked) image fetch settle for the shot
  log(`  offline frame state: "${(await page.textContent("#postcard .frame")).replace(/\s+/g, " ").trim()}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* ---- Phase 4 escaping audit: adversarial route-fulfilled payloads ----
     Isolated context (no cache/localStorage contamination of the parity run above).
     api.artic.edu pool + search responses carry hostile strings in every remote field
     the tool interpolates (title, artist_display, date_display, medium_display,
     image_id); localStorage is pre-seeded with a tampered favorite whose img is a
     javascript: URL. Every payload arms window.__pwned — the probe THROWS if any
     bit gets set or any injected node appears, so the harness cannot pass on a
     regression. Image hosts are fulfilled with a 1x1 png for determinism. */
  const ARM = bit => `window.__pwned=(window.__pwned||0)|${bit}`;
  const hostileRow = {
    id: 666001,
    title: '<img src=x onerror="' + ARM(1) + '">',
    artist_display: '"><script>' + ARM(2) + '<' + '/script>hostile artist\nsecond line dropped by split',
    date_display: '" onmouseover="' + ARM(4) + '" x="1897',
    medium_display: '<svg onload="' + ARM(8) + '">oil on hostility',
    image_id: '"><img src=x onerror="' + ARM(16) + '"',
    is_public_domain: true
  };
  const PNG1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const pctx = await page.context().browser().newContext();
  const perrs = [];
  await pctx.route(/^https:\/\/api\.artic\.edu\/api\/v1\/artworks\/search\?/, r => {
    const q = new URL(r.request().url()).searchParams.get("q") || "";
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ data: q.startsWith("emptyprobe") ? [] : [hostileRow] }) });
  });
  await pctx.route(/^https:\/\/api\.artic\.edu\/api\/v1\/artworks\?/, r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [hostileRow] }) }));
  await pctx.route(/^https:\/\/(www\.artic\.edu|images\.metmuseum\.org)\//, r =>
    r.fulfill({ status: 200, contentType: "image/png", body: PNG1x1 }));
  await pctx.addInitScript(fav => {
    localStorage.setItem("suite.theme", "light");
    localStorage.setItem("suite.art.favorites", JSON.stringify(fav));
  }, [{ id: "evil:js", source: "met", title: "tampered favorite (javascript: img)", artist: "storage tamperer",
        date: "", medium: "", img: "javascript:" + ARM(32) }]);
  const pp = await pctx.newPage();
  pp.on("pageerror", e => perrs.push("PAGEERROR: " + String(e)));
  pp.on("console", m => { if (m.type() === "error" && !m.text().includes("net::ERR")) perrs.push(m.text()); });
  await pp.goto(page.url());
  await pp.waitForFunction(() => !!document.querySelector("#postcard .caption h2"), { timeout: 20000 });

  /* probe 1: javascript:-scheme favorite from tampered storage must not reach <img src> */
  const favProbe = await pp.evaluate(() => {
    const item = document.querySelector("#favGrid .fav-item");
    const img = item && item.querySelector("img");
    return { items: document.querySelectorAll("#favGrid .fav-item").length,
             imgRendered: !!img, src: img ? img.getAttribute("src") : null,
             placeholder: !!(item && item.querySelector("div[style]")),
             cap: item ? item.querySelector(".cap b").textContent : null };
  });
  log(`escaping probe · javascript: favorite: img rendered=${favProbe.imgRendered} (scheme guard) ` +
      `placeholder=${favProbe.placeholder} cap="${favProbe.cap}"`);
  if (favProbe.imgRendered) throw new Error("ESCAPING PROBE FAILED: javascript: URL reached fav <img src>: " + favProbe.src);

  /* probe 2: hostile AIC pool record through the daily-pick postcard render */
  await pp.click("#tabAic");
  await pp.waitForFunction(() =>
    (document.querySelector("#postcard .caption h2") || {}).textContent?.includes("onerror"), { timeout: 20000 });
  const poolProbe = await pp.evaluate(() => {
    const pc = document.getElementById("postcard");
    const frameImg = pc.querySelector(".frame img");
    return {
      pwned: window.__pwned,
      scripts: pc.querySelectorAll("script").length,
      svgs: pc.querySelectorAll("svg").length,
      injected: [...pc.querySelectorAll("img")].filter(i => i.getAttribute("src") === "x").length,
      onAttrs: [...pc.querySelectorAll("*")].filter(e =>
        e.getAttribute("onerror") || e.getAttribute("onload") || e.getAttribute("onmouseover")).length,
      title: pc.querySelector("h2").textContent,
      artist: pc.querySelector(".artist").textContent,
      meta: pc.querySelector(".meta").textContent,
      frameImgSrc: frameImg ? frameImg.getAttribute("src") : null
    };
  });
  log(`escaping probe · hostile pool record: pwned=${poolProbe.pwned} scripts=${poolProbe.scripts} ` +
      `svgs=${poolProbe.svgs} injected-imgs=${poolProbe.injected} on*-attrs=${poolProbe.onAttrs}`);
  log(`  inert text: title="${poolProbe.title}" artist="${poolProbe.artist}"`);
  log(`  inert text: meta="${poolProbe.meta}"`);
  log(`  frame img src (hostile image_id stays inside the https iiif path): ${poolProbe.frameImgSrc}`);

  /* probe 3: favorite the hostile work — renderFavs grid (title/artist/img attr contexts) */
  await pp.click("#favBtn");
  const gridProbe = await pp.evaluate(() => {
    const g = document.getElementById("favGrid");
    return {
      pwned: window.__pwned,
      scripts: g.querySelectorAll("script").length,
      injected: [...g.querySelectorAll("img")].filter(i => i.getAttribute("src") === "x").length,
      onAttrs: [...g.querySelectorAll("*")].filter(e =>
        e.getAttribute("onerror") || e.getAttribute("onload") || e.getAttribute("onmouseover")).length,
      caps: [...g.querySelectorAll(".cap b")].map(b => b.textContent),
      imgSchemes: [...g.querySelectorAll("img")].map(i => (i.getAttribute("src") || "").split(":")[0])
    };
  });
  log(`escaping probe · hostile favorite in grid: pwned=${gridProbe.pwned} scripts=${gridProbe.scripts} ` +
      `injected-imgs=${gridProbe.injected} on*-attrs=${gridProbe.onAttrs} img schemes=${JSON.stringify(gridProbe.imgSchemes)}`);
  log(`  inert captions: ${JSON.stringify(gridProbe.caps)}`);

  /* probe 4: hostile user-typed search term (esc(term) in the result label) */
  const hostileTerm = '"><img src=x onerror="' + ARM(64) + '">';
  await pp.fill("#q", hostileTerm);
  await pp.keyboard.press("Enter");
  await pp.waitForFunction(() => {
    const l = document.querySelector("#postcard .label");
    return l && l.textContent.startsWith("Search:");
  }, { timeout: 20000 });
  const termProbe = await pp.evaluate(t => {
    const pc = document.getElementById("postcard");
    return { pwned: window.__pwned,
             injected: [...pc.querySelectorAll("img")].filter(i => i.getAttribute("src") === "x").length,
             labelHasLiteralTerm: pc.querySelector(".label").textContent.includes(t) };
  }, hostileTerm);
  log(`escaping probe · hostile search term in label: pwned=${termProbe.pwned} ` +
      `injected-imgs=${termProbe.injected} literal term in label=${termProbe.labelHasLiteralTerm}`);
  await pp.screenshot({ path: `${evidenceDir}/escaping-probe.png`, fullPage: true });

  /* probe 5: hostile term through the no-hits message (the other esc(term) site) */
  await pp.fill("#q", 'emptyprobe<script>' + ARM(128) + '<' + '/script>');
  await pp.keyboard.press("Enter");
  await pp.waitForFunction(() => !!document.querySelector("#postcard .broken"), { timeout: 20000 });
  const emptyProbe = await pp.evaluate(() => ({
    pwned: window.__pwned,
    scripts: document.getElementById("postcard").querySelectorAll("script").length,
    msg: document.querySelector("#postcard .broken").textContent
  }));
  log(`escaping probe · hostile term in no-hits message: pwned=${emptyProbe.pwned} scripts=${emptyProbe.scripts}`);
  log(`  inert text: "${emptyProbe.msg}"`);

  /* verdict — throw on ANY evidence of execution or injection */
  const pwnedFinal = await pp.evaluate(() => window.__pwned);
  const injections = poolProbe.scripts + poolProbe.svgs + poolProbe.injected + poolProbe.onAttrs +
    gridProbe.scripts + gridProbe.injected + gridProbe.onAttrs + termProbe.injected + emptyProbe.scripts;
  if (pwnedFinal !== undefined) throw new Error("ESCAPING PROBE FAILED: payload executed, __pwned=" + pwnedFinal);
  if (injections !== 0) throw new Error("ESCAPING PROBE FAILED: hostile markup reached the DOM (" + injections + " nodes/attrs)");
  if (!poolProbe.title.includes('<img src=x') || !termProbe.labelHasLiteralTerm)
    throw new Error("ESCAPING PROBE FAILED: hostile payload not rendered as literal text");
  log(`escaping probe verdict: INERT — __pwned=${pwnedFinal}, injected nodes/attrs=${injections}, ` +
      `probe-context console errors=${perrs.length ? JSON.stringify(perrs) : "(none)"}`);
  await pctx.close();
}

/* Same state-writing actions on v1 so localStorage parity compares equal key sets:
   favorite today's Met pick (suite.art.favorites), then open the AIC tab so v1
   writes its weekly pool cache (suite.cache.art.pool:<week>). v1 does not cache
   searches, so the v2-only suite.cache.art.search:* key is the policy-mandated
   caching addition (API-AND-RELAY.md §2) — explained in report.md. */
export async function v1Interact({ page }) {
  await page.waitForFunction(() => !!document.querySelector("#postcard .caption h2"), { timeout: 25000 });
  await page.click("#favBtn");
  await page.click("#tabAic");
  await page.waitForFunction(() => {
    const l = document.querySelector("#postcard .label");
    return (l && l.textContent !== "Artwork of the day") ||
           !!localStorage.getItem("suite.cache.art.pool:" + (() => {
             const d = new Date(); const oneJan = new Date(d.getFullYear(), 0, 1);
             const wk = Math.floor((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
             return d.getFullYear() + "-w" + wk;
           })());
  }, { timeout: 25000 });
}
