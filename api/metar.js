// Vercel serverless function: official METAR weather for up to 20 airports.
// GET /api/metar?ids=EGLL,KJFK  ->  { "t": 1794670000, "m": { "EGLL": "EGLL 141620Z ..." } }
// Source: NOAA Aviation Weather Center (public domain). Cached at Vercel's edge for 10 minutes.
module.exports = async (req, res) => {
  const ids = String((req.query && req.query.ids) || "")
    .toUpperCase().split(",").map((s) => s.trim())
    .filter((s) => /^[A-Z0-9]{3,4}$/.test(s)).slice(0, 20);
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!ids.length) { res.status(400).json({ error: "Pass ?ids=ICAO[,ICAO]" }); return; }
  try {
    const r = await fetch(`https://aviationweather.gov/api/data/metar?ids=${ids.join(",")}&format=raw`, {
      headers: { "User-Agent": "mono-radar (vercel)" },
    });
    const text = r.ok ? await r.text() : "";
    const m = {};
    for (const line of text.split("\n")) {
      const t = line.trim().replace(/^(METAR|SPECI)\s+/, "");
      const id = t.split(" ")[0];
      if (ids.includes(id) && !m[id]) m[id] = t;
    }
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1800");
    res.status(200).json({ t: Math.floor(Date.now() / 1000), m });
  } catch (e) {
    res.status(502).json({ error: "Weather source unavailable" });
  }
};
