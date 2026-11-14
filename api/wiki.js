// Vercel serverless function: Wikipedia lookups and thumbnails from the app's own domain.
// Same-origin requests avoid browser privacy and blocking rules that can stop third-party calls on phones.
// GET /api/wiki?t=Heathrow_Airport          page summary (title, thumbnail)
// GET /api/wiki?s=British%20Airways%20airline  best search hit with a thumbnail
// GET /api/wiki?img=https://thumb.wikimedia.org/...  the image itself
const UA = "MonoRadar/1.0 (https://mono-radar-six.vercel.app; flight tracker)";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const q = req.query || {};
  let url, isImg = false;
  if (q.img) {
    const u = String(q.img);
    if (!/^https:\/\/(thumb|upload)\.wikimedia\.org\/[\w\-./%()~,!'*+=&?;:@]+$/.test(u)) { res.status(400).json({ error: "Image not allowed" }); return; }
    url = u; isImg = true;
  } else if (q.t) {
    const t = String(q.t).slice(0, 200);
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(t.replace(/ /g, "_"));
  } else if (q.s) {
    const s = String(q.s).slice(0, 200);
    url = "https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=320&gsrsearch=" + encodeURIComponent(s);
  } else { res.status(400).json({ error: "Missing t, s or img" }); return; }
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA, Accept: isImg ? "image/*" : "application/json" }, signal: ctl.signal, redirect: "follow" });
    clearTimeout(timer);
    if (isImg) {
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader("Content-Type", r.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", r.ok ? "public, max-age=86400, s-maxage=2592000, immutable" : "no-store");
      res.status(r.status).send(buf);
      return;
    }
    const body = await r.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", r.ok ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" : "no-store");
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ error: "Wikipedia unavailable" });
  }
};
