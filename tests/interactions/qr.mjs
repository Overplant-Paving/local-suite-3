/* tests/interactions/qr.mjs — exercises the QR Code Maker end-to-end.
   Offline tool: encode in every preset mode, verify the canvas is genuinely
   non-blank (pixel counts), exercise EC/scale options, the error path, the
   download guard, and the full print-sheet flow (add / remove / clear / print CSS). */
import { join } from "node:path";

export const selectors = [
  "body", ".wrap", "header h1", ".theme-btn", ".tab", ".card",
  "#qrCanvas", ".seg button", ".btn", "#meta", "input[type=range]", "footer"
];

/* Count dark (module) pixels on the preview canvas — proves real encoding output. */
async function canvasStats(page) {
  return page.evaluate(() => {
    const c = document.getElementById("qrCanvas");
    const ctx = c.getContext("2d");
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0 && d[i] < 128) dark++;
    }
    return { w: c.width, h: c.height, dark };
  });
}

export async function interact({ page, log, evidenceDir }) {
  /* 1 — default payload (https://www.eff.org/) renders on load */
  log("meta on load: " + (await page.locator("#meta").innerText()));
  let s = await canvasStats(page);
  log(`canvas on load: ${s.w}x${s.h}px, dark pixels = ${s.dark}`);

  /* 2 — live re-encode on typing */
  await page.fill("#fText", "Local Suite v2 qr migration check");
  await page.waitForTimeout(100);
  log("meta after typing text: " + (await page.locator("#meta").innerText()));
  s = await canvasStats(page);
  log(`canvas after typing: ${s.w}x${s.h}px, dark pixels = ${s.dark}`);

  /* 3 — error-correction level switch */
  await page.click('#ecPick button[data-v="Q"]');
  log("meta after EC=Q: " + (await page.locator("#meta").innerText()));

  /* 4 — module size slider */
  await page.locator("#scale").fill("12");
  await page.waitForTimeout(100);
  log("scale label after slider=12: " + (await page.locator("#scaleVal").innerText()));
  s = await canvasStats(page);
  log(`canvas after scale=12: ${s.w}x${s.h}px, dark pixels = ${s.dark}`);

  /* 5 — oversize payload -> friendly error (versions cap at 10) */
  await page.fill("#fText", "x".repeat(1200));
  await page.waitForTimeout(100);
  log("error for 1200-char payload: " + (await page.locator("#err").innerText()));
  log("meta during error: " + (await page.locator("#meta").innerText()));
  await page.fill("#fText", "https://www.eff.org/");
  await page.locator("#scale").fill("8");
  await page.click('#ecPick button[data-v="M"]');
  await page.waitForTimeout(100);

  /* 6 — WiFi mode */
  await page.click('.tab[data-preset="wifi"]');
  log("wifi group visible: " + (await page.locator("#fSsid").isVisible()) +
      ", meta with empty SSID: " + (await page.locator("#meta").innerText()));
  await page.fill("#fSsid", "MyHomeNet");
  await page.fill("#fPass", "s3cret;pass");
  await page.check("#fHidden");
  await page.waitForTimeout(100);
  log("meta for WiFi payload: " + (await page.locator("#meta").innerText()));
  s = await canvasStats(page);
  log(`canvas for WiFi: ${s.w}x${s.h}px, dark pixels = ${s.dark}`);
  await page.click('#fEnc button[data-v="nopass"]');
  log("password disabled when security=None: " + (await page.locator("#fPass").isDisabled()));
  await page.click('#fEnc button[data-v="WPA"]');
  log("password re-enabled on WPA: " + !(await page.locator("#fPass").isDisabled()));

  /* 7 — phone + email presets */
  await page.click('.tab[data-preset="tel"]');
  await page.fill("#fTel", "+1 (555) 123-4567");
  await page.waitForTimeout(100);
  log("meta for tel payload: " + (await page.locator("#meta").innerText()));
  await page.click('.tab[data-preset="mail"]');
  await page.fill("#fMail", "someone@example.com");
  await page.fill("#fSubj", "Hello & welcome");
  await page.waitForTimeout(100);
  log("meta for mailto payload: " + (await page.locator("#meta").innerText()));

  /* 8 — download (PNG data-url anchor) */
  await page.click('.tab[data-preset="text"]');
  await page.waitForTimeout(100);
  try {
    const dl = page.waitForEvent("download", { timeout: 5000 });
    await page.click("#download");
    const download = await dl;
    log("download triggered, suggested filename: " + download.suggestedFilename());
    await download.cancel();
  } catch (e) {
    log("download did not trigger: " + e.message);
  }

  /* 9 — print sheet: add two, verify, print-CSS shot, remove one, clear */
  await page.click("#addSheet");
  log("toast after add: " + (await page.locator("#toast").innerText()));
  await page.fill("#fText", "second code — wifi card by the door");
  await page.waitForTimeout(100);
  await page.click("#addSheet");
  log("sheet count label: " + (await page.locator("#sheetCount").innerText()) +
      ", visible sheet items: " + (await page.locator("#sheetList .sheet-item").count()) +
      ", print-area items: " + (await page.locator("#printArea .sheet-item").count()));
  log("empty hint hidden with items: " + !(await page.locator("#sheetEmpty").isVisible()));

  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: join(evidenceDir, "v2-print-sheet.png"), fullPage: true });
  log("print-media screenshot with populated sheet: v2-print-sheet.png");
  await page.emulateMedia({ media: "screen" });

  await page.locator("#sheetList .sheet-item .x").first().click();
  log("sheet items after removing one: " + (await page.locator("#sheetList .sheet-item").count()));
  await page.click("#clearSheet");
  log("sheet items after clear: " + (await page.locator("#sheetList .sheet-item").count()) +
      ", empty hint visible again: " + (await page.locator("#sheetEmpty").isVisible()));

  /* leave one code on the sheet so the after-interaction screenshot shows the feature */
  await page.click("#addSheet");
  log("final state: one code re-added to sheet, count label = " +
      (await page.locator("#sheetCount").innerText()));
}

export const screenshotAfterInteract = true;
export const printShots = true;
