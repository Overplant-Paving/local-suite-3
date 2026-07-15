/* tests/interactions/daylight.mjs — Daylight Planner (offline, SVG chart, suite.location) */

export const selectors = [
  "body", "header h1", ".back", ".theme-btn", ".loc", ".card",
  "#citySel", "#inLat", "#saveLoc", "#geoBtn", "label", "footer"
];

export const screenshotAfterInteract = true;

async function tipText(page) {
  return (await page.$eval("#tip", el => el.innerText)).replace(/\n/g, " | ");
}
async function statLines(page) {
  return page.$$eval("#stats .stat", els => els.map(e => e.innerText.replace(/\n/g, " | ")));
}

export async function interact({ page, log }) {
  const dialogs = [];
  page.on("dialog", async d => { dialogs.push(d.message()); await d.dismiss(); });

  /* first-run state: location card shown, content hidden */
  log("first-run: locCard=" + await page.$eval("#locCard", el => getComputedStyle(el).display) +
      " content=" + await page.$eval("#content", el => getComputedStyle(el).display) +
      " locBar=" + await page.$eval("#locBar", el => getComputedStyle(el).display));

  /* validation: out-of-range latitude alerts and does not save */
  await page.fill("#inLat", "999");
  await page.fill("#inLon", "0");
  await page.click("#saveLoc");
  log("invalid lat 999 -> alert: " + (dialogs[0] || "(no dialog)"));
  log("after invalid save, suite.location = " + await page.evaluate(() => localStorage.getItem("suite.location")));

  /* pick a city: dropdown autofills the coordinate inputs */
  await page.selectOption("#citySel", "0"); // New York, USA
  log("picked New York; autofill lat=" + await page.inputValue("#inLat") +
      " lon=" + await page.inputValue("#inLon"));
  await page.click("#saveLoc");

  /* year view renders */
  log("locLabel: " + await page.textContent("#locLabel"));
  log("yearLbl: " + await page.textContent("#yearLbl"));
  (await statLines(page)).forEach(s => log("stat: " + s));

  /* the chart actually drew: count SVG elements + polyline points */
  const chart = await page.evaluate(() => {
    const svg = document.querySelector("#chartwrap svg");
    if (!svg) return null;
    const polys = [...svg.querySelectorAll("polyline")];
    return {
      rects: svg.querySelectorAll("rect").length,
      polylines: polys.length,
      polylinePoints: polys.map(p => p.getAttribute("points").trim().split(/\s+/).length),
      lines: svg.querySelectorAll("line").length,
      texts: svg.querySelectorAll("text").length
    };
  });
  log("chart drawn (SVG element counts): " + JSON.stringify(chart));

  /* hover a date: tooltip shows sunrise/sunset/daylight */
  const box = await page.locator("#chartwrap svg").boundingBox();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
  log("hover ~mid-year tip: " + await tipText(page));

  /* keyboard path (a11y addition): focus chart, arrows step days, Esc hides */
  await page.focus("#chartwrap svg");
  await page.keyboard.press("ArrowRight");
  log("keyboard ArrowRight tip: " + await tipText(page));
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  log("keyboard ArrowLeft x2 tip: " + await tipText(page));
  await page.keyboard.press("Escape");
  log("Escape hides tip: display=" + await page.$eval("#tip", el => el.style.display));

  /* change location -> polar latitude (Tromsø), submitted via Enter (a11y addition) */
  await page.click("#changeLoc");
  log("change clicked: locCard=" + await page.$eval("#locCard", el => getComputedStyle(el).display));
  await page.fill("#inLat", "69.6492");
  await page.fill("#inLon", "18.9553");
  await page.press("#inLon", "Enter");
  log("Tromsø saved via Enter; locLabel: " + await page.textContent("#locLabel"));
  (await statLines(page)).forEach(s => log("polar stat: " + s));
  log("caption: " + await page.textContent("#cap"));
  const polarChart = await page.evaluate(() => {
    const svg = document.querySelector("#chartwrap svg");
    return { rects: svg.querySelectorAll("rect").length,
             polylines: svg.querySelectorAll("polyline").length };
  });
  log("polar chart counts: " + JSON.stringify(polarChart));

  /* back to New York (dropdown) for the closing screenshot + stored key */
  await page.click("#changeLoc");
  await page.selectOption("#citySel", "0");
  await page.click("#saveLoc");
  log("final suite.location = " + await page.evaluate(() => localStorage.getItem("suite.location")));
}

/* same state-writing actions on v1 so the localStorage key sets compare equal */
export async function v1Interact({ page }) {
  await page.selectOption("#citySel", "0"); // New York, USA
  await page.click("#saveLoc");
}
