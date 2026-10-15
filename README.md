# V-Land (Bangladesh 3D)

3D map of Bangladesh (divisions, districts, areas). Tap an area to see its real buildings extruded in 3D, then open the Area map in Google Maps.

## Run locally

    cd ~/Downloads/V-land-main
    npm run dev          # http://localhost:5173/

Production build test: `npm run build && npm run preview` (http://localhost:4173/).

## Fixes and changes (Oct 15-16, 2026)

Status: **Confirmed** = tested and working. **Untested** = patch applied, not yet confirmed in the browser.

### 1. Buildings no longer depend on Overpass servers (Confirmed)
- Problem: public Overpass mirrors kept returning 406, 500, 502 and 504, so buildings often failed to load.
- Fix: buildings come from local OpenStreetMap data (Geofabrik `bangladesh-latest.osm.pbf`), exported with osmium into tiles in `public/buildings/t/*.json`, with `public/buildings/index.json` as the tile index.
- Code: `tileFootprints()` in `src/buildings3d.js`. The Overpass code stays as a fallback, including the `api/overpass.js` proxy.

### 2. Building count estimate (Confirmed)
- The HUD shows `N mapped buildings / est. ~M`.
- The estimate comes from Microsoft Global ML Building Footprints (22.47M buildings in 590,537 cells), stored in `public/buildings/est.json` (8.2 MB).
- Code: `estimateCount()` in `src/buildings3d.js`.

### 3. Area map opened the wrong place (Confirmed)
- Problem: tapping Mohammadpur opened Sylhet or Barishal. The Area map button used a text search and a rough position estimated from the 3D model.
- Fix: `realBox()` in `src/main.js` looks up the tapped area in OpenStreetMap (Nominatim) to get its real bounding box. Buildings load from that real box, and the Area map opens at the same real coordinates.
- Results are cached in `localStorage`. The lookup has a 6-second time limit and falls back to the old behaviour if it fails.

### 4. Faster area loading (Confirmed: loads in about 1 s)
- The fly animation runs while the data downloads.
- Maximum buildings drawn per area lowered from 80,000 to 25,000 (`MAXS` in `src/buildings3d.js`).
- No per-building raycast when the real box is used.
- Timing logs in the browser Console: `T fetched ... ms` and `T mesh built ... ms`.

### 5. Wrong area picked when areas overlap (Untested)
- Problem: tapping Khilgaon selected Keraniganj, which is larger and overlaps it. The loading message then stayed on screen.
- Fix: `pick()` in `src/main.js` now chooses the smallest area under the tap point.

### 6. Lighter tiles ship with the site (Confirmed: live site loads in about 1 s)
- Problem: the full tiles (about 1.2 GB) stayed on one Mac, so the live site fell back to slow Overpass servers.
- Fix: `public/buildings/t/*.json` is now a reduced copy committed to git: coordinates rounded to 5 decimals, names removed, at most 600 sampled buildings per tile (1.64M of 11.6M buildings, about 181 MB).
- Full-detail tiles are kept locally in `~/osm/t_full`. Rebuild lighter tiles with `python3 ~/Downloads/bd_lite.py <cap>`.
- Trade-off: dense areas show a sample of their buildings. The "est. ~" number in the HUD still shows the real total.

## Known issues and to-do

- Dense areas such as Dhaka look thinner than the real city because of the 600-per-tile cap. A higher cap gives more buildings but a bigger deploy and slower first load.
- Nominatim is a free public service meant for light use. For many users, cache results or use a paid geocoder.
- Tall jagged walls around some area shapes come from the area model (`public/models/areas.glb`), not from the building code.
- The Area map opens at the middle of the area, not at the exact house tapped.
- If Khilgaon still resolves to Keraniganj after fix 5, the Khilgaon shape may be missing or misnamed in `areas.glb`.

## Backups

Patch backups live in `src/` as `*.before-*` files and are git-ignored. Undo a step with `cp src/main.js.before-<name> src/main.js`.

## Data sources

- Buildings: OpenStreetMap contributors (ODbL), via Geofabrik.
- Count estimate: Microsoft Global ML Building Footprints.
- Place lookup: OpenStreetMap Nominatim.
- Maps: Google Maps embed.
