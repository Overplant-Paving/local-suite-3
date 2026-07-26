/* Focused contract: Color Studio's "colors from a photo" must actually produce a palette
   under the build-generated CSP — in both file:// and hosted mode.

   Regression guarded: the tool used to set an <img> src to URL.createObjectURL(file), and the
   generated policy (img-src 'self' data:) refuses blob: URLs, so every valid photo fell into
   the "Could not read that image" handler:

     Loading the image 'blob:null/…' violates the following Content Security Policy
     directive: "img-src 'self' data:". The action has been blocked.

   The smoke suite only asserts zero console errors *on load*, so an after-interaction CSP
   violation like this one sits in its blind spot. That is what this test covers.

   Run: node tests/color-photo.mjs */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DIST = join(REPO, "dist");
const OUT = join(REPO, "tests/evidence/color/csp-blob");

/* A deterministic 24x16 PNG with three flat colour bands, built here so the test carries no
   binary fixture. Median-cut must find those bands. */
const PNG_B64 = await (async () => {
  const { deflateSync } = await import("node:zlib");
  const W = 24, H = 16;
  const BANDS = [[200, 60, 60], [60, 160, 90], [50, 70, 190]];
  const rows = [];
  for (let y = 0; y < H; y++) {
    const row = [0];
    for (let x = 0; x < W; x++) row.push(...BANDS[Math.floor(x / (W / 3))]);
    rows.push(Buffer.from(row));
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; /* 8-bit truecolour */
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png.toString("base64");
})();

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  try {
    const p = join(DIST, decodeURIComponent(req.url.split("?")[0]));
    res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

const log = [];
const say = s => { log.push(s); console.log(s); };
let failures = 0;
const check = (label, ok, detail) => {
  say(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();

for (const [mode, url] of [["file://", "file://" + DIST + "/color.html"],
                           ["hosted", `http://127.0.0.1:${PORT}/color.html`]]) {
  say(`\n${mode}`);
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const cspMsgs = [], consoleErrors = [];
  page.on("console", m => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) cspMsgs.push(t);
    else if (m.type() === "error") consoleErrors.push(t);
  });
  page.on("pageerror", e => consoleErrors.push("pageerror: " + e.message));

  await page.goto(url);
  /* the real user path: open the tab that owns the drop zone, then hand it a file */
  await page.click('.tab[data-tab="photo"]');
  await page.setInputFiles("#fileInput",
    { name: "bands.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => {
    const pal = document.getElementById("photoPal");
    return {
      palVisible: !!pal && !pal.classList.contains("hidden"),
      hexes: JSON.parse((pal && pal.dataset.hexes) || "[]"),
      swatches: document.querySelectorAll("#photoSwatches .swatch, #photoSwatches > *").length,
      canvasShown: getComputedStyle(document.getElementById("photoCanvas")).display,
      body: document.body.innerText,
    };
  });

  check("no CSP violation after the drop", cspMsgs.length === 0, cspMsgs[0]);
  check("no console errors", consoleErrors.length === 0, consoleErrors[0]);
  check('no "Could not read that image"', !state.body.includes("Could not read that image"));
  check("palette revealed", state.palVisible);
  check("six colours extracted", state.hexes.length === 6, JSON.stringify(state.hexes));
  check("swatches rendered", state.swatches >= 6, String(state.swatches));
  check("preview canvas shown", state.canvasShown === "block", state.canvasShown);

  await mkdir(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, `palette-${mode === "file://" ? "file" : "hosted"}.png`),
                          fullPage: false });
  await page.close();
}

await browser.close();
server.close();

say(`\ncolor-photo: ${failures ? failures + " assertion(s) FAILED" : "all assertions green"}`);
await writeFile(join(OUT, "verification.txt"), log.join("\n") + "\n");
process.exit(failures ? 1 : 0);
