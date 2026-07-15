/* tests/interactions/paper.mjs — Paper Generator (offline, print-css tool).
   Exercises the core feature: pick each paper type, adjust page/spacing/ink
   controls, and log concrete facts about the SVG that actually renders. */

export const selectors = [
  "body",
  "header h1",
  ".theme-btn",
  ".back",
  ".panel.controls",
  "#type",
  ".seg",
  ".btn",
  ".preview",
  ".note",
  "footer",
];

export const screenshotAfterInteract = true;
export const printShots = true; // PRINT CSS IS THE PRODUCT

/* Concrete facts about the currently rendered SVG. */
async function svgFacts(page) {
  return page.evaluate(() => {
    const svg = document.querySelector("#preview svg");
    if (!svg) return null;
    return {
      width: svg.getAttribute("width"),
      height: svg.getAttribute("height"),
      viewBox: svg.getAttribute("viewBox"),
      lines: svg.querySelectorAll("line").length,
      circles: svg.querySelectorAll("circle").length,
      texts: svg.querySelectorAll("text").length,
      rects: svg.querySelectorAll("rect").length,
      firstLineStroke: svg.querySelector("line") ? svg.querySelector("line").getAttribute("stroke") : null,
      firstLineWidth: svg.querySelector("line") ? svg.querySelector("line").getAttribute("stroke-width") : null,
    };
  });
}

export async function interact({ page, log }) {
  const f = async label => {
    const s = await svgFacts(page);
    log(`${label}: ${s ? `svg ${s.width}x${s.height} viewBox="${s.viewBox}" lines=${s.lines} circles=${s.circles} texts=${s.texts} rects=${s.rects} stroke=${s.firstLineStroke} stroke-width=${s.firstLineWidth}` : "NO SVG RENDERED"}`);
    return s;
  };

  // default state: graph paper, US Letter portrait, 5 mm spacing
  await f("default graph/letter/portrait/5mm");

  // spacing 10 mm -> roughly half the grid lines
  await page.fill("#spacing", "10");
  await page.dispatchEvent("#spacing", "input");
  await f("graph spacing=10mm");

  // unit -> inch (10 in is clamped by max=40? no: value stays 10, unit in => 254mm; still >page so few lines)
  await page.fill("#spacing", "0.5");
  await page.selectOption("#unit", "in");
  await f("graph spacing=0.5in (12.7mm)");

  // heavy line cadence off
  await page.fill("#heavy", "0");
  await page.dispatchEvent("#heavy", "input");
  await f("graph heavy=0");
  await page.fill("#heavy", "5");
  await page.dispatchEvent("#heavy", "input");

  // each paper type; log visibility of the type-dependent control groups
  for (const type of ["dot", "lined", "iso", "music", "hand", "battleship"]) {
    await page.selectOption("#type", type);
    const vis = await page.evaluate(() => ({
      spacing: document.getElementById("spacingWrap").style.display !== "none",
      heavy: document.getElementById("heavyWrap").style.display !== "none",
      ruled: document.getElementById("ruledWrap").style.display !== "none",
    }));
    log(`type=${type}: controls visible -> spacing=${vis.spacing} heavy=${vis.heavy} ruled=${vis.ruled}`);
    await f(`type=${type}`);
  }

  // lined: switch ruling preset + margin line off
  await page.selectOption("#type", "lined");
  await page.selectOption("#ruled", "8.7");
  const linedWide = await f("lined wide-ruled 8.7mm");
  await page.uncheck("#marginLine");
  const linedNoMargin = await f("lined wide-ruled, margin line off");
  log(`margin-line toggle removed ${linedWide.lines - linedNoMargin.lines} line (expect 1, the red margin rule)`);
  await page.check("#marginLine");

  // page size & orientation
  await page.selectOption("#type", "graph");
  await page.selectOption("#size", "a4");
  await f("graph A4 portrait");
  await page.click('#orient button[data-v="landscape"]');
  await f("graph A4 landscape");
  await page.click('#orient button[data-v="portrait"]');

  // margins: full-bleed button zeroes the margin field
  await page.click("#marginBleed");
  const marginVal = await page.inputValue("#margin");
  log(`marginBleed button -> #margin value now "${marginVal}" (expect "0")`);
  await f("graph A4 full bleed");
  await page.fill("#margin", "10");
  await page.dispatchEvent("#margin", "input");

  // ink: swatch click updates the color input and the rendered stroke
  await page.locator(".sw").nth(2).click(); // #c05a5a
  const colorVal = await page.inputValue("#color");
  const afterSwatch = await f("ink swatch #c05a5a");
  log(`swatch click -> #color input="${colorVal}", rendered stroke="${afterSwatch.firstLineStroke}"`);

  // line weight
  await page.fill("#weight", "0.4");
  await page.dispatchEvent("#weight", "input");
  const heavyW = await f("minor weight 0.4mm");
  log(`weight change -> first line stroke-width now ${heavyW.firstLineWidth}`);

  // border box
  await page.check("#border");
  const withBorder = await f("border box on");
  log(`border checkbox -> rects=${withBorder.rects} (expect 3: clipPath rect + white sheet + border box)`);
  await page.uncheck("#border");

  // Download SVG: verify the blob download fires with the right name
  try {
    const dl = page.waitForEvent("download", { timeout: 4000 });
    await page.click("#dlBtn");
    const download = await dl;
    log(`Download SVG -> suggested filename "${download.suggestedFilename()}"`);
  } catch (e) {
    log(`Download SVG -> no download event captured (${String(e).slice(0, 80)})`);
  }

  // a11y probe: preview description
  const ariaLabel = await page.getAttribute("#preview", "aria-label");
  const ariaLive = await page.getAttribute("#preview", "aria-live");
  log(`preview role=img aria-label="${ariaLabel}" aria-live=${ariaLive}`);

  // leave the tool on the default-ish state for the after-interaction screenshot
  await page.selectOption("#size", "letter");
  await page.fill("#weight", "0.18");
  await page.dispatchEvent("#weight", "input");
}

/* The tool writes no localStorage of its own (suite.theme only, via core);
   no state-writing actions to mirror on v1. */
