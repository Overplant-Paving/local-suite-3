/* Automatic first location: detection, propagation, the toggle, and the refusals
   and edge cases that must NOT end in a reload loop or lost input.
   Run from tests/: node location-auto.mjs */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const url = f => pathToFileURL(join(ROOT, "dist", f)).href;
const SF = { latitude: 37.7749, longitude: -122.4194 };

let browser;
try { browser = await chromium.launch({ channel: "chrome" }); }
catch (e) {
  if (!String(e).includes("distribution 'chrome' is not found")) throw e;
  browser = await chromium.launch();
}

/* Counts real getCurrentPosition calls and page loads, so "never asks twice" and
   "never reloads twice" are measured rather than assumed. */
async function freshPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  if (opts.grant) {
    await ctx.grantPermissions(["geolocation"]);
    await ctx.setGeolocation(SF);
  }
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  const loads = { n: 0 };
  page.on("load", () => loads.n++);
  await page.addInitScript(({ deny, seed, slowMs, permState }) => {
    window.__geo = 0;
    /* The suite distinguishes a refusal the user made ("denied") from an
       environment that auto-denies while never asking ("prompt" — headless,
       automation, enterprise policy). Only the first is remembered, so tests
       have to say which one they are. */
    if (permState && navigator.permissions) {
      navigator.permissions.query = n =>
        (n && n.name === "geolocation")
          ? Promise.resolve({ state: permState })
          : Promise.reject(new Error("unsupported in test"));
    }
    const real = navigator.geolocation && navigator.geolocation.getCurrentPosition;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition = function (ok, fail, o) {
        window.__geo++;
        if (deny) return fail({ code: 1, message: "User denied Geolocation" });
        /* a pre-granted permission resolves instantly, which is exactly when a
           real user is still reading the page — slow it to the pace of someone
           actually answering a browser prompt */
        const call = () => real.call(navigator.geolocation, ok, fail, o);
        return slowMs ? setTimeout(call, slowMs) : call();
      };
    }
    for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, v);
  }, { deny: !!opts.deny, seed: opts.seed || {}, slowMs: opts.slowMs || 0,
       permState: opts.permState || null });
  return { ctx, page, errs, loads };
}
const geoCalls = page => page.evaluate(() => window.__geo);
const stored = page => page.evaluate(() => ({
  location: localStorage.getItem("suite.location"),
  auto: localStorage.getItem("suite.location.auto"),
  denied: localStorage.getItem("suite.location.autoDenied")
}));

const R = {};

/* ---- 1. cold weather.html, permission granted: detect, save, reload into data ---- */
{
  const { ctx, page, errs, loads } = await freshPage({ grant: true });
  await page.goto(url("weather.html"));
  await page.waitForFunction(() => !!localStorage.getItem("suite.location"), null, { timeout: 15000 });
  await page.waitForTimeout(1500);                       // let the one reload settle
  const s = await stored(page);
  R.cold = {
    saved: JSON.parse(s.location || "null"),
    loads: loads.n,                                       // initial + exactly one reload
    setupCardGone: await page.evaluate(() =>
      !/US ZIP CODE|Set your location/i.test(document.body.innerText)),
    errs
  };
  await ctx.close();
}

/* ---- 2. propagation: a second tool opens on it with no further prompt ---- */
{
  const seedLoc = JSON.stringify({ lat: 37.7749, lon: -122.4194, label: "My location (37.7749, -122.4194)" });
  const { ctx, page, errs, loads } = await freshPage({ grant: true, seed: { "suite.location": seedLoc } });
  await page.goto(url("alerts.html"));
  await page.waitForTimeout(1200);
  R.propagated = {
    geoCalls: await geoCalls(page),                       // must be 0 — location already known
    loads: loads.n,                                       // must be 1 — no reload
    showsLocation: await page.evaluate(() => /37\.77/.test(document.body.innerText)),
    errs
  };
  await ctx.close();
}

/* ---- 3. a refusal the USER made is remembered: card returns, revisit never re-asks ---- */
{
  const { ctx, page, errs, loads } = await freshPage({ deny: true, permState: "denied" });
  await page.goto(url("air.html"));
  await page.waitForTimeout(1200);
  const first = { geo: await geoCalls(page), ...(await stored(page)) };
  await page.goto(url("air.html"));                       // second visit, same profile
  await page.waitForTimeout(1200);
  R.denied = {
    askedOnce: first.geo === 1,
    deniedFlag: first.denied,
    askedAgain: await geoCalls(page),                     // must be 0 on the revisit
    loads: loads.n,                                       // 2 navigations, no reload
    stillOffersManual: await page.evaluate(() => /US ZIP code/i.test(document.body.innerText)),
    errs
  };
  await ctx.close();
}

/* ---- 3b. an environment auto-deny must NOT be remembered ----
   Headless runs, automation and enterprise policy all fail with the same code 1
   while the permission state is still "prompt" — nobody was ever asked. Recording
   that would disable the feature permanently for a user who never refused. Found
   for real by probing a double-clicked file:// page. */
{
  const { ctx, page, errs } = await freshPage({ deny: true, permState: "prompt" });
  await page.goto(url("air.html"));
  await page.waitForTimeout(1000);
  const first = await stored(page);
  await page.goto(url("air.html"));
  await page.waitForTimeout(1000);
  R.autoDeny = {
    notRemembered: first.denied === null,
    asksAgain: await geoCalls(page),          // still willing on the next visit
    errs
  };
  await ctx.close();
}

/* ---- 4. toggle off: nothing is asked at all ---- */
{
  const { ctx, page, errs } = await freshPage({ grant: true, seed: { "suite.location.auto": "off" } });
  await page.goto(url("quakes.html"));
  await page.waitForTimeout(1200);
  R.toggledOff = {
    geoCalls: await geoCalls(page),                       // must be 0
    location: (await stored(page)).location,              // must stay null
    errs
  };
  await ctx.close();
}

/* ---- 5. typed input cancels the reload (tools usable without a location) ---- */
{
  const { ctx, page, errs, loads } = await freshPage({ grant: true, slowMs: 1800 });
  await page.goto(url("geo.html"));
  const field = await page.$("input[type=text], input:not([type=checkbox]):not([type=radio])");
  if (field) { await field.click(); await field.type("hello typed input"); }
  await page.waitForFunction(() => !!localStorage.getItem("suite.location"), null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  R.typingWins = {
    loads: loads.n,                                       // must stay 1 — no reload over the user
    savedAnyway: !!(await stored(page)).location,         // detection still propagated
    inputSurvived: field ? await field.inputValue() : null,
    errs
  };
  await ctx.close();
}

/* ---- 6. no reload loop when the write cannot stick ---- */
{
  const { ctx, page, errs, loads } = await freshPage({ grant: true });
  await page.addInitScript(() => {                        // every suite.location write silently fails
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith("suite.location")) return;
      return set.call(this, k, v);
    };
  });
  await page.goto(url("marine.html"));
  await page.waitForTimeout(3000);
  R.noLoop = { loads: loads.n, errs };                    // must be 1
  await ctx.close();
}

/* ---- 7. the hub detects at the front door, so tools never need the reload ---- */
{
  const { ctx, page, errs } = await freshPage({ grant: true });
  await page.goto(url("index.html"));
  await page.waitForFunction(() => !!localStorage.getItem("suite.location"), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  R.hub = {
    status: await page.textContent("#locSwitchStatus"),
    switcherVisible: await page.evaluate(() => !document.getElementById("locSwitch").hidden),
    options: await page.evaluate(() =>
      [...document.querySelectorAll("#activeLoc option")].map(o => o.textContent)),
    errs
  };
  await ctx.close();
}

/* ---- 8. the Settings toggle drives it, and clears a remembered refusal ---- */
{
  const { ctx, page, errs } = await freshPage({ seed: { "suite.location.autoDenied": "denied" } });
  await page.goto(url("settings.html"));
  const deniedNote = await page.textContent("#autoLocMsg");
  await page.uncheck("#autoLocChk");
  const offState = await stored(page);
  await page.check("#autoLocChk");                        // re-enabling must clear the refusal
  const backOn = await stored(page);
  R.toggle = {
    warnsAboutRefusal: /refused the last location request/i.test(deniedNote),
    offWrites: offState.auto,
    onClears: backOn.auto === null && backOn.denied === null,
    errs
  };
  await ctx.close();
}

await browser.close();

const allErrs = Object.values(R).flatMap(v => v.errs || []);
const ok =
  R.cold.saved && Math.abs(R.cold.saved.lat - 37.7749) < 0.01 && R.cold.loads === 2 &&
    R.cold.setupCardGone &&
  R.propagated.geoCalls === 0 && R.propagated.loads === 1 && R.propagated.showsLocation &&
  R.denied.askedOnce && R.denied.deniedFlag === "denied" && R.denied.askedAgain === 0 &&
    R.denied.loads === 2 && R.denied.stillOffersManual &&
  R.autoDeny.notRemembered && R.autoDeny.asksAgain === 1 &&
  R.toggledOff.geoCalls === 0 && R.toggledOff.location === null &&
  R.typingWins.loads === 1 && R.typingWins.savedAnyway &&
    /hello typed input/.test(R.typingWins.inputSurvived || "") &&
  R.noLoop.loads === 1 &&
  /is now active and shared/.test(R.hub.status || "") && R.hub.switcherVisible &&
    R.hub.options.length === 1 &&
  R.toggle.warnsAboutRefusal && R.toggle.offWrites === "off" && R.toggle.onClears &&
  allErrs.length === 0;

const out = JSON.stringify(R, null, 2);
if (!ok) throw new Error("automatic location failed: " + out);
console.log("automatic first location: PASS " + out);
