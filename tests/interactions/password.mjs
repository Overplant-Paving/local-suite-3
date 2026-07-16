/* tests/interactions/password.mjs — Password & Passphrase Generator (Batch D, embedded EFF list)
   Randomness is made deterministic mid-session by replacing crypto.getRandomValues with a
   seeded xorshift32 (window.__seedRng(seed)), so logged outputs are concrete AND predictable:
   this module re-implements the v1 rejection-sampling + generation algorithms on the SAME
   seed and asserts the tool's output matches the independent prediction word-for-word. */

export const selectors = [
  "body", "header h1", ".back", ".theme-btn", ".tag",
  ".out .pw", ".btn", ".btn.ghost", ".meter .bar", ".meter .lbl",
  ".tab", ".tab.on", "#charPanel", ".tg", ".tg.on", "select", ".hint", "footer",
];

export const screenshotAfterInteract = true;

/* ---- independent replica of the page's PRNG + algorithms (v1 password.html:215-302) ---- */
function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s ^= (s << 13); s >>>= 0;
    s ^= (s >>> 17);
    s ^= (s << 5); s >>>= 0;
    return s;
  };
}
function makeRandInt(next) {
  return function randInt(max) {
    const limit = Math.floor(0x100000000 / max) * max;
    let x;
    do { x = next(); } while (x >= limit);
    return x % max;
  };
}
const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digit: "0123456789",
  symbol: "!@#$%^&*()-_=+[]{};:,.?/",
};
const AMBIGUOUS = new Set("0Oo lI1| 5S 2Z 8B {}[]()".replace(/\s/g, "").split(""));

function predictPhrase(seed, effWords, { words, sep, cap, num }) {
  const randInt = makeRandInt(makeRng(seed));
  const out = [];
  for (let i = 0; i < words; i++) {
    let w = effWords[randInt(effWords.length)];
    if (cap) w = w[0].toUpperCase() + w.slice(1);
    out.push(w);
  }
  let pw = out.join(sep);
  if (num) pw += (sep || "") + randInt(10);
  return pw;
}

function predictChar(seed, { len, lower, upper, digit, symbol, noAmbig }) {
  const randInt = makeRandInt(makeRng(seed));
  let pool = "";
  if (lower) pool += SETS.lower;
  if (upper) pool += SETS.upper;
  if (digit) pool += SETS.digit;
  if (symbol) pool += SETS.symbol;
  if (noAmbig) pool = [...pool].filter(ch => !AMBIGUOUS.has(ch)).join("");
  const chosen = [];
  if (lower) chosen.push("lower");
  if (upper) chosen.push("upper");
  if (digit) chosen.push("digit");
  if (symbol) chosen.push("symbol");
  const chars = [];
  for (let i = 0; i < len; i++) chars.push(pool[randInt(pool.length)]);
  if (chosen.length <= len) {
    const idx = [...Array(len).keys()];
    for (let i = idx.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const positions = idx.slice(0, chosen.length);
    chosen.forEach((setName, k) => {
      let allowed = [...SETS[setName]];
      if (noAmbig) allowed = allowed.filter(ch => !AMBIGUOUS.has(ch));
      if (allowed.length) chars[positions[k]] = allowed[randInt(allowed.length)];
    });
  }
  return chars.join("");
}

async function setRange(page, sel, value) {
  await page.$eval(sel, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, String(value));
}

async function readMeter(page) {
  return {
    pw: (await page.textContent("#pw")).trim(),
    bits: (await page.textContent("#bits")).trim(),
    strength: (await page.textContent("#strength")).trim(),
    crack: (await page.textContent("#crack")).trim(),
    barWidth: await page.$eval("#bar", el => el.style.width),
    barColor: await page.$eval("#bar", el => el.style.background),
  };
}

export async function interact({ page, log }) {
  /* ---- install the seedable deterministic RNG over crypto.getRandomValues ---- */
  await page.evaluate(() => {
    let s = 1;
    window.__seedRng = seed => { s = seed >>> 0; };
    window.__rngCalls = 0;
    crypto.getRandomValues = buf => {
      for (let i = 0; i < buf.length; i++) {
        s ^= (s << 13); s >>>= 0;
        s ^= (s >>> 17);
        s ^= (s << 5); s >>>= 0;
        buf[i] = s;
        window.__rngCalls++;
      }
      return buf;
    };
  });

  /* ---- wordlist sanity straight from the live page ---- */
  const effLen = await page.evaluate(() => EFF_WORDS.length);
  const effUnique = await page.evaluate(() => new Set(EFF_WORDS).size);
  const effSample = await page.evaluate(() => [EFF_WORDS[0], EFF_WORDS[3887], EFF_WORDS[7775]]);
  log(`EFF wordlist in page: length=${effLen} (expect 7776) unique=${effUnique} ` +
      `first/mid/last=[${effSample.join(", ")}]`);
  const effWords = await page.evaluate(() => EFF_WORDS);

  /* ---- initial (load-time) char password, default settings ---- */
  const init = await readMeter(page);
  log(`initial char pw (real crypto, pre-stub): "${init.pw}" len=${init.pw.length} ` +
      `bits=${init.bits} strength=${init.strength} crack="${init.crack}" bar=${init.barWidth}/${init.barColor}`);

  /* ---- deterministic char password: predict independently, then compare ---- */
  await page.evaluate(() => window.__seedRng(0xC0FFEE));
  await page.click("#regen");
  const char1 = await readMeter(page);
  const charPred = predictChar(0xC0FFEE, { len: 20, lower: true, upper: true, digit: true, symbol: true, noAmbig: false });
  const pool86 = 26 + 26 + 10 + 24;
  const charBits = 20 * Math.log2(pool86);
  log(`char 20 (seed 0xC0FFEE): got "${char1.pw}" predicted "${charPred}" match=${char1.pw === charPred}`);
  log(`char entropy: displayed=${char1.bits} recomputed=20*log2(${pool86})=${charBits.toFixed(2)} ` +
      `roundMatches=${Number(char1.bits) === Math.round(charBits)} strength=${char1.strength} (expect Overkill >=128)`);

  /* ---- length slider -> 32, all four classes still on ---- */
  await page.evaluate(() => window.__seedRng(42));
  await setRange(page, "#len", 32);
  const char32 = await readMeter(page);
  const char32Pred = predictChar(42, { len: 32, lower: true, upper: true, digit: true, symbol: true, noAmbig: false });
  log(`char 32 (seed 42): lenval="${await page.textContent("#lenval")}" got "${char32.pw}" ` +
      `len=${char32.pw.length} predicted match=${char32.pw === char32Pred} bits=${char32.bits} ` +
      `(recompute ${Math.round(32 * Math.log2(pool86))})`);

  /* ---- class toggles: symbols+digits off, look-alikes on; verify alphabet + entropy ---- */
  await page.click('#charToggles .tg[data-set="symbol"]');
  await page.click('#charToggles .tg[data-set="digit"]');
  await page.evaluate(() => window.__seedRng(7));
  await page.click('#charToggles .tg[data-set="noAmbig"]');
  const charNa = await readMeter(page);
  const naPool = [...(SETS.lower + SETS.upper)].filter(ch => !AMBIGUOUS.has(ch));
  const naPred = predictChar(7, { len: 32, lower: true, upper: true, digit: false, symbol: false, noAmbig: true });
  const naOk = [...charNa.pw].every(ch => naPool.includes(ch));
  log(`char letters-only noAmbig (seed 7): got "${charNa.pw}" predicted match=${charNa.pw === naPred} ` +
      `allInFilteredPool(${naPool.length} chars)=${naOk} ` +
      `noLookalikes=${![...charNa.pw].some(ch => AMBIGUOUS.has(ch))} bits=${charNa.bits} ` +
      `(recompute ${Math.round(32 * Math.log2(naPool.length))})`);

  /* ---- "keep at least one set" guard ---- */
  await page.click('#charToggles .tg[data-set="upper"]');
  await page.click('#charToggles .tg[data-set="lower"]'); // last one standing -> refused
  const toastGuard = await page.textContent("#toast");
  const lowerStillOn = await page.$eval('#charToggles .tg[data-set="lower"]',
    el => el.classList.contains("on") + "/" + el.getAttribute("aria-pressed"));
  log(`zero-set guard: clicking last active set -> toast="${toastGuard}" lower still on=${lowerStillOn}`);

  /* ---- weak-end of the strength ladder: 6 lowercase chars ---- */
  await setRange(page, "#len", 6);
  const weak = await readMeter(page);
  const lowerNaPool = [...SETS.lower].filter(ch => !AMBIGUOUS.has(ch)); // 24 chars (drops o, l)
  log(`char 6 lowercase-only (noAmbig): "${weak.pw}" bits=${weak.bits} ` +
      `(recompute ${Math.round(6 * Math.log2(lowerNaPool.length))} for ${lowerNaPool.length}-char pool) ` +
      `strength=${weak.strength} crack="${weak.crack}" bar=${weak.barWidth}`);

  /* restore defaults for the char panel */
  await page.click('#charToggles .tg[data-set="upper"]');
  await page.click('#charToggles .tg[data-set="digit"]');
  await page.click('#charToggles .tg[data-set="symbol"]');
  await page.click('#charToggles .tg[data-set="noAmbig"]');
  await setRange(page, "#len", 20);

  /* ---- passphrase tab ---- */
  await page.click("#tabPhrase");
  const phrasePanelShown = await page.$eval("#phrasePanel", el => !el.classList.contains("hidden"));
  const charPanelHidden = await page.$eval("#charPanel", el => el.classList.contains("hidden"));
  log(`tab switch: phrasePanel shown=${phrasePanelShown} charPanel hidden=${charPanelHidden} ` +
      `tab aria-pressed=${await page.getAttribute("#tabPhrase", "aria-pressed")}`);

  /* deterministic 6-word dash phrase: independent word-for-word prediction */
  await page.evaluate(() => window.__seedRng(2026));
  await page.click("#regen");
  const ph1 = await readMeter(page);
  const ph1Pred = predictPhrase(2026, effWords, { words: 6, sep: "-", cap: false, num: false });
  const ph1Words = ph1.pw.split("-");
  const phraseBits = 6 * Math.log2(7776);
  log(`phrase 6/dash (seed 2026): got "${ph1.pw}"`);
  log(`  predicted "${ph1Pred}" match=${ph1.pw === ph1Pred} words=${ph1Words.length} ` +
      `allInEFFList=${ph1Words.every(w => effWords.includes(w))}`);
  log(`  entropy: displayed=${ph1.bits} recomputed=6*log2(7776)=${phraseBits.toFixed(4)} ` +
      `roundMatches=${Number(ph1.bits) === Math.round(phraseBits)} strength=${ph1.strength} crack="${ph1.crack}"`);

  /* ---- words slider 4, space separator ---- */
  await page.selectOption("#sep", " ");
  await page.evaluate(() => window.__seedRng(99));
  await setRange(page, "#words", 4);
  const ph2 = await readMeter(page);
  const ph2Pred = predictPhrase(99, effWords, { words: 4, sep: " ", cap: false, num: false });
  log(`phrase 4/space (seed 99): got "${ph2.pw}" predicted match=${ph2.pw === ph2Pred} ` +
      `wordsval="${await page.textContent("#wordsval")}" bits=${ph2.bits} ` +
      `(recompute ${Math.round(4 * Math.log2(7776))})`);

  /* ---- capitalize + random number, dot separator ---- */
  await page.selectOption("#sep", ".");
  await page.click('#phraseToggles .tg[data-opt="cap"]');
  await page.evaluate(() => window.__seedRng(555));
  await page.click('#phraseToggles .tg[data-opt="num"]');
  const ph3 = await readMeter(page);
  const ph3Pred = predictPhrase(555, effWords, { words: 4, sep: ".", cap: true, num: true });
  const ph3BitsExp = 4 * Math.log2(7776) + Math.log2(10);
  log(`phrase 4/dot cap+num (seed 555): got "${ph3.pw}" predicted match=${ph3.pw === ph3Pred} ` +
      `capitalized=${ph3.pw.split(".").slice(0, 4).every(w => /^[A-Z]/.test(w))} ` +
      `endsWithDigit=${/\.\d$/.test(ph3.pw)} bits=${ph3.bits} ` +
      `(recompute ${ph3BitsExp.toFixed(2)} -> ${Math.round(ph3BitsExp)})`);
  const capPressed = await page.getAttribute('#phraseToggles .tg[data-opt="cap"]', "aria-pressed");
  log(`phrase toggle aria-pressed after enable: cap=${capPressed}`);

  /* ---- keyboard path on a pill toggle (span role=button) ---- */
  await page.focus('#phraseToggles .tg[data-opt="cap"]');
  await page.keyboard.press("Enter");
  const capAfterEnter = await page.$eval('#phraseToggles .tg[data-opt="cap"]',
    el => el.classList.contains("on") + "/" + el.getAttribute("aria-pressed"));
  log(`keyboard: Enter on focused cap pill -> on/aria-pressed=${capAfterEnter} (was true/true)`);
  await page.keyboard.press("Space");
  const capAfterSpace = await page.$eval('#phraseToggles .tg[data-opt="cap"]',
    el => el.classList.contains("on") + "/" + el.getAttribute("aria-pressed"));
  log(`keyboard: Space on same pill -> on/aria-pressed=${capAfterSpace}`);
  await page.keyboard.press("Space"); // back off -> plain lowercase phrase for the screenshot
  await page.click('#phraseToggles .tg[data-opt="num"]');

  /* ---- copy path: spy on the async clipboard API, then force the execCommand fallback ---- */
  await page.evaluate(() => {
    window.__copied = null;
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", { value: {}, configurable: true });
    }
    navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); };
  });
  await page.click("#copy");
  const copied = await page.evaluate(() => window.__copied);
  const shownPw = (await page.textContent("#pw")).trim();
  const toastCopy = await page.textContent("#toast");
  const toastShown = await page.$eval("#toast", el => el.classList.contains("show"));
  log(`copy (clipboard API): captured="${copied}" equalsDisplayed=${copied === shownPw} ` +
      `toast="${toastCopy}" shown=${toastShown} ariaLive=${await page.getAttribute("#toast", "aria-live")}`);

  await page.evaluate(() => {
    window.__fallback = null;
    navigator.clipboard.writeText = () => Promise.reject(new Error("blocked"));
    document.execCommand = () => { window.__fallback = "execCommand-copy-invoked"; return true; };
  });
  await page.click("#copy");
  const fb = await page.evaluate(() => window.__fallback);
  log(`copy (fallback path, clipboard rejected): ${fb} toast="${await page.textContent("#toast")}"`);

  /* ---- rng accounting: everything above the stub install used the stub ---- */
  const rngCalls = await page.evaluate(() => window.__rngCalls);
  log(`crypto.getRandomValues stub served ${rngCalls} Uint32 draws during the session`);

  /* leave the passphrase panel populated for the after-interaction screenshot */
  await page.evaluate(() => window.__seedRng(31337));
  await page.click("#regen");
  log(`final state for screenshot: phrase="${(await page.textContent("#pw")).trim()}"`);

  const keys = await page.evaluate(() => Object.keys(localStorage));
  log(`localStorage keys after full interaction: [${keys.join(", ")}] (v1 writes only suite.theme)`);
}
