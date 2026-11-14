"""Builds metars.json: the latest official METAR for every airport the app knows.

Runs in GitHub Actions every 30 minutes. Source: NOAA Aviation Weather Center
cache file (public domain US government data), https://aviationweather.gov/data/api/
"""
import csv, gzip, io, json, re, sys, time, urllib.request

SRC = "https://aviationweather.gov/data/cache/metars.cache.csv.gz"

def main(index_html, out_path):
    html = open(index_html, encoding="utf-8").read()
    wanted = set(re.findall(r'\["([A-Z0-9]{3,4})",\s*"', html))  # airport ICAO codes embedded in the app
    req = urllib.request.Request(SRC, headers={"User-Agent": "mono-radar-metar-builder (github pages)"})
    raw = urllib.request.urlopen(req, timeout=60).read()
    text = gzip.decompress(raw).decode("utf-8", "replace")
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith("raw_text"))
    rows = csv.DictReader(io.StringIO("\n".join(lines[start:])))
    out = {}
    for r in rows:
        sid = (r.get("station_id") or "").strip()
        if sid in wanted and r.get("raw_text"):
            out[sid] = r["raw_text"].strip()
    json.dump({"t": int(time.time()), "m": out}, open(out_path, "w"), separators=(",", ":"))
    print(f"{len(out)} METARs written for {len(wanted)} airports")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
