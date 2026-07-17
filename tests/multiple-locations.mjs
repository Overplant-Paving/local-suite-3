/* Focused v3 named-location contract test. Run from tests/: node multiple-locations.mjs */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch (e) {
  if (!String(e).includes("distribution 'chrome' is not found")) throw e;
  browser = await chromium.launch();
}
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
await page.goto(pathToFileURL(join(ROOT, "tools", "settings.html")).href);

const result = await page.evaluate(() => {
  const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
  for (const k of Object.keys(localStorage)) if (k.startsWith("suite.")) localStorage.removeItem(k);

  localStorage.setItem("suite.location", JSON.stringify({ lat: 1, lon: 2, label: "Home" }));
  let c = Suite.locations.init();
  assert(c.items.length === 1 && c.activeId === "saved-location", "v2 location did not migrate");
  assert(Suite.location.get().label === "Home", "migration changed the active mirror");

  const a = Suite.locations.add({ lat: 3, lon: 4, label: "Home" }).location;
  const b = Suite.locations.add({ lat: 5, lon: 6, label: "Home" }).location;
  assert(a.id === "home" && b.id === "home-2", "duplicate labels did not get stable unique ids");

  localStorage.setItem("suite.cache.switch-test", "safe-coordinate-cache");
  localStorage.setItem("suite.radar.station", "OLD-STATION");
  localStorage.setItem("suite.state", "OLD");
  const activated = Suite.locations.activate(a.id);
  assert(activated.purged === 2 && localStorage.getItem("suite.radar.station") === null &&
    localStorage.getItem("suite.state") === null, "active switch did not reset derived location state");
  assert(localStorage.getItem("suite.cache.switch-test") === "safe-coordinate-cache",
    "active switch purged a safe scoped/global cache");
  assert(Suite.location.get().lat === 3, "active switch did not mirror suite.location");

  localStorage.setItem("suite.normals.station", "OLD-NORMALS-STATION");
  Suite.location.set({ lat: 7, lon: 8, label: "Moved Home" });
  c = Suite.locations.init();
  const moved = c.items.find(x => x.id === a.id);
  assert(moved.lat === 7 && moved.revision === 2 && moved.label === "Moved Home",
    "legacy Suite.location.set did not update the active named entry");
  assert(localStorage.getItem("suite.normals.station") === null,
    "legacy active-coordinate change did not reset a derived station");
  Suite.location.set({ lat: 7, lon: 8, label: "" });
  assert(Suite.location.get().label === "" && Suite.locations.active().label === "",
    "legacy Suite.location.set no longer permits clearing its established label field");

  localStorage.setItem("suite.cache.inactive-delete", "keep");
  Suite.locations.remove(b.id);
  assert(localStorage.getItem("suite.cache.inactive-delete") === "keep",
    "deleting an inactive location purged unrelated active caches");

  const fallback = Suite.locations.remove(a.id);
  assert(fallback.active && fallback.active.id === "saved-location", "active delete did not choose fallback");
  assert(Suite.location.get().label === "Home", "fallback was not mirrored");
  assert(localStorage.getItem("suite.cache.inactive-delete") === "keep",
    "active delete purged a safe scoped/global cache");

  Suite.locations.remove("saved-location");
  assert(localStorage.getItem("suite.location") === null && localStorage.getItem("suite.locations") === null,
    "deleting the final location did not clear both storage keys");

  let invalidRejected = false;
  try { Suite.locations.add({ lat: 91, lon: 0, label: "Invalid" }); }
  catch (e) { invalidRejected = true; }
  assert(invalidRejected, "invalid coordinates were accepted");

  const extended = { schema: 1, activeId: "extended", futureTop: "keep", items: [
    { id: "extended", label: "Extended", lat: 9, lon: 10, revision: 1, futureField: "keep" }
  ] };
  localStorage.setItem("suite.locations", JSON.stringify(extended));
  localStorage.setItem("suite.location", JSON.stringify({ lat: 9, lon: 10, label: "Extended" }));
  Suite.locations.update("extended", { label: "Still extended" });
  const extendedAfter = JSON.parse(localStorage.getItem("suite.locations"));
  assert(extendedAfter.futureTop === "keep" && extendedAfter.items[0].futureField === "keep",
    "unknown schema-1 fields were discarded during a normal mutation");

  const future = { schema: 99, activeId: "future", items: [
    { id: "future", label: "Future", lat: 9, lon: 10, revision: 1, futureField: "keep" }
  ] };
  localStorage.setItem("suite.locations", JSON.stringify(future));
  const futureRead = Suite.locations.init();
  assert(futureRead.unsupported && localStorage.getItem("suite.locations") === JSON.stringify(future),
    "newer saved-location schema was modified while opening");
  let futureMutationRejected = false;
  try { Suite.locations.add({ lat: 1, lon: 1, label: "Nope" }); }
  catch (e) { futureMutationRejected = true; }
  assert(futureMutationRejected && localStorage.getItem("suite.locations") === JSON.stringify(future),
    "newer saved-location schema was not protected from mutation");

  const damaged = { schema: 1, activeId: "valid", items: [
    { id: "valid", label: "Valid", lat: 1, lon: 2, revision: 1 },
    { id: "broken", label: "Broken", lat: 999, lon: 2, revision: 1 }
  ] };
  localStorage.setItem("suite.locations", JSON.stringify(damaged));
  const damagedRead = Suite.locations.init();
  let damagedMutationRejected = false;
  try { Suite.locations.remove("valid"); } catch (e) { damagedMutationRejected = true; }
  assert(damagedRead.invalid && damagedMutationRejected &&
    localStorage.getItem("suite.locations") === JSON.stringify(damaged),
    "damaged collection was silently repaired or allowed to mutate");

  return { migration: true, uniqueIds: [a.id, b.id], legacyWriterSync: true,
    labelClear: true, activeFallback: true, finalClear: true, invalidRejected,
    unknownFieldsPreserved: true, futureSchemaPreserved: true, damagedDataPreserved: true };
});

/* Delayed response from location A must not render or repopulate a cache after
   switching to B while the request is in flight. */
const race = await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith("suite.")) localStorage.removeItem(k);
  Suite.locations.add({ lat: 1, lon: 2, label: "A" });
  const b = Suite.locations.add({ lat: 3, lon: 4, label: "B" }).location;
  let release;
  const originalFetch = window.fetch;
  window.fetch = () => new Promise(resolve => { release = () => resolve(new Response('{"place":"A"}', {
    status: 200, headers: { "content-type": "application/json" }
  })); });
  const pending = Suite.fetchJSON("https://example.test/race", { cacheKey: "race", ttl: 0 });
  await Promise.resolve();
  Suite.locations.activate(b.id);
  release();
  let rejected = false;
  try { await pending; } catch (e) { rejected = /location changed/.test(e.message); }
  window.fetch = originalFetch;
  return { rejected, cached: localStorage.getItem("suite.cache.race") };
});
if (!race.rejected || race.cached !== null) throw new Error("in-flight location guard failed: " + JSON.stringify(race));
result.inFlightGuard = race;

/* Built-hub integration: injected tool catalog and named-location controls coexist. */
await page.goto(pathToFileURL(join(ROOT, "dist", "index.html")).href);
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith("suite.")) localStorage.removeItem(k);
  localStorage.setItem("suite.location", JSON.stringify({ lat: 40.7128, lon: -74.006, label: "Home" }));
});
await page.reload();
await page.waitForSelector("#locSwitch:not([hidden])");
const hub = await page.evaluate(() => ({
  toolLinks: document.querySelectorAll("#cats article.card:not(.wip) h3 a").length,
  activeLabel: document.querySelector("#activeLoc option:checked")?.textContent,
  collection: JSON.parse(localStorage.getItem("suite.locations"))
}));
if (hub.toolLinks !== 72 || hub.activeLabel !== "Home" || hub.collection.items.length !== 1) {
  throw new Error("built hub integration failed: " + JSON.stringify(hub));
}
result.builtHub = hub;

/* Wildfire caches are coordinate-scoped: an LA payload must never paint for NY. */
await page.route(/^https?:/, route => route.abort());
await page.goto(pathToFileURL(join(ROOT, "tools", "wildfire.html")).href);
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith("suite.")) localStorage.removeItem(k);
  localStorage.setItem("suite.location", JSON.stringify({ lat: 34.0522, lon: -118.2437, label: "LA" }));
  localStorage.setItem("suite.cache.wildfire.34.052_-118.244", JSON.stringify({ t: Date.now(), v: {
    features: [{ properties: { IncidentName: "LA sentinel", IncidentSize: 10, POOState: "US-CA" },
      geometry: { coordinates: [-118.24, 34.05] } }]
  } }));
});
await page.reload();
await page.waitForSelector("#list .fire");
await page.evaluate(() => localStorage.setItem("suite.location", JSON.stringify({ lat: 40.7128, lon: -74.006, label: "NY" })));
await page.reload();
await page.waitForTimeout(300);
if (await page.locator("#list .fire").count()) throw new Error("LA wildfire cache painted for NY");
result.wildfireScoped = true;
await page.unroute(/^https?:/);

await ctx.close();
await browser.close();
if (errors.length) throw new Error("page errors: " + errors.join("; "));
console.log("multiple locations: PASS " + JSON.stringify(result));
