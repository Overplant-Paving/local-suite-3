# V3 multiple saved locations — verification record

Feature branch: `v3/multiple-locations`
Baseline: `8b8690f`

## Scope verified

- Existing `suite.location` migrates to a named `suite.locations` collection without changing the active mirror.
- Duplicate labels receive unique stable IDs.
- Add, edit, activate, and delete operations work from Settings.
- Hub switcher updates the active mirror.
- Open location-snapshot tools reload after another tab changes the active mirror.
- Existing `Suite.location.set()` updates the active named entry and increments its coordinate revision.
- Switching, moving, or deleting the active location resets ambiguous station/state/alert preferences while preserving safe coordinate-, station-, and query-keyed caches.
- Wildfire cache envelopes are coordinate-scoped; the legacy unscoped key is ignored.
- In-flight fetches are rejected and not cached if the active location changes before completion.
- Deleting an inactive location does not reset active-location state.
- Deleting the final location clears both location keys.
- Invalid coordinates are rejected.
- Empty labels remain compatible with the established `Suite.location` setter contract.
- Unknown newer collection schemas and damaged schema-1 collections are left byte-for-byte untouched and mutations are refused.
- Unknown fields in valid schema-1 collections survive normal mutations.
- A v2 location-only backup replaces and migrates over an existing v3 collection instead of being overwritten by it.
- Storage writes are read back; the UI reports unavailable/full storage rather than announcing false success.
- Settings backup/restore round-trips both location keys byte-for-byte.
- Keyboard, labels, live-region feedback, both themes, CSP, and generated-dist synchronization were exercised.

## Commands and observed results

```text
node tests/multiple-locations.mjs
multiple locations: PASS {"migration":true,"uniqueIds":["home","home-2"],"legacyWriterSync":true,"labelClear":true,"activeFallback":true,"finalClear":true,"invalidRejected":true,"unknownFieldsPreserved":true,"futureSchemaPreserved":true,"damagedDataPreserved":true,"inFlightGuard":{"rejected":true,"cached":null},"builtHub":{"toolLinks":72,"activeLabel":"Home"},"wildfireScoped":true}
```

```text
node tests/location-cross-tab.mjs
location cross-tab: PASS {"reloads":2,"active":{"lat":34.0522,"lon":-118.2437,"label":"B"}}
```

```text
node tests/verify-tool.mjs settings
evidence written to tests/evidence/settings/

node tests/verify-tool.mjs index
evidence written to tests/evidence/index/

node tests/verify-tool.mjs wildfire
evidence written to tests/evidence/wildfire/
```

All three targeted verifier runs completed with exit code 0. The settings interaction log records a 10/10 byte-identical backup round trip, v2 location-only restore migration, named-location migration, targeted state reset with safe-cache preservation, active fallback, focus return, and clean accessibility checks. The hub interaction log records migration, two selectable locations, mirror update, targeted state reset with safe-cache preservation, and zero console errors.

```text
python3 build.py --check
GATE manifest-files-sync  pass
GATE markers              pass
GATE dist-staleness       pass
GATE no-inline-handlers   pass
GATE csp                  pass
GATE escaping-heuristic   pass
GATE catalog-crosscheck   pass
GATE key-hygiene          pass
GATE no-example-urls      pass
GATE pwa-sync             pass
NEGATIVE TESTS            pass
--check: all fatal gates green
```

```text
node tests/smoke.mjs
smoke: 73/73 green
```

The installed Google Chrome distribution was unavailable on this Linux host, so the verification harness used its new fallback to the matching Playwright Chromium build. This preserves installed Chrome as the preferred path when present.

## Visual evidence

- `tests/evidence/settings/v2-light.png`
- `tests/evidence/settings/v2-dark.png`
- `tests/evidence/settings/v2-after-interaction.png`
- `tests/evidence/index/v2-light.png`
- `tests/evidence/index/v2-dark.png`
- `tests/evidence/index/v2-after-interaction.png`
- `tests/evidence/wildfire/v2-light.png`
- `tests/evidence/wildfire/v2-dark.png`
- `tests/evidence/wildfire/offline-stale.png`

The Settings location form is collapsed until Add/Edit is selected. The hub switcher remains compact above search and is hidden when no saved locations exist.
