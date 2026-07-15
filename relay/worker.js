/**
 * Local Suite relay — a minimal CORS proxy for the few public data sources
 * that block direct browser access. Deployed once by the suite maintainer on
 * Cloudflare Workers (free tier); the URL ships as the suite's built-in default.
 *
 * This is NOT a general proxy: it will only fetch from the hosts in ALLOW.
 * Usage:  https://<worker>.workers.dev/?url=<encoded upstream URL>
 */

const ALLOW = new Set([
  "aviationweather.gov",   // airport.html — METARs/TAFs
  "nasstatus.faa.gov",     // airport.html — FAA delay status
  "api.bls.gov",           // jobs.html + inflation.html — CPI, unemployment
  "www.ndbc.noaa.gov",     // marine.html — optional buoy feeds
  // add your transit agency's GTFS host here if you use a custom feed
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return reply(400, { error: "missing ?url= parameter" });
    }

    let upstream;
    try {
      upstream = new URL(target);
    } catch {
      return reply(400, { error: "invalid url" });
    }
    if (upstream.protocol !== "https:" || !ALLOW.has(upstream.hostname)) {
      return reply(403, { error: "host not allowed", host: upstream.hostname });
    }

    const init = {
      method: request.method,
      headers: { "User-Agent": "local-suite-relay (personal use)" },
    };
    if (request.method === "POST") {
      init.body = request.body;
      init.headers["Content-Type"] =
        request.headers.get("Content-Type") || "application/json";
    } else {
      // let Cloudflare's edge cache absorb repeat GETs — be a good citizen
      init.cf = { cacheTtl: 300, cacheEverything: true };
    }

    const res = await fetch(upstream.toString(), init);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    headers.set("Cache-Control", "public, max-age=300");
    return new Response(res.body, { status: res.status, headers });
  },
};

function reply(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
