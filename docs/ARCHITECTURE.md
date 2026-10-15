# Architecture (skeleton - grows each build round)

```
Browser
 ├─ index.html  -> src/main.js            3D map (vanilla JS, three.js, Leaflet). UNCHANGED except the allowed edits.
 │                 └─ src/portal-bridge.js  "Verify a Plot" + "Sign in" buttons, area sheet (plain JS)
 └─ app.html    -> src/app/main.tsx       React app: /portal/*, /admin/*, /verify/*
                   ├─ auth/      AuthProvider, RequireRole, 30-min admin idle logout
                   ├─ i18n/      t(), useLang()  (shares the `lang` localStorage key with the map)
                   ├─ components/ui/  design system (see /portal/_ui in dev)
                   └─ layouts/   PortalLayout, AdminLayout, AuthLayout
Supabase (Postgres + Auth)
 ├─ profiles (role: citizen|admin)    RLS: own row only; role is NOT updatable by users
 ├─ geo_units (8 + 64 + 546 rows)     public reference data; glb_key links a map area to a row
 └─ mouzas                            RLS on, no public policy
```

## Rules that hold in every round
1. The browser never reads land tables directly; later rounds expose **functions (RPC)** only.
2. The verdict is computed in the database, never in the browser.
3. Only the anon key reaches the browser. The service-role key and signing secret never enter the bundle or git.
4. Legacy map files change only where `docs/PLAN.md` section 2 allows.

## Routing
`vite.config.js` (dev + preview) and `vercel.json` (production) send `/portal/*`, `/admin/*`, `/verify/*` to `app.html`; everything else is the 3D map.

## The link between the map and the database
A map area is identified by its 3D node name, for example `Dhaka__Dhaka__Uttara`. `scripts/gen-geo-units.mjs` reads those names from `public/models/*.glb` and writes `supabase/migrations/003_geo_units_seed.sql`, so `geo_units.glb_key` matches the map exactly.

_Round 2 adds the land-record tables, the verification engine and certificate signing._
