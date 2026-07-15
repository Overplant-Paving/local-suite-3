/* verify-pilots.mjs — Phase 1 Definition-of-Done evidence for the three pilots.
   Produces tests/evidence/<tool>/ artifacts + the CSP verdict (Chrome/Edge/Firefox, file://).
   Run: node verify-pilots.mjs            (from tests/)
        node verify-pilots.mjs csp-only   (just the 3-browser CSP matrix)          */
import { chromium, firefox } from "playwright";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const V1 = resolve(ROOT, "..", "Local Suite");
const EV = join(ROOT, "tests", "evidence");
const fileUrl = p => pathToFileURL(p).href;
const distUrl = name => fileUrl(join(ROOT, "dist", name));
const v1Url = name => fileUrl(join(V1, name));

const SEED_LOC = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };
const VIEWPORT = { width: 1280, height: 900 };

function out(dir, name, data) {
  mkdirSync(join(EV, dir), { recursive: true });
  writeFileSync(join(EV, dir, name), data);
  console.log(`  evidence: ${dir}/${name}`);
}

async function newPage(browser, { theme, seedLocation } = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  await page.addInitScript(({ theme, loc }) => {
    try {
      if (theme) localStorage.setItem("suite.theme", theme);
      else localStorage.removeItem("suite.theme");
      if (loc) {
        localStorage.setItem("suite.location", JSON.stringify(loc));
        localStorage.setItem("suite.units", "F");
      }
    } catch (e) {}
  }, { theme: theme || null, loc: seedLocation ? SEED_LOC : null });
  return { ctx, page };
}

async function lsSnapshot(page) {
  return page.evaluate(() => {
    const o = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      o[k] = v.length > 120 ? v.slice(0, 120) + `…(${v.length} chars)` : v;
    }
    return o;
  });
}

async function computedStyles(page, selectors) {
  return page.evaluate(sels => {
    const res = {};
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) { res[sel] = null; continue; }
      const cs = getComputedStyle(el);
      const map = {};
      for (const prop of cs) map[prop] = cs.getPropertyValue(prop);
      res[sel] = map;
    }
    return res;
  }, selectors);
}

function diffStyles(a, b) {
  const lines = [];
  for (const sel of Object.keys(a)) {
    if (!a[sel] && !b[sel]) continue;
    if (!a[sel] || !b[sel]) { lines.push(`${sel}: present in only one version`); continue; }
    for (const prop of new Set([...Object.keys(a[sel]), ...Object.keys(b[sel])])) {
      const va = a[sel]?.[prop], vb = b[sel]?.[prop];
      if (va !== vb) lines.push(`${sel} { ${prop}: v1=${va} | v2=${vb} }`);
    }
  }
  return lines;
}

/* screenshots of a URL in both themes + computed styles per theme */
async function themeShots(browser, url, dir, prefix, selectors, opts = {}) {
  const styles = {};
  for (const theme of ["light", "dark"]) {
    const { ctx, page } = await newPage(browser, { theme, seedLocation: opts.seedLocation });
    await page.goto(url);
    if (opts.waitFor) await page.waitForSelector(opts.waitFor, { timeout: 45000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(EV, dir, `${prefix}-${theme}.png`), fullPage: true });
    console.log(`  evidence: ${dir}/${prefix}-${theme}.png`);
    if (selectors) styles[theme] = await computedStyles(page, selectors);
    await ctx.close();
  }
  return styles;
}

async function styleParity(browser, name, dir, selectors, opts = {}) {
  mkdirSync(join(EV, dir), { recursive: true });
  const v1s = await themeShots(browser, v1Url(name), dir, "v1", selectors, opts);
  const v2s = await themeShots(browser, distUrl(name), dir, "v2", selectors, opts);
  let report = "";
  for (const theme of ["light", "dark"]) {
    const d = diffStyles(v1s[theme], v2s[theme]);
    report += `== computed-style diff, ${theme} theme (${d.length} differing property values) ==\n`;
    report += d.length ? d.join("\n") + "\n\n" : "(none)\n\n";
  }
  out(dir, "computed-style-diff.txt", report);
}

/* ---------------- focus ---------------- */
async function verifyFocus(browser) {
  console.log("\n[focus]");
  const dir = "focus";
  const selectors = ["body", "header h1", ".timer", ".btn", ".btn.ghost", ".theme-btn",
                     ".clock", ".phase", "details", ".field input", ".scard", "footer", ".back"];
  await styleParity(browser, "focus.html", dir, selectors);

  const log = [];
  const { ctx, page } = await newPage(browser, { theme: "light" });
  await page.clock.install();
  await page.goto(distUrl("focus.html"));

  // full pomodoro cycle via the mock clock
  await page.click("#startBtn");
  log.push(`started; button reads: ${await page.textContent("#startBtn")}`);
  await page.clock.fastForward("05:00");
  log.push(`after 5min fast-forward clock shows: ${await page.textContent("#clock")}`);
  await page.click("#startBtn"); // pause
  log.push(`paused; button reads: ${await page.textContent("#startBtn")}`);
  await page.click("#startBtn"); // resume
  await page.clock.fastForward("21:00"); // past the 25min mark -> finishPhase logs the block
  await page.waitForTimeout(200);
  await page.clock.fastForward("00:05");
  await page.waitForTimeout(200);
  log.push(`after completing the focus block, phase: ${await page.textContent("#phase")}`);
  log.push(`summary: ${(await page.textContent("#summary")).replace(/\s+/g, " ").trim()}`);

  // settings persistence
  await page.click("#settings summary");
  await page.fill("#sFocus", "30");
  await page.dispatchEvent("#sFocus", "change");
  const settingsStored = await page.evaluate(() => localStorage.getItem("suite.focus.settings"));
  log.push(`settings persisted: ${settingsStored}`);

  // export
  const dl = page.waitForEvent("download");
  await page.click("#exportBtn");
  const download = await dl;
  const exportPath = join(EV, dir, "exported-backup.json");
  await download.saveAs(exportPath);
  const exported = JSON.parse(readFileSync(exportPath, "utf-8"));
  log.push(`export: format=${exported.format} settings.focus=${exported.settings.focus} logDays=${Object.keys(exported.log).length}`);
  log.push(`export hint: ${await page.textContent("#dataHint")}`);

  // import a modified backup (another machine did more work that day)
  const day = Object.keys(exported.log)[0];
  const modified = { ...exported, log: { ...exported.log, [day]: { count: 9, minutes: 225 }, "2026-07-01": { count: 2, minutes: 50 } } };
  const importPath = join(EV, dir, "import-fixture.json");
  writeFileSync(importPath, JSON.stringify(modified));
  await page.setInputFiles("#importFile", importPath);
  await page.waitForTimeout(300);
  log.push(`import hint: ${await page.textContent("#dataHint")}`);
  log.push(`log after import: ${await page.evaluate(() => localStorage.getItem("suite.focus.log"))}`);
  log.push(`summary after import: ${(await page.textContent("#summary")).replace(/\s+/g, " ").trim()}`);

  // keyboard path: space toggles
  await page.click("h1"); // move focus away from inputs
  await page.keyboard.press("Space");
  log.push(`space toggles start/pause; button reads: ${await page.textContent("#startBtn")}`);

  // theme toggle + aria
  const pressedBefore = await page.getAttribute("#themeBtn", "aria-pressed");
  await page.click("#themeBtn");
  log.push(`theme toggle: aria-pressed ${pressedBefore} -> ${await page.getAttribute("#themeBtn", "aria-pressed")}, dataset.theme=${await page.evaluate(() => document.documentElement.dataset.theme)}`);

  out(dir, "interaction.txt", log.join("\n") + "\n");
  const v2ls = await lsSnapshot(page);
  await ctx.close();

  // v1 localStorage for the same interactions (start + complete a block)
  const v1p = await newPage(browser, { theme: "light" });
  await v1p.page.clock.install();
  await v1p.page.goto(v1Url("focus.html"));
  await v1p.page.click("#startBtn");
  await v1p.page.clock.fastForward("26:00");
  await v1p.page.waitForTimeout(300);
  await v1p.page.click("#settings summary");
  await v1p.page.fill("#sFocus", "30");
  await v1p.page.dispatchEvent("#sFocus", "change");
  const v1ls = await lsSnapshot(v1p.page);
  await v1p.ctx.close();
  out(dir, "localstorage.json", JSON.stringify({
    v1: v1ls, v2: v2ls,
    keysOnlyInV1: Object.keys(v1ls).filter(k => !(k in v2ls)),
    keysOnlyInV2: Object.keys(v2ls).filter(k => !(k in v1ls)),
  }, null, 2));
}

/* ---------------- weather ---------------- */
async function verifyWeather(browser) {
  console.log("\n[weather]");
  const dir = "weather";
  const selectors = ["body", ".brand h1", ".panel", ".p-label", ".btn-icon", "a.suite-link",
                     ".station", ".updated", "footer", ".hourly-scroll", ".modal", ".field input"];
  await styleParity(browser, "weather.html", dir, selectors,
    { seedLocation: true, waitFor: "#currentBody .metrics, #currentBody .msg" });

  const log = [];
  const { ctx, page } = await newPage(browser, { theme: "light", seedLocation: true });
  const responses = [];
  page.on("response", r => {
    const u = r.url();
    if (u.startsWith("https://")) responses.push(`${r.status()} ${u.slice(0, 110)}`);
  });
  await page.goto(distUrl("weather.html"));
  await page.waitForSelector("#currentBody .metrics", { timeout: 45000 });
  await page.waitForTimeout(1500);

  log.push(`station line: ${(await page.textContent("#stationInfo")).trim()}`);
  log.push(`updated line: ${(await page.textContent("#updated")).trim()}`);
  log.push(`obs station: ${await page.textContent("#obsStation")}`);
  log.push(`current: ${(await page.textContent("#currentBody")).replace(/\s+/g, " ").slice(0, 200)}`);
  log.push(`hourly cells: ${await page.locator("#hourly .hour").count()}`);
  log.push(`daily rows: ${await page.locator("#daily .day").count()}`);
  log.push(`sun strip: sunrise=${await page.textContent("#sunriseVal")} sunset=${await page.textContent("#sunsetVal")}`);
  log.push(`status dot class: ${await page.getAttribute("#statusDot", "class")}`);
  const cacheKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith("suite.cache.weather.")));
  log.push(`cache keys written: ${cacheKeys.join(", ")}`);
  out(dir, "live-fetch.txt",
    "== live NWS fetch record ==\n" + log.join("\n") +
    "\n\n== https responses ==\n" + responses.join("\n") + "\n");

  const v2ls = await lsSnapshot(page);
  await ctx.close();

  // offline / stale-cache path: same profile trick — reseed cache by loading once,
  // then block all network and reload
  const off = await newPage(browser, { theme: "light", seedLocation: true });
  await off.page.goto(distUrl("weather.html"));
  await off.page.waitForSelector("#currentBody .metrics", { timeout: 45000 });
  // age every cache entry past the 10-min TTL so the reload really attempts the
  // network (a fresh cache would short-circuit and never hit the stale path)
  await off.page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("suite.cache.weather.")) continue;
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 60 * 60 * 1000; // one hour old
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await off.ctx.route(/^https?:/, route => route.abort());
  await off.page.reload();
  await off.page.waitForSelector("#currentBody .metrics, #currentBody .msg", { timeout: 45000 });
  await off.page.waitForTimeout(1000);
  const offLog = [
    `updated line: ${(await off.page.textContent("#updated")).trim()}`,
    `status dot class: ${await off.page.getAttribute("#statusDot", "class")}`,
    `current rendered from cache: ${(await off.page.textContent("#currentBody")).replace(/\s+/g, " ").slice(0, 150)}`,
  ];
  await off.page.screenshot({ path: join(EV, dir, "offline-stale.png"), fullPage: true });
  console.log("  evidence: weather/offline-stale.png");
  out(dir, "offline.txt", "== network blocked, reload ==\n" + offLog.join("\n") + "\n");
  await off.ctx.close();

  // v1 localStorage for the same load
  const v1p = await newPage(browser, { theme: "light", seedLocation: true });
  await v1p.page.goto(v1Url("weather.html"));
  await v1p.page.waitForSelector("#currentBody .metrics, #currentBody .msg", { timeout: 45000 });
  await v1p.page.waitForTimeout(1500);
  const v1ls = await lsSnapshot(v1p.page);
  await v1p.ctx.close();
  out(dir, "localstorage.json", JSON.stringify({
    v1: v1ls, v2: v2ls,
    keysOnlyInV1: Object.keys(v1ls).filter(k => !(k in v2ls)),
    keysOnlyInV2: Object.keys(v2ls).filter(k => !(k in v1ls)),
  }, null, 2));
}

/* ---------------- hub ---------------- */
async function verifyHub(browser) {
  console.log("\n[index]");
  const dir = "index";
  const selectors = ["body", "header h1", ".search", ".pill", ".card", ".chip",
                     ".theme-btn", ".stat b", "section h2", "footer"];
  await styleParity(browser, "index.html", dir, selectors);

  const log = [];
  const { ctx, page } = await newPage(browser, { theme: "light" });
  await page.goto(distUrl("index.html"));
  log.push(`cards rendered: ${await page.locator(".card").count()} (manifest has 2 tools)`);
  log.push(`stats: ${(await page.textContent("#stats")).replace(/\s+/g, " ").trim()}`);
  log.push(`sections: ${(await page.locator("section h2").allTextContents()).join(" | ")}`);
  await page.fill("#q", "pomodoro");
  log.push(`search "pomodoro": ${await page.locator(".card:visible").count()} card(s): ${await page.locator(".card h3").first().textContent()}`);
  await page.fill("#q", "");
  await page.click(".pill.tog:has-text('works offline')");
  log.push(`offline filter: ${await page.locator(".card").count()} card(s)`);
  await page.click(".pill.tog:has-text('works offline')");
  log.push(`schemaVersion after boot: ${await page.evaluate(() => localStorage.getItem("suite.meta.schemaVersion"))}`);
  // navigate through to a tool
  await page.click(".card h3 a:has-text('Focus Timer')");
  await page.waitForSelector("#clock");
  log.push(`clicked Focus Timer card -> ${page.url().split("/").pop()} loaded, clock=${await page.textContent("#clock")}`);
  await page.goBack();
  // keyboard: "/" focuses search
  await page.keyboard.press("/");
  log.push(`"/" focuses search: ${await page.evaluate(() => document.activeElement.id)}`);
  out(dir, "interaction.txt", log.join("\n") + "\n");
  const v2ls = await lsSnapshot(page);
  out(dir, "localstorage.json", JSON.stringify({
    v2: v2ls,
    note: "v1 hub writes only suite.theme; suite.meta.schemaVersion is new-in-v2 by design (ARCHITECTURE.md §6)",
  }, null, 2));
  await ctx.close();
}

/* ---------------- CSP verdict: Chrome / Edge / Firefox from file:// ---------------- */
async function cspVerdict() {
  console.log("\n[csp verdict]");
  const browsers = [
    ["chrome", () => chromium.launch({ channel: "chrome" })],
    ["msedge", () => chromium.launch({ channel: "msedge" })],
    ["firefox", () => firefox.launch()],
  ];
  const report = [];
  for (const [name, launch] of browsers) {
    const browser = await launch();
    for (const file of ["focus.html", "weather.html", "index.html"]) {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      const page = await ctx.newPage();
      const console_ = [], violations = [];
      page.on("console", m => { if (m.type() === "error" || m.type() === "warning") console_.push(`${m.type()}: ${m.text().slice(0, 160)}`); });
      page.on("pageerror", e => console_.push(`pageerror: ${String(e).slice(0, 160)}`));
      await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener("securitypolicyviolation", e =>
          window.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || "inline"}`));
      });
      if (file === "weather.html") {
        await page.addInitScript(loc => {
          localStorage.setItem("suite.location", JSON.stringify(loc));
          localStorage.setItem("suite.units", "F");
        }, SEED_LOC);
      }
      await page.goto(distUrl(file));
      await page.waitForTimeout(file === "weather.html" ? 12000 : 1500);
      // scripts executed under the hash CSP? theme toggle is the probe
      const before = await page.evaluate(() => document.documentElement.dataset.theme || "unset");
      await page.click("#themeBtn");
      const after = await page.evaluate(() => document.documentElement.dataset.theme || "unset");
      const scriptsRan = before !== after;
      const v = await page.evaluate(() => window.__csp);
      violations.push(...v);
      const fetched = file === "weather.html"
        ? await page.evaluate(() => !!document.querySelector("#currentBody .metrics")) : "n/a";
      report.push(`${name} · ${file}: scriptsRan=${scriptsRan} themeFlip=${before}->${after} ` +
        `liveFetchRendered=${fetched} cspViolations=${violations.length ? violations.join("; ") : "none"} ` +
        `consoleIssues=${console_.length ? console_.join(" | ") : "none"}`);
      console.log("  " + report[report.length - 1]);
      await ctx.close();
    }
    await browser.close();
  }
  mkdirSync(join(EV, "phase1"), { recursive: true });
  writeFileSync(join(EV, "phase1", "csp-verdict.txt"),
    "== CSP verdict: hash-based per-file CSP, opened from file:// ==\n" +
    "Chrome + Edge: real installed browsers via Playwright channels. Firefox: Playwright's Gecko build (CSP enforcement is engine-level).\n\n" +
    report.join("\n") + "\n");
  console.log("  evidence: phase1/csp-verdict.txt");
}

const mode = process.argv[2] || "all";
if (mode === "csp-only") {
  await cspVerdict();
} else if (mode === "weather-only") {
  const browser = await chromium.launch({ channel: "chrome" });
  await verifyWeather(browser);
  await browser.close();
} else {
  const browser = await chromium.launch({ channel: "chrome" });
  await verifyFocus(browser);
  await verifyWeather(browser);
  await verifyHub(browser);
  await browser.close();
  await cspVerdict();
}
console.log("\ndone.");
