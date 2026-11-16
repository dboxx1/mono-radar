// Vercel serverless function: live US airport delays from the FAA's NAS status feed.
// GET /api/faa  ->  { "updated": "Mon Nov 16 09:05:45 2026 GMT", "airports": { "JFK": [ { "k": "gdp", ... } ] } }
// k: "stop" ground stop, "gdp" ground delay program, "arr"/"dep" arrival/departure delays, "closed" closure.
// Source: nasstatus.faa.gov (US government work, public domain). Cached at Vercel's edge for 2 minutes.
const tag = (s, t) => { const m = s.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`)); return m ? m[1].replace(/\s+/g, " ").trim() : ""; };
const all = (s, t) => [...s.matchAll(new RegExp(`<${t}(\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "g"))].map((m) => ({ a: m[1] || "", b: m[2] }));
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const r = await fetch("https://nasstatus.faa.gov/api/airport-status-information", { headers: { "User-Agent": "mono-radar (vercel)", Accept: "application/xml" } });
    if (!r.ok) throw new Error("FAA " + r.status);
    const x = await r.text();
    const out = {};
    const add = (ap, e) => { ap = ap.toUpperCase(); if (/^[A-Z0-9]{3,4}$/.test(ap)) (out[ap] = out[ap] || []).push(e); };
    for (const l of all(x, "Ground_Stop_List")) for (const p of all(l.b, "Program")) add(tag(p.b, "ARPT"), { k: "stop", reason: tag(p.b, "Reason"), until: tag(p.b, "End_Time") });
    for (const l of all(x, "Ground_Delay_List")) for (const p of all(l.b, "Ground_Delay")) add(tag(p.b, "ARPT"), { k: "gdp", reason: tag(p.b, "Reason"), avg: tag(p.b, "Avg"), max: tag(p.b, "Max") });
    for (const l of all(x, "Arrival_Departure_Delay_List")) for (const p of all(l.b, "Delay")) {
      const ap = tag(p.b, "ARPT"), reason = tag(p.b, "Reason");
      for (const ad of all(p.b, "Arrival_Departure")) {
        const ty = (ad.a.match(/Type="([^"]+)"/i) || [])[1] || "";
        add(ap, { k: /arr/i.test(ty) ? "arr" : "dep", reason, min: tag(ad.b, "Min"), max: tag(ad.b, "Max"), trend: tag(ad.b, "Trend") });
      }
    }
    for (const l of all(x, "Airport_Closure_List")) for (const p of all(l.b, "Airport")) add(tag(p.b, "ARPT"), { k: "closed", reason: tag(p.b, "Reason"), start: tag(p.b, "Start"), reopen: tag(p.b, "Reopen") });
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({ updated: tag(x, "Update_Time"), airports: out });
  } catch (e) {
    res.status(502).json({ error: "FAA status unavailable" });
  }
};
