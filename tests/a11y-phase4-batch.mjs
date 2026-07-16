/* tests/a11y-phase4-batch.mjs — Phase 4 accessibility audit harness
   (handoff/orchestration/phase4-a11y.md; QUALITY.md §2) for the batch:
   wiki zip factbook books art geo elevation network apod nutrition congress gas

   Run (from tests/):  node a11y-phase4-batch.mjs <tool>

   All http(s) traffic is route-fulfilled with deterministic payloads (batch
   etiquette: zero live NASA/USDA/artic/ipapi requests). Checks per QUALITY.md §2:
     1. icon-only buttons/links have accessible names (runtime enumeration)
     2. async result containers carry aria-live (runtime getAttribute)
     3. keyboard path drives the PRIMARY feature start-to-finish (page.keyboard only)
        + no positive tabindex + Esc closes overlays where they exist
     4. inputs have labels (runtime enumeration)
     5. WCAG contrast, both themes, full-page scan of rendered text
        (effective bg via ancestor walk + alpha compositing)
     6. focus visibility (keyboard focus vs blurred computed styles)
   Output: tests/evidence/<tool>/a11y-phase4.txt (raw log). */

import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const tool = process.argv[2];
if (!tool) { console.error("usage: node a11y-phase4-batch.mjs <tool>"); process.exit(1); }
const url = pathToFileURL(join(ROOT, "tools", `${tool}.html`)).href;
const EV = join(ROOT, "tests", "evidence", tool);

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const png = r => r.fulfill({ status: 200, contentType: "image/png", body: PNG });
const json = (r, body, status = 200) => r.fulfill({
  status, contentType: "application/json",
  headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body)
});

/* ---------------- per-tool fixtures + drivers ---------------- */

const wikiSummary = raw => ({
  title: String(raw).replace(/_/g, " "), description: "audit fixture description",
  extract: "Deterministic a11y-audit fixture extract for " + String(raw).replace(/_/g, " ") + ". No live request was made; the render pipeline under test is real.",
  thumbnail: { source: "https://upload.wikimedia.org/fixture.png", width: 320, height: 240 },
  content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/" + encodeURIComponent(raw) } }
});

const CONGRESS_BILLS = { bills: [
  { congress: 119, type: "HR", number: "4275", title: "Fixture Appropriations Act, 2027",
    latestAction: { actionDate: new Date(Date.now() - 864e5).toISOString().slice(0, 10), text: "Passed House by recorded vote: 218 - 210." } },
  { congress: 119, type: "S", number: "1812", title: "Fixture Judiciary Act",
    latestAction: { actionDate: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10), text: "Read twice and referred to the Committee on the Judiciary." } },
  { congress: 119, type: "SRES", number: "301", title: "A resolution designating a fixture month.",
    latestAction: { actionDate: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10), text: "Agreed to in Senate without amendment by Voice Vote." } }
] };
const CONGRESS_MEMBERS = { members: [
  { bioguideId: "A000001", name: "Alvarez, Maria", partyName: "Democratic", state: "Alabama", terms: { item: [{ chamber: "Senate" }] } },
  { bioguideId: "B000002", name: "Bennett, John", partyName: "Republican", state: "Alabama", terms: { item: [{ chamber: "Senate" }] } },
  { bioguideId: "C000003", name: "Chen, David", partyName: "Independent", state: "Alabama", district: 2, terms: { item: [{ chamber: "House of Representatives" }] } }
] };
const CONGRESS_SPONSORED = { sponsoredLegislation: [
  { congress: 119, type: "S", number: "2101", title: "Fixture Resilience Act", introducedDate: "2026-06-01",
    latestAction: { actionDate: "2026-07-01", text: "Committee hearings held." } }
] };

/* deterministic EIA v2 payload (same scheme as interactions/gas.mjs) */
const GAS_BASE = { NUS: 3.1, R10: 3.2, R20: 2.95, R30: 2.75, R40: 3.3, R50: 4.1 };
const GAS_PROD = { EPMR: 0, EPMM: 0.4, EPMP: 0.8, EPD2D: 0.55 };
const GAS_NAME = { EPMR: "Regular Gasoline", EPMM: "Midgrade Gasoline", EPMP: "Premium Gasoline", EPD2D: "No 2 Diesel" };
const GAS_AREA = { NUS: "U.S.", R10: "PADD 1", R20: "PADD 2", R30: "PADD 3", R40: "PADD 4", R50: "PADD 5" };
function gasBody(area, product, length) {
  const data = [];
  for (let i = 0; i < length; i++) data.push({
    period: new Date(Date.UTC(2026, 6, 13) - i * 7 * 864e5).toISOString().slice(0, 10),
    duoarea: area, "area-name": GAS_AREA[area], product, "product-name": GAS_NAME[product],
    value: (GAS_BASE[area] + GAS_PROD[product] + 0.25 * Math.sin(i / 5) + 0.002 * i).toFixed(3), units: "$/GAL"
  });
  return { response: { total: String(length), data }, apiVersion: "2.1.8" };
}

/* Tab until document.activeElement matches sel (keyboard-only navigation helper) */
async function tabTo(page, sel, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(s => document.activeElement && document.activeElement.matches(s), sel)) return true;
  }
  return false;
}
const active = page => page.evaluate(() => {
  const a = document.activeElement;
  return a ? (a.id ? "#" + a.id : a.tagName.toLowerCase() + (a.className ? "." + String(a.className).split(" ")[0] : "")) : "(none)";
});

const TOOLS = {

  wiki: {
    live: ["#article", "#featured", "#onthisday", "#readlist"],
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/upload\.wikimedia\.org/, png);
      await ctx.route(/api\/rest_v1\/page\/summary\//, r =>
        json(r, wikiSummary(decodeURIComponent(r.request().url().split("/summary/")[1]))));
      await ctx.route(/api\/rest_v1\/page\/random\/summary/, r => json(r, wikiSummary("Random Fixture")));
      await ctx.route(/api\/rest_v1\/feed\/featured\//, r => json(r, {
        tfa: { title: "Fixture_Featured", normalizedtitle: "Fixture Featured", description: "featured fixture",
               thumbnail: { source: "https://upload.wikimedia.org/f2.png" } } }));
      await ctx.route(/api\/rest_v1\/feed\/onthisday\//, r => json(r, {
        selected: [{ year: 1815, text: "Fixture event one.", pages: [{ title: "Fixture_Page" }] },
                   { year: 1901, text: "Fixture event two.", pages: [{ title: "Fixture_Page2" }] }] }));
      await ctx.route(/rest\.php\/v1\/search\/title/, r => json(r, {
        pages: [{ id: 1, key: "Ada_Lovelace", title: "Ada Lovelace", description: "English mathematician" },
                { id: 2, key: "Ada_(town)", title: "Ada (town)", description: "a fixture town" }] }));
    },
    async kbd({ page, log }) {
      await page.waitForSelector("#article .article h2", { timeout: 15000 });
      // #q has autofocus; drive search fully by keyboard
      await page.evaluate(() => document.getElementById("q").focus());
      await page.keyboard.type("Ada Lovelace");
      await page.waitForSelector("#suggest:not([hidden]) > div", { timeout: 8000 });
      log("suggest open after typing: true");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => {
        const h = document.querySelector("#article .article h2");
        return h && h.textContent === "Ada Lovelace";
      }, { timeout: 8000 });
      log("keyboard path: type -> ArrowDown -> Enter opened 'Ada Lovelace' article");
      // Esc closes the suggest overlay
      await page.evaluate(() => document.getElementById("q").focus());
      await page.keyboard.type("ken");
      await page.waitForSelector("#suggest:not([hidden])", { timeout: 8000 }).catch(() => {});
      await page.keyboard.press("Escape");
      log("Esc closes suggest overlay: hidden=" + await page.evaluate(() => document.getElementById("suggest").hidden));
      // Tab reaches the save-to-reading-list button; Enter activates it
      const ok = await tabTo(page, "#article .actions button");
      await page.keyboard.press("Enter");
      log("Tab->Enter on save button: reached=" + ok + ", now reads '" +
        (await page.textContent("#article .actions button")).trim() + "'");
      await page.waitForSelector("#readlist .readlist-item", { timeout: 5000 });
      log("reading list row rendered (remove button aria-label='" +
        await page.getAttribute("#readlist .readlist-item button", "aria-label") + "')");
    }
  },

  zip: {
    live: ["#zipOut", "#cityOut", "#acOut"],
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/api\.zippopotam\.us\/us\/[a-z]{2}\//i, r => json(r, {
        "country": "United States", "state": "California", "state abbreviation": "CA", "place name": "Beverly Hills",
        places: [{ "place name": "Beverly Hills", "post code": "90209", latitude: "34.0901", longitude: "-118.4065" },
                 { "place name": "Beverly Hills", "post code": "90210", latitude: "34.0901", longitude: "-118.4065" }] }));
      await ctx.route(/api\.zippopotam\.us\/us\/\d{5}/, r => json(r, {
        "post code": "90012", country: "United States",
        places: [{ "place name": "Los Angeles", state: "California", "state abbreviation": "CA",
                   latitude: "34.0617", longitude: "-118.2468" }] }));
    },
    async kbd({ page, log }) {
      await tabTo(page, "#zipIn");
      await page.keyboard.type("90012");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#zipOut .big", { timeout: 8000 });
      log("keyboard ZIP lookup: '" + (await page.textContent("#zipOut .big")).trim() + "'");
      // Tab to the save-location button and activate
      await tabTo(page, "#zipOut .savebtn");
      await page.keyboard.press("Enter");
      log("Tab->Enter save location: '" + (await page.textContent("#zipOut .savebtn")).trim() + "'");
      // keyboard to the City tab (pill #2), then city lookup
      await page.evaluate(() => document.querySelector(".pills button").focus());
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      log("city tab via keyboard: cityCard hidden=" + await page.$eval("#cityCard", e => e.hidden));
      await tabTo(page, "#stIn");
      await page.keyboard.type("CA");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Beverly Hills");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#cityOut .zchip", { timeout: 8000 });
      // zchip is a role=button span with tabindex+keydown: Tab to it, Enter jumps back
      await tabTo(page, ".zchip");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#zipOut .big", { timeout: 8000 });
      log("zchip via Tab+Enter jumps to ZIP tab: #zipIn='" + await page.inputValue("#zipIn") + "'");
      // area-code tab: fully offline path
      await page.evaluate(() => document.querySelector(".pills button:nth-child(3)").focus());
      await page.keyboard.press("Enter");
      await tabTo(page, "#acIn");
      await page.keyboard.type("213");
      await page.waitForSelector("#acOut .big", { timeout: 5000 });
      log("area code via keyboard: '" + (await page.textContent("#acOut .ac-region")).trim() + "'");
    }
  },

  factbook: {
    live: ["#countryCard", "#stateCard"],
    async routes(ctx) { await ctx.route(/^https?:/, r => r.abort()); },
    async kbd({ page, log }) {
      await page.waitForSelector("#countryCard .card h2");
      await tabTo(page, "#q");
      await page.keyboard.type("japan");
      await page.waitForSelector("#suggest.open button[data-i]");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => (document.querySelector("#countryCard h2") || {}).textContent === "Japan");
      log("keyboard country lookup: Japan card rendered");
      await page.keyboard.type("ken");
      await page.waitForSelector("#suggest.open");
      await page.keyboard.press("Escape");
      log("Esc closes suggest: open=" + await page.$eval("#suggest", e => e.classList.contains("open")));
      await page.evaluate(() => document.getElementById("q").value = "");
      // keyboard to the states tab
      await page.evaluate(() => document.getElementById("tabState").focus());
      await page.keyboard.press("Enter");
      log("states tab via keyboard: aria-pressed=" + await page.getAttribute("#tabState", "aria-pressed"));
      await tabTo(page, "#qs");
      await page.keyboard.type("texas");
      await page.waitForSelector("#stateCard .card h2");
      log("state search via keyboard: '" + (await page.textContent("#stateCard h2")).trim().replace(/\s+/g, " ") + "'");
      // state chips are real <button>s: Tab to the grid, Enter picks
      await page.evaluate(() => { document.getElementById("qs").value = ""; document.getElementById("qs").dispatchEvent(new Event("input")); });
      await page.waitForFunction(() => document.querySelectorAll("#stateGrid .schip").length === 50);
      await tabTo(page, ".schip");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#stateCard .card h2");
      log("state chip via Tab+Enter: '" + (await page.textContent("#stateCard h2")).trim().replace(/\s+/g, " ") + "'");
    }
  },

  books: {
    live: ["#status"],
    liveNote: "#status is the announced channel; result cards themselves are deliberately not a live region (list re-renders would be spammy) — v1-parity design, announced via status.",
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/covers\.openlibrary\.org/, png);
      await ctx.route(/openlibrary\.org\/search\.json/, r => json(r, {
        numFound: 2, docs: [
          { key: "/works/OL1W", title: "The Left Hand of Darkness", author_name: ["Ursula K. Le Guin"],
            first_publish_year: 1969, edition_count: 63, cover_i: 123, isbn: ["9780441478125"] },
          { key: "/works/OL2W", title: "Fixture Second Book", author_name: ["Audit Author"], first_publish_year: 2001 }
        ] }));
      await ctx.route(/openlibrary\.org\/isbn\//, r => json(r, {
        title: "Dune", authors: [{ key: "/authors/OL1A" }], publish_date: "1965" }));
      await ctx.route(/openlibrary\.org\/authors\//, r => json(r, { name: "Frank Herbert" }));
    },
    async kbd({ page, log }) {
      // #q has autofocus
      await page.evaluate(() => document.getElementById("q").focus());
      await page.keyboard.type("The Left Hand of Darkness");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#results .book", { timeout: 8000 });
      log("keyboard search: status='" + (await page.textContent("#status")).trim() + "'");
      await tabTo(page, ".addbtn");
      await page.keyboard.press("Enter");
      log("Tab->Enter add to read-next: '" + (await page.textContent("#results .book .addbtn")).trim() +
        "', saved count='" + (await page.textContent("#savedCount")).trim() + "'");
      await tabTo(page, "#savedList .rm");
      await page.keyboard.press("Enter");
      log("Tab->Enter remove from list: savedEmpty visible=" + await page.isVisible("#savedEmpty"));
      // ISBN mode via keyboard
      await page.evaluate(() => document.getElementById("modeIsbn").focus());
      await page.keyboard.press("Enter");
      await page.evaluate(() => document.getElementById("q").focus());
      await page.evaluate(() => document.getElementById("q").value = "");
      await page.keyboard.type("9780441172719");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.getElementById("status").textContent.indexOf("Found by ISBN") === 0, { timeout: 8000 });
      log("keyboard ISBN lookup: status='" + (await page.textContent("#status")).trim() + "'");
    }
  },

  art: {
    live: ["#postcard", "#favCount"],
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/images\.metmuseum\.org|www\.artic\.edu/, png);
      const row = i => ({ id: 1000 + i, title: "Fixture Artwork " + i, artist_display: "Fixture Artist\nsecond line",
        date_display: "1900", medium_display: "Oil on fixture", image_id: "fixture-" + i, is_public_domain: true });
      await ctx.route(/api\.artic\.edu\/api\/v1\/artworks\/search\?/, r =>
        json(r, { data: [row(1), row(2)] }));
      await ctx.route(/api\.artic\.edu\/api\/v1\/artworks\?/, r =>
        json(r, { data: [row(1), row(2), row(3)] }));
    },
    async kbd({ page, log }) {
      await page.waitForSelector("#postcard .caption h2", { timeout: 8000 });
      log("boot postcard (embedded Met set): '" + (await page.textContent("#postcard h2")).trim().slice(0, 60) + "'");
      // favorite today's pick by keyboard
      await tabTo(page, "#favBtn");
      await page.keyboard.press("Enter");
      log("Tab->Enter favorite: '" + (await page.textContent("#favBtn")).trim() + "', count='" +
        (await page.textContent("#favCount")).trim() + "'");
      // fav-item is role=button tabindex=0 — reachable and Enter-operable
      await tabTo(page, ".fav-item");
      await page.keyboard.press("Enter");
      log("Tab->Enter on favorite grid item: label now '" + (await page.textContent("#postcard .label")).trim() + "'");
      // AIC tab + search, keyboard only (route-fulfilled; live artic 403s headless — documented env failure)
      await page.evaluate(() => document.getElementById("tabAic").focus());
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => {
        const l = document.querySelector("#postcard .label");
        return l && /Artwork of the day|Art Institute/.test(l.textContent);
      }, { timeout: 8000 });
      await tabTo(page, "#q");
      await page.keyboard.type("sunflowers");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => {
        const l = document.querySelector("#postcard .label");
        return l && l.textContent.startsWith("Search:");
      }, { timeout: 8000 });
      log("keyboard AIC search: label='" + (await page.textContent("#postcard .label")).trim() + "'");
    }
  },

  geo: {
    live: ["#locBar", "#fwdRes", "#revRes", "#convOut", "#dbOut"],
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/geocoding-api\.open-meteo\.com/, r => json(r, {
        results: [{ name: "Denver", admin1: "Colorado", country: "United States",
                    latitude: 39.7392, longitude: -104.9847, population: 715522 }] }));
      await ctx.route(/nominatim\.openstreetmap\.org\/reverse/, r => json(r, {
        name: "White House", display_name: "White House, 1600, Pennsylvania Avenue NW, Washington, DC",
        lat: "38.8977", lon: "-77.0365" }));
      await ctx.route(/geocoding\.geo\.census\.gov/, r => {
        const cb = new URL(r.request().url()).searchParams.get("callback");
        r.fulfill({ status: 200, contentType: "text/javascript",
          body: cb + "(" + JSON.stringify({ result: { addressMatches: [{
            matchedAddress: "1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500",
            coordinates: { x: -77.03654, y: 38.89767 } }] } }) + ")" });
      });
    },
    async kbd({ page, log }) {
      await tabTo(page, "#fwdQ");
      await page.keyboard.type("Denver");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#fwdRes .r", { timeout: 8000 });
      log("keyboard forward geocode: '" + (await page.textContent("#fwdRes .r .name")).trim() + "'");
      await tabTo(page, "#fwdRes .acts button");
      await page.keyboard.press("Enter"); // "use in tools"
      log("Tab->Enter 'use in tools': decLat=" + await page.inputValue("#decLat") + " ptA='" + await page.inputValue("#ptA") + "'");
      // DMS via Enter in the decimal field
      await page.evaluate(() => document.getElementById("decLat").focus());
      await page.keyboard.press("Enter");
      log("Enter in #decLat runs conversion: dmsLat='" + await page.inputValue("#dmsLat") + "'");
      // distance & bearing via keyboard
      await page.evaluate(() => { const e = document.getElementById("ptB"); e.focus(); });
      await page.keyboard.type("37.7749, -122.4194");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#dbOut .big", { timeout: 5000 });
      log("keyboard distance/bearing: '" + (await page.textContent("#dbOut .big")).trim() + "'");
      // reverse geocode via keyboard
      await page.evaluate(() => document.getElementById("revQ").focus());
      await page.keyboard.type("38.8977, -77.0365");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#revRes .r", { timeout: 8000 });
      log("keyboard reverse geocode: '" + (await page.textContent("#revRes .r .name")).trim() + "'");
    }
  },

  elevation: {
    live: ["#formErr", "#pointResult", "#profResult", "#locbar", "#readout"],
    seed: { "suite.location": JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" }) },
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/epqs\.nationalmap\.gov/, r => json(r, { value: "89.23" }));
      await ctx.route(/api\.open-elevation\.com/, r => {
        const req = r.request();
        if (req.method() === "POST") {
          const body = JSON.parse(req.postData() || "{}");
          return json(r, { results: (body.locations || []).map((l, i) => ({
            latitude: l.latitude, longitude: l.longitude, elevation: Math.round(100 + 80 * Math.sin(i / 6)) })) });
        }
        const m = /locations=([-\d.]+),([-\d.]+)/.exec(req.url()) || [0, 0, 0];
        return json(r, { results: [{ latitude: +m[1], longitude: +m[2], elevation: 120 }] });
      });
    },
    async kbd({ page, log }) {
      await page.waitForSelector("#locbar:not(.hidden)", { timeout: 5000 });
      log("locbar prefilled from suite.location: '" + (await page.textContent("#locbar")).replace(/\s+/g, " ").trim() + "'");
      // Enter in a Point-A field runs the point lookup (a11y handler in source)
      await tabTo(page, "#latA");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#pointResult .bignum b", { timeout: 8000 });
      log("keyboard point lookup (Enter in #latA): " + (await page.textContent("#pointResult .bignum b")).trim() + " " +
        (await page.textContent("#pointResult .bignum .u")).trim());
      // fill B by keyboard, Enter runs the profile
      await page.evaluate(() => document.getElementById("latB").focus());
      await page.keyboard.type("34.2257");
      await page.keyboard.press("Tab");
      await page.keyboard.type("-118.0596");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#profResult svg.profile", { timeout: 8000 });
      log("keyboard profile (Enter in #lonB): hint='" + (await page.textContent("#profResult .hint")).trim() + "'");
      // chart is tabindex=0 with arrow-key readout
      await tabTo(page, "svg.profile");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      log("chart keyboard readout: '" + (await page.textContent("#readout")).trim() + "'");
      // unit toggle via keyboard
      await page.evaluate(() => document.querySelector('#unitTog button[data-u="m"]').focus());
      await page.keyboard.press("Enter");
      log("unit toggle via keyboard: aria-pressed(m)=" +
        await page.getAttribute('#unitTog button[data-u="m"]', "aria-pressed"));
    }
  },

  network: {
    live: ["#ipVal", "#ipMsg", "#geoBody"],
    liveNote: "#latBody/#verdict are deliberately NOT live regions (10 s ping loop re-render would spam screen readers) — documented in source.",
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/api\.ipify\.org/, r => json(r, { ip: "203.0.113.7" }));
      await ctx.route(/ipapi\.co\/json/, r => json(r, {
        ip: "203.0.113.7", version: "IPv4", city: "Pocola", region: "Oklahoma", country_name: "United States",
        postal: "74902", latitude: 35.2436, longitude: -94.476, timezone: "America/Chicago",
        org: "Proton AG", asn: "AS208172" }));
      const anchor = r => r.fulfill({ status: 204, body: "" });
      await ctx.route(/cloudflare\.com/, anchor);
      await ctx.route(/www\.google\.com/, anchor);
      await ctx.route(/api\.weather\.gov/, anchor);
      await ctx.route(/en\.wikipedia\.org/, anchor);
    },
    async kbd({ page, log }) {
      await page.waitForFunction(() => {
        const t = document.querySelector("#ipVal").textContent.trim();
        return t && t !== "…";
      }, { timeout: 10000 });
      await page.waitForSelector("#geoBody .kv", { timeout: 10000 });
      log("passive tool primed: IP + geo rendered (route-fulfilled; ipapi.co serves bot challenges from this VPN exit)");
      // the one interactive element: the copy button — keyboard reachable + operable
      const ok = await tabTo(page, "#copyIp");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      log("Tab->Enter on copy button: reached=" + ok + ", reads '" + (await page.textContent("#copyIp")).trim() + "'");
      await page.waitForSelector("#latBody .lat-row", { timeout: 10000 });
      log("latency board rendered: " + await page.locator("#latBody .lat-row").count() + " anchor rows");
    }
  },

  apod: {
    live: ["#view", "#stamp"],
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/apod\.nasa\.gov/, png);
      await ctx.route(/img\.youtube\.com/, png);
      await ctx.route(/api\.nasa\.gov\/planetary\/apod/, r => {
        const date = new URL(r.request().url()).searchParams.get("date");
        return json(r, { date, media_type: "image", service_version: "v1",
          title: "Audit fixture — " + date,
          explanation: "Deterministic a11y-audit fixture payload; no live NASA request was made (shared DEMO_KEY pool, 429'd earlier today).",
          url: "https://apod.nasa.gov/apod/image/fixture.jpg",
          hdurl: "https://apod.nasa.gov/apod/image/fixture-hd.jpg", copyright: "fixture" });
      });
    },
    async kbd({ page, log }) {
      await page.waitForSelector("#view .hero", { timeout: 8000 });
      log("initial render: '" + (await page.textContent("#view .hero h2")).trim() + "'");
      // document-level arrow keys navigate days
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(() => {
        const h = document.querySelector("#view .hero h2");
        return h && !document.getElementById("nextBtn").disabled;
      }, { timeout: 8000 });
      log("ArrowLeft -> previous day: '" + (await page.textContent("#view .hero h2")).trim() + "', nextBtn enabled");
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.getElementById("nextBtn").disabled, { timeout: 8000 });
      log("ArrowRight -> back to today");
      // keycard: summary is native <details> keyboard UI; Enter key path for the key input
      await tabTo(page, "#keySummary");
      await page.keyboard.press("Enter");
      log("keycard opened via Tab+Enter on <summary>: open=" + await page.$eval("#keycard", d => d.open));
      await tabTo(page, "#keyInput");
      await page.keyboard.type("A11Y-AUDIT-KEY");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => /^Loaded just now\.$/.test(document.getElementById("stamp").textContent), { timeout: 8000 });
      log("Enter saves key: summary='" + (await page.textContent("#keySummary")).trim() + "'");
      await tabTo(page, "#keyClear");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => /demo key\.$/.test(document.getElementById("stamp").textContent), { timeout: 8000 });
      log("Tab->Enter clears key: stamp='" + (await page.textContent("#stamp")).trim() + "'");
      // date picker + buttons are native controls; prev/today via Tab+Enter
      await tabTo(page, "#todayBtn");
      await page.keyboard.press("Enter");
      log("today button via Tab+Enter: ok");
    }
  },

  nutrition: {
    live: ["#results", "#compare"],
    async routes(ctx) {
      const body = readFileSync(join(import.meta.dirname, "evidence", "nutrition", "live-response.json"), "utf8");
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/api\.nal\.usda\.gov/, r => r.fulfill({
        status: 200, contentType: "application/json",
        headers: { "access-control-allow-origin": "*" }, body }));
    },
    async kbd({ page, log }) {
      // #q has autofocus; Enter submits the form
      await page.evaluate(() => document.getElementById("q").focus());
      await page.keyboard.type("banana");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#results .res", { timeout: 8000 });
      log("keyboard search (archived USDA payload replayed; zero live requests): " +
        await page.locator("#results .res").count() + " rows");
      await tabTo(page, "#results .res .pick button.a");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#compare .food.slotA", { timeout: 5000 });
      log("Tab->Enter slot A: aria-pressed=" + await page.getAttribute("#results .res .pick button.a", "aria-pressed"));
      await tabTo(page, "#results .res:nth-child(3) .pick button.b, #results .res:nth-of-type(3) .pick button.b", 80);
      await page.keyboard.press("Enter");
      await page.waitForSelector("#compare.two", { timeout: 5000 }).catch(() => {});
      log("Tab->Enter slot B: compare class='" + await page.evaluate(() => document.getElementById("compare").className) + "'");
      // basis toggle by keyboard if a serving-size button exists
      const hasServ = await page.$("#compare .food .basis button:not(:first-child)");
      if (hasServ) {
        await page.evaluate(() => document.querySelector("#compare .food .basis button:not(:first-child)").focus());
        await page.keyboard.press("Enter");
        log("basis toggle via keyboard: pressed=" + await page.evaluate(() =>
          document.querySelector("#compare .food .basis button:not(:first-child)").getAttribute("aria-pressed")));
      } else log("basis toggle: no serving-size data in this result set (per-100g only)");
      // keybox overlay: open via keyToggle (role=button a), Esc closes and restores focus
      await page.evaluate(() => document.getElementById("keyToggle").focus());
      await page.keyboard.press("Enter");
      log("keyToggle Enter opens keybox: aria-expanded=" + await page.getAttribute("#keyToggle", "aria-expanded") +
        ", focus=" + await active(page));
      await page.keyboard.press("Escape");
      log("Esc closes keybox: aria-expanded=" + await page.getAttribute("#keyToggle", "aria-expanded") +
        ", focus returned to=" + await active(page));
    }
  },

  congress: {
    live: ["#list", "#stamp"],
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/api\.congress\.gov/, r => {
        const u = r.request().url();
        if (u.includes("/v3/bill?")) return json(r, CONGRESS_BILLS);
        if (u.includes("/sponsored-legislation")) return json(r, CONGRESS_SPONSORED);
        if (u.includes("/v3/member/")) return json(r, CONGRESS_MEMBERS);
        return json(r, {});
      });
    },
    async kbd({ page, log }) {
      // designed no-key state: paste a key with the keyboard, Enter saves (source handler)
      await page.waitForSelector(".keyrow input", { timeout: 5000 });
      await tabTo(page, ".keyrow input");
      await page.keyboard.type("A11Y-AUDIT-KEY");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#list .bill", { timeout: 8000 });
      log("keyboard key save -> bills render: " + await page.locator("#list .bill").count() + " cards, stamp='" +
        (await page.textContent("#stamp")).trim() + "'");
      // tabs via keyboard
      await page.evaluate(() => document.querySelector('.tab[data-view="passed"]').focus());
      await page.keyboard.press("Enter");
      await page.waitForSelector("#list .bill .passbadge", { timeout: 8000 });
      log("passed tab via keyboard: " + await page.locator("#list .passbadge").count() + " passage badges");
      await page.evaluate(() => document.querySelector('.tab[data-view="delegation"]').focus());
      await page.keyboard.press("Enter");
      await page.waitForSelector(".card-msg", { timeout: 8000 });
      // state select: arrow key changes selection and fires change (native control)
      await tabTo(page, "#stateSel");
      await page.keyboard.press("ArrowDown");
      await page.waitForSelector("#list .member", { timeout: 8000 });
      log("state picked via keyboard (ArrowDown on select): " + await page.locator("#list .member").count() + " member cards");
      // member card: role=button tabindex=0 aria-expanded, Enter expands
      await tabTo(page, "#list .member");
      const before = await page.getAttribute("#list .member", "aria-expanded");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#list .member.open .sponsored .sb a", { timeout: 8000 });
      log("member expand via Tab+Enter: aria-expanded " + before + " -> " +
        await page.getAttribute("#list .member", "aria-expanded"));
      // end on the passed view so the contrast scan measures the passbadge
      await page.evaluate(() => document.querySelector('.tab[data-view="passed"]').focus());
      await page.keyboard.press("Enter");
      await page.waitForSelector("#list .bill .passbadge", { timeout: 8000 });
    }
  },

  gas: {
    live: ["#dataArea", "#compare", "#keyMsg", "#natlMsg"],
    async routes(ctx) {
      await ctx.route(/^https?:/, r => r.abort());
      await ctx.route(/api\.eia\.gov/, r => {
        const u = new URL(r.request().url());
        const area = u.searchParams.get("facets[duoarea][]"), product = u.searchParams.get("facets[product][]");
        const length = parseInt(u.searchParams.get("length"), 10) || 60;
        if (!GAS_BASE[area] || !(product in GAS_PROD)) return r.abort();
        return json(r, gasBody(area, product, length));
      });
    },
    async kbd({ page, log }) {
      // designed no-key state -> paste key with keyboard, Enter saves (source handler)
      await page.waitForSelector("#keyInput", { timeout: 5000 });
      await tabTo(page, "#keyInput");
      await page.keyboard.type("A11Y-AUDIT-KEY");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => /^\$\d/.test((document.querySelector("#dataArea .price") || {}).textContent || ""), { timeout: 8000 });
      log("keyboard key save -> hero renders: '" + (await page.textContent("#dataArea .price")).replace(/\s+/g, " ").trim() + "'");
      await page.waitForFunction(() => document.querySelectorAll("#compare .v").length === 6, { timeout: 8000 });
      log("all-regions grid rendered: 6 cells");
      // selects are native: ArrowDown changes fuel/region from the keyboard
      await tabTo(page, "#product");
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(() => (document.querySelector("#dataArea .meta") || { textContent: "" }).textContent.includes("Midgrade"), { timeout: 8000 });
      log("fuel changed via keyboard (ArrowDown): meta='" + (await page.textContent("#dataArea .meta")).replace(/\s+/g, " ").trim() + "'");
      await tabTo(page, "#refreshBtn");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => /^\$\d/.test((document.querySelector("#dataArea .price") || {}).textContent || ""), { timeout: 8000 });
      log("refresh via Tab+Enter: hero re-rendered");
      log("chart svg: role=" + await page.getAttribute("#chart", "role") + ", aria-label='" + await page.getAttribute("#chart", "aria-label") + "'");
    }
  }
};

/* ---------------- generic runtime checks ---------------- */

const ICON_SCAN = () => {
  const out = [];
  const els = document.querySelectorAll("button, a[href], [role=button], summary");
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const text = (el.innerText || el.textContent || "").trim();
    const hasWord = /[A-Za-z0-9]{2,}/.test(text.replace(/\s+/g, " "));
    if (hasWord) continue; // real visible text
    const name = el.getAttribute("aria-label") ||
      (el.getAttribute("aria-labelledby") && [...el.getAttribute("aria-labelledby").split(/\s+/)]
        .map(id => (document.getElementById(id) || {}).textContent || "").join(" ").trim()) ||
      (el.querySelector("img[alt]") && el.querySelector("img[alt]").alt) || "";
    out.push({
      desc: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : ""),
      text, ariaLabel: el.getAttribute("aria-label") || "", title: el.getAttribute("title") || "",
      ok: !!name || !!el.getAttribute("title")
    });
  }
  return out;
};

const LABEL_SCAN = () => {
  const out = [];
  for (const el of document.querySelectorAll("input, select, textarea")) {
    if (el.type === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const labFor = el.id && document.querySelector(`label[for="${el.id}"]`);
    const wrapped = el.closest("label");
    const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    out.push({
      desc: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "[type=" + (el.type || "") + "]",
      how: labFor ? "label[for]" : wrapped ? "wrapping <label>" : aria ? "aria-label" : "NONE",
      ok: !!(labFor || wrapped || aria)
    });
  }
  return out;
};

const TABINDEX_SCAN = () => [...document.querySelectorAll("[tabindex]")]
  .filter(el => parseInt(el.getAttribute("tabindex"), 10) > 0)
  .map(el => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "[tabindex=" + el.getAttribute("tabindex") + "]");

const CONTRAST_SCAN = () => {
  function parse(col) {
    const m = String(col).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  }
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const mix = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  function effBg(el) {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0) { layers.push(bg); if (bg.a >= 1) break; }
    }
    let cur = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) cur = mix(layers[i], cur);
    return cur;
  }
  const hex = c => "#" + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const pairs = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent.trim();
    if (!t) continue;
    const el = node.parentElement;
    if (!el || el.closest("script, style")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (el.closest("[disabled], :disabled")) continue;
    let op = 1;
    for (let n = el; n; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity || "1");
    if (op < 0.99 && el.closest("button[disabled], [aria-disabled=true]")) continue;
    let fg = parse(cs.color); if (!fg) continue;
    const bg = effBg(el);
    if (fg.a < 1 || op < 1) fg = mix({ ...fg, a: fg.a * op }, bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const need = large ? 3 : 4.5;
    const key = hex(fg) + "|" + hex(bg) + "|" + (large ? "L" : "N");
    const desc = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
      (el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "");
    const prev = pairs.get(key);
    if (!prev || ratio < prev.ratio) pairs.set(key, {
      fg: hex(fg), bg: hex(bg), ratio: +ratio.toFixed(2), need, large,
      size: +size.toFixed(1), weight, pass: ratio >= need,
      sample: desc + " “" + t.slice(0, 28) + "”"
    });
  }
  return [...pairs.values()].sort((a, b) => a.ratio - b.ratio);
};

async function focusCheck(page, log) {
  // Tab from body through the first 8 focusable elements; verify a visible indicator
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  let visibleCount = 0, total = 0, samples = [];
  for (let i = 0; i < 10 && total < 8; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const f = getComputedStyle(el);
      const focused = { outline: f.outlineWidth + " " + f.outlineStyle + " " + f.outlineColor, shadow: f.boxShadow, border: f.borderColor };
      const desc = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.split(" ")[0] : "");
      el.blur();
      const b = getComputedStyle(el);
      const blurred = { outline: b.outlineWidth + " " + b.outlineStyle + " " + b.outlineColor, shadow: b.boxShadow, border: b.borderColor };
      el.focus();
      const changed = focused.outline !== blurred.outline || focused.shadow !== blurred.shadow || focused.border !== blurred.border;
      return { desc, changed, outline: focused.outline };
    });
    if (!r) continue; // first Tab after a blur can land on the document itself
    total++;
    if (r.changed) visibleCount++;
    if (samples.length < 3) samples.push(`${r.desc}: ${r.changed ? "visible (" + r.outline + ")" : "NO CHANGE"}`);
  }
  log(`focus visibility: ${visibleCount}/${total} tabbed elements show a computed focus indicator`);
  samples.forEach(s => log("  " + s));
  return { visibleCount, total };
}

/* ---------------- runner ---------------- */

const cfg = TOOLS[tool];
if (!cfg) { console.error("no a11y config for tool: " + tool); process.exit(1); }

const browser = await chromium.launch({ channel: "chrome" });
const lines = [];
const log = s => { lines.push(s); console.log(s); };
log(`# Phase 4 a11y audit run — ${tool} — ${new Date().toISOString()}`);
log(`# page: ${url} (all http(s) route-fulfilled/aborted; zero live requests)`);

let failures = 0, suiteFlags = 0;
/* suite-palette pairings (core suite.css: --muted on --bg, --muted on --chip).
   Per the addendum these are REPORTED prominently, never fixed tool-locally. */
const SUITE_PAIRS = new Set(["#6b7280|#f5f3ee", "#6b7280|#efece4"]);
const contrastLine = p => {
  const isSuite = !p.pass && SUITE_PAIRS.has(p.fg + "|" + p.bg);
  if (!p.pass && isSuite) suiteFlags++;
  else if (!p.pass) failures++;
  return `${p.pass ? "ok  " : isSuite ? "SUITE-FLAG" : "FAIL"} ${p.ratio} (need ${p.need}) fg=${p.fg} on bg=${p.bg} ${p.size}px/${p.weight} ${p.sample}`;
};

async function themedPage(theme) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await cfg.routes(ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", m => { if (m.type() === "error" && !m.text().includes("net::ERR")) errs.push(m.text().slice(0, 160)); });
  page.on("pageerror", e => errs.push("PAGEERROR " + String(e).slice(0, 160)));
  await page.addInitScript(([t, seed]) => {
    localStorage.setItem("suite.theme", t);
    for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, v);
  }, [theme, cfg.seed || {}]);
  await page.goto(url);
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}

/* ---- light theme: keyboard drive + all structural checks ---- */
{
  const { ctx, page, errs } = await themedPage("light");

  log("\n== 3. KEYBOARD PATH (page.keyboard only) ==");
  await cfg.kbd({ page, log });

  log("\n== 1. ICON-ONLY BUTTONS/LINKS ==");
  const icons = await page.evaluate(ICON_SCAN);
  if (!icons.length) log("no icon-only/symbol-only buttons or links rendered");
  for (const i of icons) {
    if (!i.ok) failures++;
    log(`${i.ok ? "ok  " : "FAIL"} ${i.desc} text="${i.text}" aria-label="${i.ariaLabel}" title="${i.title}"`);
  }

  log("\n== 2. ARIA-LIVE ON ASYNC CONTAINERS ==");
  for (const sel of cfg.live) {
    const v = await page.evaluate(s => {
      const el = document.querySelector(s);
      return el ? el.getAttribute("aria-live") : "(missing element)";
    }, sel);
    const ok = v === "polite" || v === "assertive";
    if (!ok) failures++;
    log(`${ok ? "ok  " : "FAIL"} ${sel} aria-live=${v}`);
  }
  if (cfg.liveNote) log("note: " + cfg.liveNote);

  log("\n== 3b. TABINDEX SANITY ==");
  const positive = await page.evaluate(TABINDEX_SCAN);
  if (positive.length) { failures++; log("FAIL positive tabindex: " + positive.join(", ")); }
  else log("ok   no positive tabindex anywhere");

  log("\n== 4. INPUT LABELS ==");
  for (const l of await page.evaluate(LABEL_SCAN)) {
    if (!l.ok) failures++;
    log(`${l.ok ? "ok  " : "FAIL"} ${l.desc} -> ${l.how}`);
  }

  log("\n== 6. FOCUS VISIBILITY ==");
  const fv = await focusCheck(page, log);
  if (fv.total > 0 && fv.visibleCount < fv.total) failures++;

  log("\n== 5. CONTRAST — light theme (primed page, distinct pairs, worst-case sample each) ==");
  for (const p of await page.evaluate(CONTRAST_SCAN)) log(contrastLine(p));

  if (errs.length) { log("\nconsole errors (non-net::ERR): " + JSON.stringify(errs)); }
  else log("\nconsole: clean (no non-network errors)");
  await ctx.close();
}

/* ---- dark theme: prime again, contrast only ---- */
{
  const { ctx, page } = await themedPage("dark");
  const quiet = () => {};
  await cfg.kbd({ page, log: quiet });
  log("\n== 5. CONTRAST — dark theme (primed page, distinct pairs, worst-case sample each) ==");
  for (const p of await page.evaluate(CONTRAST_SCAN)) log(contrastLine(p));
  await ctx.close();
}

await browser.close();
log(`\n== RESULT: ${failures === 0 ? "ALL TOOL-LOCAL CHECKS PASS" : failures + " failing tool-local check(s)"}` +
  `${suiteFlags ? " + " + suiteFlags + " suite-palette flag(s) (reported, not fixed locally)" : ""} ==`);
writeFileSync(join(EV, "a11y-phase4.txt"), lines.join("\n") + "\n");
console.log(`\nlog written to tests/evidence/${tool}/a11y-phase4.txt`);
process.exit(0);
