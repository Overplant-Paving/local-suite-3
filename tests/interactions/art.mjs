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
