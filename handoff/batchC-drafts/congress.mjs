/* tests/interactions/congress.mjs — Congress Tracker (Batch C, keyed, NO demo tier)
   Congress.gov requires a personal key and offers no demo tier, so per the Batch C
   budget the deliverables verified here are:
   1. the NO-KEY DESIGNED STATE (explanation + signup link + paste field — this is
      what the harness's initial v1/v2 theme screenshots capture, since a fresh
      profile has no key and the tool makes zero requests without one);
   2. the paste/save/forget-key mechanics: typing a fake key writes
      suite.key.congress, and the tool then attempts real fetches carrying that key —
      proven via route interception on api.congress.gov, fulfilled with realistic
      payloads to exercise the full render pipeline (bills, passed filter, delegation,
      sponsored legislation) without inventing a real key;
   3. the invalid-key gate: a route-fulfilled 403 must bring back the key card
      ("That key didn't work") even though a cache exists — v1 semantics;
   4. the Batch B stale-cache offline path: back-dated cache + aborted network must
      render bills from cache with the "offline — data from <time>" stamp, not a blank;
   5. XSS honesty: a hostile bill title in the payload must render as inert text. */

export const selectors = [
  "body", ".topbar", ".back", ".theme-btn", "header h1", "header .tag",
  ".card-msg", ".card-msg h3", ".keyrow input", "button.primary", ".tab", "footer"
];

export const screenshotAfterInteract = true;

const FAKE_KEY = "FAKE-KEY-FOR-ROUTE-INTERCEPTION-TEST";
const iso = daysAgo => new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);
const HOSTILE_TITLE = `<script>document.title="pwned"</script> "Hostile" & <b>Bold</b> Title Act`;

const BILLS = {
  bills: [
    { congress: 119, type: "HR", number: "4275", title: "Departments of Labor, Health and Human Services, and Education Appropriations Act, 2027",
      latestAction: { actionDate: iso(1), text: "Passed House by recorded vote: 218 - 210." } },
    { congress: 119, type: "S", number: "1812", title: HOSTILE_TITLE,
      latestAction: { actionDate: iso(2), text: "Read twice and referred to the Committee on the Judiciary." } },
    { congress: 119, type: "HJRES", number: "52", title: "Making continuing appropriations for fiscal year 2027, and for other purposes.",
      latestAction: { actionDate: iso(4), text: "Became Public Law No: 119-45." } },
    { congress: 119, type: "SRES", number: "301", title: "A resolution designating July 2026 as National Blueberry Month.",
      latestAction: { actionDate: iso(2), text: "Agreed to in Senate without amendment and with a preamble by Voice Vote." } },
    { congress: 119, type: "HR", number: "9", title: "Lower Energy Costs Act",
      latestAction: { actionDate: iso(25), text: "Referred to the House Committee on Energy and Commerce." } }
  ]
};
const MEMBERS = {
  members: [
    { bioguideId: "A000001", name: "Alvarez, Maria", partyName: "Democratic", state: "California",
      terms: { item: [{ chamber: "Senate" }] } },
    { bioguideId: "B000002", name: "Bennett, John", partyName: "Republican", state: "California",
      terms: { item: [{ chamber: "Senate" }] } },
    { bioguideId: "C000003", name: "Chen, David", partyName: "Democratic", state: "California", district: 12,
      terms: { item: [{ chamber: "House of Representatives" }] } },
    { bioguideId: "O000004", name: "Okafor, Grace", partyName: "Independent", state: "California", district: 3,
      terms: { item: [{ chamber: "House of Representatives" }] } }
  ]
};
const SPONSORED = {
  sponsoredLegislation: [
    { congress: 119, type: "S", number: "2101", title: "Wildfire Resilience and Recovery Act",
      introducedDate: iso(30), latestAction: { actionDate: iso(5), text: "Committee on Agriculture. Hearings held." } },
    { congress: 119, type: "S", number: "1988", title: "Coastal Communities Housing Act",
      introducedDate: iso(60), latestAction: { actionDate: iso(12), text: "Read twice and referred to the Committee on Banking." } }
  ]
};

async function routeApi(page, requested) {
  await page.route(/api\.congress\.gov/, route => {
    const url = route.request().url();
    requested.push(url);
    let body = {};
    if (url.includes("/v3/bill?")) body = BILLS;
    else if (url.includes("/sponsored-legislation")) body = SPONSORED;
    else if (url.includes("/v3/member/")) body = MEMBERS;
    route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body)
    });
  });
}

async function saveKeyAndLoad(page) {
  await page.fill(".keyrow input", FAKE_KEY);
  await page.click(".keyrow button.primary");
  await page.waitForSelector("#list .bill", { timeout: 10000 });
}

async function pickDelegation(page) {
  await page.click('.tab[data-view="delegation"]');
  await page.waitForSelector(".card-msg"); // "Pick your state"
  await page.selectOption("#stateSel", "CA");
  await page.waitForSelector("#list .member", { timeout: 10000 });
}

export async function interact({ page, log, evidenceDir }) {
  /* ---- 1. the no-key designed state (fresh profile, zero requests) ---- */
  const keyCard = {
    title: (await page.textContent(".card-msg h3")).trim(),
    body: (await page.textContent(".card-msg p")).replace(/\s+/g, " ").trim().slice(0, 140),
    hasInput: !!(await page.$('.keyrow input[placeholder="paste API key"]')),
    saveBtn: (await page.textContent(".keyrow button.primary")).trim(),
    signup: await page.getAttribute(".card-msg a", "href"),
    tabsHidden: await page.getAttribute("#tabs", "hidden") !== null
  };
  log(`no-key designed state: title="${keyCard.title}"; body starts "${keyCard.body}…"`);
  log(`no-key designed state: paste field=${keyCard.hasInput}, button="${keyCard.saveBtn}", signup link=${keyCard.signup}, tabs hidden=${keyCard.tabsHidden}`);
  if (keyCard.title !== "Add your free Congress.gov key" || !keyCard.hasInput || !keyCard.signup)
    throw new Error("no-key designed state incomplete");
  await page.screenshot({ path: `${evidenceDir}/no-key-state.png`, fullPage: true });

  /* ---- 2. paste/save key mechanics + fetch attempted WITH the key ---- */
  const requested = [];
  await routeApi(page, requested);
  await saveKeyAndLoad(page);
  const storedKey = await page.evaluate(() => localStorage.getItem("suite.key.congress"));
  log(`key saved: localStorage["suite.key.congress"] = "${storedKey}" (bare string, byte-identical to typed value: ${storedKey === FAKE_KEY})`);
  const billReq = requested.find(u => u.includes("/v3/bill?"));
  log(`fetch attempted with key: ${billReq}`);
  if (!billReq || !billReq.includes("api_key=" + FAKE_KEY))
    throw new Error("bill fetch did not carry the saved key");

  /* recent bills rendered from the fulfilled payload */
  const bills = await page.$$eval("#list .bill", els => els.map(el => ({
    num: el.querySelector(".num").textContent.trim(),
    title: el.querySelector("h3 a").textContent.trim(),
    action: (el.querySelector(".action") || { textContent: "" }).textContent.trim().slice(0, 80)
  })));
  log(`recent tab: ${bills.length} bill cards; first: ${bills[0].num} — "${bills[0].title}"`);
  log(`recent tab stamp: "${(await page.textContent("#stamp")).trim()}"`);

  /* ---- 5 (interleaved). hostile remote title renders as inert text ---- */
  const hostile = bills.find(b => b.title.includes("<script>"));
  const injected = await page.evaluate(() => !!document.querySelector("#list script, #list b"));
  const docTitle = await page.title();
  log(`hostile title rendered as text: ${!!hostile} ("${hostile && hostile.title.slice(0, 60)}…"); injected <script>/<b> in list: ${injected}; document.title: "${docTitle}"`);
  if (!hostile || injected || docTitle === "pwned") throw new Error("hostile title was not neutralized");

  /* ---- passed-this-week filter ---- */
  await page.click('.tab[data-view="passed"]');
  await page.waitForSelector("#list .bill .passbadge");
  const passed = await page.$$eval("#list .bill", els => els.map(el =>
    `${el.querySelector(".num").textContent.trim()} [${el.querySelector(".passbadge").textContent.trim()}]`));
  log(`passed tab: ${passed.length} of ${BILLS.bills.length} bills pass the 8-day passage filter: ${passed.join(" · ")}`);

  /* ---- delegation + sponsored legislation (keyboard path on the member card) ---- */
  await pickDelegation(page);
  const members = await page.$$eval("#list .member", els => els.map(el =>
    `${el.querySelector(".name").textContent.trim()} (${el.querySelector(".meta").textContent.trim()})`));
  log(`delegation CA: ${members.length} members, senate-first: ${members.join(" · ")}`);
  log(`suite.state written: "${await page.evaluate(() => localStorage.getItem("suite.state"))}"`);

  const first = page.locator("#list .member").first();
  await first.focus();
  const beforeExp = await first.getAttribute("aria-expanded");
  await page.keyboard.press("Enter"); // keyboard path — v1 was mouse-only
  await page.waitForSelector("#list .member.open .sponsored .sb a", { timeout: 10000 });
  const afterExp = await first.getAttribute("aria-expanded");
  const sponsored = await page.$$eval("#list .member.open .sponsored .sb a", els => els.map(a => a.textContent.trim()));
  log(`member expanded via keyboard Enter (aria-expanded ${beforeExp} -> ${afterExp}); sponsored bills: ${sponsored.join(" · ")}`);
  const spReq = requested.find(u => u.includes("/sponsored-legislation"));
  log(`sponsored fetch carried key: ${spReq && spReq.includes("api_key=" + FAKE_KEY)}`);

  /* cache envelopes written (v1 keys, v1 processed-array value shapes) */
  const env = await page.evaluate(() => {
    const out = {};
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.congress.")) {
      const e = JSON.parse(localStorage.getItem(k));
      out[k] = `t=${e.t} v=${Array.isArray(e.v) ? "array[" + e.v.length + "]" : typeof e.v}`;
    }
    return out;
  });
  for (const [k, v] of Object.entries(env)) log(`cache ${k}: ${v}`);

  /* ---- "change key" mechanics ---- */
  await page.click("#changeKey");
  const changeTitle = (await page.textContent(".card-msg h3")).trim();
  const prefilled = await page.inputValue(".keyrow input");
  log(`change-key card: title="${changeTitle}", input prefilled with saved key: ${prefilled === FAKE_KEY}`);
  await page.click(".keyrow button.primary"); // re-save, back to the tool
  await page.waitForSelector("#list .member");

  /* ---- 3. invalid-key gate: 403 must beat the cache and re-show the key card ----
     Run on a second page in the SAME context (shared file:// localStorage) because a
     fulfilled 403 logs "Failed to load resource" on the page console, which the
     harness treats as a hard failure on ITS page; the gate behavior is identical. */
  await page.unroute(/api\.congress\.gov/);
  await page.evaluate(() => { // back-date caches so a real fetch (and its 403) happens
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now() - 24 * 60 * 60 * 1000;
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  const p2 = await page.context().newPage();
  await p2.route(/api\.congress\.gov/, r => r.fulfill({
    status: 403, contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ error: { code: "API_KEY_INVALID", message: "An invalid api_key was supplied." } })
  }));
  await p2.goto(page.url());
  await p2.waitForFunction(() => {
    const h = document.querySelector(".card-msg h3");
    return h && h.textContent.includes("didn't work");
  }, { timeout: 10000 });
  log(`invalid-key gate: 403 re-shows key card — "${(await p2.textContent(".card-msg h3")).trim()}" (24h-old cache present but NOT silently served)`);
  await p2.screenshot({ path: `${evidenceDir}/invalid-key.png`, fullPage: true });
  await p2.close();

  /* ---- 4. stale-cache offline path (caches still back-dated 24 h) ---- */
  await page.context().route(/^https?:/, r => r.abort());
  await page.reload(); // must render bills from the stale cache, not a blank page
  await page.waitForSelector("#list .bill", { timeout: 10000 });
  const staleStamp = (await page.textContent("#stamp")).trim();
  const staleCount = await page.locator("#list .bill").count();
  log(`offline-stale: ${staleCount} bill cards rendered from back-dated cache; stamp: "${staleStamp}"`);
  if (!staleStamp.startsWith("offline — data from")) throw new Error(`stale stamp missing offline note: "${staleStamp}"`);
  await page.screenshot({ path: `${evidenceDir}/offline-stale.png`, fullPage: true });
  await page.context().unroute(/^https?:/);

  /* restore a fresh-looking view for the after-interaction shot WITHOUT a network
     fetch: re-freshen the cache timestamps so fetchJSON serves from cache */
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) {
      const e = JSON.parse(localStorage.getItem(k));
      e.t = Date.now();
      localStorage.setItem(k, JSON.stringify(e));
    }
  });
  await page.reload();
  await page.waitForSelector("#list .bill");
  log(`restored (fresh cache, no refetch): "${(await page.textContent("#stamp")).trim()}"`);
}

/* Same state-writing actions on v1 (with the same route-fulfilled payloads) so
   localStorage parity compares equal key sets: suite.key.congress, suite.state,
   suite.cache.congress.{bills, members.CA, sponsored.A000001} (+ suite.theme via the
   harness's toggle click). v1 members are mouse-only — click the first card. */
export async function v1Interact({ page }) {
  await routeApi(page, []);
  await saveKeyAndLoad(page);
  await pickDelegation(page);
  await page.click("#list .member"); // first member — same bioguideId as v2's keyboard toggle
  await page.waitForSelector("#list .member.open .sponsored .sb a", { timeout: 10000 });
}
