/* tests/interactions/text.mjs — Text Toolbox verification (known input -> expected output) */

export const selectors = [
  "body", "header h1", ".top", ".theme-btn", ".tab", ".card",
  "#text", ".stat b", ".b", "#encOut", "#diffOut", "footer",
];

export const screenshotAfterInteract = true;

const SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

async function setTextarea(page, sel, value) {
  await page.fill(sel, value);
  // fill() fires input events, so updateStats runs; nothing else needed
}

export async function interact({ page, log }) {
  /* ---- counts on known text ---- */
  await setTextarea(page, "#text", "one two three\nfour five");
  const stats = await page.$$eval("#stats .stat", els =>
    els.map(e => e.querySelector("b").textContent + " " + e.querySelector("span").textContent));
  log("counts expected: 5 words / 23 characters / 19 no spaces / 2 lines / 1 sentences / 1 paragraphs / <1 min");
  log("counts actual:   " + stats.join(" / "));

  /* ---- case transform + undo ---- */
  await setTextarea(page, "#text", "hello world");
  await page.click('[data-op="upper"]');
  log(`UPPERCASE expected "HELLO WORLD" actual "${await page.inputValue("#text")}"`);
  await page.click('[data-op="camel"]');
  log(`camelCase expected "helloWorld" actual "${await page.inputValue("#text")}"`);
  await page.click("#undo");
  log(`undo (1x) expected "HELLO WORLD" actual "${await page.inputValue("#text")}"`);

  /* ---- sort + dedupe on a known list ---- */
  await setTextarea(page, "#text", "banana\napple\nbanana\ncherry");
  await page.click('[data-op="sortAsc"]');
  log(`sort A-Z expected "apple\\nbanana\\nbanana\\ncherry" actual "${(await page.inputValue("#text")).replace(/\n/g, "\\n")}"`);
  await page.click('[data-op="dedupe"]');
  log(`dedupe expected "apple\\nbanana\\ncherry" actual "${(await page.inputValue("#text")).replace(/\n/g, "\\n")}"`);

  /* ---- shuffle preserves the multiset ---- */
  await setTextarea(page, "#text", "1\n2\n3\n4\n5");
  await page.click('[data-op="shuffle"]');
  const shuffled = await page.inputValue("#text");
  log(`shuffle output sorted back expected "1,2,3,4,5" actual "${shuffled.split("\n").sort().join(",")}"`);

  /* ---- JSON pretty/minify + the error path ---- */
  await setTextarea(page, "#text", '{"b":1,"a":[1,2]}');
  await page.click('[data-op="jsonPretty"]');
  const pretty = await page.inputValue("#text");
  log(`jsonPretty produces indented output: ${pretty.includes('\n  "b": 1')}`);
  await page.click('[data-op="jsonMin"]');
  log(`jsonMin expected '{"b":1,"a":[1,2]}' actual '${await page.inputValue("#text")}'`);
  await setTextarea(page, "#text", "not json");
  await page.click('[data-op="jsonPretty"]');
  log(`jsonPretty error hint: "${await page.textContent("#opHint")}"`);
  log(`error left input untouched: "${await page.inputValue("#text")}"`);

  /* ---- encode & hash tab ---- */
  await page.click('[data-tab="encode"]');
  await setTextarea(page, "#encIn", "abc");
  await page.click('[data-enc="sha256"]');
  const sha = (await page.textContent("#encOut")).trim();
  log(`SHA-256("abc") expected ${SHA256_ABC}`);
  log(`SHA-256("abc") actual   ${sha}  match=${sha === SHA256_ABC}`);

  // Base64 round-trip (Unicode)
  const uni = "Hello, Wörld! ✓";
  await setTextarea(page, "#encIn", uni);
  await page.click('[data-enc="b64Enc"]');
  const b64 = (await page.textContent("#encOut")).trim();
  log(`Base64 encode("${uni}") = ${b64}`);
  await page.click("#encToInput");
  await page.click('[data-enc="b64Dec"]');
  const roundB64 = (await page.textContent("#encOut")).trim();
  log(`Base64 round-trip expected "${uni}" actual "${roundB64}" match=${roundB64 === uni}`);

  // URL round-trip
  const urly = "a b&c=d?é";
  await setTextarea(page, "#encIn", urly);
  await page.click('[data-enc="urlEnc"]');
  log(`URL encode("${urly}") = ${(await page.textContent("#encOut")).trim()}`);
  await page.click("#encToInput");
  await page.click('[data-enc="urlDec"]');
  const roundUrl = (await page.textContent("#encOut")).trim();
  log(`URL round-trip expected "${urly}" actual "${roundUrl}" match=${roundUrl === urly}`);

  // decode error path
  await setTextarea(page, "#encIn", "!!not base64!!");
  await page.click('[data-enc="b64Dec"]');
  log(`Base64 decode of junk shows error: "${(await page.textContent("#encOut")).slice(0, 60)}"`);

  /* ---- diff tab with two known strings ---- */
  await page.click('[data-tab="diff"]');
  await setTextarea(page, "#diffA", "the quick brown fox\nsame line\nremoved line");
  await setTextarea(page, "#diffB", "the quick red fox\nsame line\nadded line");
  await page.click("#runDiff");
  const diff = await page.evaluate(() => {
    const out = document.getElementById("diffOut");
    return {
      visible: !out.classList.contains("hidden"),
      dels: out.querySelectorAll(".ln.del").length,
      ins: out.querySelectorAll(".ln.ins").length,
      eq: out.querySelectorAll(".ln:not(.del):not(.ins)").length,
      marks: [...out.querySelectorAll("mark")].map(m => m.textContent),
      summary: document.getElementById("diffSummary").textContent,
    };
  });
  log(`diff visible=${diff.visible} expected del/ins/eq = 2/2/1, actual ${diff.dels}/${diff.ins}/${diff.eq}`);
  log(`diff word marks expected [brown, red, removed, added] actual [${diff.marks.join(", ")}]`);
  log(`diff summary expected "2 lines added, 2 removed." actual "${diff.summary}"`);

  // identical inputs
  await setTextarea(page, "#diffB", "the quick brown fox\nsame line\nremoved line");
  await page.click("#runDiff");
  log(`diff identical-texts summary: "${await page.textContent("#diffSummary")}"`);

  /* ---- tabs switch back (visibility sanity) ---- */
  await page.click('[data-tab="transform"]');
  const vis = await page.evaluate(() => ({
    transform: !document.getElementById("tab-transform").classList.contains("hidden"),
    encode: document.getElementById("tab-encode").classList.contains("hidden"),
    diff: document.getElementById("tab-diff").classList.contains("hidden"),
  }));
  log(`tab switch back to transform: shown=${vis.transform}, encode hidden=${vis.encode}, diff hidden=${vis.diff}`);

  /* ---- copy button (clipboard or execCommand fallback) ---- */
  await setTextarea(page, "#text", "copy me");
  await page.click("#copyText");
  await page.waitForTimeout(200);
  log(`copy toast says: "${await page.textContent("#toast")}"`);

  // WebCrypto availability note for the report (file:// check)
  const cryptoInfo = await page.evaluate(() => ({
    secureContext: window.isSecureContext,
    subtle: !!crypto.subtle,
    protocol: location.protocol,
  }));
  log(`webcrypto on ${cryptoInfo.protocol} secureContext=${cryptoInfo.secureContext} crypto.subtle=${cryptoInfo.subtle}`);

  // back on the diff tab for the post-interaction screenshot? no — leave a filled diff view instead
  await page.click('[data-tab="diff"]');
  await setTextarea(page, "#diffB", "the quick red fox\nsame line\nadded line");
  await page.click("#runDiff");
}
