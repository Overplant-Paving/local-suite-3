# Local Suite v3 — National Parks Explorer evidence

## Scope

`tools/parks.html` was expanded from a multiple-park alert watcher into a park-centered explorer for
all 29 resources in the official NPS Swagger 2 schema. The generated artifact is
`dist/parks.html`; it remains self-contained and supports `file://`, hosted, and PWA use.

Official sources reviewed:

- `https://www.nps.gov/subjects/developer/api-documentation.htm`
- `https://www.nps.gov/subjects/developer/customcf/swagger.json`
- `https://www.nps.gov/subjects/developer/guides.htm`
- `https://www.nps.gov/subjects/developer/changelog.htm`
- `https://www.nps.gov/subjects/developer/faqs.htm`

## Information architecture and endpoint coverage

- **Overview:** `/parks`
- **Alerts:** `/alerts`
- **Plan a visit:** `/campgrounds`, `/events`, `/feespasses`, `/parkinglots`, `/roadevents`,
  `/passportstamplocations`, `/visitorcenters`, `/mapdata/parkboundaries/{sitecode}`
- **Explore:** `/activities/parks`, `/thingstodo`, `/tours`, `/webcams`
- **Learn:** `/articles`, `/lessonplans`, `/newsreleases`, `/people`, `/places`
- **Media:** `/multimedia/audio`, `/multimedia/galleries`,
  `/multimedia/galleries/assets`, `/multimedia/videos`
- **Reference:** `/activities`, `/amenities`, `/amenities/parksplaces`,
  `/amenities/parksvisitorcenters`, `/topics`, `/topics/parks`

This is 29/29 documented resources. Endpoint health in the Reference tab distinguishes loaded,
stale, errored, and not-yet-loaded resources.

## Request, credential, and cache design

- The NPS key is read from `suite.key.nps` and sent only through `X-Api-Key`.
- No request places the key in the URL.
- `file://` CORS preflight was verified to allow `X-Api-Key` and `Origin: null`.
- The park directory is cached for 30 days.
- Core park content follows the NPS two-hour source update cadence.
- Reference and media resources use longer TTLs.
- Resource groups load only when their tab is opened.
- Failed network requests visibly fall back to timestamped stale cache data.
- Cache identities include the endpoint path, selected park, and query parameters.
- Late responses are rejected after park/tab changes through a view sequence guard.
- Gallery assets are loaded only after a gallery is resolved, are queried by `galleryId`, and can
  be switched through a gallery picker; live verification showed that `parkCode` does not constrain
  that endpoint.
- NPS-hosted images are CSP-limited to `www.nps.gov`; API requests are limited to
  `developer.nps.gov`.
- The key never appears in page text, page URLs, repository files, generated HTML, screenshots,
  or this report.

## Upstream service behavior

A live schema inventory queried every documented endpoint with conservative limits. Twenty-six
resources returned usable data in the final built-browser run. The following NPS services returned
upstream errors during repeated direct and browser checks:

- `/events`
- `/roadevents`
- `/mapdata/parkboundaries/{sitecode}`

These resources remain represented, but the UI loads them only after an explicit user action. This
prevents recurring console noise and wasted quota while retaining a recovery path. Their error
states explain that the NPS upstream service is unavailable and do not invent replacement data.

## Deterministic verification

`tests/interactions/parks.mjs` route-fulfills realistic payloads for all 29 resources and verifies:

- Designed no-key state and masked credential input.
- Key storage under `suite.key.nps`.
- Header authentication on every API request.
- No `api_key` query parameters.
- Search and keyboard park selection.
- Active park persistence through `suite.parks.active`.
- Existing watched-park compatibility through `suite.parks`.
- Overview, alerts, planning, exploration, learning, media, and reference render paths.
- All 29 unique endpoint paths requested and represented in endpoint health.
- Gallery assets constrained by `galleryId`, not `parkCode`.
- Fresh-cache reload without additional requests.
- Invalid-key handling.
- Offline stale fallback for all eight planning resources, including manual resources.
- Native park-option and section-button semantics with `aria-pressed`, avoiding incomplete ARIA
  listbox/tab interaction contracts.
- 390-pixel responsive layout without horizontal document overflow.
- Light/dark theme behavior and clean main-page JavaScript execution.

`tests/parks-built.mjs` repeats the complete 29-resource route through generated
`dist/parks.html`, verifying deep-link startup, generated CSP allowances for the API and NPS
images, header-only authentication, gallery identity, endpoint health, no credential disclosure,
no horizontal overflow, and a clean browser console.

Evidence is under `tests/evidence/parks/`, including:

- `nokey-designed-state.png`
- `invalid-key-state.png`
- `offline-stale.png`
- `mobile-390.png`
- `v2-after-interaction.png`
- `interaction.txt`
- `localstorage.json`
- `computed-style-diff.txt`

## Live built-page verification

The generated `dist/parks.html` was opened through `file://` in a fresh Playwright Chromium context.
The credential was injected only into the temporary browser context. Yellowstone was selected and
all non-manual resource groups were loaded.

Observed final live results:

- Park directory and Yellowstone overview: successful.
- Alerts: 5 records.
- Campgrounds: 12 records.
- Fees/passes: 1 park-level response.
- Parking lots: 11 records.
- Passport stamp locations: 13 records.
- Visitor centers: 11 records.
- Things to do: 87 records.
- Tours: 9 records.
- Webcams: 10 records.
- Articles: 385 records.
- Lesson plans: 13 records.
- News releases: 16 records.
- People: 4 records.
- Places: 532 records.
- Audio: 169 records.
- Galleries: 265 records.
- First-gallery assets: 107 records, scoped by `galleryId`.
- Videos: 291 records.
- Activity catalog: 40 records.
- Amenity catalog: 127 records.
- Place-amenity relationships: 57 records.
- Visitor-center amenity relationships: 37 records.
- Topic catalog: 83 records.
- NPS responses consumed by the final healthy-resource run: 26.
- Browser console errors: 0.
- Key visible in body or URL: false.

The three unreliable resources were shown as on-demand and were not automatically requested in the
final clean run.

## Build and release gates

The focused sequence is:

```bash
python3 build.py
cd tests
node verify-tool.mjs parks
node parks-built.mjs
cd ..
python3 build.py --check
node tests/smoke.mjs
git diff --check
```

The report should only be considered complete when that sequence and the hosted GitHub Pages check
are green for the final committed revision.
