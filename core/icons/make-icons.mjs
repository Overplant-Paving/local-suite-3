// One-time icon renderer: core/icons/icon.svg -> icon-192.png, icon-512.png,
// icon-maskable-512.png. Run from tests/ (where Playwright lives):
//   node ../core/icons/make-icons.mjs
// The maskable variant is the same full-bleed art (the glyph already sits in the
// central safe zone); it exists as a separate file so the webmanifest can declare
// purpose "maskable" without double-listing the "any" icon.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
// playwright lives under tests/ (the harness's home), not here
const { chromium } = createRequire(join(here, "..", "..", "tests", "package.json"))("playwright");
const svg = join(here, "icon.svg");

const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.goto("file://" + svg.replace(/\\/g, "/"));
  await page.screenshot({ path: join(here, `icon-${size}.png`) });
  await page.close();
  console.log(`icon-${size}.png`);
}
copyFileSync(join(here, "icon-512.png"), join(here, "icon-maskable-512.png"));
console.log("icon-maskable-512.png (copy of 512 — art is maskable-safe by design)");
await browser.close();
