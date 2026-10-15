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
