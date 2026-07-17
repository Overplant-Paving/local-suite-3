/* tests/interactions/index.mjs — hub location switcher and source-hub guard. */

export const selectors = [
  "body", "header h1", ".theme-btn", ".controls", "#activeLoc", "#cats", "footer"
];
export const screenshotAfterInteract = true;

export async function interact({ page, log }) {
  await page.evaluate(() => {
    localStorage.setItem("suite.location", JSON.stringify({ lat: 40.7128, lon: -74.006, label: "Home" }));
  });
  await page.reload();
  await page.waitForSelector("#locSwitch:not([hidden])");
  log(`legacy migration: ${await page.evaluate(() => localStorage.getItem("suite.locations"))}`);
  log(`hub active location: ${(await page.locator("#activeLoc").inputValue())} / ${(await page.locator("#activeLoc option:checked").innerText())}`);

  await page.evaluate(() => {
    Suite.locations.add({ lat: 34.0522, lon: -118.2437, label: "Work" });
    localStorage.setItem("suite.cache.hub-switch-probe", JSON.stringify({ t: Date.now(), v: "safe scoped data" }));
    localStorage.setItem("suite.tides.station", "OLD-STATION");
    paintLocationSwitch();
  });
  log(`saved options after add: ${await page.locator("#activeLoc option").allTextContents()}`);
  await page.selectOption("#activeLoc", "work");
  const switched = await page.evaluate(() => ({
    mirror: JSON.parse(localStorage.getItem("suite.location")),
    collection: JSON.parse(localStorage.getItem("suite.locations")),
    safeCache: localStorage.getItem("suite.cache.hub-switch-probe"),
    tidesStation: localStorage.getItem("suite.tides.station"),
    status: document.getElementById("locSwitchStatus").textContent
  }));
  log(`hub switch result: ${JSON.stringify(switched)}`);

  const sourceGuard = (await page.locator("#cats").innerText()).replace(/\s+/g, " ").trim();
  log(`source-hub guard remains designed: ${JSON.stringify(sourceGuard)}`);
}

/* v1 has no named-location collection. Seed only its established active mirror so
   the generic parity report records the intentional v3-only suite.locations key. */
export async function v1Interact({ page }) {
  await page.evaluate(() => {
    localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "Work" }));
  });
}
