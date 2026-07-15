# PWA.md — the optional installable layer

Phase 3 spec. Short on purpose: the PWA is **additive**, and the moment it threatens the
single-file story, the PWA loses.

## 1. The invariant

**`file://` double-click is the primary mode, forever.** The PWA activates only when the suite is
served over http(s) — locally via `build.py --serve`, or publicly via the documented sharing host
(GitHub Pages serving `dist/`, set up in Phase 3):

```js
// in core/suite.js — inert from disk
if (location.protocol.startsWith("http") && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
```

Nothing else about the files changes between modes. Phase 3's regression bar: dist output opened
from `file://` behaves byte-identically to the pre-PWA build.

## 2. Generated artifacts

`build.py` emits both from the manifest — nothing is hand-maintained:

- **`dist/manifest.webmanifest`** — name "Local Suite", short_name, icons from `core/icons/`,
  `theme_color`/`background_color` from the suite palette (light `#f5f3ee`, accent `#2f6f6a`),
  `start_url: index.html`, `display: standalone`. Per-tool deep links work because every tool is
  just a page.
- **`dist/sw.js`** — precache list = every dist HTML file + icons + webmanifest. Cache name
  includes a content hash of the precache set (`suite-v2-<hash>`), so any rebuild that changes
  anything produces a new cache.

## 3. Caching strategy

- **App shell: cache-first.** The HTML files *are* the app; serve from cache, update in the
  background (stale-while-revalidate on navigation requests is acceptable; plain cache-first with
  hash-busting is simpler and fine).
- **API calls: network-only pass-through.** The SW never caches data-source responses. Tools
  already do localStorage caching with visible timestamps (`{t, v}` envelopes) — a second, invisible
  SW cache layer would serve stale data without the "cached from <time>" honesty. One caching
  brain, not two.
- **Update policy:** new SW calls `skipWaiting()`; on `activate`, `clients.claim()` + delete old
  `suite-v2-*` caches. Worst case a user sees fresh HTML one reload late — acceptable for this
  suite; never let an old cache pin the whole suite stale.

## 4. Offline matrix

| Class | Installed-PWA offline behavior |
|---|---|
| ~23 zero-network tools (password, notes, timers, convert…) | fully functional |
| CORS-open fetchers (weather, quakes…) | shell loads; data comes from localStorage stale cache with the "cached from…" card (existing v1 behavior) |
| keyed / CORS-blocked tools | shell loads; same stale-cache story; embedded data and link-out cards work offline by nature |

## 5. Storage origin nuance (important)

`file://` pages and `http://localhost:8000` are **different origins** — separate localStorage.
A user who lives in file:// mode and then installs the PWA starts with empty settings there.

- Documented in the hub's first-run hint when served over http with empty `suite.*` storage:
  "Coming from the double-click files? Export your data there (Settings → Backup) and import here."
- **settings.html export/import is the sanctioned bridge.** No automatic sync, no cleverness.

## 6. Install UX

- Icons: 192/512 px + maskable variant, drawn from the suite design language (teal accent on
  warm paper / dark slate) — produced in Phase 3, live in `core/icons/`.
- Verify install prompts + standalone launch on Chrome and Edge (primary), confirm graceful
  no-op on Firefox/Safari file:// usage.

## 7. Non-goals

No push notifications. No background sync. No periodic background refresh. No web-share targets.
The PWA is exactly: installable icon + offline shell. Anything more re-opens the "no tracking,
no accounts, calm" conversation, and the answer is no.
