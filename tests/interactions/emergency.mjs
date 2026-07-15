/* tests/interactions/emergency.mjs — Emergency Quick-Reference (Batch A, zero-network).
   SAFETY-CRITICAL: the first-aid/CPR text must survive byte-for-byte. interact() captures
   v2's content textContent; v1Interact() captures v1's and writes content-parity.txt. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const selectors = [
  "body",
  "header h1",
  ".call911",
  ".call911 .big a",
  ".hotlines .hot",
  ".hot .num a",
  "nav.jump a",
  "section.topic",
  ".callout",
  ".metro",
  ".metro button",
  "fieldset.card",
];

export const screenshotAfterInteract = true;
export const printShots = true; // the Family Emergency Card is a print feature (@media print block)

/* Content areas whose text is the medical guidance — extracted identically on both versions. */
const CONTENT_SEL =
  'header h1, header .tag, .call911, .hotlines, nav.jump, section.topic, fieldset.card legend, footer';
function extractText(page) {
  return page.evaluate(sel =>
    [...document.querySelectorAll(sel)].map(el => el.textContent).join("\n===\n"), CONTENT_SEL);
}

let v2Text = null;
let evDir = null;

export async function interact({ page, log, evidenceDir }) {
  evDir = evidenceDir;
  await page.clock.install(); // metronome + flash() are timer-based

  /* -- capture the safety-critical text BEFORE any interaction mutates button labels -- */
  v2Text = await extractText(page);
  log(`content textContent captured: ${v2Text.length} chars (parity vs v1 written by v1Interact)`);

  /* -- tel: links render -- */
  const tels = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="tel:"]')].map(a => `${a.getAttribute("href")} -> "${a.textContent}"`));
  log(`tel: links (${tels.length}): ${tels.join(" | ")}`);

  /* -- jump navigation between sections -- */
  await page.click('nav.jump a[href="#cpr"]');
  let pos = await page.evaluate(() => ({
    hash: location.hash, top: Math.round(document.getElementById("cpr").getBoundingClientRect().top) }));
  log(`jump to #cpr: hash=${pos.hash}, section top=${pos.top}px from viewport`);

  /* -- CPR metronome: start, count beat pulses under a fake clock, stop -- */
  await page.evaluate(() => {
    window.__beatTimes = [];
    new MutationObserver(() => {
      if (document.getElementById("beat").classList.contains("on")) window.__beatTimes.push(Date.now());
    }).observe(document.getElementById("beat"), { attributes: true, attributeFilter: ["class"] });
  });
  await page.click("#metroBtn");
  log(`metronome started: button reads "${await page.textContent("#metroBtn")}", ` +
      `has .stop class=${await page.evaluate(() => document.getElementById("metroBtn").classList.contains("stop"))}`);
  await page.clock.runFor(6000);
  const times = await page.evaluate(() => window.__beatTimes);
  const bpm = times.length > 1
    ? Math.round(60000 / ((times[times.length - 1] - times[0]) / (times.length - 1)) * 10) / 10 : 0;
  log(`beat pulses in 6s of fake clock: ${times.length}, measured interval avg => ${bpm} BPM (tool claims ~110)`);
  await page.click("#metroBtn");
  log(`metronome stopped: button reads "${await page.textContent("#metroBtn")}", ` +
      `beat .on=${await page.evaluate(() => document.getElementById("beat").classList.contains("on"))}`);

  /* -- jump to the emergency card -- */
  await page.click('nav.jump a[href="#card"]');
  pos = await page.evaluate(() => ({
    hash: location.hash, top: Math.round(document.getElementById("card").getBoundingClientRect().top) }));
  log(`jump to #card: hash=${pos.hash}, fieldset top=${pos.top}px from viewport`);

  /* -- fill + Save -- */
  await page.fill("#f_name", "The Rivera family");
  await page.fill("#f_ice1", "Sam — 555-123-4567");
  await page.fill("#f_allergy", "Penicillin (Mom); peanuts (Ana)");
  await page.click("#saveBtn");
  log(`after Save: savedMsg="${await page.textContent("#savedMsg")}"`);
  let stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), "suite.emergency.card");
  log(`stored suite.emergency.card: name="${stored.name}", ice1="${stored.ice1}", allergy="${stored.allergy}"`);

  /* -- autosave on change (blur) -- */
  await page.fill("#f_hosp", "County General");
  await page.locator("#f_hosp").blur();
  stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), "suite.emergency.card");
  log(`autosave on blur: stored hosp="${stored.hosp}", savedMsg="${await page.textContent("#savedMsg")}"`);

  /* -- Print button: stub window.print, verify it saves then prints -- */
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click("#printBtn");
  log(`print button: window.print called ${await page.evaluate(() => window.__printed)} time(s), ` +
      `savedMsg="${await page.textContent("#savedMsg")}"`);

  /* -- Clear: dismiss keeps data, accept wipes fields + removes the key -- */
  page.once("dialog", d => { d.dismiss(); });
  await page.click("#clearBtn");
  log(`clear then Cancel: f_name still "${await page.inputValue("#f_name")}", ` +
      `key present=${await page.evaluate(k => localStorage.getItem(k) !== null, "suite.emergency.card")}`);
  page.once("dialog", d => { d.accept(); });
  await page.click("#clearBtn");
  log(`clear then OK: f_name="${await page.inputValue("#f_name")}", ` +
      `key present=${await page.evaluate(k => localStorage.getItem(k) !== null, "suite.emergency.card")}, ` +
      `savedMsg="${await page.textContent("#savedMsg")}"`);

  /* -- refill + save so the final localStorage snapshot contains the card key (parity vs v1) -- */
  await page.fill("#f_name", "The Rivera family");
  await page.fill("#f_ice1", "Sam — 555-123-4567");
  await page.fill("#f_allergy", "Penicillin (Mom); peanuts (Ana)");
  await page.fill("#f_hosp", "County General");
  await page.click("#saveBtn");
  log(`refilled + saved for final snapshot: savedMsg="${await page.textContent("#savedMsg")}"`);
}

/* Same state-writing actions on v1, so the localStorage key sets compare equal —
   plus the byte-for-byte content-parity check against the v2 text captured above. */
export async function v1Interact({ page }) {
  const v1Text = await extractText(page);
  if (evDir) {
    const same = v1Text === v2Text;
    writeFileSync(join(evDir, "content-parity.txt"),
      `SAFETY-CRITICAL CONTENT PARITY (textContent of ${JSON.stringify(CONTENT_SEL)})\n` +
      `v1 length: ${v1Text.length} chars\nv2 length: ${v2Text ? v2Text.length : "n/a"} chars\n` +
      `byte-for-byte identical: ${same}\n` +
      (same ? "" : "\n--- v1 ---\n" + v1Text + "\n--- v2 ---\n" + v2Text + "\n"));
  }
  await page.fill("#f_name", "The Rivera family");
  await page.fill("#f_ice1", "Sam — 555-123-4567");
  await page.fill("#f_allergy", "Penicillin (Mom); peanuts (Ana)");
  await page.fill("#f_hosp", "County General");
  await page.click("#saveBtn");
}
