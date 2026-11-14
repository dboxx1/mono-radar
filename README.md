# Mono Radar

A free live flight tracker that runs in the browser and installs to your home screen.


## Features
- Live aircraft from community ADS-B networks (adsb.lol, airplanes.live, adsb.fi, OpenSky)
- Full-width flight card with route, progress, photos, a 3D follow view and sharing
- Airports with live arrivals and departures boards, runways in use, official METAR weather
- What's overhead, a sky view for pointing your phone at planes, and nearby alerts
- Saved flights with live updates, a personal flight log with stats and a route map
- Altitude colours, weather radar, day and night shading, vector maps (OpenFreeMap)

## Hosting (Vercel)
Import this repo in Vercel (Add New → Project → `dboxx1/mono-radar`). No build settings needed:
it's a static site plus one serverless function, `api/metar.js`, which fetches official airport
weather server-side and caches it for 10 minutes.

If your Vercel domain isn't `mono-radar.vercel.app`, update `METAR_HOST` in `index.html`
(the native iPhone app uses it to reach the weather function).

## Install on iPhone
Open the site in Safari → Share → **Add to Home Screen**.

## Credits
Aircraft: adsb.lol (ODbL), airplanes.live, adsb.fi, OpenSky Network. Routes: adsbdb, hexdb.io.
Photos: Planespotters.net, Airport-Data.com, Wikipedia. Weather: Open-Meteo (CC BY 4.0),
NOAA Aviation Weather Center (METAR), RainViewer. Map: OpenFreeMap / OpenMapTiles / OpenStreetMap
contributors, MapLibre. Airports and runways: OurAirports (public domain). Free for personal use.
