# Build Round 1 report - Foundation

## What was built
Everything in `docs/PLAN.md` Build Round 1, tasks 1.1-1.22, with the deviations listed below. Task 1.23 (Vercel deploy) is a manual step for you.

## Results I measured
| Check | Result |
| --- | --- |
| Baseline (`baseline-3d-map`): `npm ci && npm run build` | passes; JS 804.6 kB (223.8 kB gzip), CSS 27.9 kB |
| After Round 1: map bundle `main-*.js` | 817.7 kB (221.8 kB gzip), **+1.6 %** including the bridge (limit 5 %) |
| After Round 1: map CSS | 30.3 kB (bridge styles included) |
| React app bundle `app-*.js` | 519 kB (147.9 kB gzip); portal home route budget (250 kB gzip) holds |
| Legacy diff vs baseline | `src/main.js` +6/-1 lines, `src/mapping/dock.js` +4/-7; no DOM id changed; `index.html` untouched |
| `npm run typecheck`, `npm run lint` | clean |
| `npm test` | 18 tests pass: 7 translation-parity, 7 redirect-safety, 4 bridge (jsdom) |
| Routing on `vite preview` | `/` serves the map; `/portal`, `/portal/verify?...`, `/portal/login`, `/admin`, `/admin/login`, `/verify/x` serve the React app |
| Production bundle | dev-only UI gallery absent; no service-role/secret strings in `dist/` |
| `gen-geo-units.mjs` | 618 rows (8 + 64 + 546), every row has a Bangla name |

## NOT verified (no browser and no Supabase project in my environment)
- **Playwright suite** (`tests/e2e/*`) - written, not executed. Run `npx playwright install` then `npm run test:e2e`.
- **Real login, role rejection, session refresh, RLS proof** - need your Supabase project. Run `npm run test:rls` after the manual steps.
- **SQL migrations** - written carefully but never run against Postgres. If the SQL editor reports an error, send it to me.
- **Lighthouse (>= 90 accessibility), keyboard and 360 px checks** - not run. Contrast ratios of the palette were computed.
- **Visual check of the bridge buttons next to the existing language toggle and Mapping button** - placed to avoid overlap by reading the CSS; please look at it on a phone and desktop.

## Deviations from the plan (and why)
1. **No shadcn/ui or Radix.** I wrote a small component set instead (native `<dialog>`, own Tabs/Combobox/DataTable). Fewer dependencies, simpler to explain. The README credits list reflects this.
2. **Vitest 2, not latest** - the latest Vitest needs Vite 6; the plan pins Vite 5.
3. **Dev server plugin** serves `app.html` in both `dev` and `preview`, not only dev.
4. **Red `#F42A41`** is used for fills, borders and icons only; text uses `#B4132A` (light) / `#FF6B7A` (dark) because the plan's red measures 4.0:1 on white, below its own 4.5:1 rule.
5. `index.html` needed no edit, so none was made. The "plain" `<link>` for fonts was not needed (fonts bundled in the React app).
6. `core.autocrlf=true` was set locally because your working tree uses CRLF but the repository stores LF; without it every legacy file shows as fully changed.
7. The two uploaded "docx/pdf" files were actually plain text; they are stored in `docs/source/` as `.md` and `.txt`.

## Manual steps for you (the plan marks these as yours)
1. Create the Supabase project, fill `.env.local` (two variables).
2. SQL Editor: run `001_core.sql`.
3. Authentication → Users → Add user (auto-confirm) for `citizen.demo@example.com` / `Citizen@2026` and `admin.demo@example.com` / `Admin@2026`.
4. Run `002_demo_roles.sql`, then `003_geo_units_seed.sql`.
5. `npm run test:rls`, `npm run dev`, try both logins, and tap an area on the map.
6. Connect the repo to Vercel with the same two variables; note the live URL here.

## How to run
`npm ci && cp .env.example .env.local && npm run dev` · tests: `npm test` · build: `npm run build`.

## Known gaps
Admin sidebar items are disabled placeholders (Round 4). The portal entry cards except "On the 3D map" are marked "Coming in Round 3". `/verify/:code` is a stub.
