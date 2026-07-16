/* tests/interactions/parks.mjs — National Parks Companion (Batch C, keyed: nps, NO demo tier)
   No real NPS key is available, so per the Batch C addendum the live-fetch requirement is
   replaced by: (1) the designed no-key state verified explicitly with a screenshot, (2) the
   v1 paste-a-key mechanics (write to suite.key.nps), and (3) the full render pipeline driven
   by route-FULFILLED responses with realistic NPS payload shapes (parks roster + alerts,
   including the parkCode query filter the real API applies). developer.nps.gov's CORS
   openness was verified separately by curl (403-without-key still carries
   Access-Control-Allow-Origin: *) — recorded in report.md.
   Stale path per Batch B: back-date the fulfilled caches, abort all http, reload — the
   picker must render from the 30-day parklist cache and alerts must render the
   "Offline — cached data from <time>" stamp. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".card-msg", ".card-msg h3", ".keyrow input", "button.primary", ".stamp", "footer"
];

export const screenshotAfterInteract = true;

const FAKE_KEY = "TEST-KEY-NOT-REAL-0000";

/* ---- realistic NPS API fixtures (developer.nps.gov/api/v1 shapes) ---- */
const PARKS_FIXTURE = {
  total: "8", limit: "600", start: "0",
  data: [
    { id: "4324B2B4", url: "https://www.nps.gov/yose/index.htm", fullName: "Yosemite National Park", parkCode: "yose", description: "Not just a great valley, but a shrine to human foresight...", states: "CA", designation: "National Park", name: "Yosemite" },
    { id: "2C5178A7", url: "https://www.nps.gov/jotr/index.htm", fullName: "Joshua Tree National Park", parkCode: "jotr", description: "Two distinct desert ecosystems, the Mojave and the Colorado...", states: "CA", designation: "National Park", name: "Joshua Tree" },
    { id: "F58C6D24", url: "https://www.nps.gov/yell/index.htm", fullName: "Yellowstone National Park", parkCode: "yell", description: "On March 1, 1872, Yellowstone became the first national park...", states: "ID,MT,WY", designation: "National Park", name: "Yellowstone" },
    { id: "6BAC1191", url: "https://www.nps.gov/grca/index.htm", fullName: "Grand Canyon National Park", parkCode: "grca", description: "Grand Canyon overwhelms our senses through its immense size...", states: "AZ", designation: "National Park", name: "Grand Canyon" },
    { id: "586F587B", url: "https://www.nps.gov/zion/index.htm", fullName: "Zion National Park", parkCode: "zion", description: "Follow the paths where people have walked for thousands of years...", states: "UT", designation: "National Park", name: "Zion" },
    { id: "6DA17C86", url: "https://www.nps.gov/acad/index.htm", fullName: "Acadia National Park", parkCode: "acad", description: "Acadia National Park protects the natural beauty of the highest rocky headlands...", states: "ME", designation: "National Park", name: "Acadia" },
    { id: "D9819727", url: "https://www.nps.gov/grsm/index.htm", fullName: "Great Smoky Mountains National Park", parkCode: "grsm", description: "Ridge upon ridge of forest straddles the border between North Carolina and Tennessee...", states: "NC,TN", designation: "National Park", name: "Great Smoky Mountains" },
    { id: "FF80BE21", url: "https://www.nps.gov/deva/index.htm", fullName: "Death Valley National Park", parkCode: "deva", description: "In this below-sea-level basin, steady drought and record summer heat...", states: "CA,NV", designation: "National Park", name: "Death Valley" }
  ]
};

const ALERTS_FIXTURE = [
  { id: "A1", url: "https://www.nps.gov/yose/planyourvisit/conditions.htm", title: "Extreme Heat Warning in Yosemite Valley", parkCode: "yose", description: "Temperatures may exceed 100°F. Carry water and avoid strenuous hikes midday.", category: "Danger", lastIndexedDate: "2026-07-14 09:12:00.0" },
  { id: "A2", url: "https://www.nps.gov/yose/planyourvisit/tiogaroad.htm", title: "Tioga Road Closed for Repairs", parkCode: "yose", description: "Tioga Road is closed between Crane Flat and Tuolumne Meadows through late July.", category: "Park Closure", lastIndexedDate: "2026-07-13 14:02:00.0" },
  { id: "A3", url: "", title: "Bear Activity: Food Storage Required", parkCode: "yose", description: "Store all food in bear boxes. Increased bear activity reported in Little Yosemite Valley.", category: "Information", lastIndexedDate: "2026-07-10 08:30:00.0" }
  /* jotr deliberately has NO alerts: exercises the "no active alerts" group */
];

function fulfillJSON(route, body) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body)
  });
}

/* Route developer.nps.gov like the real API: parks roster + alerts filtered by parkCode. */
async function routeNps(page, counts) {
  await page.context().route("https://developer.nps.gov/**", route => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/v1/parks") {
      counts.parks++;
      counts.lastParksKey = u.searchParams.get("api_key");
      return fulfillJSON(route, PARKS_FIXTURE);
    }
    if (u.pathname === "/api/v1/alerts") {
      counts.alerts++;
      counts.lastAlertsQuery = u.searchParams.get("parkCode");
      const codes = (u.searchParams.get("parkCode") || "").split(",");
      const data = ALERTS_FIXTURE.filter(a => codes.includes(a.parkCode));
      return fulfillJSON(route, { total: String(data.length), limit: "200", start: "0", data });
    }
    return route.abort();
  });
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. designed no-key state (NO demo tier — this is a feature, not an error) ---- */
  await page.waitForSelector("#app .card-msg", { timeout: 15000 });
  log(`no-key card title: "${(await page.textContent("#app .card-msg h3")).trim()}"`);
  log(`no-key card body: "${(await page.textContent("#app .card-msg p")).replace(/\s+/g, " ").trim()}"`);
  log(`no-key signup link: ${await page.getAttribute("#app .card-msg a", "href")}`);
  log(`no-key paste field present: ${await page.locator('#app input[aria-label="NPS API key"]').isVisible()}, ` +
    `Save key button: ${await page.locator("#app button.primary").isVisible()}`);
  await page.screenshot({ path: evidenceDir + "/nokey-designed-state.png", fullPage: true });

  /* ---- 2. paste-a-key mechanics + route-fulfilled render pipeline ---- */
  const counts = { parks: 0, alerts: 0, lastParksKey: null, lastAlertsQuery: null };
  await routeNps(page, counts);
  await page.fill('#app input[aria-label="NPS API key"]', FAKE_KEY);
  await page.click("#app button.primary");
  await page.waitForSelector(".picker", { timeout: 15000 });
  log(`key saved -> suite.key.nps = "${await page.evaluate(() => localStorage.getItem("suite.key.nps"))}"`);
  log(`parks request made with api_key param = "${counts.lastParksKey}" (requests so far: parks=${counts.parks})`);
  const optCount = await page.locator(".options .opt").count();
  log(`picker rendered: ${optCount} park options; first option: "${(await page.locator(".options .opt").first().innerText()).replace(/\s+/g, " ").trim()}"`);
  log(`parklist cache envelope: ${await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("suite.cache.parks.parklist"));
    return e ? `t=${new Date(e.t).toISOString()} v=array[${e.v.length}] sample=${JSON.stringify(e.v[0])}` : "MISSING";
  })}`);
  log(`empty selection message: "${(await page.textContent("#content .card-msg")).replace(/\s+/g, " ").trim()}"`);

  /* select Yosemite via search */
  await page.fill('.picker input[type="search"]', "yose");
  log(`search "yose" filters options to: ${await page.locator(".options .opt").count()}`);
  await page.click('.options .opt:has-text("Yosemite")');
  await page.waitForSelector(".parkgroup", { timeout: 15000 });
  log(`selected chip: "${(await page.locator(".pchip").first().innerText()).trim()}"; suite.parks = ${await page.evaluate(() => localStorage.getItem("suite.parks"))}`);
  log(`alerts request parkCode = "${counts.lastAlertsQuery}"`);

  /* add Joshua Tree (keyboard path: Enter on the focused option row) */
  await page.fill('.picker input[type="search"]', "joshua");
  await page.focus('.options .opt:has-text("Joshua Tree")');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelectorAll(".parkgroup").length === 2, { timeout: 15000 });
  log(`keyboard-selected Joshua Tree; suite.parks = ${await page.evaluate(() => localStorage.getItem("suite.parks"))}`);
  log(`alerts request parkCode = "${counts.lastAlertsQuery}" (sorted codes; requests: alerts=${counts.alerts})`);

  /* ---- 3. rendered alerts: grouping, severity sort, badges, links, no-alert card ---- */
  log(`stamp: "${(await page.textContent("#content .stamp")).trim()}"`);
  const groups = await page.$$eval(".parkgroup", gs => gs.map(g => ({
    head: g.querySelector("h2").textContent.replace(/\s+/g, " ").trim(),
    link: g.querySelector("h2 a").href,
    cats: [...g.querySelectorAll(".alert .cat")].map(c => c.textContent.trim()),
    titles: [...g.querySelectorAll(".alert h3")].map(t => t.textContent.trim()),
    noAlerts: g.querySelector(".card-msg") ? g.querySelector(".card-msg").textContent.trim() : null
  })));
  for (const g of groups) log(`group: "${g.head}" · park page ${g.link} · badges [${g.cats.join(", ")}] · ` +
    (g.noAlerts ? `no-alert card: "${g.noAlerts}"` : `titles: ${g.titles.map(t => `"${t}"`).join(", ")}`));
  log(`severity sort check (Danger before Closure before Information): [${groups[0].cats.join(" -> ")}]`);
  log(`alert title link (a.url present): ${await page.getAttribute(".alert h3 a", "href")}`);
  const chipLabel = await page.getAttribute(".pchip button", "aria-label");
  log(`chip remove button aria-label: "${chipLabel}"`);

  /* ---- 4. selection persistence + fresh-cache reload (no refetch) ---- */
  const before = { parks: counts.parks, alerts: counts.alerts };
  await page.reload();
  await page.waitForSelector(".parkgroup", { timeout: 15000 });
  log(`after reload: chips = ${await page.locator(".pchip").count()}, groups = ${await page.locator(".parkgroup").count()}, ` +
    `stamp "${(await page.textContent("#content .stamp")).trim()}"`);
  log(`reload served from cache: requests unchanged (parks ${before.parks}->${counts.parks}, alerts ${before.alerts}->${counts.alerts})`);

  /* remove a chip: unwatch Joshua Tree -> refetch for the single remaining code */
  await page.click('.pchip button[aria-label="Remove Joshua Tree National Park"]');
  await page.waitForFunction(() => document.querySelectorAll(".parkgroup").length === 1, { timeout: 15000 });
  log(`removed Joshua Tree via chip ×: suite.parks = ${await page.evaluate(() => localStorage.getItem("suite.parks"))}, groups = 1`);
  /* re-add so the final localStorage matches v1Interact's key set */
  await page.fill('.picker input[type="search"]', "joshua");
  await page.click('.options .opt:has-text("Joshua Tree")');
  await page.waitForFunction(() => document.querySelectorAll(".parkgroup").length === 2, { timeout: 15000 });

  /* "change key" returns to the key card with the saved key prefilled */
  await page.click('.picker button.ghost:has-text("change key")');
  await page.waitForSelector("#app .card-msg h3", { timeout: 15000 });
  log(`change key card: "${(await page.textContent("#app .card-msg h3")).trim()}", ` +
    `input prefilled with saved key: ${await page.inputValue('#app input[aria-label="NPS API key"]') === FAKE_KEY}`);
  await page.click("#app button.primary"); // save the same key -> back to the picker
  await page.waitForSelector(".parkgroup", { timeout: 15000 });

  /* ---- 5. invalid-key path: API answers 403 -> the "That key didn't work" card ---- */
  await page.context().unroute("https://developer.nps.gov/**");
  await page.context().route("https://developer.nps.gov/**", route => route.fulfill({
    status: 403, contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ error: { code: "API_KEY_INVALID", message: "An invalid api_key was supplied." } })
  }));
  await page.evaluate(() => {
    localStorage.removeItem("suite.cache.parks.parklist"); // force a parks refetch on boot
  });
  await page.reload();
  await page.waitForSelector('#app .card-msg h3:has-text("That key didn\'t work")', { timeout: 15000 });
  log(`403 from API -> invalid-key card: "${(await page.textContent("#app .card-msg h3")).trim()}", ` +
    `input cleared: ${(await page.inputValue('#app input[aria-label="NPS API key"]')) === ""}`);
  await page.context().unroute("https://developer.nps.gov/**");

  /* restore the good pipeline + caches for the stale test */
  await routeNps(page, counts);
  await page.reload();
  await page.waitForSelector(".parkgroup", { timeout: 15000 });

  /* ---- 6. stale-cache offline path (Batch B addendum) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000; // older than the 360-min alerts TTL, within the 30-day parklist TTL
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().unroute("https://developer.nps.gov/**");
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector(".parkgroup", { timeout: 15000 }); // renders from stale cache, not a blank
  const staleStamp = (await page.textContent("#content .stamp")).trim();
  log(`offline reload: picker from 30-day parklist cache (options: ${await page.locator(".options .opt").count()}), ` +
    `alerts stale stamp: "${staleStamp}" (must say Offline), groups: ${await page.locator(".parkgroup").count()}`);
  await page.screenshot({ path: evidenceDir + "/offline-stale.png", fullPage: true });
  await page.context().unroute(/^https?:/);

  /* restore a fresh-looking view for the after-interaction shot WITHOUT refetching:
     re-freshen the cache timestamps so the reload serves everything from cache */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now();
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.reload();
  await page.waitForSelector(".parkgroup", { timeout: 15000 });
  log(`restored fresh-cache view: stamp "${(await page.textContent("#content .stamp")).trim()}"`);
}

/* Same state-writing actions on v1 (identical fixtures through the same routes) so the
   localStorage key sets compare equal: suite.key.nps, suite.parks,
   suite.cache.parks.parklist, suite.cache.parks.alerts.yose, suite.cache.parks.alerts.jotr,yose
   (plus suite.theme via the harness toggle click). */
export async function v1Interact({ page }) {
  const counts = { parks: 0, alerts: 0 };
  await routeNps(page, counts);
  await page.waitForSelector("#app .card-msg", { timeout: 15000 });
  await page.fill('#app input[placeholder="paste API key"]', FAKE_KEY);
  await page.click("#app button.primary");
  await page.waitForSelector(".picker", { timeout: 15000 });
  await page.fill('.picker input[type="search"]', "yose");
  await page.click('.options .opt:has-text("Yosemite")');
  await page.waitForSelector(".parkgroup", { timeout: 15000 });
  await page.fill('.picker input[type="search"]', "joshua");
  await page.click('.options .opt:has-text("Joshua Tree")');
  await page.waitForFunction(() => document.querySelectorAll(".parkgroup").length === 2, { timeout: 15000 });
}
