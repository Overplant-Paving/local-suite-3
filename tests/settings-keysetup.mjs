/* Built Settings guided key setup: wizard, verified api.data.gov fan-out, paste
   routing, and the Aviationstack spend guard. Run from tests/: node settings-keysetup.mjs */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let browser;
try { browser = await chromium.launch({ channel: "chrome" }); }
catch (e) {
  if (!String(e).includes("distribution 'chrome' is not found")) throw e;
  browser = await chromium.launch();
}
const ctx = await browser.newContext();
const page = await ctx.newPage();
const issues = [];
page.on("console", m => { if (m.type() === "error") issues.push(m.text()); });
page.on("pageerror", e => issues.push(String(e)));

/* every provider endpoint the page can reach, counted so the fan-out can be shown
   to probe only its api.data.gov siblings and nothing else */
const hits = {};
const GOOD = "abcdefghij0123456789ABCDEFGHIJ0123456789";   // 40 chars: API Umbrella shape
const BAD  = "zzzzzzzzzz9999999999ZZZZZZZZZZ9999999999";
const route = (name, re, handler) => page.route(re, r => {
  hits[name] = (hits[name] || 0) + 1;
  return handler(r);
});
const umbrella = (name, keyOf) => route(name, new RegExp(name.replace(/\./g, "\\.")), r => {
  const supplied = keyOf(r.request());
  return supplied === GOOD
    ? r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
    : r.fulfill({ status: 403, contentType: "application/json",
        body: '{"error":{"code":"API_KEY_INVALID"}}' });
});
const qkey = p => req => new URL(req.url()).searchParams.get(p);
await umbrella("api.nasa.gov", qkey("api_key"));
await umbrella("api.congress.gov", qkey("api_key"));
await umbrella("api.nal.usda.gov", qkey("api_key"));
await umbrella("api.eia.gov", qkey("api_key"));
await umbrella("developer.nps.gov", req => req.headers()["x-api-key"]);
await umbrella("api.aviationstack.com", qkey("access_key"));

const url = pathToFileURL(join(ROOT, "dist", "settings.html")).href;
await page.goto(url);

const csp = await page.evaluate(() =>
  document.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
const cspAllows = ["https://api.nasa.gov", "https://api.congress.gov", "https://api.nal.usda.gov",
  "https://api.eia.gov", "https://developer.nps.gov", "https://finnhub.io", "https://api.ebird.org",
  "https://api.bart.gov", "https://api.aviationstack.com"].every(h => csp.includes(h));

/* ---- 1. the wizard opens on the step that covers the most ground ---- */
await page.click("#wizStartBtn");
await page.waitForSelector("#wizBody:not([hidden])");
const step1 = await page.evaluate(() => ({
  label: document.getElementById("wizStepLab").textContent,
  covers: document.getElementById("wizCovers").textContent,
  signup: document.getElementById("wizOpenBtn").getAttribute("href"),
  fields: [...document.querySelectorAll("#wizProfile input")].map(i => i.id)
}));

/* ---- 2. the profile persists and is the signup form's paste source ---- */
await page.fill("#prof_email", "someone@example.com");
await page.fill("#prof_first", "Ada");
await page.dispatchEvent("#prof_first", "change");
await page.dispatchEvent("#prof_email", "change");
const profile = await page.evaluate(() => ({
  email: localStorage.getItem("suite.profile.email"),
  first: localStorage.getItem("suite.profile.first")
}));

/* ---- 3. one accepted key fans out to its verified siblings only ---- */
await page.fill("#wizKeyInput", GOOD);
await page.click("#wizSaveBtn");
await page.waitForFunction(() => /no second signup needed|accepted this key/.test(
  document.getElementById("wizMsg").textContent), null, { timeout: 15000 });
await page.waitForTimeout(300);
const afterFanout = await page.evaluate(() => ({
  nasa: localStorage.getItem("suite.key.nasa"),
  congress: localStorage.getItem("suite.key.congress"),
  usda: localStorage.getItem("suite.key.usda"),
  eia: localStorage.getItem("suite.key.eia"),
  nps: localStorage.getItem("suite.key.nps"),
  msg: document.getElementById("wizMsg").textContent
}));

/* ---- 4. a rejected key is reported as rejected, not saved-and-forgotten ---- */
await page.evaluate(() => localStorage.removeItem("suite.key.eia"));
await page.click('.keyrow[data-key="eia"] input');
await page.fill('.keyrow[data-key="eia"] input', BAD);
await page.click('.keyrow[data-key="eia"] button:has-text("Save")');
await page.click('.keyrow[data-key="eia"] button:has-text("Test")');
await page.waitForFunction(() => /rejected this key/.test(
  document.querySelector('.keyrow[data-key="eia"] .kstatus').textContent), null, { timeout: 15000 });
const rejected = await page.evaluate(() =>
  document.querySelector('.keyrow[data-key="eia"] .kstatus').textContent);

/* ---- 5. paste routing: wording in the email picks the provider ---- */
await page.evaluate(() => { localStorage.removeItem("suite.key.eia"); });
await page.evaluate(async (key) => {
  const dt = new DataTransfer();
  dt.setData("text/plain",
    "Thank you for registering with the U.S. Energy Information Administration (EIA).\n" +
    "Your API key is: " + key + "\nUse it as ?api_key=");
  document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
}, GOOD);
await page.waitForFunction(() => /accepted this key/.test(
  document.getElementById("pasteBox").textContent), null, { timeout: 15000 });
const pasteRouted = await page.evaluate(() => ({
  eia: localStorage.getItem("suite.key.eia"),
  box: document.getElementById("pasteBox").textContent
}));

/* ---- 6. an unattributable key asks rather than guesses ---- */
await page.evaluate(() => ["nasa", "congress", "usda", "eia", "nps"]
  .forEach(k => localStorage.removeItem("suite.key." + k)));
await page.evaluate(async (key) => {
  const dt = new DataTransfer();
  dt.setData("text/plain", key);
  document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
}, GOOD);
await page.waitForSelector("#pasteBox .provlist");
const ambiguous = await page.evaluate(() =>
  [...document.querySelectorAll("#pasteBox .provlist button")].map(b => b.textContent));

/* the "check and file it" path identifies by live response, not by shape */
await page.click('#pasteBox .provlist button:has-text("Check and file it")');
await page.waitForFunction(k => localStorage.getItem("suite.key.congress") === k,
  GOOD, { timeout: 20000 });
const identified = await page.evaluate(() => ({
  nasa: localStorage.getItem("suite.key.nasa"),
  congress: localStorage.getItem("suite.key.congress")
}));

/* ---- 7. Aviationstack costs real allowance: first click only arms ---- */
await page.evaluate(k => localStorage.setItem("suite.key.aviationstack", k), GOOD);
await page.evaluate(() => localStorage.removeItem("suite.flight.usage"));
await page.reload();
const avBefore = hits["api.aviationstack.com"] || 0;
await page.click('.keyrow[data-key="aviationstack"] button:has-text("Test")');
await page.waitForTimeout(400);
const armedNoRequest = (hits["api.aviationstack.com"] || 0) === avBefore;
const armedLabel = await page.textContent('.keyrow[data-key="aviationstack"] button:has-text("Spend")');
await page.click('.keyrow[data-key="aviationstack"] button:has-text("Spend")');
await page.waitForFunction(() => /accepted this key/.test(
  document.querySelector('.keyrow[data-key="aviationstack"] .kstatus').textContent),
  null, { timeout: 15000 });
const usage = await page.evaluate(() => JSON.parse(localStorage.getItem("suite.flight.usage")));

const result = {
  cspAllows,
  step1Label: step1.label,
  step1Signup: step1.signup,
  step1Fields: step1.fields,
  step1CoversThree: /NASA/.test(step1.covers) && /Congress\.gov/.test(step1.covers) &&
    /USDA FoodData/.test(step1.covers),
  profile,
  fanout: { nasa: afterFanout.nasa === GOOD, congress: afterFanout.congress === GOOD,
            usda: afterFanout.usda === GOOD, eiaUntouched: afterFanout.eia === null,
            npsUntouched: afterFanout.nps === null },
  fanoutProbedOnlySiblings: !hits["developer.nps.gov"],
  rejected,
  pasteRouted: pasteRouted.eia === GOOD,
  ambiguousChoices: ambiguous,
  identifiedNasaFirst: identified.nasa === GOOD && identified.congress === GOOD,
  armedNoRequest, armedLabel,
  aviationstackCounted: usage && usage.count === 1,
  /* the bad-key step provokes a real 403; Chromium logs every failed load as a
     console error, so that one is expected evidence, not a defect */
  expectedRejections: issues.filter(t => /status of 403/.test(t)).length,
  issues: issues.filter(t => !/status of 403/.test(t))
};

const ok =
  result.cspAllows &&
  /Step 1 of 6 · api\.data\.gov/.test(result.step1Label) &&
  result.step1Signup === "https://api.data.gov/signup/" &&
  result.step1Fields.join(",") === "prof_email,prof_first,prof_last" &&
  result.step1CoversThree &&
  result.profile.email === "someone@example.com" && result.profile.first === "Ada" &&
  result.fanout.nasa && result.fanout.congress && result.fanout.usda &&
  result.fanout.eiaUntouched && result.fanout.npsUntouched &&
  result.fanoutProbedOnlySiblings &&
  /EIA rejected this key/.test(result.rejected) &&
  result.pasteRouted &&
  result.ambiguousChoices.some(t => t === "NASA") &&
  result.ambiguousChoices.some(t => t === "EIA") &&
  result.identifiedNasaFirst &&
  result.armedNoRequest && /Spend 1 request\?/.test(result.armedLabel) &&
  result.aviationstackCounted &&
  result.expectedRejections >= 1 &&
  result.issues.length === 0;

await ctx.close();
await browser.close();
if (!ok) throw new Error("settings key setup failed: " + JSON.stringify(result, null, 2));
console.log("settings guided key setup: PASS " + JSON.stringify(result, null, 2));
