# EXPLAIN-IT - how to explain each part (rulebook 9.3: both students must be able to)

## Build Round 1
**The big idea.** We did not rewrite the 3D map. We wrapped it: the map is still `/`, and a second small React app (`app.html`) holds the citizen portal and the admin portal. Supabase is the database and the login system.

| Module | Plain-language explanation | Files to open | A judge might ask |
| --- | --- | --- | --- |
| Bridge | A tiny plain-JS file adds two buttons to the map and a sheet when you tap an area. It never touches the 3D code except one hook in `drill()`. | `src/portal-bridge.js`, `src/main.js` (search `__vlandAreaSheet`) | *Why not put React inside the map?* Risk: the map is hand-tuned; the bridge keeps it untouched and testable. |
| Map-to-database link | Each map area has a node name like `Dhaka__Dhaka__Uttara`; we store that exact text as `glb_key`. | `scripts/gen-geo-units.mjs`, `supabase/migrations/003_geo_units_seed.sql` | *How does a tap become a database row?* The key is passed in the URL (`?area=`) and looked up. |
| Two logins | Both use Supabase Auth. The role (`citizen` or `admin`) lives in our `profiles` table, not in anything the user can edit. Each login page rejects the other kind of account. | `src/app/auth/*`, `src/app/pages/LoginPage.tsx`, `supabase/migrations/001_core.sql` | *Can a citizen make themselves admin?* No: the role column is not in the list of columns users may update (`grant update (display_name, lang)`). |
| Row Level Security | The database itself refuses to show rows to the wrong person, even if the browser code were changed. | `001_core.sql`, `scripts/test-auth-rls.mjs` | *What if someone copies the anon key?* It only opens what policies allow: public place names, nothing else. |
| Language | One `lang` key in localStorage is shared by the map, the bridge and every React page. | `src/app/i18n/index.ts`, `src/app/locales/*` | *How do you keep Bangla and English in sync?* A test fails if a key exists in only one language. |
| Design system | Colour tokens + small components. Verdicts always use an icon and a word, not just colour. | `src/app/styles/index.css`, `src/app/components/ui/*` | *Why two reds?* `#F42A41` fails the 4.5:1 text-contrast rule on white, so it is used for fills/icons; text uses a darker red. |

Suggested split: **Student A** - map bridge, geo seed, language. **Student B** - auth, RLS, design system. Both should be able to run `npm run build` and `npm test` and read the SQL.

## Round 2: data and engine
The database holds all verification logic. The browser calls functions, never land tables. evaluate_plot runs the 20 rules in risk_rules and returns a verdict. The 15 SCN plots are the test suite. reset_demo_data() restores them from a snapshot. Sample judge question: why can an anonymous visitor not read plots? Answer: row level security is on and only functions are exposed.
