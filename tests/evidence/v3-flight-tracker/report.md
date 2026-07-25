# V3 Flight Tracker — provider and verification record

Originally verified on branch `v3/multiple-locations`; released in `v3.0.0`.

## Provider due diligence

Official surfaces inspected:

- Documentation: <https://aviationstack.com/documentation>
- Product/pricing: <https://aviationstack.com/product>
- Free signup: <https://aviationstack.com/signup/free>
- API endpoint: <https://api.aviationstack.com/v1/flights>

Observed from the official product page:

- Personal Free tier shown at $0/month.
- 100 requests are advertised for that tier.
- HTTPS Encryption is listed.

Observed from a direct unauthenticated endpoint probe:

```text
GET https://api.aviationstack.com/v1/flights?flight_iata=AA100
HTTP/2 401
content-type: application/json; Charset=UTF-8
access-control-allow-methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS
access-control-allow-origin: *

{
  "error": {
    "code": "missing_access_key",
    "message": "You have not supplied an API Access Key. [Required format: access_key=YOUR_ACCESS_KEY]"
  }
}
```

This verifies the browser-facing endpoint and CORS surface without claiming that a real keyed
flight payload was fetched. The signup form requires third-party identity/account information
(first name, last name, email, password) and acceptance of APIlayer terms/privacy processing.
Local Suite/Hermes cannot truthfully supply those facts or accept those terms for the user, so no
account was created and no credential was fabricated or committed.

## Deterministic functional verification

`node tests/verify-tool.mjs flight` completed with exit code 0 and generated:

- `tests/evidence/flight/v2-light.png`
- `tests/evidence/flight/v2-dark.png`
- `tests/evidence/flight/v2-after-interaction.png`
- `tests/evidence/flight/mobile.png`
- `tests/evidence/flight/interaction.txt`
- `tests/evidence/flight/localstorage.json`

The route-fulfilled provider fixture verifies:

- missing-key setup state;
- malformed flight-number rejection before any request;
- dated flight identity and no-match handling;
- provider key rejection and request-limit messaging;
- airline, status, route, actual departure, estimated arrival, terminal, and gate rendering;
- countdown, altitude, speed, aircraft registration, coordinates, heading, position freshness;
- world-map aircraft marker;
- cache identity by normalized flight number plus service date;
- stale/offline fallback with explicit labeling;
- API key not rendered into page text;
- 390 px mobile layout without horizontal overflow.

`node tests/flight-built.mjs` result:

```text
built flight tracker: PASS {"title":"AA100","route":["JFK","LAX"],"mapVisible":true,"keyExposed":false,"cspAllowsProvider":true,"cached":true}
```

The built deep-link test verifies `dist/flight.html?flight=AA100&date=...`, generated CSP access to
`api.aviationstack.com`, result rendering, map visibility, cache persistence, and non-disclosure of
the key in page text.

## Build gates

```text
manifest: 73 tools + hub  (71 v1 migrations, 2 suite-native)
--check: all fatal gates green
smoke: 74/74 green
```

## Live keyed verification

After the user explicitly authorized use of their personal credential, real provider probes found
that Aviationstack returned status/schedule/ETA records but no `live` objects among 100 active
records. The implementation was therefore extended to resolve Aviationstack's `aircraft.icao24`
through the keyless Airplanes.live ADS-B endpoint when the selected active flight lacks position.

A built `file://` browser verification then tracked a real JL80 instance:

```text
flight: JL80
status: active
route: PVG → HND
arrival: Jul 17, 10:13 PM GMT+9
map visible: yes
position source: Airplanes.live ADS-B
coordinates present: yes
api.aviationstack.com: HTTP 200
api.airplanes.live: HTTP 200
console errors: 0
key visible in page text: no
```

Seven Aviationstack requests were consumed across provider diagnosis and final browser
verification. The credential was not written to repository files, evidence, generated HTML, or
the final report. Normal use still requires the account owner to save the key in their own browser
through Settings as `suite.key.aviationstack`.
