/* tests/interactions/color.mjs — Color Studio interaction for verify-tool.mjs */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const selectors = [
  "body",
  "header h1",
  ".tab.on",
  ".card",
  "input[type=color]",
  ".fmt",
  ".sw",
  ".sw .chip",
  ".sw .lab",
  ".ratio",
  ".drop",
  "footer",
];

export const screenshotAfterInteract = true;

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. picker: set a known color, verify conversions ---- */
  await page.evaluate(() => {
    const i = document.getElementById("colorInput");
    i.value = "#ff8800";
    i.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const fmts = await page.$$eval("#formats .fmt", rows =>
    rows.map(r => r.querySelector(".k").textContent + " = " + r.querySelector(".v").textContent));
  log("picker set to #ff8800; format rows: " + fmts.join(" | "));
  const sliders = await page.evaluate(() => ({
    h: document.getElementById("slH").value,
    s: document.getElementById("slS").value,
    l: document.getElementById("slL").value,
    outH: document.getElementById("outH").textContent,
    outS: document.getElementById("outS").textContent,
    outL: document.getElementById("outL").textContent,
  }));
  log("HSL sliders after set: H=" + sliders.h + " S=" + sliders.s + " L=" + sliders.l +
      " (outputs: " + sliders.outH + " " + sliders.outS + " " + sliders.outL + ")");

  /* drive a slider to prove the reverse path (HSL -> RGB -> formats) */
  await page.evaluate(() => {
    const s = document.getElementById("slL");
    s.value = "25";
    s.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const hexAfterSlider = await page.$eval("#formats .fmt .v", el => el.textContent);
  log("lightness slider moved to 25 -> HEX now: " + hexAfterSlider);

  /* ---- 2. palettes: verify generation, save one ---- */
  const palettes = await page.$$eval("#palettes .pal", pals =>
    pals.map(p => p.querySelector("h4 span").textContent + " [" +
      [...p.querySelectorAll(".sw .lab")].map(l => l.textContent).join(", ") + "]"));
  log("generated palettes:\n  " + palettes.join("\n  "));
  await page.click("#palettes .pal .savebtn"); // save "Complementary"
  log("clicked Save on first palette; toast: " + (await page.$eval("#toast", el => el.textContent)));

  /* copy path: click a format row, observe the toast (clipboard or execCommand fallback) */
  await page.click("#formats .fmt");
  await page.waitForTimeout(150);
  log("clicked HEX row; toast: " + (await page.$eval("#toast", el => el.textContent)));

  /* ---- 3. contrast: known pair #000 on #fff must be 21:1 ---- */
  await page.click('.tab[data-tab="contrast"]');
  await page.fill("#fgHex", "#000000");
  await page.fill("#bgHex", "#ffffff");
  const cc = await page.evaluate(() => ({
    ratio: document.getElementById("ccRatio").textContent,
    badges: [...document.querySelectorAll("#ccBadges .badge")].map(b => b.textContent.trim()),
    previewBg: document.getElementById("ccPreview").style.background,
    previewColor: document.getElementById("ccPreview").style.color,
  }));
  log("contrast #000000 on #ffffff -> ratio: " + cc.ratio + "; badges: " + cc.badges.join(" | "));
  log("contrast preview inline styles: background=" + cc.previewBg + " color=" + cc.previewColor);

  /* a second known pair: #777 on #fff ~ 4.48:1 (AA normal should FAIL) */
  await page.fill("#fgHex", "#777777");
  const cc2 = await page.evaluate(() => ({
    ratio: document.getElementById("ccRatio").textContent,
    badges: [...document.querySelectorAll("#ccBadges .badge")].map(b => b.textContent.trim()),
  }));
  log("contrast #777777 on #ffffff -> ratio: " + cc2.ratio + "; badges: " + cc2.badges.join(" | "));

  /* ---- 4. photo: generate a 4-color test image in-page, feed the file input ---- */
  await page.click('.tab[data-tab="photo"]');
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 40; c.height = 40;
    const x = c.getContext("2d");
    x.fillStyle = "#ff0000"; x.fillRect(0, 0, 20, 20);
    x.fillStyle = "#00ff00"; x.fillRect(20, 0, 20, 20);
    x.fillStyle = "#0000ff"; x.fillRect(0, 20, 20, 20);
    x.fillStyle = "#ffffff"; x.fillRect(20, 20, 20, 20);
    return c.toDataURL("image/png");
  });
  const photoPath = join(evidenceDir, "test-photo.png");
  writeFileSync(photoPath, Buffer.from(dataUrl.split(",")[1], "base64"));
  await page.setInputFiles("#fileInput", photoPath);
  await page.waitForSelector("#photoPal:not(.hidden)", { timeout: 5000 });
  const photo = await page.evaluate(() => ({
    hexes: document.getElementById("photoPal").dataset.hexes,
    swatches: [...document.querySelectorAll("#photoSwatches .sw .lab")].map(l => l.textContent),
    canvasShown: getComputedStyle(document.getElementById("photoCanvas")).display,
  }));
  log("photo (red/green/blue/white quadrants) dominant colors: " + photo.swatches.join(", ") +
      " (dataset.hexes=" + photo.hexes + "; canvas display=" + photo.canvasShown + ")");
  await page.click("#savePhotoPal");
  log("saved photo palette; toast: " + (await page.$eval("#toast", el => el.textContent)));

  /* ---- 5. saved tab: both palettes listed; delete one ---- */
  await page.click('.tab[data-tab="saved"]');
  const savedBefore = await page.$$eval("#savedWrap .saved-item .nm", els => els.map(e => e.textContent));
  log("saved tab items: " + savedBefore.join(" | "));
  await page.click("#savedWrap .saved-item .del"); // delete the newest ("From photo")
  const savedAfter = await page.$$eval("#savedWrap .saved-item .nm", els => els.map(e => e.textContent));
  log("after deleting first item, saved tab items: " + savedAfter.join(" | "));

  /* ---- 6. keyboard path spot-check: focus a swatch, press Enter ---- */
  await page.click('.tab[data-tab="picker"]');
  await page.focus("#palettes .sw");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  log("keyboard Enter on focused swatch; toast: " + (await page.$eval("#toast", el => el.textContent)));
}

/* Same state-writing action on v1 so localStorage key sets compare equal:
   saving any palette creates suite.color.palettes. */
export async function v1Interact({ page }) {
  await page.click("#palettes .pal .savebtn");
}
