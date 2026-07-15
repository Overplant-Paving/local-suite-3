/* Local Suite v2 — core/suite.js
   One IIFE, one global. Small, boring, dependency-free. Spec: ARCHITECTURE.md §3.

   Not here yet (no dead API surface ships):
   - Protocol-gated service-worker registration lands in Phase 3 (PWA.md). */
(() => {
"use strict";

/* Safe storage backend: memory fallback when localStorage is unavailable
   (private mode, file:// quirks). Persistence is polite, never fatal. */
const backend = (() => {
  try {
    const k = "__suite_t";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch (e) {
    const mem = new Map();
    return {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: k => { mem.delete(k); }
    };
  }
})();

function assertNamespaced(key) {
  if (typeof key !== "string" || !key.startsWith("suite.")) {
    throw new Error('Suite.store keys must start with "suite." - got: ' + key);
  }
}

const store = {
  /* v1 wrote some keys as bare strings ("dark", "F") and some as JSON.
     Read both: JSON first, raw string when parsing fails. */
  get(key, fallback = null) {
    assertNamespaced(key);
    const raw = backend.getItem(key);
    if (raw === null) return fallback === undefined ? null : fallback;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  },
  /* Strings are written bare so v1 tools keep reading their keys unchanged. */
  set(key, value) {
    assertNamespaced(key);
    try {
      backend.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch (e) { /* quota exceeded or denied - never fatal */ }
  },
  /* Deletes a key outright (v1 tools used removeItem for unpin/clear flows). */
  remove(key) {
    assertNamespaced(key);
    try { backend.removeItem(key); } catch (e) {}
  },
  /* Ordered migrations gated by suite.meta.schemaVersion (ARCHITECTURE.md §6).
     Baseline v2 = v1 layout, so the suite-wide list starts empty. */
  migrate(fns) {
    const KEY = "suite.meta.schemaVersion";
    let v = store.get(KEY, 0);
    if (typeof v !== "number" || !isFinite(v)) v = 0;
    for (; v < fns.length; v++) fns[v]();
    store.set(KEY, fns.length);
  }
};

/* ---- theme: the suite.theme convention (absent = follow system) ---- */
function activeTheme() {
  return document.documentElement.dataset.theme ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function paintThemeButtons() {
  document.querySelectorAll("#themeBtn, .theme-btn").forEach(btn => {
    btn.setAttribute("aria-pressed", String(activeTheme() === "dark"));
  });
}
const theme = {
  init() {
    const saved = store.get("suite.theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
    document.querySelectorAll("#themeBtn, .theme-btn").forEach(btn => {
      btn.setAttribute("aria-label", "Toggle light/dark theme");
      btn.addEventListener("click", theme.toggle);
    });
    paintThemeButtons();
  },
  toggle() {
    const next = activeTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("suite.theme", next);
    paintThemeButtons();
  }
};

/* ---- fetch: one helper for the whole suite ----
   Returns an envelope {v, t, stale, fromCache}:
     v         the JSON payload
     t         epoch ms the payload was fetched
     stale     true when the network failed and this is the cached fallback -
               render the "Offline - cached from <time>" card
     fromCache true when no request was made (fresh within ttl, or stale)
   Cache lives at localStorage["suite.cache." + cacheKey] as {t, v}
   (the v1 envelope - v1 caches keep working). ttl is in ms; 0 = always fetch. */
async function fetchJSON(url, opts = {}) {
  const {
    timeout = 12000, cacheKey = null, ttl = 0, fallbackToCache = true,
    accept = "application/json", tries = 1, headers = {}
  } = opts;
  const fullKey = cacheKey ? "suite.cache." + cacheKey : null;

  let cached = null;
  if (fullKey) {
    const e = store.get(fullKey);
    if (e && typeof e === "object" && "t" in e && "v" in e) cached = e;
  }
  if (cached && ttl > 0 && Date.now() - cached.t < ttl) {
    return { v: cached.v, t: cached.t, stale: false, fromCache: true };
  }

  let lastErr = null;
  const n = Math.max(1, tries);
  for (let i = 0; i < n; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: Object.assign(accept ? { "Accept": accept } : {}, headers)
      });
      clearTimeout(timer);
      if (r.ok) {
        const v = await r.json();
        const t = Date.now();
        if (fullKey) store.set(fullKey, { t, v });
        return { v, t, stale: false, fromCache: false };
      }
      lastErr = new Error("HTTP " + r.status);
      if (r.status === 404) break; /* a 404 will not improve on retry */
    } catch (e) {
      clearTimeout(timer);
      lastErr = (e && e.name === "AbortError") ? new Error("timed out") : e;
    }
    if (i < n - 1) await new Promise(res => setTimeout(res, 600 * (i + 1)));
  }
  if (fallbackToCache && cached) {
    return { v: cached.v, t: cached.t, stale: true, fromCache: true };
  }
  throw lastErr || new Error("fetch failed");
}

/* ---- escaping: mandatory for remote data interpolated into innerHTML ---- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---- a11y: mark an async result container so screen readers hear updates ---- */
function liveRegion(el) {
  el.setAttribute("aria-live", "polite");
  return el;
}

/* ---- shared location: the suite.location key, used by ~20 tools ---- */
const loc = {
  get() {
    const l = store.get("suite.location");
    if (l && typeof l === "object" && isFinite(l.lat) && isFinite(l.lon)) {
      return { lat: +l.lat, lon: +l.lon, label: l.label || "" };
    }
    return null;
  },
  set(l) {
    if (!l || !isFinite(l.lat) || !isFinite(l.lon)) {
      throw new Error("Suite.location.set needs {lat, lon}");
    }
    store.set("suite.location", { lat: +l.lat, lon: +l.lon, label: l.label || "" });
  }
};

/* ---- API keys: the suite.key.<name> convention (API-AND-RELAY.md §3) ----
   Officially published demo/public keys only — never a personal key. */
const DEMO_KEYS = {
  nasa: "DEMO_KEY",              // api.nasa.gov demo tier: 30/hr, 50/day
  usda: "DEMO_KEY",              // USDA FoodData Central demo tier
  bart: "MW9S-E7SL-26DU-VV8V"    // BART's officially published public key
};
function key(name) {
  const v = store.get("suite.key." + name);
  if (typeof v === "string" && v.trim()) return { value: v.trim(), isDemo: false };
  if (DEMO_KEYS[name]) return { value: DEMO_KEYS[name], isDemo: true };
  return { value: null, isDemo: false };
}

/* ---- optional power-user relay (API-AND-RELAY.md §6) ----
   Unset for everyone by default: tools use their link-out/embedded paths. */
function relay(url) {
  const base = store.get("suite.relay.url");
  if (typeof base !== "string" || !base.trim()) return null;
  const b = base.trim().replace(/\/$/, "");
  return b + (b.includes("?") ? "&" : "?") + "url=" + encodeURIComponent(url);
}

window.Suite = { theme, fetchJSON, store, esc, liveRegion, location: loc, key, relay };
})();
