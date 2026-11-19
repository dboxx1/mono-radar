// Vercel serverless function: counts how many people open each flight, for the Most tracked tab.
// Storage is Upstash Redis over its REST API (add it free from the Vercel Marketplace; it sets
// KV_REST_API_URL / KV_REST_API_TOKEN). Without it the endpoint says so and the app falls back.
//   POST /api/track  {hex, cs, type, reg}  -> count one view (once per person per flight per 30 min)
//   GET  /api/track                        -> top flights over the last hour or so
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmds) {
  const r = await fetch(URL_ + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).map((x) => x.result);
}
const bucket = (offset = 0) => "trk:" + (Math.floor(Date.now() / 1800000) - offset);   // half-hour buckets
const clean = (s, n) => String(s || "").replace(/[^\w\- ]/g, "").slice(0, n);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (!URL_ || !TOKEN) { res.setHeader("Cache-Control", "public, s-maxage=300"); res.status(200).json({ enabled: false, top: [] }); return; }
  try {
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      const hex = String((body && body.hex) || "").toLowerCase();
      if (!/^~?[0-9a-f]{6}$/.test(hex)) { res.status(400).json({ error: "bad hex" }); return; }
      const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
      const [first] = await redis([["SET", `seen:${ip}:${hex}`, "1", "NX", "EX", "1800"]]);
      if (first === "OK") {
        const b = bucket(), meta = JSON.stringify({ cs: clean(body.cs, 10), type: clean(body.type, 6), reg: clean(body.reg, 10) });
        await redis([["ZINCRBY", b, "1", hex], ["EXPIRE", b, "7200"], ["HSET", "trkmeta", hex, meta]]);
      }
      res.status(204).end();
      return;
    }
    // last hour: this half-hour plus the previous two
    const out = await redis([["ZUNIONSTORE", "trk:top", "3", bucket(0), bucket(1), bucket(2)], ["ZREVRANGE", "trk:top", "0", "24", "WITHSCORES"]]);
    const flat = out[1] || [], top = [];
    for (let i = 0; i < flat.length; i += 2) top.push({ hex: flat[i], n: Number(flat[i + 1]) });
    const metas = top.length ? (await redis([["HMGET", "trkmeta", ...top.map((t) => t.hex)]]))[0] || [] : [];
    top.forEach((t, i) => { try { Object.assign(t, JSON.parse(metas[i] || "{}")); } catch (e) {} });
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    res.status(200).json({ enabled: true, top });
  } catch (e) {
    res.status(200).json({ enabled: false, top: [], error: "store unavailable" });
  }
};
