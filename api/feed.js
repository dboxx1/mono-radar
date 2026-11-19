// Vercel serverless function: relays the free live-aircraft feeds, which don't allow
// browser requests from other websites (CORS). Only known read-only paths are allowed.
// GET /api/feed?src=adsblol&q=v2%2Fpoint%2F51.47%2F-0.46%2F25
const SOURCES = {
  adsblol: { base: "https://api.adsb.lol/", ok: /^v2\/(point|callsign|registration|hex|sqk|type)\/[\w\/.\-]+$|^v2\/mil$/ },
  airplanes: { base: "https://api.airplanes.live/", ok: /^v2\/(point|callsign|reg|hex|squawk|type)\/[\w\/.\-]+$|^v2\/mil$/ },
  adsbfi: { base: "https://opendata.adsb.fi/api/", ok: /^v2\/(lat|callsign|registration|hex|sqk)\/[\w\/.\-]+$|^v2\/mil$/ },
  opensky: { base: "https://opensky-network.org/api/", ok: /^(states\/all|tracks\/all)\?[\w=&.\-]*$/ },
  // Full-day position history for one aircraft (readsb trace files), used to draw the real flown path
  trace_adsblol: { base: "https://globe.adsb.lol/data/traces/", ok: /^[0-9a-f]{2}\/trace_(full|recent)_[0-9a-f]{6}\.json$/, ttl: 20 },
  trace_airplanes: { base: "https://globe.airplanes.live/data/traces/", ok: /^[0-9a-f]{2}\/trace_(full|recent)_[0-9a-f]{6}\.json$/, ttl: 20 },
  trace_adsbfi: { base: "https://globe.adsb.fi/data/traces/", ok: /^[0-9a-f]{2}\/trace_(full|recent)_[0-9a-f]{6}\.json$/, ttl: 20 },
};
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const src = SOURCES[(req.query && req.query.src) || ""];
  const q = String((req.query && req.query.q) || "");
  if (!src || !src.ok.test(q)) { res.status(400).json({ error: "Unknown feed or path" }); return; }
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
    const isTrace = src.base.includes("/data/traces/");
    const r = await fetch(src.base + q, { headers: { "User-Agent": "Mozilla/5.0 (compatible; mono-radar)", Accept: "application/json", ...(isTrace ? { Referer: src.base.replace(/data\/traces\/$/, "") } : {}) }, signal: ctl.signal });
    clearTimeout(timer);
    const body = await r.text();
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    // zoomed-out map tiles (fixed worldwide grid: lat on .5, radius 250) are shared between users for longer
    const tile = /\/-?\d+\.5000\/.*\/250$/.test(q), byType = /^v2\/type\//.test(q);
    // worldwide lists by aircraft type (Most tracked tab) change slowly: share them for a minute
    res.setHeader("Cache-Control", r.ok ? `public, s-maxage=${src.ttl || (byType ? 60 : tile ? 12 : 4)}, stale-while-revalidate=${byType ? 60 : tile ? 20 : 10}` : "no-store");
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ error: "Feed unavailable" });
  }
};
