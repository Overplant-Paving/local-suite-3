/* tests/interactions/fedregister.mjs — Federal Register Daily (Batch B, CORS-open fetcher)
   Live source: www.federalregister.gov documents.json for today's publication date
   (one real fetch on boot). Type pills and agency chips are client-side filters over
   the fetched set — no extra requests. The date-change path is exercised in the
   OFFLINE segment (uncached date -> error card with Retry; back to today -> stale
   cache render), so no second live request is made. Stale-cache offline path per the
   Batch B addendum: age the cache 24 h (past the 60-min TTL), abort all http(s)
   routes, reload, verify the cached docs + "offline — data from" stamp render. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  "label.field", "#dateInput", ".stats", ".pills", ".list", "footer"
];

export const screenshotAfterInteract = true;

/* docs rendered, or a settled (non-"Loading…") message card */
async function waitSettled(page) {
  await page.waitForFunction(() => {
    const l = document.getElementById("list");
    if (l.querySelector(".doc")) return true;
    const h = l.querySelector(".card-msg h3");
    return !!h && h.textContent !== "Loading…";
  }, null, { timeout: 30000 });
}

async function setDate(page, iso) {
  await page.evaluate(v => {
    const el = document.getElementById("dateInput");
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, iso);
}

const isoOf = d =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
  String(d.getDate()).padStart(2, "0");

const statTexts = page => page.locator("#stats .stat").allInnerTexts()
  .then(a => a.map(s => s.replace(/\s+/g, " ").trim()));

export async function interact({ page, log, evidenceDir }) {
  /* ---- live fetch: today's documents ---- */
  await waitSettled(page);
  const today = isoOf(new Date());
  log(`date input on boot: ${await page.inputValue("#dateInput")} (max=${await page.getAttribute("#dateInput", "max")})`);

  const env = await page.evaluate(t => {
    const raw = localStorage.getItem("suite.cache.fedregister." + t);
    if (!raw) return null;
    const e = JSON.parse(raw);
    const s = e.v[0] || null;
    return {
      count: e.v.length, cachedAt: new Date(e.t).toISOString(),
      sample: s && { title: s.title, type: s.type, agencies: (s.agencies || []).map(a => a.name) }
    };
  }, today);
  if (env) {
    log(`live fetch: suite.cache.fedregister.${today} holds ${env.count} documents (cached at ${env.cachedAt})`);
    log(`sample document: [${env.sample && env.sample.type}] "${env.sample && env.sample.title}" — agencies: ${env.sample && env.sample.agencies.join(" · ")}`);
  } else {
    log(`live fetch: NO cache envelope for ${today} — list shows: "${(await page.locator("#list .card-msg").innerText()).replace(/\s+/g, " ").trim()}"`);
  }
  for (const s of await statTexts(page)) log(`stat: ${s}`);
  log(`stamp: "${(await page.locator("#stamp").innerText()).trim()}"`);
  const total = await page.locator("#list .doc").count();
  log(`doc cards rendered: ${total}`);
  const firstDoc = page.locator("#list .doc").first();
  log(`first card: badge "${(await firstDoc.locator(".badge").innerText()).trim()}", ` +
    `title "${(await firstDoc.locator("h3 a").innerText()).trim().slice(0, 120)}", ` +
    `link ${await firstDoc.locator("h3 a").getAttribute("href")}`);
  const agLine = await firstDoc.locator(".agencies").count()
    ? (await firstDoc.locator(".agencies").innerText()).trim() : "(none listed)";
  log(`first card agencies: ${agLine}`);

  /* ---- type pill filter (client-side) ---- */
  const pills = await page.locator("#typePills .pill").allInnerTexts();
  log(`type pills: [${pills.join(", ")}], on="${(await page.locator("#typePills .pill.on").innerText()).trim()}", ` +
    `aria-pressed(on)=${await page.locator("#typePills .pill.on").getAttribute("aria-pressed")}`);
  await page.locator("#typePills .pill", { hasText: "Rules" }).first().click();
  const ruleCount = await page.locator("#list .doc").count();
  log(`after "Rules" pill: ${ruleCount} docs shown (of ${total}); on-pill="${(await page.locator("#typePills .pill.on").innerText()).trim()}"`);
  const ruleBadges = await page.locator("#list .doc .badge").allInnerTexts();
  /* badge text renders uppercase (CSS text-transform), so innerText is "RULE" */
  log(`badges under Rules filter all "RULE": ${ruleBadges.every(b => b.trim() === "RULE")} (${ruleBadges.length} badges)`);
  await page.locator("#typePills .pill", { hasText: "All types" }).click();
  log(`back to All types: ${await page.locator("#list .doc").count()} docs`);

  /* ---- agency filter ---- */
  await page.click("#agencyBar summary");
  const chipCount = await page.locator("#agencyChips .achip").count();
  log(`agency bar open: ${chipCount} agency chips, header count ${(await page.locator("#agencyCount").innerText()).trim()}`);
  const chip = page.locator("#agencyChips .achip").first();
  const chipLabel = (await chip.innerText()).trim();
  await chip.click();
  const agCount = await page.locator("#list .doc").count();
  log(`clicked agency chip "${chipLabel}" -> ${agCount} docs shown; ` +
    `chip class on=${(await chip.getAttribute("class")).includes("on")}, aria-pressed=${await chip.getAttribute("aria-pressed")}`);
  const expected = parseInt(chipLabel.split("·").pop(), 10);
  log(`filtered count matches chip's own count (${expected}): ${agCount === expected}`);
  await chip.click();
  log(`chip toggled off -> ${await page.locator("#list .doc").count()} docs, aria-pressed=${await chip.getAttribute("aria-pressed")}`);

  /* combined: type pill + agency chip */
  await page.locator("#typePills .pill", { hasText: "Notices" }).click();
  await chip.click();
  log(`combined Notices + "${chipLabel}": ${await page.locator("#list .doc").count()} docs ` +
    `(empty-state card visible: ${await page.locator("#list .card-msg").count() > 0})`);
  await chip.click();
  await page.locator("#typePills .pill", { hasText: "All types" }).click();

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
  await waitSettled(page);
  log(`offline reload: ${await page.locator("#list .doc").count()} cached docs render (not a blank page)`);
  log(`offline stamp: "${(await page.locator("#stamp").innerText()).trim()}"`);
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });

  /* date change to an uncached date while offline -> error card with Retry (v1 UX) */
  const prev = isoOf(new Date(Date.now() - 86400000));
  await setDate(page, prev);
  await waitSettled(page);
  log(`offline date change to ${prev} (uncached): card "${(await page.locator("#list .card-msg h3").innerText()).trim()}", ` +
    `retry button present: ${await page.locator("#list .card-msg button").count() === 1}`);

  /* back to today -> aged cache serves again with the offline stamp */
  await setDate(page, today);
  await waitSettled(page);
  log(`back to ${today}: ${await page.locator("#list .doc").count()} cached docs, ` +
    `stamp "${(await page.locator("#stamp").innerText()).trim()}"`);
  await page.context().unroute(/^https?:/);
}

/* v1 writes the same single cache key (suite.cache.fedregister.<today>) on boot; letting
   its live load settle makes the localStorage key sets compare equal. The offline date
   change in v2 wrote no key (fetch failed, nothing cached), so no further action needed. */
export async function v1Interact({ page }) {
  await page.waitForFunction(() => {
    const l = document.getElementById("list");
    if (l.querySelector(".doc")) return true;
    const h = l.querySelector(".card-msg h3");
    return !!h && h.textContent !== "Loading…";
  }, null, { timeout: 30000 });
}
