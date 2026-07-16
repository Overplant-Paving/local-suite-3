/* Independent sanity recomputation for tests/evidence/passes/ (Batch D).
   Recomputes one pass of CSS (TIANHE) from the SAME archived TLE fixture used by
   tests/interactions/passes.mjs, via a from-scratch Kepler + J2-secular propagator
   (NOT the tool's SGP4 port: no SGP4 init, no drag terms, no short-period corrections,
   independent Kepler solver / rotations / GMST / geodetic code written from textbook
   formulas). Expected agreement vs full SGP4 near epoch: peak elevation within ~2.5 deg,
   peak time within ~120 s (short-period J2 terms ~10 km are the dominant omission).

   Tool's own result (tests/evidence/passes/interaction.txt, "precise passes" line,
   observer Los Angeles 34.0522 -118.2437, minEl 10, T=2026-07-16T04:00:00Z):
     CSS (TIANHE) 48274: startJd 2461237.690509279, maxJd 2461237.6938889106,
                         endJd 2461237.6974537275, maxEl 22.418 deg, maxAz 7.06 deg */

const L1 = "1 48274U 21035A   26196.53543323  .00001219  00000+0  20014-4 0  9991";
const L2 = "2 48274  41.4690 149.7716 0002229 300.3824  59.6794 15.58093729297592";
const TOOL = { startJd: 2461237.690509279, maxJd: 2461237.6938889106, endJd: 2461237.6974537275, maxEl: 22.418, maxAz: 7.06 };
const OBS = { lat: 34.0522, lon: -118.2437, hKm: 0 };

const PI = Math.PI, TWOPI = 2 * PI, DEG = PI / 180;
const MU = 398600.8, RE = 6378.135, J2 = 0.001082616; // WGS72, same constants as the tool

/* --- TLE elements --- */
const epochyr = 2000 + parseInt(L1.substring(18, 20), 10);
const epochdays = parseFloat(L1.substring(20, 32));
const inc = parseFloat(L2.substring(8, 16)) * DEG;
const raan0 = parseFloat(L2.substring(17, 25)) * DEG;
const ecc = parseFloat("0." + L2.substring(26, 33).trim());
const argp0 = parseFloat(L2.substring(34, 42)) * DEG;
const M0 = parseFloat(L2.substring(43, 51)) * DEG;
const n0Kozai = parseFloat(L2.substring(52, 63)) * TWOPI / 1440; // rad/min

const epochMs = Date.UTC(epochyr, 0, 1) + (epochdays - 1) * 86400000;
const jdEpoch = 2440587.5 + epochMs / 86400000;

/* --- Brouwer mean motion (un-Kozai) + J2 secular rates --- */
const ke = 60 / Math.sqrt(RE * RE * RE / MU); // sqrt(mu) in er^1.5/min
const k2 = J2 / 2, th = Math.cos(inc), th2 = th * th;
const b32 = Math.pow(1 - ecc * ecc, 1.5);
const a1 = Math.pow(ke / n0Kozai, 2 / 3);
const d1 = 1.5 * k2 * (3 * th2 - 1) / (b32 * a1 * a1);
const a2 = a1 * (1 - d1 / 3 - d1 * d1 - (134 / 81) * d1 * d1 * d1);
const d0 = 1.5 * k2 * (3 * th2 - 1) / (b32 * a2 * a2);
const n = n0Kozai / (1 + d0);                 // rad/min
const a = Math.pow(ke / n, 2 / 3);            // earth radii
const p = a * (1 - ecc * ecc), p2 = p * p;
const raandot = -1.5 * J2 * n * th / p2;                                  // rad/min
const argpdot = 0.75 * J2 * n * (5 * th2 - 1) / p2;
const mdot = n * (1 + 0.75 * J2 * Math.sqrt(1 - ecc * ecc) * (3 * th2 - 1) / p2);

/* --- GMST (IAU 1982, written from the textbook expression) --- */
function gmst(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  let s = 67310.54841 + (876600 * 3600 + 8640184.812866) * T + 0.093104 * T * T - 6.2e-6 * T * T * T;
  s = ((s % 86400) + 86400) % 86400;
  return s / 240 * DEG; // 86400 s = 360 deg -> 1 s = 1/240 deg
}

/* --- observer ECEF (WGS84 geodetic) --- */
const latR = OBS.lat * DEG, lonR = OBS.lon * DEG;
const wa = 6378.137, f = 1 / 298.257223563, e2 = f * (2 - f);
const sinLat = Math.sin(latR), cosLat = Math.cos(latR), sinLon = Math.sin(lonR), cosLon = Math.cos(lonR);
const N = wa / Math.sqrt(1 - e2 * sinLat * sinLat);
const oEcef = { x: (N + OBS.hKm) * cosLat * cosLon, y: (N + OBS.hKm) * cosLat * sinLon, z: (N * (1 - e2) + OBS.hKm) * sinLat };

function elevation(jd) {
  const t = (jd - jdEpoch) * 1440; // min since epoch
  const M = M0 + mdot * t, argp = argp0 + argpdot * t, raan = raan0 + raandot * t;
  /* Kepler: Newton iteration */
  let E = M % TWOPI;
  for (let i = 0; i < 12; i++) E = E - (E - ecc * Math.sin(E) - (M % TWOPI)) / (1 - ecc * Math.cos(E));
  const nu = Math.atan2(Math.sqrt(1 - ecc * ecc) * Math.sin(E), Math.cos(E) - ecc);
  const r = a * (1 - ecc * Math.cos(E)) * RE; // km
  const u = argp + nu;
  const cO = Math.cos(raan), sO = Math.sin(raan), cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(inc), si = Math.sin(inc);
  const x = r * (cO * cu - sO * su * ci), y = r * (sO * cu + cO * su * ci), z = r * su * si; // TEME-ish ECI
  const g = gmst(jd), cg = Math.cos(g), sg = Math.sin(g);
  const xe = cg * x + sg * y, ye = -sg * x + cg * y, ze = z; // ECEF
  const rx = xe - oEcef.x, ry = ye - oEcef.y, rz = ze - oEcef.z;
  const e_ = -sinLon * rx + cosLon * ry;
  const n_ = -sinLat * cosLon * rx - sinLat * sinLon * ry + cosLat * rz;
  const u_ = cosLat * cosLon * rx + cosLat * sinLon * ry + sinLat * rz;
  const rng = Math.sqrt(rx * rx + ry * ry + rz * rz);
  let az = Math.atan2(e_, n_); if (az < 0) az += TWOPI;
  return { el: Math.asin(u_ / rng) / DEG, az: az / DEG, rng };
}

/* scan the tool's pass window +/- 5 min in 1 s steps */
let best = { el: -90, jd: 0 };
for (let jd = TOOL.startJd - 5 / 1440; jd <= TOOL.endJd + 5 / 1440; jd += 1 / 86400) {
  const o = elevation(jd);
  if (o.el > best.el) best = { el: o.el, az: o.az, jd };
}
const jdToDate = jd => new Date((jd - 2440587.5) * 86400000);
const atToolMax = elevation(TOOL.maxJd);
console.log("Independent Kepler+J2-secular recomputation, CSS (TIANHE) 48274");
console.log("  elements: a=%s er, e=%s, i=%s deg, n=%s rad/min (un-Kozai)",
  a.toFixed(6), ecc, (inc / DEG).toFixed(4), n.toFixed(8));
console.log("  independent peak: el=%s deg az=%s deg at %s (jd %s)",
  best.el.toFixed(3), best.az.toFixed(2), jdToDate(best.jd).toISOString(), best.jd.toFixed(7));
console.log("  tool (SGP4) peak: el=%s deg az=%s deg at %s (jd %s)",
  TOOL.maxEl, TOOL.maxAz, jdToDate(TOOL.maxJd).toISOString(), TOOL.maxJd.toFixed(7));
console.log("  independent el at tool's maxJd: %s deg", atToolMax.el.toFixed(3));
const dEl = best.el - TOOL.maxEl, dT = (best.jd - TOOL.maxJd) * 86400;
console.log("  delta: peak el %s deg, peak time %s s", dEl.toFixed(3), dT.toFixed(1));
console.log("  verdict:", Math.abs(dEl) <= 2.5 && Math.abs(dT) <= 120 ? "WITHIN TOLERANCE (|dEl|<=2.5 deg, |dt|<=120 s)" : "OUT OF TOLERANCE");
