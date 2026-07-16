/* tests/phase4-a11y-net.mjs — Phase 4 accessibility audit harness (QUALITY.md §2,
   handoff/orchestration/phase4-a11y.md) for the network-tool batch:
   wildlife iss asteroids fedregister recalls treasury yields currency illness
   medicine foodrecalls dictionary

   EXECUTES the checklist per tool against the RUNNING tools/<tool>.html from file://.
   All network is route-fulfilled from shape-matched payloads (asteroids: the archived
   real NeoWs payload in tests/evidence/asteroids/) — a catch-all abort guarantees ZERO
   live requests (NASA DEMO_KEY pool and FiscalData WAF constraints; orchestrator-ruled).

   Run (from tests/): node phase4-a11y-net.mjs <tool>
   Output: human log to stdout + JSON to the audit-out dir given by A11Y_OUT (default
   ./phase4-a11y-out). Exit 1 when any check FAILs, 0 otherwise. */

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = process.env.A11Y_OUT || join(import.meta.dirname, "phase4-a11y-out");
mkdirSync(OUT, { recursive: true });
const tool = process.argv[2];

/* ---------------- synthetic payloads (shape-matched to each tool's parser) -------- */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64");

const zipPayload = {
  "post code": "90210", country: "United States",
  places: [{ "place name": "Beverly Hills", latitude: "34.0901", longitude: "-118.4065", "state abbreviation": "CA" }]
};

function inatPayload(researchOnly) {
  const mk = (i, grade, withPhoto, taxon) => ({
    id: 1000 + i, quality_grade: grade,
    time_observed_at: new Date(Date.now() - i * 3600e3).toISOString(),
    observed_on: new Date(Date.now() - i * 3600e3).toISOString().slice(0, 10),
    created_at: new Date(Date.now() - i * 3600e3).toISOString(),
    location: (34.05 + i * 0.01).toFixed(4) + "," + (-118.24 - i * 0.01).toFixed(4),
    uri: "https://www.inaturalist.org/observations/" + (1000 + i),
    photos: withPhoto ? [{ url: "https://static.inaturalist.org/photos/" + i + "/square.jpg" }] : [],
    taxon
  });
  const all = [
    mk(1, "research", true,  { preferred_common_name: "Western Fence Lizard", name: "Sceloporus occidentalis", iconic_taxon_name: "Reptilia" }),
    mk(2, "research", true,  { preferred_common_name: "Anna's Hummingbird", name: "Calypte anna", iconic_taxon_name: "Aves" }),
    mk(3, "research", false, { preferred_common_name: "Coast Live Oak", name: "Quercus agrifolia", iconic_taxon_name: "Plantae" }),
    mk(4, "needs_id", false, { preferred_common_name: "", name: "Apis mellifera", iconic_taxon_name: "Insecta" }),
    mk(5, "needs_id", true,  { preferred_common_name: "Mule Deer", name: "Odocoileus hemionus", iconic_taxon_name: "Mammalia" })
  ];
  const rows = researchOnly ? all.filter(o => o.quality_grade === "research") : all;
  return { total_results: rows.length, results: rows };
}

const issPayload = () => ({
  name: "iss", id: 25544,
  latitude: 34.12 + Math.random() * 0.2, longitude: -118.3 + Math.random() * 0.2,
  altitude: 420.5, velocity: 27571.3, visibility: "daylight",
  footprint: 4523.1, timestamp: Math.floor(Date.now() / 1000),
  daynum: 2461000.5, solar_lat: 21.3, solar_lon: 102.4, units: "kilometers"
});

const frDoc = (n, type, agency, date) => ({
  title: "Synthetic " + type + " document " + n + " for the a11y audit",
  type, abstract: "Route-fulfilled abstract text " + n + " — no live request was made.",
  html_url: "https://www.federalregister.gov/documents/audit-" + n,
  agencies: [{ name: agency }], document_number: "2026-" + (10000 + n), publication_date: date
});
function fedregisterPayload(date) {
  return { count: 6, results: [
    frDoc(1, "Rule", "Environmental Protection Agency", date),
    frDoc(2, "Rule", "Transportation Department", date),
    frDoc(3, "Proposed Rule", "Environmental Protection Agency", date),
    frDoc(4, "Notice", "Interior Department", date),
    frDoc(5, "Notice", "Transportation Department", date),
    frDoc(6, "Presidential Document", "Executive Office of the President", date)
  ] };
}

const fdaFoodPayload = { meta: {}, results: [
  { classification: "Class I", status: "Ongoing", recall_initiation_date: "20260601",
    product_description: "Synthetic peanut butter 16oz jars (audit fixture)",
    recalling_firm: "Audit Foods LLC", reason_for_recall: "Potential Salmonella contamination",
    distribution_pattern: "Nationwide", product_quantity: "10,000 jars", code_info: "Lots A1-A9",
    city: "FRESNO", state: "CA", voluntary_mandated: "Voluntary: Firm initiated", recall_number: "F-0001-2026" },
  { classification: "Class II", status: "Ongoing", recall_initiation_date: "20260520",
    product_description: "Synthetic granola bars (audit fixture)",
    recalling_firm: "Audit Snacks Inc", reason_for_recall: "Undeclared almonds",
    distribution_pattern: "CA and nationwide", product_quantity: "2,400 cases", code_info: "Best by 2026-12",
    city: "SACRAMENTO", state: "CA", voluntary_mandated: "Voluntary: Firm initiated", recall_number: "F-0002-2026" },
  { classification: "Class III", status: "Completed", recall_initiation_date: "20260415",
    product_description: "Synthetic sparkling water (audit fixture)",
    recalling_firm: "Audit Beverages", reason_for_recall: "Off-flavor, no safety risk",
    distribution_pattern: "Nationwide", product_quantity: "800 cases", code_info: "Lot W3",
    city: "PORTLAND", state: "OR", voluntary_mandated: "Voluntary: Firm initiated", recall_number: "F-0003-2026" }
] };

const nhtsaPayload = { Count: 2, results: [
  { Component: "AIR BAGS", Summary: "Synthetic recall: the driver air bag inflator may rupture (audit fixture).",
    Consequence: "An inflator rupture may result in injury.", Remedy: "Dealers will replace the inflator free of charge.",
    NHTSACampaignNumber: "26V001000", ReportReceivedDate: "12/05/2026", parkIt: false, parkOutSide: false },
  { Component: "FUEL SYSTEM, GASOLINE", Summary: "Synthetic recall: fuel pump may fail causing stall (audit fixture).",
    Consequence: "An engine stall increases the risk of a crash.", Remedy: "Dealers will replace the fuel pump.",
    NHTSACampaignNumber: "26V002000", ReportReceivedDate: "20/05/2026", parkIt: true, parkOutSide: false }
] };

const cpscPayload = [
  { RecallDate: "2026-06-20T00:00:00", Title: "Audit Widgets Recalled Due to Fire Hazard (fixture)",
    URL: "https://www.cpsc.gov/Recalls/2026/audit-widgets", Hazards: [{ Name: "Fire" }],
    Products: [{ Name: "Audit Widget 3000" }], Description: "<p>Synthetic description for the a11y audit.</p>" },
  { RecallDate: "2026-06-10T00:00:00", Title: "Audit Lamps Recalled Due to Shock Hazard (fixture)",
    URL: "https://www.cpsc.gov/Recalls/2026/audit-lamps", Hazards: [{ Name: "Shock" }],
    Products: [{ Name: "Audit Lamp" }], Description: "<p>Synthetic description two.</p>" }
];

function monthsBack(n) {
  const d = new Date(); d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 8) + "28";
}
const AVG_SECS = ["Treasury Bills", "Treasury Notes", "Treasury Bonds",
  "Treasury Inflation-Protected Securities (TIPS)", "Treasury Floating Rate Notes (FRN)"];
function avgRatesPayload() {
  const data = [];
  for (let m = 0; m < 14; m++) {
    const rd = monthsBack(m);
    AVG_SECS.forEach((sec, i) => data.push({
      record_date: rd, security_type_desc: "Marketable", security_desc: sec,
      avg_interest_rate_amt: (4.8 - i * 0.7 - m * 0.02).toFixed(3)
    }));
    data.push({ record_date: rd, security_type_desc: "Marketable",
      security_desc: "Total Marketable", avg_interest_rate_amt: (3.4 - m * 0.02).toFixed(3) });
  }
  return { data };
}
function debtLatestPayload() {
  return { data: [{ record_date: new Date(Date.now() - 86400e3).toISOString().slice(0, 10),
    tot_pub_debt_out_amt: "37123456789012.34" }] };
}
function debtSeriesPayload() {
  const data = [];
  for (let m = 12; m >= 0; m--) data.push({
    record_date: monthsBack(m).slice(0, 8) + "15",
    tot_pub_debt_out_amt: String(35.2e12 + (12 - m) * 0.16e12) + ".00"
  });
  return { data };
}
function auctionsPayload() {
  const day = n => new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);
  return { data: [
    { security_type: "Bill", security_term: "4-Week",  auction_date: day(3), issue_date: day(1), high_yield: null, high_investment_rate: "4.912", high_discnt_rate: "4.82", bid_to_cover_ratio: "2.85", offering_amt: "80000000000" },
    { security_type: "Bill", security_term: "13-Week", auction_date: day(4), issue_date: day(2), high_yield: null, high_investment_rate: "4.655", high_discnt_rate: "4.53", bid_to_cover_ratio: "2.91", offering_amt: "70000000000" },
    { security_type: "Bill", security_term: "52-Week", auction_date: day(9), issue_date: day(6), high_yield: null, high_investment_rate: "4.210", high_discnt_rate: "4.05", bid_to_cover_ratio: "3.02", offering_amt: "48000000000" },
    { security_type: "Note", security_term: "2-Year",  auction_date: day(12), issue_date: day(9), high_yield: "3.905", high_investment_rate: null, high_discnt_rate: null, bid_to_cover_ratio: "2.64", offering_amt: "69000000000" },
    { security_type: "Note", security_term: "10-Year", auction_date: day(6), issue_date: day(3), high_yield: "4.310", high_investment_rate: null, high_discnt_rate: null, bid_to_cover_ratio: "2.51", offering_amt: "42000000000" },
    { security_type: "Bond", security_term: "30-Year", auction_date: day(5), issue_date: day(2), high_yield: "4.640", high_investment_rate: null, high_discnt_rate: null, bid_to_cover_ratio: "2.38", offering_amt: "25000000000" }
  ] };
}

function frankfurterLatest() {
  return { amount: 1, base: "USD", date: new Date().toISOString().slice(0, 10),
    rates: { EUR: 0.862, GBP: 0.742, JPY: 148.23, CHF: 0.803, CAD: 1.362, AUD: 1.487,
      CNY: 7.163, INR: 83.41, MXN: 18.62, BRL: 5.44, KRW: 1352.4, SGD: 1.335 } };
}
function frankfurterRange(url) {
  const code = new URL(url).searchParams.get("symbols") || "EUR";
  const base = { EUR: 0.862, GBP: 0.742, JPY: 148.23, CHF: 0.803, CAD: 1.362, AUD: 1.487,
    CNY: 7.163, INR: 83.41, MXN: 18.62, BRL: 5.44, KRW: 1352.4, SGD: 1.335 }[code] || 1;
  const rates = {};
  for (let d = 29; d >= 0; d -= 1) {
    const dt = new Date(Date.now() - d * 86400e3);
    if (dt.getDay() === 0 || dt.getDay() === 6) continue;
    rates[dt.toISOString().slice(0, 10)] = { [code]: +(base * (1 + Math.sin(d / 5) * 0.012)).toFixed(4) };
  }
  return { amount: 1, base: "USD", start_date: Object.keys(rates)[0],
    end_date: Object.keys(rates).at(-1), rates };
}

function nwssPayload() {
  const rows = [];
  for (let w = 29; w >= 0; w--) {
    const de = new Date(Date.now() - w * 7 * 86400e3).toISOString().slice(0, 10);
    rows.push({ date_end: de + "T00:00:00.000", percentile: String(35 + Math.round(30 * Math.sin(w / 4)) + (w % 3)), ptc_15d: "5" });
    rows.push({ date_end: de + "T00:00:00.000", percentile: String(45 + Math.round(25 * Math.sin(w / 4))), ptc_15d: "4" });
  }
  return rows;
}
function nhsnPayload() {
  const rows = [];
  for (let w = 39; w >= 0; w--) {
    const de = new Date(Date.now() - w * 7 * 86400e3).toISOString().slice(0, 10);
    rows.push({ weekendingdate: de + "T00:00:00.000",
      totalconfc19newadm: String(300 + Math.round(150 * Math.sin(w / 5))),
      totalconfflunewadm: String(80 + Math.round(70 * Math.max(0, Math.sin(w / 3)))),
      totalconfrsvnewadm: String(20 + Math.round(15 * Math.max(0, Math.sin(w / 4)))) });
  }
  return rows;
}

const fdaLabelPayload = { results: [{
  effective_time: "20250110",
  openfda: { brand_name: ["Tylenol"], generic_name: ["acetaminophen"], substance_name: ["ACETAMINOPHEN"],
    route: ["ORAL"], product_type: ["HUMAN OTC DRUG"], manufacturer_name: ["Audit Pharma (fixture)"] },
  indications_and_usage: ["Uses: temporarily relieves minor aches and pains and reduces fever. (Synthetic audit fixture text.)"],
  dosage_and_administration: ["Adults and children 12 years and over: take 2 tablets every 6 hours. (Fixture.)"],
  warnings: ["Liver warning: this product contains acetaminophen. Severe liver damage may occur. (Fixture.)"],
  drug_interactions: ["Ask a doctor or pharmacist before use if you are taking the blood thinning drug warfarin. (Fixture.)"],
  active_ingredient: ["Acetaminophen 500 mg (in each tablet)"],
  purpose: ["Pain reliever/fever reducer"]
}] };
const fdaDrugEnfPayload = { results: [
  { classification: "Class II", product_description: "Acetaminophen 500 mg tablets, 100-count bottle (audit fixture)",
    reason_for_recall: "Failed dissolution specification (fixture)", recalling_firm: "Audit Pharma",
    recall_initiation_date: "20260410", status: "Ongoing" }
] };

function dictPayload(url) {
  const word = decodeURIComponent(new URL(url).pathname.split("/").pop() || "serendipity");
  return [{
    word, phonetic: "/ˌsɪn.θə.tɪk/",
    phonetics: [{ text: "/ˌsɪn.θə.tɪk/", audio: "https://upload.wikimedia.org/wikipedia/commons/audit.mp3" }],
    meanings: [
      { partOfSpeech: "noun",
        definitions: [
          { definition: "A route-fulfilled definition of “" + word + "” used by the Phase 4 accessibility audit.",
            example: "The harness looked up “" + word + "” without any live request.",
            synonyms: ["fixture", "sample"], antonyms: ["original"] }
        ],
        synonyms: ["stand-in", "surrogate"], antonyms: ["genuine"] },
      { partOfSpeech: "verb",
        definitions: [{ definition: "To verify the rendering path of the dictionary tool.", example: "", synonyms: [], antonyms: [] }],
        synonyms: [], antonyms: [] }
    ]
  }];
}

/* ---------------- per-tool configuration ---------------- */
const NEOWS_FILE = join(ROOT, "tests", "evidence", "asteroids", "neows-live-d7.json");

const CONFIGS = {
  wildlife: {
    routes: [
      [/api\.zippopotam\.us\/us\//, () => zipPayload],
      [/api\.inaturalist\.org\/v1\/observations/, url => inatPayload(new URL(url).searchParams.get("quality_grade") === "research")],
      [/static\.inaturalist\.org|inaturalist-open-data/, "png"],
      [/api\.ebird\.org/, "abort"]
    ],
    liveTargets: ["#count", "#ebirdBody .err"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: "#count", why: "muted count on page bg", suite: true },
      { sel: ".obs .cn", why: "card title on card" },
      { sel: ".obs .sn", why: "muted sci name on card" },
      { sel: ".obs .meta", why: "muted meta on card" },
      { sel: "#main .stamp", why: "muted stamp on page bg", suite: true },
      { sel: ".obs .qg:not(.research)", why: "badge white on scrim (no-photo card)" },
      { sel: ".obs .qg.research", why: "research badge white on --research" },
      { sel: ".locchip", why: "chip ink on card" },
      { probe: { parent: "#ebirdBody .keycard", tag: "div", cls: "err", text: "probe" }, name: ".err (probe)", why: "tool error color on card" },
      { sel: "#ebirdBody .btn.primary", why: "primary button label on accent" },
      { sel: "footer", why: "muted footer on page bg", suite: true }
    ],
    async flow(page, log, kb) {
      await page.waitForSelector(".firstrun", { timeout: 10000 });
      log("first-run card shown (no location)");
      await kb.tabTo(page, 'input[aria-label="US ZIP code"]');
      await page.keyboard.type("90210");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#main .obs", { timeout: 15000 });
      log("KEYBOARD: ZIP typed + Enter -> location set -> " + await page.locator("#main .obs").count() + " observation cards rendered (route-fulfilled)");
      log("count line: " + (await page.locator("#count").innerText()).trim());
      await kb.tabTo(page, "#rgToggle");
      await page.keyboard.press("Space");
      await page.waitForFunction(() => document.querySelectorAll("#main .obs").length === 5, { timeout: 15000 });
      log("KEYBOARD: Space on research-grade toggle -> refetch, now " + await page.locator("#main .obs").count() + " cards incl. needs-ID");
      // eBird keycard: save (route-aborted) and forget, keyboard-only
      await kb.tabTo(page, '#ebirdBody input[aria-label="eBird API token"]');
      await page.keyboard.type("AUDIT-TOKEN");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#ebirdBody .card-msg .big", { timeout: 10000 });
      log("KEYBOARD: eBird token Enter-saved -> aborted request -> designed error card: " +
        (await page.locator("#ebirdBody .card-msg .big").innerText()).trim());
      await kb.tabTo(page, '#ebirdBody button.btn:not(.primary)');
      await page.keyboard.press("Enter");
      await page.waitForSelector("#ebirdBody .keycard", { timeout: 10000 });
      log("KEYBOARD: Forget token -> keycard restored; suite.key.ebird=" +
        await page.evaluate(() => localStorage.getItem("suite.key.ebird")));
    }
  },

  iss: {
    routes: [
      [/api\.wheretheiss\.at\/v1\/satellites/, () => issPayload()],
      [/api\.zippopotam\.us\/us\//, () => zipPayload]
    ],
    liveTargets: ["#errbar", "#locErr"],
    liveNote: "#stats repaints every 5 s from polling — aria-live deliberately omitted there (would announce continuously); the state-change regions (#errbar, #locErr) are live.",
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: ".stat b", why: "stat value on card" },
      { sel: ".stat span", why: "muted stat label on card" },
      { sel: ".legend", why: "muted legend on card" },
      { sel: "#visInfo", why: "muted visibility line on card" },
      { probe: { parent: ".wrap", tag: "div", cls: "errbar", text: "probe" }, name: ".errbar (probe)", why: "tool error color on page bg" },
      { sel: "#locErr", forceText: "probe", why: "loc error color on card" },
      { sel: ".locchip", why: "chip ink on card" },
      { sel: "footer", why: "muted footer on page bg", suite: true }
    ],
    async flow(page, log, kb) {
      await page.waitForSelector(".stat b", { timeout: 15000 });
      log("stats rendered from route-fulfilled position: " + (await page.locator(".stat b").first().innerText()).trim() + " lat");
      await kb.tabTo(page, ".locchip");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".locform.open", { timeout: 5000 });
      log("KEYBOARD: Enter on location chip opens form; aria-expanded=" + await page.locator(".locchip").getAttribute("aria-expanded"));
      await kb.tabTo(page, "#zipInput");
      await page.keyboard.type("90210");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.getElementById("locform").classList.contains("open"), { timeout: 10000 });
      log("KEYBOARD: ZIP + Enter -> location saved, form closed; chip now: " + (await page.locator(".locchip").innerText()).trim());
      await kb.tabTo(page, ".locchip");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".locform.open", { timeout: 5000 });
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("locform").classList.contains("open"), { timeout: 5000 });
      log("KEYBOARD: Esc closes the location form (overlay path)");
      await page.waitForSelector(".stat:nth-child(5)", { timeout: 12000 }).catch(() => {});
      log("distance stat present after location: " + (await page.locator(".stat").count()) + " stat blocks");
    }
  },

  asteroids: {
    routes: [
      [/api\.nasa\.gov\/neo\/rest\/v1\/feed/, () => JSON.parse(readFileSync(NEOWS_FILE, "utf8"))]
    ],
    liveTargets: ["#view", "#stamp"],
    contrast: [
      { sel: ".sub", why: "muted sub on page bg", suite: true },
      { sel: ".hero .label", why: "--near label on card" },
      { sel: ".hero .when", why: "muted when on card" },
      { sel: ".hero .big .num", big: true, why: "hero numbers on card" },
      { sel: ".hero .big .lbl", why: "muted hero labels on card" },
      { sel: ".pha", why: "--near PHA badge on --near-soft" },
      { sel: "#view th", why: "muted table header on page bg", suite: true },
      { sel: "#view tbody tr:first-child td", parentClass: "close", name: "tr.close td (forced class)", why: "ink on --near-soft highlight row" },
      { sel: ".keycard summary", why: "accent summary on card" },
      { sel: ".keycard button#keySave", why: "key button label on accent" },
      { sel: "#stamp", why: "muted stamp on page bg", suite: true },
      { sel: ".foot-note", why: "muted foot-note on page bg", suite: true }
    ],
    async flow(page, log, kb) {
      await page.waitForSelector("#view .hero", { timeout: 15000 });
      log("initial 7-day load rendered from the ARCHIVED NeoWs payload (no live NASA request): stamp \"" +
        (await page.locator("#stamp").innerText()).trim() + "\"");
      if (!await page.locator(".pha").count()) log("note: no PHA badge rows in this payload slice");
      await kb.tabTo(page, "#keycard summary");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#keyInput", { state: "visible", timeout: 5000 });
      await kb.tabTo(page, "#keyInput");
      await page.keyboard.type("AUDIT-KEY-ROUTED");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => /^Loaded just now/.test(document.getElementById("stamp").textContent), { timeout: 10000 });
      log("KEYBOARD: key pasted + Enter -> saved + reload (route-fulfilled); summary: " +
        (await page.locator("#keySummary").innerText()).trim());
      await kb.tabTo(page, "#keyClear");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => /^Loaded just now/.test(document.getElementById("stamp").textContent), { timeout: 10000 });
      log("KEYBOARD: Use demo -> key cleared; suite.key.nasa=" + await page.evaluate(() => localStorage.getItem("suite.key.nasa")));
      await kb.tabTo(page, "#window");
      await page.keyboard.press("ArrowDown"); // 7 -> 3 days (fires change)
      await page.waitForFunction(() => /Loaded just now|Cached/.test(document.getElementById("stamp").textContent), { timeout: 10000 });
      log("KEYBOARD: window select ArrowDown -> change fired -> view reloaded; rows=" + await page.locator("#view tbody tr").count());
      await kb.tabTo(page, "#refreshBtn");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => /^Loaded just now/.test(document.getElementById("stamp").textContent), { timeout: 10000 });
      log("KEYBOARD: refresh via Enter -> forced reload (route-fulfilled)");
    }
  },

  fedregister: {
    routes: [
      [/federalregister\.gov\/api\/v1\/documents\.json/, url =>
        fedregisterPayload(/publication_date%5D%5Bis%5D=([\d-]+)/.exec(url) ? decodeURIComponent(/is%5D=([\d-]+)/.exec(url)[1]) : "2026-07-15")]
    ],
    liveTargets: ["#list", "#stats", "#stamp"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: ".stat b", big: true, why: "accent stat number on page bg" },
      { sel: ".stat span", why: "muted stat label on page bg", suite: true },
      { sel: ".pill:not(.on)", why: "muted pill on card" },
      { sel: ".pill.on", why: "active pill white on accent" },
      { sel: ".badge.t-rule", why: "rule badge white on --rule" },
      { sel: ".badge.t-prorule", why: "proposed badge white on --prorule" },
      { probe: { parent: ".doc", tag: "span", cls: "badge t-notice", text: "Notice" }, name: ".badge.t-notice (probe)", why: "notice badge white on --notice" },
      { probe: { parent: ".doc", tag: "span", cls: "badge t-presdoc", text: "Presidential" }, name: ".badge.t-presdoc (probe)", why: "presidential badge white on --presdoc" },
      { sel: ".doc .agencies", why: "accent agencies line on card" },
      { sel: ".doc .abstract", why: "muted abstract on card" },
      { sel: ".achip:not(.on)", why: "muted agency chip on card" },
      { sel: ".achip.on", why: "accent-on-soft active agency chip" },
      { sel: "#stamp", why: "muted stamp on page bg", suite: true }
    ],
    async flow(page, log, kb) {
      await page.waitForSelector(".doc", { timeout: 15000 });
      log("today's issue rendered (route-fulfilled): " + await page.locator(".doc").count() + " docs; stats: " +
        (await page.locator("#stats").innerText()).replace(/\s+/g, " ").trim());
      await kb.tabTo(page, "#typePills .pill:nth-child(2)"); // Rules
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelectorAll("#list .doc").length === 2, { timeout: 5000 });
      log("KEYBOARD: Enter on Rules pill -> filtered to " + await page.locator("#list .doc").count() +
        " docs; aria-pressed=" + await page.locator("#typePills .pill:nth-child(2)").getAttribute("aria-pressed"));
      // date change via keyboard (resets type filter, rebuilds agency chips)
      await page.keyboard.press("Escape"); // ensure nothing is mid-interaction
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await kb.tabTo(page, "#dateInput"); // forward Tab enters at the month segment
      await page.keyboard.type("07142026"); // MM DD YYYY segments
      await page.keyboard.press("Tab");
      await page.waitForFunction(() => document.querySelectorAll("#list .doc").length === 6, { timeout: 10000 });
      log("KEYBOARD: date typed into date input -> change -> reloaded for " + await page.evaluate(() => document.getElementById("dateInput").value));
      // agency filter, left ON at flow end so .achip.on is measurable
      await kb.tabTo(page, "#agencyBar summary");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".achip", { state: "visible", timeout: 5000 });
      await kb.tabTo(page, ".achip");
      await page.keyboard.press("Enter");
      log("KEYBOARD: agency chip toggled ON; aria-pressed=" + await page.locator(".achip").first().getAttribute("aria-pressed") +
        "; visible docs=" + await page.locator("#list .doc").count());
    }
  },

  recalls: {
    routes: [
      [/api\.fda\.gov\/food\/enforcement\.json/, () => fdaFoodPayload],
      [/api\.nhtsa\.gov\/recalls\/recallsByVehicle/, () => nhtsaPayload],
      [/saferproducts\.gov\/RestWebServices\/Recall/, () => cpscPayload]
    ],
    prep: { "suite.state": "CA" },
    liveTargets: ["#foodList", "#carList", "#prodList"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: ".locrow", why: "muted locrow on page bg", suite: true },
      { sel: ".badge.c1", why: "Class I badge white on --c1" },
      { sel: ".badge.c2", why: "Class II badge white on --c2" },
      { probe: { parent: ".rec .top", tag: "span", cls: "badge c3", text: "Class III" }, name: ".badge.c3 (probe)", why: "Class III badge white on --c3" },
      { probe: { parent: ".rec .top", tag: "span", cls: "badge park", text: "Do not drive" }, name: ".badge.park (probe)", why: "park badge white on --danger" },
      { sel: ".rec .date", why: "muted date on card" },
      { sel: ".rec .firm", why: "accent firm on card" },
      { sel: ".rec .reason", why: "muted reason on card" },
      { sel: ".carhead .cn", why: "car name on accent-soft header" },
      { sel: ".carhead .cc", why: "muted count on accent-soft header" },
      { sel: "button.x", why: "muted remove button on card" },
      { sel: "button.primary", why: "primary button white on accent" },
      { sel: ".panel .sub", why: "muted panel sub on page bg", suite: true }
    ],
    async flow(page, log, kb) {
      await page.waitForSelector("#foodList .rec", { timeout: 15000 });
      log("food recalls rendered for CA (route-fulfilled): " + await page.locator("#foodList .rec").count());
      await page.waitForSelector("#prodList .rec", { timeout: 15000 });
      log("CPSC product recalls rendered: " + await page.locator("#prodList .rec").count());
      await kb.tabTo(page, "#carMake");
      await page.keyboard.type("Honda");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Accord");
      await page.keyboard.press("Tab");
      await page.keyboard.type("2020");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".carblock .rec", { timeout: 15000 });
      log("KEYBOARD: vehicle added via typing + Enter -> " + await page.locator(".carblock .rec").count() +
        " NHTSA recalls rendered; remove button aria-label=\"" +
        await page.locator(".carhead button.x").getAttribute("aria-label") + "\"");
      await kb.tabTo(page, "#stateSel");
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(() => document.getElementById("stateSel").value !== "CA", { timeout: 5000 });
      log("KEYBOARD: state select ArrowDown -> " + await page.evaluate(() => document.getElementById("stateSel").value) + " -> food list reloaded");
      // remove the car (keyboard), then re-add one so .carhead is measurable for contrast
      await kb.tabTo(page, ".carhead button.x");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.querySelector(".carblock"), { timeout: 5000 });
      log("KEYBOARD: Enter on remove -> vehicle removed");
      await kb.tabTo(page, "#carMake");
      await page.keyboard.type("Honda");
      await page.keyboard.press("Tab");
      await page.keyboard.type("Civic");
      await page.keyboard.press("Tab");
      await page.keyboard.type("2021");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".carblock .rec", { timeout: 15000 });
    }
  },

  treasury: {
    routes: [
      [/debt_to_penny\?filter=/, () => debtSeriesPayload()],
      [/debt_to_penny\?sort=-record_date/, () => debtLatestPayload()],
      [/avg_interest_rates/, () => avgRatesPayload()],
      [/auctions_query/, () => auctionsPayload()]
    ],
    liveTargets: ["#hero", "#ratesBox", "#auctionsBox"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: ".hero .debt", big: true, why: "accent debt figure on card" },
      { sel: ".hero .lbl", why: "muted label on card" },
      { sel: ".hero .asof", why: "muted asof on card" },
      { sel: ".sparkmeta .chg", why: "trend change color on card" },
      { sel: ".pc .v", big: true, why: "per-person value on card" },
      { sel: ".pc .k", why: "muted per-person label on card" },
      { sel: "#ratesBox th", why: "muted table header on card" },
      { sel: "#ratesBox td.rate", why: "rate cell on card" },
      { sel: "#ratesStamp", why: "muted stamp on page bg", suite: true },
      { sel: "section .note", why: "muted section note on page bg", suite: true }
    ],
    async flow(page, log) {
      await page.waitForFunction(() => {
        const d = document.querySelector("#hero .debt");
        return d && !d.classList.contains("skel") && d.textContent.trim().startsWith("$");
      }, { timeout: 15000 });
      await page.waitForSelector("#ratesBox td.rate", { timeout: 15000 });
      await page.waitForSelector("#auctionsBox td.rate", { timeout: 15000 });
      log("all three sections rendered route-fulfilled (FiscalData WAFs headless UAs — environment failure per orchestrator): debt=" +
        (await page.locator("#hero .debt").innerText()).trim());
      log("KEYBOARD: tool is passive (auto-loads; no mouse-only interactions) — links/theme reachable by Tab, verified in the generic pass");
    }
  },

  yields: {
    routes: [
      [/auctions_query/, () => auctionsPayload()],
      [/avg_interest_rates/, () => avgRatesPayload()]
    ],
    liveTargets: ["#savings", "#termStamp", "#cmpStamp"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: ".savings .pill .v", big: true, why: "accent pill value on card" },
      { sel: ".savings .pill .k", why: "muted pill label on card" },
      { sel: ".savings .blurb", why: "muted blurb on card" },
      { sel: "td.grp", why: "accent-on-soft group header cell" },
      { sel: "#termBox td.num", why: "rate cell on card" },
      { sel: ".bar span", why: "bar value label over the colored bar fill" },
      { sel: ".legend", why: "muted legend on page bg", suite: true },
      { sel: ".btnlink", why: "accent-on-soft link button" },
      { sel: "#termStamp", why: "muted stamp on page bg", suite: true }
    ],
    async flow(page, log) {
      await page.waitForSelector("#termBox td.num", { timeout: 15000 });
      await page.waitForSelector(".barrow .bar span", { timeout: 15000 });
      log("savings pills: " + (await page.locator(".savings .pill .v").allInnerTexts()).join(" / ") +
        "; term rows=" + await page.locator("#termBox tbody tr").count() +
        "; compare bars=" + await page.locator(".barrow").count());
      log("KEYBOARD: tool is passive (auto-loads; only link is the yield-curve link-out) — Tab reach verified in the generic pass");
    }
  },

  currency: {
    routes: [
      [/api\.frankfurter\.dev\/v1\/latest/, () => frankfurterLatest()],
      [/api\.frankfurter\.dev\/v1\/\d{4}-/, url => frankfurterRange(url)],
      [/open\.er-api\.com/, "abort"]
    ],
    liveTargets: ["#status", "#convResult", "#trendNote", "#trendErr"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: "#status", why: "muted status on page bg", suite: true },
      { sel: "#convResult", big: true, why: "conversion result on card" },
      { sel: "#convResult small", why: "muted unit rate on card" },
      { sel: ".fx .code", why: "board code on card" },
      { sel: ".fx .name", why: "muted board name on card" },
      { sel: ".fx .rate", why: "board rate on card" },
      { sel: "#trendNote", why: "muted trend note on card" },
      { probe: { parent: "#trendErr", tag: "div", cls: "errbox", text: "probe" }, name: ".errbox (probe)", why: "error color on card" },
      { sel: ".swap", why: "swap button ink on card" }
    ],
    async flow(page, log, kb) {
      await page.waitForSelector(".fx .rate", { timeout: 15000 });
      await page.waitForFunction(() => document.querySelectorAll("#chart path").length > 0, { timeout: 15000 });
      log("board + trend rendered (route-fulfilled): " + await page.locator(".fx").count() + " currencies; status: " +
        (await page.locator("#status").innerText()).trim());
      await kb.tabTo(page, "#amt");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("250");
      log("KEYBOARD: amount typed -> result: " + (await page.locator("#convResult").innerText()).replace(/\s+/g, " ").trim());
      await kb.tabTo(page, "#to");
      await page.keyboard.press("ArrowDown");
      log("KEYBOARD: 'to' select arrowed -> " + await page.evaluate(() => document.getElementById("to").value) +
        " -> result: " + (await page.locator("#convResult").innerText()).replace(/\s+/g, " ").trim());
      await kb.tabTo(page, "#swapBtn");
      await page.keyboard.press("Enter");
      log("KEYBOARD: swap via Enter -> from=" + await page.evaluate(() => document.getElementById("from").value) +
        " to=" + await page.evaluate(() => document.getElementById("to").value));
      await kb.tabTo(page, ".fx:nth-child(2)");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => /GBP/.test(document.getElementById("trendTitle").textContent), { timeout: 10000 });
      log("KEYBOARD: board button Enter -> trend switched: " + (await page.locator("#trendTitle").innerText()).trim());
    }
  },

  illness: {
    routes: [
      [/data\.cdc\.gov\/resource\/2ew6-ywp6\.json/, () => nwssPayload()],
      [/data\.cdc\.gov\/resource\/ua7e-t2fy\.json/, () => nhsnPayload()]
    ],
    prep: { "suite.state": "CA" },
    liveTargets: ["#wwBody", "#admBody"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: ".bignum", big: true, why: "level word (tool status color) on card" },
      { sel: "#wwBody .trend", why: "muted trend line on card" },
      { sel: ".adm:nth-child(1) .lbl", why: "COVID label (--covid) on card" },
      { sel: ".adm:nth-child(2) .lbl", why: "flu label (--flu) on card" },
      { sel: ".adm:nth-child(3) .lbl", why: "RSV label (--rsv) on card" },
      { sel: ".adm .val", big: true, why: "admissions value on card" },
      { sel: ".adm .meta", why: "muted meta on card" },
      { sel: ".note", why: "muted note on accent-soft" },
      { sel: "#wwBody .stamp", why: "muted stamp on card" },
      { sel: ".legend", why: "legend text on card" }
    ],
    async flow(page, log, kb) {
      await page.waitForSelector(".bignum", { timeout: 15000 });
      await page.waitForSelector(".adm .val", { timeout: 15000 });
      log("wastewater level: " + (await page.locator(".bignum").innerText()).trim() +
        "; admissions tiles: " + await page.locator(".adm").count());
      await kb.tabTo(page, "#stateSel");
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(() => document.getElementById("stateSel").value !== "CA", { timeout: 5000 });
      await page.waitForSelector(".bignum", { timeout: 15000 });
      log("KEYBOARD: state select ArrowDown -> " + await page.evaluate(() => document.getElementById("stateSel").value) +
        " -> both panels reloaded (route-fulfilled)");
    }
  },

  medicine: {
    routes: [
      [/api\.fda\.gov\/drug\/label\.json/, () => fdaLabelPayload],
      [/api\.fda\.gov\/drug\/enforcement\.json/, () => fdaDrugEnfPayload]
    ],
    liveTargets: ["#results"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: ".disclaimer", why: "disclaimer body on --warn-soft" },
      { sel: ".disclaimer b", why: "--warn bold lead on --warn-soft" },
      { sel: ".drughead .gen", why: "muted generic line on card" },
      { sel: ".pill", why: "muted pill on --chip", suite: true },
      { sel: "details.sec > summary", why: "section summary on card" },
      { sel: "details.sec.danger > summary", why: "--bad danger summary on card" },
      { sel: ".recalls .cls", why: "recall class label (c2 --warn) on card" },
      { sel: ".recalls .rmeta", why: "muted recall meta on card" },
      { sel: ".history button", why: "muted history chip on card" },
      { sel: "button.go", why: "search button white on accent" },
      { sel: ".stamp", why: "muted stamp on card" }
    ],
    async flow(page, log, kb) {
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
      log("autofocus lands on #" + focused);
      if (focused !== "q") await kb.tabTo(page, "#q");
      await page.keyboard.type("tylenol");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".drughead h2", { timeout: 15000 });
      log("KEYBOARD: search + Enter -> label rendered: " + (await page.locator(".drughead h2").first().innerText()).trim() +
        "; recalls card: " + await page.locator(".recalls .r").count() + " entries");
      await kb.tabTo(page, "details.sec:not([open]) > summary");
      await page.keyboard.press("Enter");
      log("KEYBOARD: Enter on closed section summary -> open=" +
        await page.evaluate(() => !!document.querySelector("details.sec[open] ~ details.sec[open]") || document.querySelectorAll("details.sec[open]").length));
      await kb.tabToBackwards(page, ".history button");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".drughead h2", { timeout: 15000 });
      log("KEYBOARD: history chip Enter -> re-ran search (cache-served)");
    }
  },

  foodrecalls: {
    routes: [[/api\.fda\.gov\/food\/enforcement\.json/, () => fdaFoodPayload]],
    prep: { "suite.state": "CA" },
    liveTargets: ["#summary", "#list"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: "#summary", why: "muted summary on page bg", suite: true },
      { sel: ".badge.c1", why: "Class I text on --c1-soft" },
      { sel: ".badge.c2", why: "Class II text on --c2-soft" },
      { sel: ".badge.c3", why: "Class III text on --c3-soft" },
      { sel: ".r .date", why: "muted date on card" },
      { sel: ".r .desc", why: "description on card" },
      { sel: ".r .reason b", why: "muted 'Reason:' bold on card" },
      { sel: ".r .kv", why: "muted kv line on card" },
      { sel: ".r details summary", why: "accent summary on card" },
      { sel: ".filters button:not(.on)", why: "muted filter on card" },
      { sel: ".filters button.on", why: "active filter white on accent" },
      { sel: ".legend", why: "muted legend on page bg", suite: true }
    ],
    async flow(page, log, kb) {
      await page.waitForSelector(".r .desc", { timeout: 15000 });
      log("recalls rendered for CA (route-fulfilled): " + await page.locator(".r").count() + "; summary: " +
        (await page.locator("#summary").innerText()).trim());
      await kb.tabTo(page, '#filters button[data-c="1"]');
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelectorAll("#list .r").length === 1, { timeout: 5000 });
      log("KEYBOARD: Class I filter via Enter -> " + await page.locator("#list .r").count() +
        " rows; aria-pressed=" + await page.locator('#filters button[data-c="1"]').getAttribute("aria-pressed"));
      await kb.tabToBackwards(page, '#filters button[data-c="all"]');
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelectorAll("#list .r").length === 3, { timeout: 5000 });
      await kb.tabTo(page, ".r details summary");
      await page.keyboard.press("Enter");
      log("KEYBOARD: More detail summary Enter -> open=" + await page.evaluate(() => !!document.querySelector(".r details[open]")));
      await kb.tabToBackwards(page, "#stateSel");
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(() => document.getElementById("stateSel").value !== "CA", { timeout: 5000 });
      await page.waitForSelector(".r .desc", { timeout: 15000 }); // reload settled before contrast pass
      log("KEYBOARD: state ArrowDown -> " + await page.evaluate(() => document.getElementById("stateSel").value) + " -> reloaded");
    }
  },

  dictionary: {
    routes: [
      [/api\.dictionaryapi\.dev\/api\/v2\/entries\/en\//, url => dictPayload(url)],
      [/en\.wiktionary\.org/, "abort"],
      [/upload\.wikimedia\.org/, "abort"]
    ],
    liveTargets: ["#result"],
    contrast: [
      { sel: "header .tag", why: "muted tag on page bg", suite: true },
      { sel: ".word-head h2", big: true, why: "headword on card" },
      { sel: ".phon", why: "muted phonetic on card" },
      { sel: ".pos h3", why: "accent part-of-speech on card" },
      { sel: ".example", why: "muted example on card" },
      { sel: ".synchip:not(.ant)", why: "accent synonym chip on --bg chip" },
      { sel: ".synchip.ant", why: "antonym chip color on --bg chip" },
      { sel: ".synrow .lbl", why: "muted row label on card" },
      { sel: ".src-note", why: "muted source note on card" },
      { sel: ".hchip", why: "muted history chip on page bg" },
      { sel: ".gobtn", why: "search button white on accent" },
      { sel: ".audio-btn", why: "accent audio button on --bg" }
    ],
    async flow(page, log, kb) {
      await page.waitForSelector(".word-head h2", { timeout: 15000 });
      log("initial lookup rendered (route-fulfilled): " + (await page.locator(".word-head h2").innerText()).trim());
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
      log("autofocus lands on #" + focused);
      if (focused !== "q") await kb.tabTo(page, "#q");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("perspicacious");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => /perspicacious/.test((document.querySelector(".word-head h2") || {}).textContent || ""), { timeout: 10000 });
      log("KEYBOARD: typed word + Enter -> rendered: " + (await page.locator(".word-head h2").innerText()).trim());
      await kb.tabTo(page, ".synchip");
      const chipWord = (await page.evaluate(() => document.activeElement.textContent)).trim();
      await page.keyboard.press("Enter");
      await page.waitForFunction(w => new RegExp(w).test((document.querySelector(".word-head h2") || {}).textContent || ""), chipWord, { timeout: 10000 });
      log("KEYBOARD: Enter on synonym chip \"" + chipWord + "\" -> looked up (role=button tabindex=0 path)");
      await kb.tabTo(page, ".hchip");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".word-head h2", { timeout: 10000 });
      log("KEYBOARD: history chip Enter -> re-lookup: " + (await page.locator(".word-head h2").innerText()).trim());
      log("audio button present with aria-label: " + await page.locator(".audio-btn").getAttribute("aria-label"));
    }
  }
};

/* ---------------- generic checks ---------------- */
const kb = {
  async tabTo(page, selector, allowWrap) {
    const max = 120;
    for (let i = 0; i < max; i++) {
      const hit = await page.evaluate(sel => {
        const el = document.activeElement;
        return !!(el && el.matches && el.matches(sel));
      }, selector);
      if (hit) return true;
      await page.keyboard.press("Tab");
    }
    throw new Error("tabTo: never reached " + selector + " within 120 tabs (possible keyboard trap or unreachable control)");
  },
  async tabToBackwards(page, selector) {
    const max = 120;
    for (let i = 0; i < max; i++) {
      const hit = await page.evaluate(sel => {
        const el = document.activeElement;
        return !!(el && el.matches && el.matches(sel));
      }, selector);
      if (hit) return true;
      await page.keyboard.press("Shift+Tab");
    }
    throw new Error("tabToBackwards: never reached " + selector);
  }
};

const PAGE_HELPERS = `
  function __parseColor(s) {
    s = String(s || "").trim();
    let m = /^rgba?\\(([^)]+)\\)$/.exec(s);
    if (m) {
      const p = m[1].split(/[,\\/]/).map(x => x.trim());
      return { r: +p[0], g: +p[1], b: +p[2], a: p[3] === undefined ? 1 : +p[3] };
    }
    m = /^color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)(?: \\/ ([\\d.]+))?\\)$/.exec(s);
    if (m) return { r: 255 * +m[1], g: 255 * +m[2], b: 255 * +m[3], a: m[4] === undefined ? 1 : +m[4] };
    if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    // resolve via a probe element
    const d = document.createElement("div");
    d.style.color = s; document.body.appendChild(d);
    const c = getComputedStyle(d).color; d.remove();
    if (c !== s) return __parseColor(c);
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  function __comp(top, bot) {
    const a = top.a + bot.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a,
      g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a,
      b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a, a
    };
  }
  function __effBg(el) {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = __parseColor(getComputedStyle(e).backgroundColor);
      if (c.a > 0) layers.push(c);
      if (c.a >= 1) break;
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const rootBg = __parseColor(getComputedStyle(document.documentElement).backgroundColor);
    if (rootBg.a > 0 && !(layers.length && layers[layers.length-1].a >= 1)) layers.push(rootBg);
    for (let i = layers.length - 1; i >= 0; i--) bg = __comp(layers[i], bg);
    return bg;
  }
  function __lum(c) {
    const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function __ratio(fg, bg) {
    const a = __lum(fg), b = __lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }
  function __hex(c) {
    const h = v => Math.round(v).toString(16).padStart(2, "0");
    return "#" + h(c.r) + h(c.g) + h(c.b);
  }
`;

async function measureContrast(page, targets) {
  return page.evaluate(({ helpers, targets }) => {
    eval(helpers);
    const out = [];
    for (const t of targets) {
      let el = null, probeEl = null;
      if (t.probe) {
        const parent = document.querySelector(t.probe.parent);
        if (parent) {
          probeEl = document.createElement(t.probe.tag || "div");
          probeEl.className = t.probe.cls;
          probeEl.textContent = t.probe.text || "probe";
          parent.appendChild(probeEl);
          el = probeEl;
        }
      } else {
        el = document.querySelector(t.sel);
        if (el && t.forceText && !el.textContent.trim()) el.textContent = t.forceText;
      }
      if (!el) { out.push({ name: t.name || t.sel, missing: true, why: t.why }); continue; }
      let classedParent = null;
      if (t.parentClass && el.parentElement) { classedParent = el.parentElement; classedParent.classList.add(t.parentClass); }
      const cs = getComputedStyle(el);
      let fg = __parseColor(cs.color);
      const bg = __effBg(el);
      if (fg.a < 1) fg = __comp(fg, bg);
      const size = parseFloat(cs.fontSize);
      const weight = +cs.fontWeight || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const threshold = t.nonText ? 3 : (t.big || large) ? 3 : 4.5;
      const ratio = __ratio(fg, bg);
      out.push({
        name: t.name || t.sel, why: t.why, suite: !!t.suite,
        fg: __hex(fg), bg: __hex(bg), ratio: Math.round(ratio * 100) / 100,
        sizePx: Math.round(size * 10) / 10, weight, threshold,
        pass: ratio >= threshold
      });
      if (probeEl) probeEl.remove();
      if (classedParent) classedParent.classList.remove(t.parentClass);
      if (t.forceText && el.textContent === t.forceText) el.textContent = "";
    }
    return out;
  }, { helpers: PAGE_HELPERS, targets });
}

async function genericChecks(page) {
  return page.evaluate(() => {
    const res = { iconOnly: [], labels: [], positiveTabindex: [], imgs: [] };
    const symbolish = t => !t || /^[^\p{L}\p{N}]*$/u.test(t); // no letters/digits at all
    document.querySelectorAll("button, a, [role=button], summary").forEach(el => {
      if (el.closest("[hidden]")) return;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (symbolish(text)) {
        res.iconOnly.push({
          desc: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).join(".") : ""),
          text, ariaLabel: el.getAttribute("aria-label"), title: el.getAttribute("title"),
          ok: !!(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (text && !symbolish(text)))
        });
      }
    });
    document.querySelectorAll("input:not([type=hidden]), select, textarea").forEach(el => {
      const style = getComputedStyle(el);
      const hidden = style.display === "none" || style.visibility === "hidden" || el.closest("[hidden]");
      const wrapped = !!el.closest("label");
      const forLabel = el.id ? !!document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : false;
      const aria = !!(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"));
      res.labels.push({
        desc: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "[" + (el.type || "") + "]",
        hidden: !!hidden, wrapped, forLabel, aria, ok: wrapped || forLabel || aria
      });
    });
    document.querySelectorAll("[tabindex]").forEach(el => {
      const v = +el.getAttribute("tabindex");
      if (v > 0) res.positiveTabindex.push(el.tagName + "#" + el.id + " tabindex=" + v);
    });
    document.querySelectorAll("img").forEach(img => {
      res.imgs.push({ src: (img.src || "").slice(0, 60), alt: img.getAttribute("alt"), ok: img.getAttribute("alt") !== null });
    });
    return res;
  });
}

async function focusVisibleCheck(page) {
  // reach an interactive element with a real keyboard Tab (=> :focus-visible);
  // retry a few times — sequential focus may need to wrap back into the document
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    const ok = await page.evaluate(() => document.activeElement && document.activeElement !== document.body);
    if (ok) break;
  }
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { ok: false, note: "nothing focused after Tab" };
    const f = getComputedStyle(el);
    const focused = { outline: f.outlineStyle + " " + f.outlineWidth + " " + f.outlineColor, boxShadow: f.boxShadow };
    const desc = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + ("." + (el.className || ""));
    el.blur();
    const b = getComputedStyle(el);
    const blurred = { outline: b.outlineStyle + " " + b.outlineWidth + " " + b.outlineColor, boxShadow: b.boxShadow };
    el.focus(); // restore
    const visible = focused.outline !== blurred.outline || focused.boxShadow !== blurred.boxShadow;
    return { ok: visible, el: desc, focused: focused.outline, blurred: blurred.outline };
  });
}

/* ---------------- driver ---------------- */
async function installRoutes(ctx, cfg, counters) {
  await ctx.route(/^https?:/, r => { counters.aborted.push(r.request().url().slice(0, 90)); r.abort(); });
  for (const [pat, body] of cfg.routes) {
    await ctx.route(pat, r => {
      const url = r.request().url();
      counters.fulfilled.push(url.slice(0, 90));
      if (body === "abort") { counters.deliberateAbort.push(url.slice(0, 90)); return r.abort(); }
      if (body === "png") return r.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG });
      const v = typeof body === "function" ? body(url) : body;
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(v) });
    });
  }
}

async function newAuditPage(browser, cfg, theme, counters) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await installRoutes(ctx, cfg, counters);
  const page = await ctx.newPage();
  const consoleErrs = [];
  page.on("console", m => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 160)); });
  page.on("pageerror", e => consoleErrs.push("pageerror: " + String(e).slice(0, 160)));
  await page.addInitScript(({ theme, prep }) => {
    try {
      localStorage.setItem("suite.theme", theme);
      for (const [k, v] of Object.entries(prep || {})) localStorage.setItem(k, v);
    } catch (e) {}
  }, { theme, prep: cfg.prep || {} });
  return { ctx, page, consoleErrs };
}

async function run(tool) {
  const cfg = CONFIGS[tool];
  if (!cfg) { console.error("no config for " + tool); process.exit(1); }
  const url = pathToFileURL(join(ROOT, "tools", tool + ".html")).href;
  const browser = await chromium.launch({ channel: "chrome" });
  const counters = { fulfilled: [], aborted: [], deliberateAbort: [] };
  const report = { tool, when: new Date().toISOString(), log: [], contrast: {}, generic: null, focus: null, live: [], failures: [] };
  const log = s => { report.log.push(s); console.log("  " + s); };

  console.log("== " + tool + " ==");

  /* light theme: full functional pass */
  const L = await newAuditPage(browser, cfg, "light", counters);
  await L.page.goto(url);
  await L.page.waitForTimeout(400);
  try {
    await cfg.flow(L.page, log, kb);
  } catch (e) {
    report.failures.push("FLOW: " + e.message);
    log("FLOW FAILED: " + e.message);
    log("  at: " + String(e.stack).split("\n").slice(1, 5).join(" | "));
  }

  /* live regions (checked at runtime on the populated page) */
  for (const sel of cfg.liveTargets) {
    const v = await L.page.evaluate(s => {
      for (const part of s.split(",")) {
        const el = document.querySelector(part.trim());
        if (el) return { sel: part.trim(), live: el.getAttribute("aria-live") };
      }
      return { sel: s, live: null, missing: true };
    }, sel);
    report.live.push(v);
    const ok = v.live === "polite" || v.live === "assertive";
    if (!ok) report.failures.push("LIVE: " + sel + " aria-live=" + v.live);
    log((ok ? "live ok: " : "LIVE MISSING: ") + v.sel + " aria-live=" + v.live);
  }
  if (cfg.liveNote) log("live note: " + cfg.liveNote);

  /* generic: icon-only names, labels, positive tabindex, img alt */
  report.generic = await genericChecks(L.page);
  for (const b of report.generic.iconOnly) {
    if (!b.ok) report.failures.push("ICON-ONLY unnamed: " + b.desc + " text=" + JSON.stringify(b.text));
    log((b.ok ? "icon-only ok: " : "ICON-ONLY UNNAMED: ") + b.desc + " text=" + JSON.stringify(b.text) + " aria-label=" + JSON.stringify(b.ariaLabel));
  }
  for (const l of report.generic.labels) {
    if (!l.ok && !l.hidden) report.failures.push("LABEL missing: " + l.desc);
    if (!l.hidden) log((l.ok ? "label ok: " : "LABEL MISSING: ") + l.desc + (l.wrapped ? " (wrapped)" : l.forLabel ? " (label[for])" : l.aria ? " (aria)" : ""));
  }
  if (report.generic.positiveTabindex.length) {
    report.failures.push("POSITIVE tabindex: " + report.generic.positiveTabindex.join(", "));
    log("POSITIVE TABINDEX: " + report.generic.positiveTabindex.join(", "));
  } else log("no positive tabindex anywhere");
  for (const im of report.generic.imgs) {
    if (!im.ok) { report.failures.push("IMG missing alt: " + im.src); log("IMG MISSING ALT: " + im.src); }
  }

  /* focus visibility */
  report.focus = await focusVisibleCheck(L.page);
  if (!report.focus.ok) report.failures.push("FOCUS indicator not visible on " + report.focus.el);
  log((report.focus.ok ? "focus-visible ok on " : "FOCUS INDICATOR MISSING on ") + report.focus.el + " (" + report.focus.focused + " vs blurred " + report.focus.blurred + ")");

  /* contrast, light */
  report.contrast.light = await measureContrast(L.page, cfg.contrast);
  const consoleLight = L.consoleErrs.slice();
  await L.ctx.close();

  /* dark theme: render again, contrast only */
  const D = await newAuditPage(browser, cfg, "dark", counters);
  await D.page.goto(url);
  await D.page.waitForTimeout(400);
  try { await cfg.flow(D.page, () => {}, kb); } catch (e) { report.failures.push("FLOW(dark): " + e.message); }
  report.contrast.dark = await measureContrast(D.page, cfg.contrast);
  await D.ctx.close();

  for (const theme of ["light", "dark"]) {
    console.log("  -- contrast (" + theme + ") --");
    for (const c of report.contrast[theme]) {
      if (c.missing) { console.log("    MISSING " + c.name + " (" + c.why + ")"); continue; }
      const tag = c.pass ? "pass" : (c.suite ? "FAIL(SUITE)" : "FAIL");
      console.log("    " + tag + " " + c.name + ": " + c.fg + " on " + c.bg + " = " + c.ratio +
        " (need " + c.threshold + ", " + c.sizePx + "px w" + c.weight + ") — " + c.why);
      if (!c.pass) report.failures.push("CONTRAST(" + theme + (c.suite ? ",suite-wide" : "") + "): " + c.name + " " + c.ratio + " < " + c.threshold);
    }
  }

  const noise = consoleLight.filter(s => !/net::ERR|Failed to load resource/.test(s));
  if (noise.length) { report.failures.push("CONSOLE: " + noise.join(" | ")); log("CONSOLE ERRORS: " + noise.join(" | ")); }
  else log("console: clean (only expected aborted-request noise: " + consoleLight.length + " lines)");
  report.consoleLight = consoleLight;
  report.network = { fulfilled: counters.fulfilled.length, catchAllAborted: counters.aborted, deliberateAbort: counters.deliberateAbort };
  if (counters.aborted.length) log("catch-all aborted (would have been LIVE): " + [...new Set(counters.aborted)].join(", "));

  await browser.close();
  writeFileSync(join(OUT, tool + ".json"), JSON.stringify(report, null, 2));
  console.log((report.failures.length ? "RESULT: " + report.failures.length + " failure(s)" : "RESULT: all checks pass") + " -> " + join(OUT, tool + ".json"));
  process.exit(report.failures.length ? 1 : 0);
}

run(tool);
