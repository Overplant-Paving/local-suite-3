# Automatic first location (2026-07-25)

## What was actually wrong

Not propagation — that already worked. All 23 location tools write through `Suite.location.set()`
(`core/suite.js`), which mirrors to `suite.location` and is read by every other tool; several tools
already said so in their own copy (quakes.html: *"This is saved for the whole suite."*).

The gap was that **nothing ever acquired the first location**. 19 of the 23 tools already called
`navigator.geolocation`, but only from a click handler, so every tool cold-started into a blocking
"type a ZIP" card. `before-setup-card.png` is that card; `after-detected.png` is the same tool, same
cold profile, with detection on — straight into live data.

## Mechanism, and why not IP geolocation

Browser geolocation: the device answers, so there is **no network request**. It works under every
tool's generated CSP — the hub's is `connect-src 'none'` — and from `file://`, needs no manifest,
CATALOG or CSP change, and hands no third party the user's IP. An `ipapi.co`-style lookup would have
required all of that plus the privacy cost, to get a worse answer.

## The failure modes, and how each is handled

| Case | Behaviour | Asserted by |
|---|---|---|
| Cold tool, permission granted | detects, saves, reloads **once** into the data view | `cold.loads === 2`, `setupCardGone` |
| Second tool afterwards | opens on the same location, **zero** further geolocation calls, **no** reload | `propagated.geoCalls === 0`, `loads === 1` |
| Permission refused **by the user** | `suite.location.autoDenied` set; manual card returns; a **revisit never asks again** | `denied.askedOnce`, `askedAgain === 0` |
| Auto-denied by the **environment** | **not** remembered; still willing on the next visit | `autoDeny.notRemembered`, `asksAgain === 1` |
| Toggle off | no geolocation call at all, no location written | `toggledOff.geoCalls === 0` |
| User typed something first | reload **cancelled**, input intact, location still saved and shared | `typingWins.loads === 1`, `inputSurvived` |
| Storage write cannot stick | **no reload loop** — page settles at one load | `noLoop.loads === 1` |
| Hub (PWA `start_url`) | detects at the front door, so tools need no reload at all | `hub.status`, `hub.options` |
| Refusal recovery | Settings explains it and re-ticking clears the flag | `toggle.warnsAboutRefusal`, `onClears` |

Three of these are defects found while building, not hypotheticals:

- **An environment auto-deny poisoned the preference permanently.** Probing a genuinely
  double-clicked `file://` page — nothing granted, nothing stubbed — showed Chromium reporting
  `isSecureContext: true` with `navigator.geolocation` present, then failing with `code 1`
  ("User denied Geolocation") *without anyone being asked*, and the suite writing
  `suite.location.autoDenied` on that very first load. Any headless run, automation harness or
  enterprise policy would have silently disabled the feature forever for a user who never refused.
  `auto()` now consults `navigator.permissions.query({name:"geolocation"})` and remembers the
  refusal only when the state is not `"prompt"`. Regression-tested as scenario 3b.

- **The reload could have eaten user input.** `geo`, `elevation`, `recalls` and the station pickers
  are usable *without* a location, so a detection that resolved while someone was typing would have
  reloaded over them. `autoBoot()` now watches `input`/`change` and cancels the reload; the location
  is still saved and shared, only the free re-render is given up.
- **`store.get()` JSON-parses first**, so a `"1"` sentinel would have come back as the number `1` and
  `autoDenied()` would never have matched — the refusal would not have stuck and the prompt would
  have returned on every load. The sentinel is the non-numeric `"denied"`.

A fourth guard is structural rather than a fixed defect: `auto()` resolves truthy **only after
re-reading `loc.get()`**. A write that did not persist reports failure, which is what makes the
reload loop impossible rather than unlikely.

## Why reload rather than re-render

The 23 tools boot in at least eight different shapes — `boot()`, `load()`,
`if (loc) showApp(); else showFirstRun()`, bare IIFEs — and several cache
`let loc = Suite.location.get()` at parse time. One reload is correct for all of them with no edit
to any tool's internals, and it is the same move `weather.html`, `almanac.html` and `daylight.html`
already make on the cross-tab `storage` event. Cost is bounded: it fires only on a genuine cold
start, and not at all for users who enter through the hub.

## Gates

| Gate | Result |
|---|---|
| `python3 build.py --check` | all fatal gates green |
| `node tests/location-auto.mjs` | PASS — 9 scenarios, 27 assertions (`test-output.txt`) |
| `node tests/smoke.mjs` | 74/74 green — covers all 23 touched tools plus the 51 untouched ones |
| `node tests/verify-tool.mjs <tool>` | 24/24 green across every touched tool, the hub and settings |
| `node tests/settings-keysetup.mjs` | PASS — the previous feature still green |

`verify-tool.mjs weather` cannot run: `tests/interactions/weather.mjs` does not exist in this
checkout. That is pre-existing and unrelated — weather.html is still covered by `smoke.mjs` and by
scenario 1 of `location-auto.mjs`.

## Screenshots

| File | Shows |
|---|---|
| `before-setup-card.png` | the blocking card every cold tool used to open with |
| `after-detected.png` | same tool, same cold profile, detection on — live data, no card |
| `propagated-weather.png` | a second tool opening on the same location with no prompt |
| `hub-detected.png` | the hub acquiring it at the front door |
| `toggle.png`, `toggle-refused.png` | the Settings switch, and the recoverable refusal state |

## Storage added

`suite.location.auto` (`"off"` disables; absent = on) and `suite.location.autoDenied` (`"denied"`),
listed per tool in `manifest/tools.json` beside `suite.location` and documented in ARCHITECTURE §6.1.
