/* tests/interactions/flight.mjs — deterministic individual Flight Tracker coverage.
   No provider allowance is consumed: every Aviationstack request is route-fulfilled. */

export const selectors = [
  "body", ".back", ".theme-btn", "h1", ".sub", ".searchcard", "#flightIn", "#dateIn",
  "#trackBtn", "#status", ".flight-card", ".metrics", ".mapcard", "svg", "footer"
];
export const screenshotAfterInteract = true;

const API_RE = /api\.aviationstack\.com\/v1\/flights/;

export function fixture(date) {
  const now = Date.now();
  return {
    pagination: { limit: 100, offset: 0, count: 1, total: 1 },
    data: [{
      flight_date: date,
      flight_status: "active",
      departure: {
        airport: "John F Kennedy International", timezone: "America/New_York", iata: "JFK", icao: "KJFK",
        terminal: "8", gate: "42", scheduled: new Date(now - 3 * 3600000).toISOString(),
        estimated: new Date(now - 2.5 * 3600000).toISOString(), actual: new Date(now - 2.4 * 3600000).toISOString()
      },
      arrival: {
        airport: "Los Angeles International", timezone: "America/Los_Angeles", iata: "LAX", icao: "KLAX",
        terminal: "4", gate: "45A", scheduled: new Date(now + 2.25 * 3600000).toISOString(),
        estimated: new Date(now + 2.5 * 3600000).toISOString(), actual: null
      },
      airline: { name: "American Airlines", iata: "AA", icao: "AAL" },
      flight: { number: "100", iata: "AA100", icao: "AAL100" },
      aircraft: { registration: "N123AA", iata: "B738", icao: "B738", icao24: "abc123" },
      live: {
        updated: new Date(now - 45000).toISOString(), latitude: 39.125, longitude: -103.55,
        altitude: 10668, direction: 252, speed_horizontal: 861, speed_vertical: 0, is_ground: false
      }
    }]
  };
}

export async function interact({ page, log, evidenceDir }) {
  let mode = "active", calls = 0, positionCalls = 0, leakedKey = false, serviceDate = "";
  await page.route(API_RE, async route => {
    calls++;
    const u = new URL(route.request().url());
    if (u.searchParams.get("access_key") !== "test-key") throw new Error("request omitted saved API key");
    if (!u.searchParams.get("flight_iata") || u.searchParams.get("limit") !== "100" || u.searchParams.has("flight_date")) throw new Error("request contract mismatch");
    if (mode === "throttle") return route.fulfill({ status: 200, contentType: "application/json", body: '{"error":{"code":"usage_limit_reached","message":"rate limit"}}' });
    if (mode === "keyerror") return route.fulfill({ status: 200, contentType: "application/json", body: '{"error":{"code":"invalid_access_key","message":"Invalid API access key"}}' });
    if (mode === "empty") return route.fulfill({ status: 200, contentType: "application/json", body: '{"pagination":{"count":0},"data":[]}' });
    if (mode === "wrongdate") {
      const body = fixture("1999-01-01");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    if (mode === "noliv") {
      const body = fixture(serviceDate); body.data[0].flight_status = "scheduled"; body.data[0].live = null;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    if (mode === "fallback") { const body=fixture(serviceDate); body.data[0].live=null; return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)}); }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(serviceDate)) });
  });
  await page.route(/api\.airplanes\.live\/v2\/hex\//, route => { positionCalls++; return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ac:[{hex:"abc123",lat:41.25,lon:-92.5,alt_baro:35000,track:265,gs:470,seen:.8}]})}); });

  log(`initial no-key card visible=${await page.locator("#keyCard").isVisible()}, status=${JSON.stringify((await page.locator("#status").innerText()).trim())}`);
  await page.fill("#flightIn", "bad");
  await page.click("#trackBtn");
  log(`invalid flight rejected before fetch: calls=${calls}, status=${JSON.stringify((await page.locator("#status").innerText()).trim())}`);

  await page.evaluate(() => localStorage.setItem("suite.key.aviationstack", "test-key"));
  await page.reload();
  serviceDate = await page.inputValue("#dateIn");
  await page.fill("#flightIn", "ZZ999");
  mode = "empty";
  await page.click("#trackBtn");
  await page.waitForFunction(() => /No matching/.test(document.getElementById("status").textContent));
  log(`no-match path: ${JSON.stringify((await page.locator("#status").innerText()).trim())}`);

  await page.fill("#flightIn", "AA100");
  mode = "wrongdate";
  await page.click("#trackBtn");
  await page.waitForFunction(() => /No matching/.test(document.getElementById("status").textContent));
  log(`wrong-date provider row rejected rather than misidentified: ${JSON.stringify((await page.locator("#status").innerText()).trim())}`);

  mode = "keyerror";
  await page.evaluate(() => document.getElementById("refreshBtn").click());
  await page.waitForFunction(() => /key was rejected/.test(document.getElementById("status").textContent));
  log(`provider key rejection is specific: ${JSON.stringify((await page.locator("#status").innerText()).trim())}`);

  mode = "throttle";
  await page.evaluate(() => { const e=document.getElementById("refreshEvery"); e.value="900000"; e.dispatchEvent(new Event("change")); });
  await page.click("#trackBtn");
  await page.waitForFunction(() => /request limit/.test(document.getElementById("status").textContent));
  if (await page.inputValue("#refreshEvery") !== "0") throw new Error("rate limit did not disable automatic refresh");
  log(`429 path is specific: ${JSON.stringify((await page.locator("#status").innerText()).trim())}`);

  mode = "noliv";
  await page.press("#flightIn", "Enter");
  await page.waitForSelector("#result:not([hidden])");
  const noLive = await page.evaluate(() => ({ mapHidden: document.getElementById("mapCard").hidden,
    status: document.getElementById("status").textContent, altitude: document.querySelector("#metrics .metric:nth-child(2) b").textContent }));
  if (!noLive.mapHidden || !/no live position/.test(noLive.status) || noLive.altitude !== "Not reported") throw new Error("no-live state failed: " + JSON.stringify(noLive));
  log(`scheduled/no-position state is explicit: ${JSON.stringify(noLive)}`);

  mode = "fallback";
  await page.click("#refreshBtn");
  await page.waitForFunction(() => /Airplanes\.live ADS-B/.test(document.getElementById("positionAge").textContent));
  const fallback = await page.evaluate(() => ({mapHidden:document.getElementById("mapCard").hidden,position:document.getElementById("positionAge").textContent,coords:document.getElementById("coords").textContent,altitude:document.querySelector("#metrics .metric:nth-child(2) b").textContent}));
  if(fallback.mapHidden||fallback.altitude!=="35,000 ft"||positionCalls!==1) throw new Error("ADS-B fallback failed: "+JSON.stringify({fallback,positionCalls}));
  log(`keyed flight identity resolved through ADS-B fallback: ${JSON.stringify(fallback)}`);

  mode = "active";
  await page.click("#refreshBtn");
  await page.waitForFunction(() => document.getElementById("statePill").textContent === "active" && !document.getElementById("mapCard").hidden);
  const active = await page.evaluate(() => ({
    title: document.getElementById("flightTitle").textContent,
    airline: document.getElementById("airline").textContent,
    state: document.getElementById("statePill").textContent,
    route: [document.getElementById("depCode").textContent, document.getElementById("arrCode").textContent],
    arrival: document.getElementById("arrTime").textContent,
    metrics: [...document.querySelectorAll("#metrics .metric")].map(x => x.innerText.replace(/\s+/g, " ").trim()),
    mapHidden: document.getElementById("mapCard").hidden,
    planeMarkers: document.querySelectorAll("#map g").length,
    coords: document.getElementById("coords").textContent,
    cacheKeys: Object.keys(localStorage).filter(k => k.startsWith("suite.cache.flight.")),
    bodyContainsKey: document.body.innerText.includes("test-key"),
    usage: JSON.parse(localStorage.getItem("suite.flight.usage")),
    controls: (() => { const e=document.querySelector(".tracker-controls"),r=e.getBoundingClientRect(),cs=getComputedStyle(e); return {height:r.height,display:cs.display,align:cs.alignItems,justify:cs.justifyContent,gap:cs.gap,children:[...e.children].map(x=>({tag:x.tagName,top:Math.round(x.getBoundingClientRect().top-r.top),height:Math.round(x.getBoundingClientRect().height)}))}; })()
  }));
  if (active.title !== "AA100" || active.route.join("-") !== "JFK-LAX" || active.mapHidden ||
      active.planeMarkers !== 1 || active.bodyContainsKey || leakedKey) throw new Error("active render failed: " + JSON.stringify(active));
  log(`active flight rendered without exposing key: ${JSON.stringify(active)}`);

  // Stale fallback: age the envelope, abort the forced refresh, and retain visibly labeled data.
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith("suite.cache.flight."));
    const e = JSON.parse(localStorage.getItem(k)); e.t = Date.now() - 3600000; localStorage.setItem(k, JSON.stringify(e));
  });
  await page.evaluate(() => { window.__flightNativeFetch = window.fetch; window.fetch = () => Promise.reject(new Error("offline")); });
  await page.click("#refreshBtn");
  await page.waitForFunction(() => /Showing cached data/.test(document.getElementById("status").textContent));
  await page.evaluate(() => { window.fetch = window.__flightNativeFetch; delete window.__flightNativeFetch; });
  log(`offline stale fallback: ${JSON.stringify((await page.locator("#status").innerText()).trim())}`);
  log(`total deterministic provider requests: aviationstack=${calls}, airplanes.live=${positionCalls}`);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    routeColumns: getComputedStyle(document.querySelector(".route")).gridTemplateColumns }));
  if (mobile.scrollWidth > mobile.width) throw new Error("mobile horizontal overflow: " + JSON.stringify(mobile));
  await page.screenshot({ path: evidenceDir + "/mobile.png", fullPage: true });
  log(`mobile layout has no horizontal overflow: ${JSON.stringify(mobile)}`);
  await page.setViewportSize({ width: 1280, height: 900 });
}
