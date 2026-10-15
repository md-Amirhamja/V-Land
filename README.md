
## Update (Oct 16, 2026): lighter tiles ship with the site

- `public/buildings/t/*.json` is now a reduced copy of the building tiles (coordinates rounded to 5 decimals, names removed, at most 600 sampled buildings per tile, 1.64M of 11.6M buildings), committed to git so the live site loads buildings in about 1 s without Overpass.
- Full-detail tiles are kept locally in `~/osm/t_full`. Rebuild lighter tiles with `python3 ~/Downloads/bd_lite.py <cap>`.
- Trade-off: dense areas show a sample of their buildings. The "est. ~" number in the HUD still shows the real total.
