/* tests/a11y-phase4-set2.mjs — Phase 4 accessibility audit harness (agent set 2:
   qr, text, color, random, notes, dataviewer, sound, paper, timers, loan,
   flashcards, alerts). Executes the QUALITY.md §2 checklist per
   handoff/orchestration/phase4-a11y.md against the RUNNING tool from file://.

   Run (from tests/):  node a11y-phase4-set2.mjs <tool> [<tool> ...]
   Output: JSON + human log per tool to stdout (the auditing agent archives the
   verdicts into tests/evidence/<tool>/report.md). Never modifies tools. */

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const toolUrl = t => pathToFileURL(join(ROOT, "tools", `${t}.html`)).href;
const VIEWPORT = { width: 1280, height: 900 };

/* ---------------- in-page audit library (serialized into evaluate) ---------------- */
const PAGE_LIB = `
(() => {
  function parseColor(s) {
    if (!s) return null;
    s = s.trim();
    let m = s.match(/^rgba?\\(([^)]+)\\)$/);
    if (m) {
      const p = m[1].split(/[,\\s\\/]+/).filter(Boolean).map(parseFloat);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    m = s.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+%?))?\\)$/);
    if (m) {
      let a = 1;
      if (m[4] !== undefined) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a };
    }
    m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); return { r: (n>>16)&255, g: (n>>8)&255, b: n&255, a: 1 }; }
    if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    // let the browser normalize anything else
    const d = document.createElement("div"); d.style.color = s; document.body.append(d);
    const c = getComputedStyle(d).color; d.remove();
    if (c !== s) return parseColor(c);
    return null;
  }
  function composite(top, bottom) {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
      g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
      b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a, a
    };
  }
  function effectiveBg(el) {
    // walk up the ancestor chain collecting background layers until an opaque one
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) { layers.push(bg); if (bg.a >= 1) break; }
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 }; // canvas default under everything
    if (layers.length && layers[layers.length - 1].a >= 1) acc = layers.pop();
    while (layers.length) acc = composite(layers.pop(), acc);
    return acc;
  }
  function relLum(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(c1, c2) {
    const l1 = relLum(c1), l2 = relLum(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  const hex = c => "#" + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  window.__a11y = { parseColor, composite, effectiveBg, relLum, ratio, hex };
})();
`;

/* item 5: measure contrast for configured targets (runs in page) */
async function measureContrast(page, targets) {
  return page.evaluate((targets) => {
    const A = window.__a11y;
    const out = [];
    for (const t of targets) {
      const el = document.querySelector(t.sel);
      if (!el) { out.push({ ...t, missing: true }); continue; }
      const cs = getComputedStyle(el);
      const fg = A.parseColor(cs.color);
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const threshold = t.kind === "ui" ? 3 : (large ? 3 : 4.5);
      const bgs = [];
      if (t.bgColors) for (const b of t.bgColors) bgs.push({ label: b, c: A.parseColor(b) });
      else {
        const bgEl = t.bgSel ? document.querySelector(t.bgSel) : el;
        bgs.push({ label: "computed", c: A.effectiveBg(bgEl || el) });
      }
      for (const b of bgs) {
        const r = A.ratio(fg, b.c);
        out.push({
          sel: t.sel, desc: t.desc || "", fg: A.hex(fg), bg: A.hex(b.c),
          bgLabel: b.label, size, weight, threshold,
          ratio: Math.round(r * 100) / 100, pass: r >= threshold,
        });
      }
    }
    return out;
  }, targets);
}

/* item 1: icon-only buttons/links — enumerate + resolve accessible names */
async function checkIconButtons(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll("button, a, [role=button]")];
    const results = [];
    for (const el of els) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const text = (el.textContent || "").trim();
      // symbol-only: empty, or 1-2 chars that aren't alphanumeric words
      const symbolOnly = text === "" || (text.length <= 2 && !/[a-z0-9]{2}/i.test(text));
      if (!symbolOnly) continue;
      let name = el.getAttribute("aria-label") || "";
      const lb = el.getAttribute("aria-labelledby");
      if (!name && lb) name = lb.split(/\s+/).map(id => document.getElementById(id)?.textContent || "").join(" ").trim();
      if (!name) name = el.getAttribute("title") || "";
      results.push({
        tag: el.tagName.toLowerCase(), id: el.id || null, cls: el.className && el.className.baseVal !== undefined ? "" : (el.className || ""),
        text, name, pass: !!name,
      });
    }
    return results;
  });
}

/* item 4: every input labeled */
async function checkLabels(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll("input, select, textarea")];
    const out = [];
    for (const el of els) {
      if (el.type === "hidden" || el.hidden) continue;
      const style = getComputedStyle(el);
      // hidden file inputs opened by proxy buttons still need names, keep them
      const visible = style.display !== "none" && style.visibility !== "hidden";
      let how = null;
      if (el.getAttribute("aria-label")) how = "aria-label";
      else if (el.getAttribute("aria-labelledby")) how = "aria-labelledby";
      else if (el.id && document.querySelector(`label[for="${el.id}"]`)) how = "label[for]";
      else if (el.closest("label")) how = "wrapping label";
      out.push({ tag: el.tagName.toLowerCase(), type: el.type || "", id: el.id || null, visible, how, pass: !!how });
    }
    return out;
  });
}

/* item 3 support: positive tabindex scan */
async function checkTabindex(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[tabindex]")]
      .filter(el => parseInt(el.getAttribute("tabindex"), 10) > 0)
      .map(el => ({ tag: el.tagName, id: el.id || null, tabindex: el.getAttribute("tabindex") }))
  );
}

/* item 2: aria-live present at runtime on given selectors */
async function checkLive(page, sels) {
  return page.evaluate((sels) => sels.map(sel => {
    const el = document.querySelector(sel);
    return { sel, present: !!el, ariaLive: el ? el.getAttribute("aria-live") : null };
  }), sels);
}

/* item 6: keyboard-focus an interactive element, diff outline/box-shadow */
async function checkFocusVisible(page) {
  // Tab from body until a button/a/input is focused, compare focused vs blurred styles
  await page.evaluate(() => document.body.focus());
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    if (["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(tag)) break;
  }
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { pass: false, why: "nothing focused" };
    const f = getComputedStyle(el);
    const focused = { outlineWidth: f.outlineWidth, outlineStyle: f.outlineStyle, outlineColor: f.outlineColor, boxShadow: f.boxShadow };
    const id = el.id, tag = el.tagName;
    el.blur();
    const b = getComputedStyle(el);
    const blurred = { outlineWidth: b.outlineWidth, outlineStyle: b.outlineStyle, outlineColor: b.outlineColor, boxShadow: b.boxShadow };
    el.focus();
    const changed = focused.outlineWidth !== blurred.outlineWidth || focused.outlineStyle !== blurred.outlineStyle
      || focused.boxShadow !== blurred.boxShadow;
    const hasOutline = focused.outlineStyle !== "none" && parseFloat(focused.outlineWidth) > 0;
    return { pass: changed && hasOutline, el: tag + (id ? "#" + id : ""), focused, blurred };
  });
}

/* keyboard helper: press Tab until predicate matches activeElement (max n) */
async function tabTo(page, match, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const cur = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? {
        id: el.id || "", tag: el.tagName, text: (el.textContent || "").trim().slice(0, 40),
        aria: el.getAttribute("aria-label") || "", cls: typeof el.className === "string" ? el.className : "",
      } : null;
    });
    if (cur && cur.tag !== "BODY" && match(cur)) return cur;
  }
  throw new Error("tabTo: target not reached");
}

/* ------------------------------- tool configs ------------------------------- */
/* Each: liveSels (item 2 runtime check), stages [{name, setup(page), targets[]}] for
   item 5 (run in BOTH themes), keyboard(page, log) — item 3, keyboard-only drive of
   the primary feature (light theme). setup may use mouse; keyboard() must not. */

const TOOLS = {
  /* ---------------- qr ---------------- */
  qr: {
    liveSels: ["#meta", "#err", "#toast"],
    stages: [{
      name: "default + sheet item",
      setup: async page => {
        await page.click("#addSheet"); // creates .sheet-item with ✕
      },
      targets: [
        { sel: "header .tag", desc: "tagline (muted on bg)" },
        { sel: ".tab.on", desc: "active preset tab (white on accent)" },
        { sel: ".tab:not(.on)", desc: "inactive tab (muted on card)" },
        { sel: "label.fl", desc: "field label (muted on card)" },
        { sel: ".seg button.on", desc: "segmented active (white on accent)" },
        { sel: ".seg button:not(.on)", desc: "segmented idle (muted on card)" },
        { sel: "#meta", desc: "meta line (muted on card)" },
        { sel: ".btn", desc: "primary button (white on accent)" },
        { sel: ".btn.ghost", desc: "ghost button (accent on card)" },
        { sel: "#err", desc: "error text (--bad on card)" },
        { sel: ".sheet-item .x", desc: "remove ✕ (--bad on card)" },
        { sel: ".sheet-item .cap", desc: "sheet caption (muted on card)" },
        { sel: "footer", desc: "footer (muted on bg)" },
        { sel: "#toast", desc: "toast (bg-inverse)" },
      ],
    }],
    keyboard: async (page, log) => {
      const t = await tabTo(page, c => c.id === "fText");
      log("Tab -> " + t.id);
      await page.keyboard.press("Control+a");
      await page.keyboard.type("keyboard-only payload");
      log("typed payload; meta: " + await page.locator("#meta").innerText());
      // switch EC level with keyboard: Tab to "Q · 25%" then Enter
      await tabTo(page, c => c.text.startsWith("Q ·"));
      await page.keyboard.press("Enter");
      log("EC Q via Enter; meta: " + await page.locator("#meta").innerText());
      // add to sheet via keyboard
      await tabTo(page, c => c.id === "addSheet");
      await page.keyboard.press("Enter");
      log("Add to sheet via Enter; count: " + await page.locator("#sheetCount").innerText()
        + "; toast: " + await page.locator("#toast").innerText());
      // preset tab switch via keyboard (Shift+Tab back is fine; use fresh Tabs from body)
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.text === "WiFi");
      await page.keyboard.press("Enter");
      const ssidVisible = await page.locator("#fSsid").isVisible();
      log("WiFi preset via Enter; ssid field visible: " + ssidVisible);
    },
  },

  /* ---------------- text ---------------- */
  text: {
    liveSels: ["#toast", "#opHint", "#encOut", "#diffSummary"],
    stages: [{
      name: "stats + diff rendered",
      setup: async page => {
        await page.fill("#text", "Hello world\nsecond line");
        await page.click('.tab[data-tab="diff"]');
        await page.fill("#diffA", "alpha\nbravo");
        await page.fill("#diffB", "alpha\ncharlie");
        await page.click("#runDiff");
        await page.click('.tab[data-tab="transform"]');
      },
      targets: [
        { sel: "header .tag", desc: "tagline (muted on bg)" },
        { sel: ".tab.on", desc: "active tab (white on accent)" },
        { sel: ".tab:not(.on)", desc: "inactive tab (muted on card)" },
        { sel: ".stat b", desc: "stat number (accent on card)" },
        { sel: ".stat span", desc: "stat label (muted, .74rem)" },
        { sel: ".grp h4", desc: "group heading (muted uppercase)" },
        { sel: ".b", desc: "op button (ink on card)" },
        { sel: "#runDiff", desc: "Compare (.b.primary white on accent)", bgSel: "#runDiff" },
        { sel: ".hint", desc: "hint (muted on card)" },
        { sel: ".diff .del", desc: "diff deleted line (del-ink on del-bg)" },
        { sel: ".diff .ins", desc: "diff inserted line (ins-ink on ins-bg)" },
        { sel: ".diff .ln:not(.del):not(.ins) .gutter", desc: "gutter on plain line (muted on bg)" },
        { sel: ".diff .del .gutter", desc: "gutter on deleted line" },
        { sel: ".diff .ins .gutter", desc: "gutter on inserted line" },
        { sel: "label.inl", desc: "diff labels (muted on card)" },
      ],
    }],
    keyboard: async (page, log) => {
      await tabTo(page, c => c.id === "text");
      await page.keyboard.type("make me shout");
      log("typed; stats: " + (await page.locator("#stats").innerText()).replace(/\s+/g, " "));
      await tabTo(page, c => c.text === "UPPERCASE");
      await page.keyboard.press("Enter");
      log("UPPERCASE via Enter; value: " + await page.locator("#text").inputValue());
      // diff via keyboard
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.text === "Diff");
      await page.keyboard.press("Enter");
      await tabTo(page, c => c.id === "diffA");
      await page.keyboard.type("one\ntwo");
      await tabTo(page, c => c.id === "diffB");
      await page.keyboard.type("one\nthree");
      await tabTo(page, c => c.id === "runDiff");
      await page.keyboard.press("Enter");
      log("diff via keyboard; summary: " + await page.locator("#diffSummary").innerText());
    },
  },

  /* ---------------- color ---------------- */
  color: {
    liveSels: ["#toast", "#ccRatio", "#photoSwatches"],
    stages: [{
      name: "picker + contrast tab with PASS and FAIL badges",
      setup: async page => {
        await page.click('.tab[data-tab="contrast"]');
        // ~3.9:1 pair -> AA-large passes, AA-normal fails: both badge kinds render
        await page.fill("#fgHex", "#767676");
        await page.dispatchEvent("#fgHex", "input");
        await page.click('.tab[data-tab="picker"]');
      },
      targets: [
        { sel: "header .tag", desc: "tagline (muted on bg)" },
        { sel: ".tab.on", desc: "active tab (white on accent)" },
        { sel: ".fmt .k", desc: "format key (muted .8rem on --bg)" },
        { sel: ".fmt .v", desc: "format value (ink on --bg)" },
        { sel: ".sl label", desc: "slider label (muted on card)" },
        { sel: ".pal h4", desc: "palette heading (muted on card)" },
        { sel: ".sw .lab", desc: "swatch hex label (ink on card)" },
        { sel: ".savebtn", desc: "save button (accent on card)" },
        { sel: "#tab-contrast .badge.pass", desc: "PASS badge (--good on good-mix)" },
        { sel: "#tab-contrast .badge.fail", desc: "FAIL badge (--bad on bad-mix)" },
        { sel: ".cc-field label", desc: "contrast field label (muted)" },
        { sel: "footer", desc: "footer (muted on bg)" },
      ],
    }],
    keyboard: async (page, log) => {
      // primary path: adjust HSL slider by keyboard -> formats update
      const before = await page.locator(".fmt .v").first().innerText();
      await tabTo(page, c => c.id === "slH");
      for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
      const after = await page.locator(".fmt .v").first().innerText();
      log(`slider ArrowRight x10: HEX ${before} -> ${after} (changed: ${before !== after})`);
      // copy a format row via Enter (clickable div path)
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.cls.includes("fmt"));
      await page.keyboard.press("Enter");
      log("fmt row Enter; toast: " + await page.locator("#toast").innerText());
      // photo drop zone reachable + Enter opens chooser (verify handler wired without dialog)
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.text === "From a Photo");
      await page.keyboard.press("Enter");
      const dz = await tabTo(page, c => c.id === "drop");
      log("drop zone focused (tabindex path): " + dz.id + ", aria: " + dz.aria);
    },
  },

  /* ---------------- random ---------------- */
  random: {
    liveSels: ["#diceTotal", "#coinTally", "#spinResult", "#pickResult", "#numResult"],
    stages: [{
      name: "dice rolled, coin flipped, picks made",
      setup: async page => {
        await page.click("#rollDice");
        await page.locator(".tab", { hasText: "Coin" }).click();
        await page.click("#flipCoin");
        await page.locator(".tab", { hasText: "Pick from list" }).click();
        await page.click("#pickBtn");
        await page.locator(".tab", { hasText: "Dice" }).click();
      },
      targets: [
        { sel: ".tag", desc: "tagline (muted on bg)" },
        { sel: ".tab.on", desc: "active tab (white on accent)" },
        { sel: "#p-dice label", desc: "field label (muted uppercase)" },
        { sel: "button.go", desc: "go button (white on accent)" },
        { sel: "button.mini", desc: "mini button (ink on bg)" },
        { sel: ".result-big", desc: "big result (accent on card, large)" },
        { sel: ".result-sub", desc: "sub result (muted on card)" },
        { sel: ".die", desc: "die face (accent on accent-soft, 1.4rem bold)" },
        { sel: "#coin", desc: "coin H/T (white on gold gradient)", bgColors: ["#f0c65a", "#c69518"] },
        { sel: ".streak span.h", desc: "streak H (#4a3800 on gold)", bgColors: ["#f0c65a"] },
        { sel: ".picked-list li", desc: "picked item (accent on accent-soft)" },
        { sel: ".log h2", desc: "log heading (muted)" },
        { sel: ".log li .kind", desc: "log kind (muted .75rem)" },
        { sel: ".log li time", desc: "log time (muted .78rem)" },
      ],
    }],
    keyboard: async (page, log) => {
      await tabTo(page, c => c.id === "diceCount");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("3");
      await page.keyboard.press("Enter"); // Enter triggers panel's go button
      log("dice via Enter-in-input; total: " + await page.locator("#diceTotal").innerText()
        + "; sub: " + await page.locator("#diceSub").innerText());
      // switch to Number tab via keyboard
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.text.includes("Number"));
      await page.keyboard.press("Enter");
      await tabTo(page, c => c.id === "numMin");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("7");
      await page.keyboard.press("Enter");
      log("number pick via Enter: " + await page.locator("#numResult").innerText());
      // coin flip fully by keyboard
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.text.includes("Coin"));
      await page.keyboard.press("Enter");
      await tabTo(page, c => c.id === "flipCoin");
      await page.keyboard.press("Enter");
      log("coin flip via Enter; tally: " + await page.locator("#coinTally").innerText());
    },
  },

  /* ---------------- notes ---------------- */
  notes: {
    liveSels: ["#saved"],
    stages: [{
      name: "editor with dirty flag",
      setup: async page => {
        await page.click("#editor");
        await page.type("#editor", "x"); // trigger dirty state briefly
      },
      targets: [
        { sel: ".saved", desc: "save state (muted on card header)" },
        { sel: ".saved.dirty", desc: "dirty state (--warn fallback on card)" },
        { sel: ".tbtn", desc: "toolbar button (ink on card)" },
        { sel: ".side-top button", desc: "+ New note (accent on accent-soft)" },
        { sel: ".note-list li.on .nm", desc: "active note name (accent on accent-soft)" },
        { sel: ".note-list li .wc", desc: "word count (muted .7rem)" },
        { sel: ".note-list li .del", desc: "delete × (muted on accent-soft)" },
        { sel: ".editor-bar .count", desc: "word count (muted .78rem on card)" },
        { sel: "#editor", desc: "editor text (ink on bg)" },
        { sel: ".preview blockquote", desc: "blockquote (muted on bg)" },
        { sel: ".preview code", desc: "inline code (ink on code-bg)" },
        { sel: "footer", desc: "footer (muted .78rem on card)" },
      ],
    }],
    keyboard: async (page, log) => {
      await tabTo(page, c => c.id === "editor");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("# Keyboard note\n\ntyped with keys only");
      await page.waitForTimeout(800); // autosave debounce
      log("typed; saved indicator: " + await page.locator("#saved").innerText()
        + "; preview h1: " + await page.locator(".preview h1").innerText());
      // new note via keyboard
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.id === "newNote");
      await page.keyboard.press("Enter");
      log("new note via Enter; list items: " + await page.locator(".note-list li").count());
      // select the other note via Enter on the li (focus moves into editor on select)
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.tag === "LI");
      await page.keyboard.press("Enter");
      log("note selected via Enter on li; title now: " + await page.locator("#noteTitle").inputValue());
      // Ctrl+S saves
      await page.keyboard.press("Control+s");
      log("Ctrl+S; saved indicator: " + await page.locator("#saved").innerText());
    },
  },

  /* ---------------- dataviewer ---------------- */
  dataviewer: {
    liveSels: ["#notice", "#rowInfo", "#fmeta"],
    stages: [
      {
        name: "CSV table",
        setup: async page => { await page.click('.sample[data-s="csv"]'); },
        targets: [
          { sel: ".tag", desc: "tagline (muted on bg)" },
          { sel: ".filebar .meta", desc: "file meta (muted .85rem)" },
          { sel: "#closeFile", desc: "close button (ink on card)" },
          { sel: "#modes button.on", desc: "active mode (white on accent)" },
          { sel: "thead th", desc: "table header (ink on card)" },
          { sel: "thead th .stat", desc: "column stats (muted .68rem!)" },
          { sel: "td.num", desc: "numeric cell (--t-num on card)" },
          { sel: ".rownum", desc: "row number (muted on card)" },
          { sel: ".tools .rows", desc: "row info (muted .85rem)" },
        ],
      },
      {
        name: "JSON tree",
        setup: async page => {
          await page.click("#closeFile"); // stage 1 left the CSV loaded
          await page.click('.sample[data-s="json"]');
        },
        targets: [
          { sel: ".tree .k", desc: "JSON key (--t-key on card)" },
          { sel: ".tree .s", desc: "string (--t-str on card)" },
          { sel: ".tree .n", desc: "number (--t-num on card)" },
          { sel: ".tree .b", desc: "boolean (--t-bool on card)" },
          { sel: ".tree .nul", desc: "null (--t-null on card)" },
          { sel: ".tree .tw", desc: "twisty (muted, ui)", kind: "ui" },
          { sel: "#expandAll", desc: "expand all (ink on card)" },
        ],
      },
    ],
    keyboard: async (page, log) => {
      await tabTo(page, c => c.text === "Try sample CSV");
      await page.keyboard.press("Enter");
      log("sample CSV via Enter; meta: " + await page.locator("#fmeta").innerText());
      await tabTo(page, c => c.id === "search");
      await page.keyboard.type("new");
      log("filter typed; rowInfo: " + await page.locator("#rowInfo").innerText());
      await page.keyboard.press("Control+a");
      await page.keyboard.press("Delete");
      // sort by keyboard on a header
      await tabTo(page, c => c.tag === "TH");
      await page.keyboard.press("Enter");
      const sorted = await page.evaluate(() =>
        [...document.querySelectorAll("#thead th")].map(th => th.getAttribute("aria-sort")).join(","));
      log("th Enter sort; aria-sort states: " + sorted
        + "; focus retained on: " + await page.evaluate(() => document.activeElement.tagName));
      // close, load JSON, toggle a twisty by keyboard
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.id === "closeFile");
      await page.keyboard.press("Enter");
      await tabTo(page, c => c.text === "Try sample JSON");
      await page.keyboard.press("Enter");
      await tabTo(page, c => c.cls.includes("tw"));
      await page.keyboard.press("Enter");
      const collapsed = await page.evaluate(() => document.querySelectorAll("#tree .collapsed").length);
      log("twisty Enter; collapsed nodes: " + collapsed + " (aria-expanded="
        + await page.evaluate(() => document.activeElement.getAttribute("aria-expanded")) + ")");
    },
  },

  /* ---------------- sound ---------------- */
  sound: {
    liveSels: ["#timerStatus"],
    stages: [{
      name: "one sound on + timer set",
      setup: async page => {
        await page.locator(".snd").first().click();
        await page.locator("#timerOpts button", { hasText: "15 min" }).click();
      },
      targets: [
        { sel: ".tag", desc: "tagline (muted on bg)" },
        { sel: ".master .play", desc: "play button (white glyph on accent)", kind: "ui" },
        { sel: ".master .mlabel", desc: "master label (muted .78rem)" },
        { sel: ".snd .desc", desc: "sound description (muted .8rem)" },
        { sel: ".snd.on .state", desc: "state ON (accent on accent-soft)" },
        { sel: ".snd:not(.on) .state", desc: "state off (muted .72rem)" },
        { sel: ".timer .opts button.on", desc: "timer option active (white on accent)" },
        { sel: ".timer .opts button:not(.on)", desc: "timer option (ink on bg)" },
        { sel: ".timer .status", desc: "timer status (muted on card)" },
        { sel: ".timer .status b", desc: "countdown (accent on card)" },
        { sel: ".hint", desc: "hint (muted on bg)" },
      ],
    }],
    keyboard: async (page, log) => {
      await tabTo(page, c => c.id === "masterBtn");
      await page.keyboard.press("Enter");
      log("master play via Enter; aria-pressed: "
        + await page.locator("#masterBtn").getAttribute("aria-pressed")
        + "; glyph: " + await page.locator("#masterBtn").innerText());
      await tabTo(page, c => c.id === "masterVol");
      await page.keyboard.press("ArrowLeft");
      log("master volume ArrowLeft: " + await page.locator("#masterVol").inputValue());
      // toggle a sound card (role=button div)
      await tabTo(page, c => c.aria === "White noise");
      await page.keyboard.press("Enter");
      log("white noise via Enter; aria-pressed: "
        + await page.evaluate(() => document.querySelector(".snd").getAttribute("aria-pressed"))
        + "; state: " + await page.locator(".snd .state").first().innerText());
      // its volume slider via arrows (keydown must not toggle the card)
      await page.keyboard.press("Tab");
      await page.keyboard.press("ArrowRight");
      const stillOn = await page.evaluate(() => document.querySelector(".snd").classList.contains("on"));
      log("slider arrow adjusts without toggling card: " + stillOn);
      // sleep timer via keyboard
      await tabTo(page, c => c.text === "30 min");
      await page.keyboard.press("Enter");
      log("timer via Enter; status: " + await page.locator("#timerStatus").innerText());
    },
  },

  /* ---------------- paper ---------------- */
  paper: {
    liveSels: ["#preview"],
    stages: [{
      name: "default graph paper",
      setup: async () => {},
      targets: [
        { sel: "header .tag", desc: "tagline (muted on bg)" },
        { sel: "h2.sec", desc: "section heading (muted .78rem)" },
        { sel: ".field label", desc: "field label (muted .8rem)" },
        { sel: ".seg button.on", desc: "segmented active (white on accent)" },
        { sel: ".seg button:not(.on)", desc: "segmented idle (muted on bg)" },
        { sel: ".btn", desc: "print button (white on accent)" },
        { sel: ".btn.ghost", desc: "download (accent on card)" },
        { sel: ".hint", desc: "hint (muted .78rem)" },
        { sel: ".note", desc: "print note (muted on bg)" },
        { sel: ".note b", desc: "note emphasis (ink on bg)" },
        { sel: ".checkrow", desc: "checkbox row (ink on card)" },
      ],
    }],
    keyboard: async (page, log) => {
      const before = await page.locator("#preview").getAttribute("aria-label");
      await tabTo(page, c => c.id === "type");
      await page.keyboard.press("ArrowDown"); // graph -> dot grid
      await page.waitForTimeout(150);
      const after = await page.locator("#preview").getAttribute("aria-label");
      log(`type select ArrowDown: "${before}" -> "${after}" (changed: ${before !== after})`);
      // orientation via keyboard
      await tabTo(page, c => c.text === "Landscape");
      await page.keyboard.press("Enter");
      log("landscape via Enter; preview label: " + await page.locator("#preview").getAttribute("aria-label"));
      // margins via keyboard (number input arrows)
      await tabTo(page, c => c.id === "margin");
      await page.keyboard.press("ArrowUp");
      log("margin ArrowUp: " + await page.locator("#margin").inputValue());
      // full-bleed button
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      log("full-bleed 0 via Enter: margin=" + await page.locator("#margin").inputValue());
    },
  },

  /* ---------------- timers ---------------- */
  timers: {
    liveSels: ["#announce"],
    stages: [{
      name: "one ringing timer + laps",
      setup: async page => {
        // page.clock is installed by the stage runner for timers (see run())
        await page.fill("#tM", "0");
        await page.fill("#tS", "2");
        await page.click("#addTimer");
        await page.clock.fastForward(3500);
        await page.click('.tab[data-view="stopwatch"]');
        await page.click("#swStart");
        await page.clock.fastForward(1200);
        await page.click("#swLap");
        await page.clock.fastForward(900);
        await page.click("#swLap");
        await page.click('.tab[data-view="timers"]');
      },
      targets: [
        { sel: "header .tag", desc: "tagline (muted on bg)" },
        { sel: ".tab.on", desc: "active tab (white on accent)" },
        { sel: ".btn", desc: "add button (white on accent)" },
        { sel: ".preset", desc: "preset chip (ink on card)" },
        { sel: ".timer.ringing .big", desc: "ringing display (--alarm on card, large)" },
        { sel: ".timer .x", desc: "remove ✕ (muted on card)" },
        { sel: "#timerEmpty", desc: "empty state (muted)" },
        { sel: "footer", desc: "footer (muted on bg)" },
      ],
    }, {
      name: "stopwatch laps",
      setup: async page => {
        // stopwatch is still running with 2 uneven laps from stage 1; add one more
        await page.click('.tab[data-view="stopwatch"]');
        await page.clock.fastForward(2000);
        await page.click("#swLap");
      },
      targets: [
        { sel: ".sw-face .big", desc: "stopwatch display (ink, large)" },
        { sel: ".sw-face .ms", desc: "centiseconds (accent, large)" },
        { sel: ".laps th", desc: "laps header (muted .78rem)" },
        { sel: ".laps tr.best td", desc: "best lap (--built on card)" },
        { sel: ".laps tr.worst td", desc: "worst lap (--alarm on card)" },
        { sel: ".laps .tag.best", desc: "fastest chip (--built on built-mix)" },
        { sel: ".laps .tag.worst", desc: "slowest chip (--alarm on alarm-mix)" },
      ],
    }],
    useClock: true,
    keyboard: async (page, log) => {
      await page.clock.install();
      await tabTo(page, c => c.id === "tName");
      await page.keyboard.type("Keyboard egg");
      await tabTo(page, c => c.id === "tM");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("0");
      await tabTo(page, c => c.id === "tS");
      await page.keyboard.type("2");
      await page.keyboard.press("Enter"); // Enter adds the timer
      log("timer added via Enter; card: " + await page.locator(".timer .tname").first().innerText()
        + " " + await page.locator(".timer .big").first().innerText());
      await page.clock.fastForward(3000);
      log("after fastForward: display=" + await page.locator(".timer .big").first().innerText()
        + " ringing=" + await page.evaluate(() => document.querySelector(".timer").classList.contains("ringing")));
      // dismiss via keyboard
      await tabTo(page, c => c.text === "Dismiss");
      await page.keyboard.press("Enter");
      log("dismissed via Enter; display: " + await page.locator(".timer .big").first().innerText());
      // stopwatch fully by keyboard
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.text.includes("Stopwatch"));
      await page.keyboard.press("Enter");
      await tabTo(page, c => c.id === "swStart");
      await page.keyboard.press("Enter");
      await page.clock.fastForward(1500);
      await page.keyboard.press("Tab"); // swLap now enabled
      await page.keyboard.press("Enter");
      log("lap via keyboard; rows: " + await page.locator("#lapsWrap tbody tr").count()
        + "; display: " + (await page.locator("#swDisplay").innerText()).replace(/\s+/g, ""));
    },
  },

  /* ---------------- loan ---------------- */
  loan: {
    liveSels: ["#stats", "#exSavings", "#refiVerdict"],
    stages: [{
      name: "loan + extra + refi (bad verdict)",
      setup: async page => {
        await page.click('.tab[data-view="extra"]');
        await page.click('.tab[data-view="refi"]');
        await page.fill("#rNewApr", "9");   // force the .bad verdict
        await page.dispatchEvent("#rNewApr", "input");
      },
      targets: [
        { sel: "header .tag", desc: "tagline (muted on bg)" },
        { sel: ".tab.on", desc: "active tab (white on accent)" },
        { sel: ".card h2", desc: "card heading (muted .82rem)" },
        { sel: ".field label", desc: "field label (muted .78rem)" },
        { sel: ".field .in span", desc: "unit affix (muted .9rem on bg)" },
        { sel: ".stat b", desc: "stat value (accent on card, large)" },
        { sel: ".stat span", desc: "stat label (muted .76rem)" },
        { sel: ".legend", desc: "legend (muted .82rem)" },
        { sel: ".btn.ghost", desc: "CSV export (accent on card)" },
        { sel: "table.sched th", desc: "schedule header (muted .74rem)" },
        { sel: "table.sched tr.yearend td", desc: "year-end row (ink on accent-soft)" },
        { sel: "#view-refi .compare > div:first-child > div", desc: "'Current' heading (--interest on card)" },
        { sel: "#view-refi .compare > div:last-child > div", desc: "'New' heading (--principal on card)" },
        { sel: ".verdict.bad", desc: "bad verdict (--interest on interest-mix)" },
        { sel: ".kv span", desc: "kv label (ink on card)" },
      ],
    }],
    keyboard: async (page, log) => {
      const before = await page.locator(".stat b").first().innerText();
      await tabTo(page, c => c.id === "principal");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("250000");
      await page.waitForTimeout(150);
      const after = await page.locator(".stat b").first().innerText();
      log(`principal typed: P&I ${before} -> ${after} (changed: ${before !== after})`);
      // extra tab via keyboard
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.text === "Extra payments");
      await page.keyboard.press("Enter");
      await tabTo(page, c => c.id === "exMonthly");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("300");
      await page.waitForTimeout(150);
      log("extra via keyboard; savings: "
        + (await page.locator("#exSavings").innerText()).replace(/\s+/g, " ").slice(0, 120));
      // CSV export button reachable
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.text === "Loan & schedule");
      await page.keyboard.press("Enter");
      await tabTo(page, c => c.id === "csvBtn");
      log("csv button reachable by Tab: true");
      // focus indicators on the field styles that suppress the core outline:
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.id === "principal");
      const wrapped = await page.evaluate(() => {
        const inp = document.activeElement;
        const on = getComputedStyle(inp.closest(".in")).borderColor;
        inp.blur();
        const off = getComputedStyle(inp.closest(".in")).borderColor;
        return { on, off, changed: on !== off };
      });
      log("wrapped input focus-within border: " + JSON.stringify(wrapped));
      await tabTo(page, c => c.id === "start");
      const bare = await page.evaluate(() => {
        const cs = getComputedStyle(document.activeElement);
        return cs.outlineStyle + " " + cs.outlineWidth;
      });
      log("bare month input focus outline: " + bare);
      // extra tab select
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.text === "Extra payments");
      await page.keyboard.press("Enter");
      await tabTo(page, c => c.id === "exBiweekly");
      const selOutline = await page.evaluate(() => {
        const cs = getComputedStyle(document.activeElement);
        return cs.outlineStyle + " " + cs.outlineWidth;
      });
      log("select focus outline: " + selOutline);
    },
  },

  /* ---------------- flashcards ---------------- */
  flashcards: {
    liveSels: ["#deckStats", "#studyBody"],
    stages: [{
      name: "deck + study grades visible",
      setup: async page => {
        await page.fill("#newDeck", "Audit deck");
        await page.click("#addDeck");
        await page.locator(".deck").first().click();
        await page.fill("#cardFront", "Q1");
        await page.fill("#cardBack", "A1");
        await page.click("#addCard");
        await page.click("#studyBtn");
        await page.locator("#flashcard").click(); // flip -> grades appear
      },
      targets: [
        { sel: "header .tag", desc: "tagline (muted on bg)" },
        { sel: ".crumb a", desc: "breadcrumb link (accent on bg)" },
        { sel: ".face .lbl", desc: "face label (muted .72rem)" },
        { sel: ".face .content", desc: "card text (ink on card, 1.5rem)" },
        { sel: ".grade.again b", desc: "Again (--again on card)" },
        { sel: ".grade.hard b", desc: "Hard (--hard on card)" },
        { sel: ".grade.good b", desc: "Good (--good on card)" },
        { sel: ".grade.easy b", desc: "Easy (--easy on card)" },
        { sel: ".grade span", desc: "grade interval (muted .72rem)" },
        { sel: ".grade .k", desc: "key hint (muted .66rem!)" },
        { sel: ".prompt-hint", desc: "prompt hint (muted .85rem)" },
      ],
    }, {
      name: "deck list + editor",
      setup: async page => {
        // stage 1 left us in study view; walk back out (colors of the hidden
        // deck-detail elements are still computable — display doesn't change them)
        await page.click("#studyBackCrumb");
        await page.click("#crumbBack");
      },
      targets: [
        { sel: ".deck .meta", desc: "deck meta (muted .82rem)" },
        { sel: ".deck .due", desc: "due count (accent on card)" },
        { sel: ".stat b", desc: "stat number (accent on card)" },
        { sel: ".stat span", desc: "stat label (muted .74rem)" },
        { sel: ".cardrow .back-t", desc: "card back (muted .92rem)" },
        { sel: ".cardrow .badge", desc: "state badge (muted .68rem!)" },
        { sel: ".iconbtn", desc: "Edit/✕ (muted on bg)", kind: "ui" },
        { sel: ".btn", desc: "primary button (white on accent)" },
        { sel: ".btn.ghost", desc: "ghost (accent on card)" },
      ],
    }],
    keyboard: async (page, log) => {
      await tabTo(page, c => c.id === "newDeck");
      await page.keyboard.type("KB deck");
      await page.keyboard.press("Enter");
      log("deck created via Enter; decks: " + await page.locator(".deck").count());
      await tabTo(page, c => c.cls.includes("deck"));
      await page.keyboard.press("Enter");
      log("deck opened via Enter on card; title: " + await page.locator("#deckTitle").innerText());
      await tabTo(page, c => c.id === "cardFront");
      await page.keyboard.type("2+2?");
      await tabTo(page, c => c.id === "cardBack");
      await page.keyboard.type("4");
      await page.keyboard.press("Control+Enter");
      log("card added via Ctrl+Enter; stats: "
        + (await page.locator("#deckStats").innerText()).replace(/\s+/g, " "));
      // study fully by keyboard: Space flips, 3 grades
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.id === "studyBtn");
      await page.keyboard.press("Enter");
      log("study started; hint: " + await page.locator("#hint").innerText());
      await page.keyboard.press("Space");
      log("Space flips; flipped: "
        + await page.evaluate(() => document.querySelector("#flashcard").classList.contains("flipped")));
      await page.keyboard.press("3");
      log("graded 3 via number key; session: "
        + (await page.locator("#studyBody").innerText()).replace(/\s+/g, " ").slice(0, 80));
    },
  },

  /* ---------------- alerts ---------------- */
  alerts: {
    liveSels: ["#main", "#updated"],
    network: true,
    stages: [{
      name: "stubbed alerts, all severities",
      setup: async page => { /* stubbing + location seeding done in run() for alerts */ },
      targets: [
        { sel: ".back", desc: "back link (muted on bg)" },
        { sel: ".locbar", desc: "location bar (muted .9rem)" },
        { sel: ".loclabel", desc: "location label (ink)" },
        { sel: ".linklike", desc: "change (accent link)" },
        { sel: ".notify-toggle", desc: "notify pill (muted on card)" },
        { sel: ".updated", desc: "updated stamp (muted .8rem)" },
        { sel: ".banner .count", desc: "count (white on severity color)" },
        { sel: ".banner .sub", desc: "banner sub (muted .88rem)" },
        { sel: ".banner .sub strong", desc: "'Most serious' (severity color on card)" },
        { sel: '[data-sev="Extreme"] .sev-badge', desc: "Extreme badge (white on --extreme)" },
        { sel: '[data-sev="Severe"] .sev-badge', desc: "Severe badge (white on --severe)" },
        { sel: '[data-sev="Moderate"] .sev-badge', desc: "Moderate badge (white on --moderate)" },
        { sel: '[data-sev="Minor"] .sev-badge', desc: "Minor badge (white on --minor)" },
        { sel: '[data-sev="Unknown"] .sev-badge', desc: "Unknown badge (white on --unknown)" },
        { sel: ".a-meta", desc: "alert meta (muted .82rem)" },
        { sel: ".a-body .instruction", desc: "instruction (ink on accent-soft)" },
        { sel: ".kv dt", desc: "kv label (muted .84rem)" },
        { sel: ".chev", desc: "chevron (muted, ui)", kind: "ui" },
      ],
    }],
    keyboard: async (page, log) => {
      // first-run form: zip field is auto-focused; keyboard-only from there
      await page.waitForSelector("#zip");
      log("first-run: focus is on: " + await page.evaluate(() => document.activeElement.id));
      await page.keyboard.type("10001");
      await page.keyboard.press("Enter");
      await page.waitForSelector(".banner", { timeout: 5000 });
      log("ZIP set via Enter; banner: "
        + (await page.locator(".banner .big").innerText()));
      // open an alert with keyboard (details/summary)
      await tabTo(page, c => c.tag === "SUMMARY");
      await page.keyboard.press("Enter");
      const open = await page.evaluate(() => document.querySelector("details.alert").open);
      log("summary Enter expands: " + open);
      await page.keyboard.press("Enter");
      log("summary Enter collapses: " + !(await page.evaluate(() => document.querySelector("details.alert").open)));
      // change-location link reachable
      await page.evaluate(() => document.body.focus());
      await tabTo(page, c => c.id === "changeLoc");
      await page.keyboard.press("Enter");
      log("change location via Enter; form shown: " + await page.locator("#zip").isVisible());
    },
  },
};

/* ---- alerts stubbing helpers ---- */
const ALERT_FIXTURE = {
  features: ["Extreme", "Severe", "Moderate", "Minor", "Unknown"].map((sev, i) => ({
    id: "urn:test:" + i,
    properties: {
      id: "urn:test:" + i, event: sev + " Test Warning", severity: sev,
      headline: "Test headline for " + sev, areaDesc: "Test County",
      description: "Synthetic alert used for the accessibility audit.",
      instruction: "No action needed — audit fixture.",
      certainty: "Observed", urgency: "Expected", senderName: "NWS Test",
      effective: new Date().toISOString(), onset: new Date().toISOString(),
      ends: new Date(Date.now() + 3600e3).toISOString(), expires: new Date(Date.now() + 3600e3).toISOString(),
    },
  })),
};
async function stubAlerts(ctx) {
  await ctx.route("**/api.weather.gov/**", route => route.fulfill({
    contentType: "application/geo+json", body: JSON.stringify(ALERT_FIXTURE),
  }));
  await ctx.route("**/api.zippopotam.us/**", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ places: [{ "place name": "New York", "state abbreviation": "NY", latitude: "40.7128", longitude: "-74.0060" }] }),
  }));
}

/* ------------------------------- runner ------------------------------- */
async function newPage(browser, theme, tool, opts = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  if (tool === "alerts") await stubAlerts(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", e => errors.push(String(e).slice(0, 160)));
  await page.addInitScript(({ theme, tool, seedLoc }) => {
    try {
      theme ? localStorage.setItem("suite.theme", theme) : localStorage.removeItem("suite.theme");
      if (seedLoc) localStorage.setItem("suite.location", JSON.stringify({ lat: 40.7128, lon: -74.006, label: "New York, NY (audit)" }));
    } catch (e) {}
  }, { theme, tool, seedLoc: tool === "alerts" && !opts.firstRun });
  if (TOOLS[tool].useClock && opts.clock) await page.clock.install();
  await page.goto(toolUrl(tool));
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: PAGE_LIB });
  return { ctx, page, errors };
}

async function run(tool) {
  const cfg = TOOLS[tool];
  const browser = await chromium.launch({ channel: "chrome" });
  const report = { tool, themes: {}, keyboard: [], iconButtons: null, labels: null, tabindex: null, live: null, focus: null, grep: null };

  /* per-theme: setup stages, contrast, plus one-time structural checks (light) */
  for (const theme of ["light", "dark"]) {
    const { ctx, page, errors } = await newPage(browser, theme, tool, { clock: true });
    if (tool === "alerts") {
      await page.waitForSelector(".banner, .card-msg", { timeout: 8000 }).catch(() => {});
      // tag severity for selectors + open first alert body for contrast targets
      await page.evaluate(() => {
        document.querySelectorAll("details.alert").forEach(d => {
          const badge = d.querySelector(".sev-badge");
          if (badge) d.dataset.sev = badge.textContent.trim();
        });
        const first = document.querySelector("details.alert");
        if (first) first.open = true;
      });
    }
    const stagesOut = [];
    for (const stage of cfg.stages) {
      await stage.setup(page);
      await page.waitForTimeout(250);
      stagesOut.push({ name: stage.name, contrast: await measureContrast(page, stage.targets) });
    }
    report.themes[theme] = { stages: stagesOut, consoleErrors: errors };

    if (theme === "light") {
      report.iconButtons = await checkIconButtons(page);
      report.labels = await checkLabels(page);
      report.tabindex = await checkTabindex(page);
      report.live = await checkLive(page, cfg.liveSels);
      report.focus = await checkFocusVisible(page);
    }
    await ctx.close();
  }

  /* keyboard-only drive (light, fresh page) */
  {
    const { ctx, page, errors } = await newPage(browser, "light", tool, { firstRun: tool === "alerts" });
    const log = s => report.keyboard.push(s);
    try { await cfg.keyboard(page, log); }
    catch (e) { report.keyboard.push("KEYBOARD FAIL: " + e.message); report.keyboardFailed = true; }
    report.keyboardConsole = errors;
    await ctx.close();
  }

  await browser.close();
  return report;
}

const tools = process.argv.slice(2);
if (!tools.length) { console.error("usage: node a11y-phase4-set2.mjs <tool> ..."); process.exit(1); }
for (const t of tools) {
  if (!TOOLS[t]) { console.error("no audit config for " + t); process.exit(1); }
  const rep = await run(t);
  console.log("===== AUDIT " + t + " =====");
  console.log(JSON.stringify(rep, null, 1));
}
