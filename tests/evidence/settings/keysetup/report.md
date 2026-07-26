# settings.html — guided API-key setup (2026-07-25)

Automating the *acquisition* of the keys the suite asks for. Companion to the parent
`../report.md`, which covers the rest of the tool.

## What can't be automated, and why that's final

Signup is a human action at every one of the nine providers, and no amount of engineering changes
that:

- **api.data.gov's own signup embed requires reCAPTCHA v2 *and* v3 tokens plus an explicit terms
  checkbox.** Pulled from the live bundle and archived in `provider-probes.txt` §4:
  `"g-recaptcha-response-v2"`, `"g-recaptcha-response-v3"`, `"user_terms_and_conditions"`,
  `https://www.google.com/recaptcha/api.js`.
- Satisfying that would mean either defeating a captcha or loading third-party script from
  `api.data.gov` and `google.com` into a suite page — barred by the no-runtime-dependency contract
  and by the generated CSP independently.
- Finnhub, eBird and Aviationstack additionally require an account and terms acceptance;
  `https://ebird.org/api/keygen` 302s to a Cornell Lab login (`provider-probes.txt` §3).

So the page opens the form and takes the key back. It never poses as the user. This matches what
flight.html has told users since v3: "Local Suite cannot create or accept a third-party account on
your behalf."

## What is automated

### 1. One signup, three key rows

NASA, Congress.gov and USDA FoodData are one api.data.gov gateway. Evidence, `provider-probes.txt`
§1 — all three answer `via: https/1.1 api-umbrella` and accept the universal `DEMO_KEY` with an
identical `x-ratelimit-limit: 10`. api.data.gov's developer manual: a key "gives you access to all
APIs from agencies participating in api.data.gov's service."

**EIA and the Park Service run their own API Umbrella instances.** Same software — so the same
`DEMO_KEY` works and the same `API_KEY_INVALID` body comes back — but separate registration and
separate keys. They are deliberately *not* folded into the api.data.gov step. This was the one
finding that could have produced a confidently wrong feature.

The fan-out never assumes: a sibling row is filled only after **that provider's own endpoint has
accepted the key**. `settings-keysetup.mjs` asserts both halves — the three api.data.gov rows fill,
and `eiaUntouched` / `npsUntouched` / `fanoutProbedOnlySiblings` confirm nothing else was written or
even probed.

### 2. Live key checks

One request per click, `cache: "no-store"`, distinguishing accepted / rejected / rate-limited /
unreachable. `provider-probes.txt` §2 records the bad-key response of all nine: 401 or 403 with a
machine-readable body in every case, which is why a rejection is reported as a rejection and a
network failure is reported as a network failure — never conflated.

This is why the manifest entry moved from `"network": "offline"` to `"keyed"` with nine endpoint
hosts: the generated CSP has to allow the check. `cspAllows` in the test asserts all nine are in the
built page's `connect-src`. The page still issues nothing until a button is pressed, and the footer
now says so.

### 3. Paste routing

Keys arrive in an email or on a dashboard, so a paste anywhere on the page is scanned: key shape
narrows the field, provider wording in the surrounding text usually settles it, and when it doesn't,
the live check decides. A paste into a real input is left alone (the backup textarea keeps working).

- Routed by wording: an EIA registration email files itself under `suite.key.eia` (`pasteRouted`).
- Unattributable: a bare 40-character key offers NASA · Congress.gov · USDA FoodData · EIA · Park
  Service plus "Check and file it" rather than guessing (`paste-ambiguous.png`,
  `ambiguousChoices`).
- "Check and file it" tries candidates against the live APIs and keeps the one that accepts
  (`identifiedNasaFirst`).

### 4. Spend guard

Aviationstack's free tier is 100 requests/month, so its test arms on the first click ("Spend 1
request?") and fires on a confirming second, counting into the same `suite.flight.usage` ledger the
Flight Tracker keeps. Asserted by `armedNoRequest` (no request leaves the page on click one),
`armedLabel`, and `aviationstackCounted` (`count === 1` after the confirming click). BART is absent
from the wizard on purpose — it ships a published public key and needs no signup.

## Gates

| Gate | Result |
|---|---|
| `python3 build.py --check` | all fatal gates green (CSP hashes, key hygiene, catalog crosscheck, negative tests) |
| `settings-signup-sync` (new, advisory) | pass — every manifest signup URL is offered by settings.html. Caught one real drift on introduction (`https://api.nasa.gov/` vs the manifest's `https://api.nasa.gov`) and was confirmed to fire on a mutated source before being trusted |
| `node tests/settings-keysetup.mjs` | PASS — 23 assertions, output in `test-output.txt` |
| `node tests/smoke.mjs` | 74/74 green, settings.html included |
| `node tests/verify-tool.mjs settings` | exit 0; a11y sweep now lists `wizMsg` and `pasteBox` as live regions, and reports no unlabelled input and no unlabelled icon button |

The one console error in the parent `interaction.txt` (`net::ERR_FAILED`) is the pre-existing,
documented relay route-abort, not a regression — see `../report.md` line 134. In
`settings-keysetup.mjs` the deliberate bad-key step produces exactly one `403` console entry, which
the test counts as `expectedRejections` rather than silently filtering.

## Screenshots

| File | Shows |
|---|---|
| `wizard-step1-light.png`, `wizard-step1-dark.png` | step 1 of 6, the three providers one key covers, the profile fields with Copy |
| `fanout-light.png`, `fanout-dark.png` | after one key: three rows filled, each labelled with what accepted it |
| `paste-ambiguous.png` | an unattributable key asking instead of guessing |

## Storage added

`suite.profile.email`, `suite.profile.first`, `suite.profile.last` — used only to fill signup forms,
never transmitted by this page, and in backups like everything else (the card says so).
