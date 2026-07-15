/* tests/interactions/factbook.mjs — Country & State Factbook (Batch B slot, but the
   shipped v1 tool is ZERO-NETWORK: both datasets are embedded, flags are emoji built
   from ISO2 codes — no restcountries/Census/flag-CDN calls exist in v1 or v2).
   Exercised: country lookup via keyboard (Japan), Esc-closes-suggest, suggestion click,
   states tab (Texas by search, Ohio by chip click), then the Batch B offline reload —
   with ALL http(s) aborted the tool must stay fully functional (Kenya lookup offline). */

export const selectors = [
  "body", ".topbar", ".suite-link", ".theme-btn", "header h1", "header .tag",
  ".tab", ".search", "#countryCard .card", ".flag", ".fact .v", "footer"
];

export const screenshotAfterInteract = true;

const cardText = async (page, root, sel) =>
  (await page.textContent(`${root} ${sel}`)).replace(/\s+/g, " ").trim();

async function logCountryCard(page, log, label) {
  const h2 = await cardText(page, "#countryCard", "h2");
  const facts = await page.$$eval("#countryCard .fact", els =>
    els.map(e => `${e.querySelector(".k").textContent}=${e.querySelector(".v").textContent.replace(/\s+/g, " ").trim()}`));
  const flag = await page.$eval("#countryCard .flag", e => ({
    text: e.textContent,
    codepoints: [...e.textContent].map(c => c.codePointAt(0).toString(16).toUpperCase()).join(" "),
    ariaLabel: e.getAttribute("aria-label")
  }));
  log(`${label}: h2="${h2}"`);
  log(`  facts: ${facts.join(" | ")}`);
  log(`  flag: codepoints U+${flag.codepoints.replace(/ /g, " U+")} aria-label="${flag.ariaLabel}"`);
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- boot: default US card renders from the embedded dataset ---- */
  await page.waitForSelector("#countryCard .card h2");
  await logCountryCard(page, log, "boot default country");

  /* ---- country lookup "Japan" via the keyboard path (type -> ArrowDown -> Enter) ---- */
  await page.fill("#q", "japan");
  await page.waitForSelector("#suggest.open button[data-i]");
  const sugg = await page.$$eval("#suggest button[data-i]", els => els.map(e => e.textContent.trim()));
  log(`suggest for "japan": ${sugg.length} item(s): ${sugg.join(", ")}`);
  await page.press("#q", "ArrowDown");
  await page.press("#q", "Enter");
  await page.waitForFunction(() =>
    document.querySelector("#countryCard h2") &&
    document.querySelector("#countryCard h2").textContent === "Japan");
  await logCountryCard(page, log, 'country lookup "Japan" (keyboard pick)');
  log(`  suggest closed after pick: open=${await page.$eval("#suggest", e => e.classList.contains("open"))}`);

  /* ---- a11y addition: Esc closes the suggest overlay ---- */
  await page.fill("#q", "ken");
  await page.waitForSelector("#suggest.open");
  await page.press("#q", "Escape");
  log(`Esc closes suggest: open=${await page.$eval("#suggest", e => e.classList.contains("open"))}`);

  /* ---- US states tab: search "texas" (exact match renders the card) ---- */
  await page.click("#tabState");
  log(`states tab: countryPanel display="${await page.$eval("#countryPanel", e => e.style.display)}", tab aria-pressed=${await page.getAttribute("#tabState", "aria-pressed")}`);
  const gridAll = await page.$$eval("#stateGrid .schip", els => els.length);
  log(`state grid (unfiltered): ${gridAll} chips`);
  await page.fill("#qs", "texas");
  await page.waitForSelector("#stateCard .card h2");
  const txFacts = await page.$$eval("#stateCard .fact", els =>
    els.map(e => `${e.querySelector(".k").textContent}=${e.querySelector(".v").textContent.replace(/\s+/g, " ").trim()}`));
  log(`state lookup "texas": h2="${await cardText(page, "#stateCard", "h2")}" official="${await cardText(page, "#stateCard", ".official")}"`);
  log(`  facts: ${txFacts.join(" | ")}`);
  const gridTx = await page.$$eval("#stateGrid .schip", els => els.map(e => e.textContent.replace(/\s+/g, " ").trim()));
  log(`  grid filtered to: ${gridTx.join(", ")}`);

  /* ---- state chip click path (Ohio) ---- */
  await page.fill("#qs", "");
  await page.waitForFunction(() => document.querySelectorAll("#stateGrid .schip").length === 50);
  await page.click('#stateGrid .schip[data-name="Ohio"]');
  await page.waitForFunction(() =>
    document.querySelector("#stateCard h2") &&
    document.querySelector("#stateCard h2").textContent.startsWith("Ohio"));
  const ohFacts = await page.$$eval("#stateCard .fact", els =>
    els.map(e => `${e.querySelector(".k").textContent}=${e.querySelector(".v").textContent.replace(/\s+/g, " ").trim()}`));
  log(`state chip click "Ohio": h2="${await cardText(page, "#stateCard", "h2")}"`);
  log(`  facts: ${ohFacts.join(" | ")}`);

  /* ---- offline path (Batch B addendum, adapted): this tool performs ZERO fetches —
     there is no suite.cache.* entry to back-date and no stale state to render. The
     equivalent proof: abort ALL http(s) requests, reload, and show the tool remains
     fully functional from its embedded data. ---- */
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForSelector("#countryCard .card h2");
  log(`offline reload: boot card h2="${await cardText(page, "#countryCard", "h2")}" (rendered with all http(s) aborted)`);
  await page.fill("#q", "kenya");
  await page.waitForSelector("#suggest.open button[data-i]");
  await page.click("#suggest button[data-i]");
  await page.waitForFunction(() =>
    document.querySelector("#countryCard h2") &&
    document.querySelector("#countryCard h2").textContent === "Kenya");
  await logCountryCard(page, log, 'offline country lookup "Kenya"');
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);
  log("offline verdict: zero-network tool — everything works with the network blocked; no stale card exists by design");
}

/* No v1Interact needed: neither version writes any localStorage key beyond suite.theme
   (written by the harness's theme-toggle click on both sides). */
