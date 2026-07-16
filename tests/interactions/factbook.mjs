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

  /* ---- Phase 4 escaping probe: the tool has no remote data source (zero-network), so
     "route-fulfil with hostile payloads" becomes: inject hostile rows into the embedded
     COUNTRIES/STATES datasets in-page (top-level lexical bindings, reachable from
     evaluate) and push them through the REAL render paths — updateSuggest -> pick ->
     renderCountry, and drawStateGrid -> chip click -> renderStateCard. Every payload
     must render as inert literal text: no element creation, no handler attributes, no
     window.__xss side effect, no javascript: URL reaching a live href. ---- */
  const XC = {
    code: '"<',   // hostile "ISO2": flagEmoji output must stay astral-plane, never ASCII
    name: '<img src=x onerror=window.__xss=1>Evilland "><script>window.__xss=2</script>',
    capital: '<svg onload=window.__xss=3>javascript:alert(1)',
    region: '"><iframe src=javascript:window.__xss=4>',
    currency: "' onmouseover='window.__xss=5",
    languages: '</div><script>window.__xss=6</script>'
  };
  const XS = {
    name: 'Evil " onfocus="window.__xss=7" x="><img src=x onerror=window.__xss=8>',
    abbr: 'ZZ',
    capital: 'javascript:window.__xss=9',
    admitted: '"><b>1666</b>',
    nickname: '<script>window.__xss=10</script>'
  };
  await page.evaluate(([xc, xs]) => {
    COUNTRIES.push({ code: xc.code, name: xc.name, capital: xc.capital, region: xc.region,
                     currency: xc.currency, languages: xc.languages, pop: NaN });
    STATES.push({ name: xs.name, abbr: xs.abbr, capital: xs.capital, admitted: xs.admitted,
                  nickname: xs.nickname, pop: 1234 });
  }, [XC, XS]);

  /* hostile country through the suggest dropdown + card */
  await page.fill("#q", "evilland");
  await page.waitForSelector("#suggest.open button[data-i]");
  const suggProbe = await page.$eval("#suggest", el => ({
    liveEls: el.querySelectorAll("img,script,svg,iframe").length,
    literal: el.querySelector("button[data-i]").textContent.includes("<img src=x onerror=")
  }));
  log(`escape probe (suggest): injected els=${suggProbe.liveEls} payload-as-literal-text=${suggProbe.literal}`);
  await page.press("#q", "Enter"); // picks the hostile country -> renderCountry
  await page.waitForFunction(() =>
    document.querySelector("#countryCard h2") &&
    document.querySelector("#countryCard h2").textContent.includes("Evilland"));
  const cProbe = await page.evaluate(xcName => {
    const card = document.getElementById("countryCard");
    return {
      xss: window.__xss,
      liveEls: card.querySelectorAll("script,img,svg,iframe,a").length,
      h2Literal: card.querySelector("h2").textContent === xcName,
      ariaLabelIntact: card.querySelector(".flag").getAttribute("aria-label") === "Flag of " + xcName,
      flagAstralOnly: [...card.querySelector(".flag").textContent]
        .every(ch => ch.codePointAt(0) > 0xFFFF),
      pop: card.querySelector(".v.big").textContent.replace(/\s+/g, " ").trim()
    };
  }, XC.name);
  log(`escape probe (country card): __xss=${cProbe.xss} script/img/svg/iframe/a inside card=${cProbe.liveEls} ` +
      `name-as-literal-text=${cProbe.h2Literal} flag aria-label intact=${cProbe.ariaLabelIntact} ` +
      `hostile-ISO2 flag astral-only=${cProbe.flagAstralOnly} pop(NaN)="${cProbe.pop}"`);
  if (cProbe.xss !== undefined || suggProbe.liveEls !== 0 || cProbe.liveEls !== 0 ||
      !cProbe.h2Literal || !cProbe.ariaLabelIntact || !cProbe.flagAstralOnly)
    throw new Error("ESCAPE PROBE FAILED (country): " + JSON.stringify({ suggProbe, cProbe }));

  /* hostile state through the grid chip (data-name attribute context) + card */
  await page.click("#tabState");
  await page.fill("#qs", "evil");
  await page.waitForFunction(() => document.querySelectorAll("#stateGrid .schip").length === 1);
  const chipProbe = await page.$eval("#stateGrid .schip", (b, xsName) => ({
    liveEls: b.querySelectorAll("img,script,b,svg").length,
    attrs: [...b.attributes].map(a => a.name).join(","),
    onAttrs: [...b.attributes].filter(a => /^on/i.test(a.name)).length,
    datasetRoundTrip: b.dataset.name === xsName
  }), XS.name);
  log(`escape probe (state chip): attrs=[${chipProbe.attrs}] on*-attrs=${chipProbe.onAttrs} ` +
      `injected els=${chipProbe.liveEls} data-name attr round-trips to raw string=${chipProbe.datasetRoundTrip}`);
  if (chipProbe.onAttrs !== 0 || chipProbe.liveEls !== 0 || !chipProbe.datasetRoundTrip)
    throw new Error("ESCAPE PROBE FAILED (state chip): " + JSON.stringify(chipProbe));
  await page.click("#stateGrid .schip"); // dataset.name lookup must still find the row
  await page.waitForSelector("#stateCard .card h2");
  const sProbe = await page.evaluate(xs => {
    const card = document.getElementById("stateCard");
    return {
      xss: window.__xss,
      liveEls: card.querySelectorAll("script,img,svg,iframe,b,a").length,
      h2: card.querySelector("h2").textContent.replace(/\s+/g, " ").trim(),
      nicknameLiteral: card.querySelector(".official").textContent.includes(xs.nickname),
      jsHrefsAnywhere: document.querySelectorAll('a[href^="javascript:"]').length
    };
  }, XS);
  log(`escape probe (state card): __xss=${sProbe.xss} injected els=${sProbe.liveEls} ` +
      `nickname-as-literal-text=${sProbe.nicknameLiteral} javascript: hrefs in document=${sProbe.jsHrefsAnywhere}`);
  log(`  h2="${sProbe.h2}"`);
  if (sProbe.xss !== undefined || sProbe.liveEls !== 0 || !sProbe.nicknameLiteral || sProbe.jsHrefsAnywhere !== 0)
    throw new Error("ESCAPE PROBE FAILED (state card): " + JSON.stringify(sProbe));
  log("escape probe verdict: all hostile payloads inert in every sink (text + attribute contexts)");
}

/* No v1Interact needed: neither version writes any localStorage key beyond suite.theme
   (written by the harness's theme-toggle click on both sides). */
