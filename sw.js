// Mono Radar service worker: makes the app installable and opens instantly.
// Live data (planes, photos, weather) always comes from the network.
const CACHE = "mono-radar-v53";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // The app page: network first so updates arrive, cached copy when offline
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); return r; }).catch(() => caches.match("./index.html")));
    return;
  }
  // Icons and the manifest: cache first
  if (url.origin === location.origin && /\/(icons\/|manifest\.webmanifest)/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  // Map library and fonts: stale-while-revalidate
  if (/unpkg\.com\/(maplibre-gl|three@)|cdn\.jsdelivr\.net\/npm\/three@|fonts\.(googleapis|gstatic)\.com/.test(url.href)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => { const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit); return hit || net; })));
  }
});
