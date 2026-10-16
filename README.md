# V-Land - Citizen Pre-Purchase Verification (LandTech 2026, problem P5)

V-Land turns an interactive **3D map of Bangladesh** into the front door of a *"check before you buy"* service: a citizen finds a plot, names the seller and gets a **Clear / Caution / Stop** verdict backed by ownership, mutation, court-case and khas/acquisition evidence, in Bangla or English.

> **Status: Build Round 1 of 5 complete** (foundation: portals, logins, design system, Supabase base). The verification engine arrives in Round 2 and the citizen check flow in Round 3. See `docs/PLAN.md`.

## Synthetic-data statement
All data in this project is **synthetic**. No real person, NID number, phone number, address or land record is stored, collected or displayed (rulebook 8.1, 8.2). No government portal is scraped or queried (8.3). Every page shows a **"Demo data, not real records"** ribbon. Security features are demonstrated only on our own prototype (8.4).

## AI tool disclosure (rulebook 9.2)
**Claude (Anthropic)** was used for planning and for generating code and documentation. The student members reviewed the output and are responsible for being able to explain it (`docs/EXPLAIN-IT.md`).

## Quick start (about 10 minutes)
```bash
npm ci
cp .env.example .env.local      # then fill in the two Supabase values
npm run dev                      # http://localhost:5173
```
1. Create a free project at supabase.com (pick the region closest to Bangladesh: Singapore / South Asia).
2. Put **Project URL** and the **anon (publishable) key** into `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Never use the service-role key in the browser.
3. In Supabase **SQL Editor**, run `supabase/migrations/001_core.sql`.
4. **Authentication → Users → Add user** (tick *Auto Confirm User*) for the two demo accounts below.
5. Run `002_demo_roles.sql`, then `003_geo_units_seed.sql` (expect: area 546, district 64, division 8).
6. Optional proof of the access rules: `npm run test:rls`.

### Demo-only credentials
| Portal | URL | Email | Password |
| --- | --- | --- | --- |
| Citizen | `/portal/login` | citizen.demo@example.com | Citizen@2026 |
| Admin | `/admin/login` | admin.demo@example.com | Admin@2026 |

These are **demo-only** credentials with dummy passwords. If Supabase refuses the addresses, use any address you control and edit `002_demo_roles.sql` and `src/app/lib/demo.ts`.

## Scripts
`npm run dev` · `build` · `preview` · `typecheck` · `lint` · `test` (Vitest) · `test:e2e` (Playwright; first run `npx playwright install`) · `test:rls` · `gen:geo` (regenerate the geo seed from the 3D models)

## Routes
| URL | What |
| --- | --- |
| `/` | The 3D map (original), plus **Verify a Plot** and **Sign in** buttons; tapping an area opens *Verify plots here / Open satellite map* |
| `/portal`, `/portal/verify`, `/portal/my` | Citizen portal (home and verify are public) |
| `/portal/login`, `/admin/login` | Separate logins; each rejects the other's account |
| `/admin` | Admin console shell (modules arrive in Round 4) |
| `/verify/:code` | Public certificate page (Round 3) |
| `/portal/_ui` | Component gallery, development only |

## Data sources and runtime third parties
Synthetic data only (Round 2 adds the generator). The 3D map and Mapping tool load, at run time: Esri World Imagery and OpenStreetMap tiles, Nominatim search, a Google Maps embed (the *Open satellite map* action). Fonts are self-hosted.

## Credits and licences
| Library / service | Use | Licence |
| --- | --- | --- |
| three.js | 3D map | MIT |
| Leaflet | Mapping tool | BSD-2-Clause |
| Esri World Imagery, OpenStreetMap (ODbL), Nominatim | Map tiles and place search | Provider terms; credited |
| Google Maps embed | Satellite view from the area sheet | Google terms |
| React, React DOM, React Router | Portal UI and routing | MIT |
| TanStack Query | Data fetching (used from Round 3) | MIT |
| Zod | Form validation (used from Round 3) | MIT |
| Tailwind CSS, PostCSS, Autoprefixer | Styling | MIT |
| lucide-react | Icons | ISC |
| clsx, tailwind-merge | Class helpers | MIT |
| Noto Sans Bengali, Inter (via @fontsource) | Typography | SIL OFL 1.1 |
| Supabase JS, Supabase platform (Postgres, Auth) | Backend | MIT / Apache-2.0 |
| Vite, @vitejs/plugin-react | Build tool | MIT |
| TypeScript, ESLint, typescript-eslint, Prettier | Tooling | Apache-2.0 / MIT |
| Vitest, jsdom, Playwright | Tests | MIT / MIT / Apache-2.0 |

## Changes since Round 1
_(none yet - this section is filled in before the Final, rulebook 7.5)_

## Documentation
`docs/PLAN.md` (full plan) · `docs/CONTEXT.md` (rulebook digest) · `docs/ARCHITECTURE.md` · `docs/EXPLAIN-IT.md` · `docs/LEGACY_MAP_CHECKLIST.md` · `docs/rounds/` (a report per build round) · `docs/source/` (the files this project was started from: the rulebook and the plan)

Decision support, not legal advice.


---

# Map fixes (Oct 15-16, 2026)

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

## Changes since Round 1
- Round 2: 25+ table schema with row-level security; 20-rule verdict engine in SQL; 15 scripted scenarios; signed certificates with change detection; hash-chained audit log; synthetic data (about 2,400 plots); `npm run test:engine`.
- Round 3 (partial): citizen check wizard with certificate issue.
- Round 4 (partial): audited admin functions and an admin console; `npm run test:admin`, `npm run audit:rls`, `npm run scan:secrets`, `npm run demo:tamper`.
- Round 5 (partial): report-only Content-Security-Policy and security headers; PRIVACY, QA-PREP, DEMO_SCRIPT and CONCEPT_NOTE docs.

## Changes since Round 1
- Round 2: 25+ table schema with row-level security; 20-rule verdict engine in SQL; 15 scripted scenarios; signed certificates with change detection; hash-chained audit log; synthetic data (about 2,400 plots); `npm run test:engine`.
- Round 3 (partial): citizen check wizard with certificate issue.
- Round 4 (partial): audited admin functions and an admin console; `npm run test:admin`, `npm run audit:rls`, `npm run scan:secrets`, `npm run demo:tamper`.
- Round 5 (partial): report-only Content-Security-Policy and security headers; PRIVACY, QA-PREP, DEMO_SCRIPT and CONCEPT_NOTE docs.
