# Changelog

## Build Round 1 - Foundation
- Added the React app (`app.html`, `src/app`) beside the unchanged 3D map; two Vite entries.
- Map bridge: **Verify a Plot** + **Sign in** buttons and the area sheet (`src/portal-bridge.*`); two allowed edits in `src/main.js`; `src/mapping/dock.js` now finds the tools panel by `#tools`.
- Supabase: `001_core.sql` (profiles, roles, `is_admin()`, `geo_units`, `mouzas`, RLS), `002_demo_roles.sql`, generated `003_geo_units_seed.sql` (8 + 64 + 546 rows).
- Citizen and admin logins with role checks, safe redirects and a 30-minute admin idle timeout.
- Design system, Bangla/English UI with a parity test, DemoRibbon, light/dark themes, large-text switch.
- Tests: Vitest (translations, redirect safety, bridge), Playwright suite, RLS script.
