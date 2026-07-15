/* tests/interactions/alerts.mjs — Severe Weather Alert Board (Batch B, cors-open fetcher)
   Live sources exercised once each: api.weather.gov (active alerts for the seeded
   shared location) and api.zippopotam.us (ZIP lookup on the change-location path).
   Los Angeles may legitimately have ZERO active alerts — the all-clear banner is a
   designed state and is logged as such; the severity sort, card render, and escaping
   are additionally driven deterministically with a synthetic feature set. */
import { join } from "node:path";

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", ".locbar",
  ".notify-toggle", ".card-msg", ".card-msg .big", ".field input", ".btn", "footer"
];

export const screenshotAfterInteract = true;

const LA = { lat: 34.0522, lon: -118.2437, label: "Los Angeles, CA" };

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. live fetch: active alerts for the seeded shared location ---- */
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForTimeout(3000); // live api.weather.gov fetch + render
  log(`seeded suite.location = ${JSON.stringify(LA)}`);
  log(`live #locLabel: "${(await page.textContent("#locLabel")).trim()}"`);
  log(`live #updated: "${(await page.textContent("#updated")).trim()}"`);
  const mainText = (await page.textContent("#main")).replace(/\s+/g, " ").trim();
  log(`live #main (first 300 chars): "${mainText.slice(0, 300)}"`);
  const liveCount = await page.locator("details.alert").count();
  const clearBanner = await page.locator(".banner.clear").count();
  log(`live alert cards: ${liveCount}; all-clear banner rendered: ${clearBanner === 1}`);
  if (liveCount) {
    const sevs = await page.locator(".sev-badge").allTextContents();
    log(`live severity badge order (top banner first excluded; must be non-increasing rank): ${sevs.join(", ")}`);
    await page.locator("details.alert summary").first().click();
    const body = (await page.locator("details.alert .a-body").first().textContent()).replace(/\s+/g, " ").trim();
    log(`first card expanded via summary click, .a-body (first 200 chars): "${body.slice(0, 200)}"`);
  }
  const envelope = await page.evaluate(() => {
    try {
      const e = JSON.parse(localStorage.getItem("suite.cache.alerts"));
      return { t: e.t, key: e.key, payload: Array.isArray(e.v) ? "features-array (v1 shape)" : typeof e.v };
    } catch (e) { return null; }
  });
  log(`suite.cache.alerts envelope after live load: ${JSON.stringify(envelope)}`);

  /* ---- 2. severity sort + escaping, driven with a synthetic feature set ----
     LA often has no active alerts, so the sort/render path is exercised here
     deterministically; real state is restored by the later re-render. */
  const synth = await page.evaluate(() => {
    const mk = (severity, event) => ({ properties: {
      severity, event, effective: new Date().toISOString(),
      headline: "headline for " + event, description: "desc", instruction: "instr",
      areaDesc: "Test Area", certainty: "Observed", urgency: "Expected",
      ends: new Date(Date.now() + 3600000).toISOString()
    } });
    renderAlerts([
      mk("Minor", "Frost Advisory"),
      mk("Extreme", "Tornado Warning"),
      mk("Moderate", "Wind Advisory"),
      mk("Severe", 'Storm <b>"markup&test"</b> Warning'),
      mk("Bogus", "Mystery Alert")
    ], Date.now());
    const badges = [...document.querySelectorAll(".sev-badge")].map(b => b.textContent);
    const banner = document.querySelector(".banner").textContent.replace(/\s+/g, " ").trim();
    const severeEvent = document.querySelectorAll(".a-event")[1];
    return {
      badges, banner,
      severeText: severeEvent.textContent,
      escaped: severeEvent.innerHTML.includes("&lt;b&gt;") && !severeEvent.querySelector("b")
    };
  });
  log(`synthetic sort: expected Extreme, Severe, Moderate, Minor, Unknown (Bogus->Unknown); observed: ${synth.badges.join(", ")}`);
  log(`synthetic banner: "${synth.banner}"`);
  log(`escaping: severe card event textContent = "${synth.severeText}"; injected <b> markup inert in DOM: ${synth.escaped}`);

  /* ---- 3. notify toggle (headless auto-resolves the permission prompt) ---- */
  await page.click("#notifyBtn");
  await page.waitForTimeout(500);
  const notify = await page.evaluate(() => ({
    text: document.getElementById("notifyBtn").textContent,
    pressed: document.getElementById("notifyBtn").getAttribute("aria-pressed"),
    stored: localStorage.getItem("suite.alerts.notify"),
    permission: Notification.permission
  }));
  log(`notify after click: text="${notify.text}", aria-pressed=${notify.pressed}, suite.alerts.notify=${JSON.stringify(notify.stored)}, Notification.permission=${notify.permission}`);

  /* ---- 4. change location -> live ZIP lookup (zippopotam.us, one request) ---- */
  await page.click("#changeLoc");
  log(`change-location card: "${(await page.textContent(".card-msg .big")).trim()}"; #locLabel="${(await page.textContent("#locLabel")).trim()}"`);
  await page.fill("#zip", "123");
  await page.click("#zipGo");
  log(`invalid ZIP "123": #locMsg="${(await page.textContent("#locMsg")).trim()}"`);
  await page.fill("#zip", "90012");
  await page.press("#zip", "Enter"); // Enter submits the ZIP field
  await page.waitForTimeout(3500);   // zippopotam lookup + alerts refetch for the new point
  log(`after ZIP 90012 (Enter key): #locLabel="${(await page.textContent("#locLabel")).trim()}"`);
  log(`  suite.location=${await page.evaluate(() => localStorage.getItem("suite.location"))}`);
  log(`  #updated="${(await page.textContent("#updated")).trim()}"`);
  log(`  #main (first 200 chars): "${(await page.textContent("#main")).replace(/\s+/g, " ").trim().slice(0, 200)}"`);

  /* ---- 5. stale-cache offline path (Batch B Definition of Done) ---- */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload();
  await page.waitForTimeout(2000);
  log(`offline reload (cache aged 24h, network blocked):`);
  log(`  #updated="${(await page.textContent("#updated")).trim()}"`);
  log(`  #main (first 200 chars): "${(await page.textContent("#main")).replace(/\s+/g, " ").trim().slice(0, 200)}"`);
  await page.screenshot({ path: join(evidenceDir, "offline-stale.png"), fullPage: true });
  await page.context().unroute(/^https?:/);

  /* ---- 6. back online: fresh load for the post-interaction screenshot ---- */
  await page.reload();
  await page.waitForTimeout(3000);
  log(`back online: #updated="${(await page.textContent("#updated")).trim()}", #main (first 150): "${(await page.textContent("#main")).replace(/\s+/g, " ").trim().slice(0, 150)}"`);
}

/* Same state-writing actions on v1 so the localStorage key sets compare equal:
   suite.location (seed + ZIP change), suite.cache.alerts, suite.alerts.seen,
   and the notify click (writes suite.alerts.notify only if permission granted —
   identical outcome in the same headless browser). */
export async function v1Interact({ page }) {
  await page.evaluate(l => { localStorage.setItem("suite.location", JSON.stringify(l)); }, LA);
  await page.reload();
  await page.waitForTimeout(3000);
  await page.click("#notifyBtn");
  await page.waitForTimeout(500);
  await page.click("#changeLoc");
  await page.fill("#zip", "90012");
  await page.click("#zipGo");
  await page.waitForTimeout(3500);
}
