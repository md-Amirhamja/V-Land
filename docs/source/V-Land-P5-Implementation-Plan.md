# V-Land P5 — Citizen Pre-Purchase Verification: Implementation Plan

Oct 15, 2026 · @Arghya

## 1. Vision, scope and ground rules

V-Land P5 turns your existing 3D Bangladesh map into the front door of a "check before you buy" service: a citizen finds a plot, names the seller, and gets a **Clear, Caution or Stop** verdict backed by ownership, mutation, court-case and khas/acquisition evidence, in Bangla or English. The build is split into five AI rounds, and each round ends with a site that runs and can be demoed.

**Deadline check.** The rulebook sets the LandTech Round 1 submission deadline at October 16, 2026, which is tomorrow (today is October 15). Please confirm on the LandTech platform that it still stands. This plan is ordered so that a complete citizen flow exists after Build Round 3; Rounds 4 and 5 then become the improvements the rulebook allows before the Final (rule 6.2.2), which the README must summarise (rule 7.5).

**Two kinds of ****"****round****"****.** *Competition Round* means LandTech Round 1 or the Final. *Build Round* means one of the five AI work sessions in this plan.

### The problem in Bangladesh terms

- Land disputes come from forged deeds, conflicting khatians across survey generations (CS, SA, RS, BS), and records split between the sub-registry (registration) and the AC Land office (mutation).

- Today a buyer reads a porcha, checks mutation status, checks land tax and asks around about court cases, usually in different offices or portals, then interprets the result alone.

- V-Land P5 does the interpretation: one query, one explainable verdict, one tamper-evident certificate.

### Who uses it

| Persona | Need | What they get |
| --- | --- | --- |
| Rahim, first-time buyer on a phone, Bangla-first | "Is this plot safe to buy from this seller?" | Verdict, plain-language reasons, next steps, a checklist |
| Nasrin, lawyer or bank officer | Evidence she can attach to a file and trust | QR-verifiable certificate, evidence trail, share link |
| Land officer (admin) | Keep records correct and spot fraud early | Records console, fraud signals, audit log |

### How the plan meets the rulebook

| Rule | What it requires | How the plan complies |
| --- | --- | --- |
| Section 3, P5 | Verify ownership, mutation history, pending cases, khas or acquisition status before a transaction | The whole product; every item is a section of the Plot Dossier |
| Track | Digital land records, verification, tamper-proof checks | Survey cross-reference (CS/SA/RS/BS), QR certificate with hash and signature, hash-chained audit log |
| 8.1, 8.2 | Synthetic or public data only; no real names, NID, addresses or land records | Generated dataset, no NID field anywhere, a "Demo data" ribbon on every page |
| 8.3, 8.4 | No scraping of government portals; no security testing of live systems | No calls to government sites; official systems appear only as documented adapter interfaces; security tests run on our own prototype |
| 7.2 | Open-source licences respected and credited | README credits table, kept current each round |
| 7.4, 7.5 | Commit history kept; changes between rounds summarised | Small commits, no history rewriting, CHANGELOG.md and a "Changes since Round 1" README section |
| 9.2, 9.3 | AI tools disclosed; both students can explain the code | README disclosure written in Round 1; an EXPLAIN-IT.md per round keeps the design simple to explain |
| 10.1 | Concept note (max 4 pages), repo and README, demo video (max 3 min), live link | Submission kit built in Round 5 |
| 10.2, 11 | Pitch deck (max 10 slides); 5 min pitch with live demo, then 3 min Q&A | Scripted demo scenarios, a one-click demo reset, deck outline |

The judging rubric is a separate document that was not in the files you sent. Sending it lets me weight the rounds toward what is actually scored.

### Scope

**In scope:** plot lookup four ways (record numbers, 3D map, GPS, deed number); explainable verdict; plot dossier; seller and co-sharer check; certified report with QR; watch and re-check; guided buyer checklist; citizen portal and admin portal with separate logins; Supabase backend.

**Not in scope (stretch or future):** real government data feeds, real NID or e-KYC, online payment, Bangla OCR (that is P1), full e-mutation processing (that is P4), real court data. Each of these appears in the countrywide plan for the concept note instead.

### How to run the five rounds

build roadmap · 5 rounds, 5 gates

The round order puts the full citizen flow first, so a submission is possible after Round 3.

Each Build Round is a fresh AI session that knows nothing about the last one, so the rounds pass a baton through the repo:

- Round 1 saves this plan as docs/PLAN.md in the repository.

- Every round begins by reading docs/PLAN.md and the previous docs/rounds/ROUND-<n>-REPORT.md.

- Every round ends by writing its own report (what was built, how to run and test it, known gaps), updating EXPLAIN-IT.md, committing, and tagging build-r<n>.

- The AI must never change how the existing 3D map behaves; Section 2 lists the only allowed edits.

- All data stays synthetic. No real person, NID, address or land record anywhere.

- Secrets (Supabase service key, signing secret) never enter the browser bundle or git.

Kickoff prompt for every round (replace the number): *"**Read docs/PLAN.md and docs/rounds/ROUND-(n-1)-REPORT.md in this repository, then implement Build Round n exactly as written, ask me before doing anything the plan marks as a manual step for me, and finish with the round report, a commit and the tag.**"*

## 2. Your existing 3D map: what it is and how it stays

The zip is a vanilla JavaScript + Vite project that builds cleanly today (one 805 kB JS file, 224 kB gzipped), so this plan **wraps it instead of rewriting it**. The 3D map stays as the home page at /, and the new portals grow around it.

### What is in the zip

| Part | What it does | Where |
| --- | --- | --- |
| 3D map engine | three.js 0.160; Division > District > Area drill-down over 546 areas; Draco-compressed models (4.6 MB total) that load lazily; floating Bangla labels; keyboard and touch controls | src/main.js (568 lines), public/models/*.glb |
| Blood-pulse borders | Animated red pulse along every border | src/blood.js |
| Bangla names and language toggle | lang key in localStorage, default bn; Bangla names for divisions, districts, areas | src/names-bn.js |
| Mapping tool | Leaflet land measuring: draw a plot, see area in Bigha, Katha, Decimal and regional units, split among heirs, share as an image; saves to localStorage mapping.v1 | src/mapping/* |
| Area click | At area level, opens a Google Maps embed | drill() in src/main.js |
| Identity | Logo, splash screen, dark green palette (#0f1d17, #1b3a2b) with cyan accent (#5cf2ff), glass panels | public/logo.png, index.html, src/style.css |
| Build tooling | Blender scripts that produced the models; object names follow Division__District__Area | blender/*, patch_anchor.py |
| Git | Six commits and a GitHub origin; the rulebook wants history kept | .git |

### What the new product reuses

- **The 3D map is the area picker.** The Blender-style key Division__District__Area becomes the stable link between a map area and the geo_units table in Supabase.

- **The Mapping tool becomes the boundary check.** A buyer picks a land saved in the Mapping tool (or draws one in the portal), and the portal compares that polygon with the recorded plot (area difference and overlap). Its heir split also explains co-sharer shares.

- **units.js**** formats every area** in Bigha, Katha, Decimal and regional units, with Bangla digits.

- **The same ****lang**** key and Bangla names** drive every new screen, so the language switch never disagrees between pages.

- **geo.js** (area, distance, polygon clipping) is reused for client-side geometry.

- **The visual identity** (logo, splash, palette, glass panels) is the base of the new design system.

### The only edits allowed in existing files

| File | Edit | Why |
| --- | --- | --- |
| src/main.js | In drill(), replace return openMap(...) at area level with a small sheet: **Verify plots here** or **Open satellite map** (about 10 lines) | Area click becomes the doorway to P5 without losing the old behaviour |
| src/main.js | Add import './portal-bridge.js' at the end | The bridge adds the Verify a Plot and Sign in buttons to the top bar and, in Round 5, reads ?focus=Division__District__Area to fly to an area |
| src/mapping/dock.js | Find the tools panel by #tools instead of searching for a button whose text is "+" | It polls every 300 ms and could latch onto a new button once the page has more UI |
| index.html | Add meta tags and preconnect hints only | main.js looks up #c, #top, #tools, #mapview, #loading, #tip, #msg, so the DOM ids must not change |

Everything else in the legacy files is read-only, with one planned exception in Round 5: a read-only navigation hook in main.js (about 20 lines) that lets the bridge fly the map to an area and mark areas that have data. Round 1 writes a regression checklist and a Playwright smoke test so any accidental break is caught.

### Weak spots to manage, not rewrite

- **One 805 kB script.** Leave it for now; Round 5 splits the Leaflet-based Mapping tool with a dynamic import.

- **Runtime third parties:** Google Fonts, Esri and OpenStreetMap tiles, the Google Maps embed and Nominatim search. They are fine for a demo, must be credited in the README, and the fonts get self-hosted in Round 5 so a venue with weak Wi-Fi still renders Bangla.

- **geoOf()**** is approximate.** It converts 3D position to latitude and longitude with a linear box mapping. That is good enough to centre a search, not to identify a plot, so plots use real coordinates stored in the database.

- **75 areas sit on district borders** with low match confidence in export_report.txt. The 3D geometry is never used for anything legal; the database is the source of truth.

- **About 20 backup copies** (main.js.before-*, *.bak*, *.working) are git-ignored. Leave them and do not ship them.

- **No tests, lint or types.** They are added for new code only.

### Final route map

| URL | What | Access | Built in |
| --- | --- | --- | --- |
| / | Existing 3D map plus Verify a Plot and Sign in buttons | Public | Existing, Round 1 |
| /portal | Citizen home: four ways to start a check | Public | Round 1 shell, Round 3 |
| /portal/login, /admin/login | Separate logins | Public | Round 1 |
| /portal/verify | Check wizard; public users get the verdict only, signed-in users get the full dossier | Public / citizen | Round 3 |
| /portal/report/:id and /print | Plot Dossier and printable certificate | Citizen | Round 3 |
| /portal/my, /portal/my-land, /portal/deed-check | My checks, watchlist, purchases; owner view; deed check | Citizen | Round 3 |
| /verify/:code | Certificate authenticity page (the QR target) | Public | Round 3 |
| /admin and /admin/records, /fraud, /inbox, /rules, /reports, /audit, /system | Admin console | Admin | Round 4 |

## 3. Architecture, stack and data model

One repository, one Vite build with two entry points: the existing 3D map and a new React app that serves the citizen portal, the admin portal and the public certificate page. Supabase holds all data **and all verification logic**; the browser never reads land tables directly, which also keeps the product honest about anti-scraping (rulebook 8.3).

system architecture · 3 pages, 1 backend

The highlighted box is the only way into land data: both portals call functions, never tables.

### Stack decisions

| Layer | Choice | Why |
| --- | --- | --- |
| Existing map | Unchanged: vanilla JS, three.js, Leaflet | Keeps your work intact and low-risk |
| New UI | React 18, TypeScript (lenient mode), Vite 5, Tailwind CSS, shadcn/ui (Radix) and lucide icons | Accessible, modern components that an AI writes reliably |
| Data and routing | React Router 6, TanStack Query, Zod | Simple, well-known, easy to explain |
| Maps in the portals | Leaflet (already in the project), Esri and OSM tiles | No second map library |
| Charts (admin) | Recharts | Small and readable |
| Language | One t() helper with bn and en files, same lang key as the map | The switch never disagrees across pages |
| Certificate | qrcode library plus a print stylesheet ("Save as PDF") | Client-side PDF libraries handle Bangla fonts badly; print CSS does not |
| Backend | Supabase: Auth (email and password), Postgres with PostGIS, pgcrypto, pg_trgm; Row Level Security; SQL functions called as RPC | Matches your choice; SQL files can be pasted into the Supabase SQL editor, so no command-line setup |
| Hosting | Vercel free tier (.vercel is already in your .gitignore) with SPA rewrites | Public live link, which the rulebook recommends |
| Tests | Vitest for pure code, Node scenario tests against Supabase, Playwright for end-to-end | Each round has checks the AI can run |

Edge Functions are deliberately not used in Rounds 1 to 5: they need the Supabase command line and a deploy step. They are the planned home for e-mail or SMS alerts later.

### Data model

| Table | Purpose | Key columns |
| --- | --- | --- |
| geo_units | Division, district and upazila (map "area") hierarchy | level, parent_id, name_en, name_bn, glb_key such as Dhaka__Dhaka__Uttara |
| mouzas | Revenue villages | upazila_id, name_en, name_bn, jl_no |
| plots | The physical parcel | mouza_id, area_decimal, land_class, geom (PostGIS polygon), is_synthetic |
| survey_records | The same parcel under each survey generation | plot_id, survey_type (CS, SA, RS, BS, DIGITAL), khatian_no, dag_no, recorded_area, khatian_kind (private, khas, vested, waqf) |
| persons | Synthetic people only | name_bn, name_en, father_name_*, village_text, name_key (normalised for matching); no NID column |
| ownerships | Who holds which share, and when | plot_id, person_id, share_num, share_den, acquired_via, source_deed_id, from_date, to_date (null means current) |
| deeds, deed_parties | Registered deeds and their sellers, buyers, mortgagors | deed_no, year, sub_registry_office, deed_type, registered_on, area_sold, consideration, status |
| mutations | AC Land mutation cases | case_no, plot_id, deed_id, status, filed_on, decided_on, office |
| cases | Court cases | court, case_no, case_type, status, stay_order, filed_on, next_hearing |
| land_flags | Khas, vested, acquisition, waqf, mortgage, admin hold | plot_id, flag, authority, ref_no, status, dates |
| acquisition_zones | Planned project corridors | project, notice_ref, stage, geom |
| tax_records | Land development tax | plot_id, fiscal_year, amount, paid_on, receipt_no |
| profiles | Role and language per login | id (auth user), role (citizen or admin), display_name, linked_person_id (powers the demo owner view) |
| verifications | Every check that was run | user_id, plot_id, seller_input, intent, verdict, risk_points, findings (json) |
| reports | Certified snapshots | code, payload, payload_hash, signature, state_hash, issued_at, expires_at, revoked |
| watches, notifications | Change alerts | last_state_hash; type, title, read |
| purchase_cases | The buyer's guided journey | plot_id, stage, checklist (json), notes |
| objections, fraud_reports | Citizen feedback queues | plot_id, type, message, status, resolution |
| risk_rules, risk_rules_history | Tunable verdict rules | key, enabled, weight, severity, params, Bangla and English title and advice |
| plot_events, fraud_signals | Change feed and detected anomalies | event_type, detail; signal_type, evidence, status |
| audit_log | Hash-chained admin actions | actor, action, entity, diff, prev_hash, hash |
| private.app_secrets | Report-signing secret | Never exposed through the API |

Two ideas carry most of the design. First, one physical plot has many survey_records, so a search by RS dag 456 and one by BS dag 1190 can land on the same land, and conflicts between surveys can be detected. Second, a **state hash** fingerprints every fact that can change a verdict (owners, deeds, mutations, cases, flags, tax). A certificate stores it, so the public page can say "changed since issued".

### Access control and privacy

| Who | Can do | How it is enforced |
| --- | --- | --- |
| Anonymous visitor | Read the area hierarchy; run a **quick check** (verdict and top reasons, owner names masked); verify a certificate by code; see plot status colours on a map | RPC functions only; no table access |
| Citizen | Everything above, plus the full dossier, certificates, watchlist, notifications, purchase cases, objections | RPC functions; own rows only through RLS; dossier calls rate limited per user |
| Admin | Read and write records, rules, queues, audit log | is_admin() reads profiles.role (never user-editable metadata); every write goes through a function that also writes the audit log |

Land tables have RLS switched on with **no** public policies, and functions are security definer with a fixed search_path. The service-role key lives only on the developer's machine for seeding, never in the browser bundle and never in git. Demo logins are real Supabase Auth users with dummy passwords, so the role checks are genuine even though the passwords are not secret.

## 4. The features that make it unique and usable

Most land tools show records. V-Land P5 **answers the buyer****'****s actual question**: can this person sell me this land, and is anything about to go wrong? Records are split across offices (rulebook 1.1), so the value is in joining them, explaining the result in plain Bangla, and keeping the answer trustworthy after the check. Priority: **M** must have for a credible submission, **S** should have, **C** could have.

| # | Feature | What it does | Why it matters in real life | Pri | Round |
| --- | --- | --- | --- | --- | --- |
| 1 | Explainable verdict | Clear, Caution or Stop from 20 transparent rules; every finding shows its evidence and a "what to do" step in Bangla and English | A buyer needs a decision and a reason, not a data dump; a black-box score would not be trusted | M | 2, 3 |
| 2 | Seller and co-sharer check | Matches the seller's name (Bangla or English spelling, father's name) to current owners and compares the share held with the share being sold | Selling land you only partly own, or under a lookalike name, is a classic fraud | M | 2, 3 |
| 3 | Four ways in | Record numbers from any survey; tap an area on the 3D map; "I am standing on the plot" (GPS); a deed number | Buyers rarely know every number; on site they have a phone and a location | M (GPS: S) | 3 |
| 4 | Survey cross-reference | Shows the same land under CS, SA, RS and BS numbers and flags conflicts between them | Directly addresses the khatian conflicts named in rulebook 1.1 | M | 2, 3 |
| 5 | Certified report | PDF with QR code, SHA-256 hash, signature and 7-day validity; a public page confirms it is genuine and says whether the record **changed since it was issued** | Banks and lawyers can trust it; a forged or stale report is caught | M | 2, 3 |
| 6 | Watch and re-check | Watch a plot; if a deed, case or mutation appears before you sign, you get an alert and a "what changed" view | Records change between the check and the registration day | S | 2, 3 |
| 7 | Guided buyer journey | A checklist and document list generated from the findings (what to ask the seller, when to see a lawyer, what to do after registration); progress is saved | Turns a report into action for first-time buyers | S | 3 |
| 8 | Measure and compare | Pick a land saved in your Mapping tool, or draw one in the portal, and see the area difference and overlap against the recorded plot | Catches encroachment and wrong areas in deeds | S | 3, 5 |
| 9 | Neighbourhood map | Plot shown among neighbours coloured by status, with a warning if a planned acquisition corridor is near | A "clean" plot beside a planned road is still risky | S | 3 |
| 10 | Deed check | Enter a deed number, office and year from the seller's copy and compare it with the registry record | Forged or altered deed copies | S | 3 |
| 11 | Owner shield ("My land") | Owners see their plots, a non-identifying count of recent checks, and alerts on new deeds, mutations or cases | An early warning that someone may be selling your land | S | 3 |
| 12 | Report a problem | "This record looks wrong" and "Suspicious seller" forms go to an admin inbox, and the citizen is told the outcome | Closes the loop between citizens and the land office | S | 3, 4 |
| 13 | Bangla-first and low-bandwidth | Bangla digits and regional units, mobile-first layout, installable app that keeps your last reports offline; read-aloud of the verdict (C) | Most users are on phones with patchy data | S (read-aloud: C) | 5 |
| 14 | Fraud and anomaly center | Detects double sales, rapid transfers, registration-mutation gaps, a seller probed against many plots, sudden check spikes; admin can **freeze** a plot | Moves from checking one plot to catching fraud patterns (links to P3) | M | 4 |
| 15 | Risk Rule Studio | Admin turns rules on and off, changes weights and thresholds, and simulates the effect on the demo scenarios before saving | Shows the system is governable, not hard-wired | S | 4 |
| 16 | Tamper-evident audit log | Every admin write is chained by hash; one button re-verifies the whole chain | Credibility for a records system | S | 4 |
| 17 | Demo reset and scenario launcher | One click restores all demo data and jumps into any scenario | Makes the 5-minute live pitch repeatable | M | 4 |

The verdict is **decision support, not legal advice**. The rule list should be reviewed by your faculty mentor or the Law department before the Final, and every report carries that wording.

### Fifteen demo scenarios (they double as the test suite)

Round 2 creates these plots with fixed codes. Each has an expected verdict, and the automated tests fail if the engine disagrees. Rule codes are defined in Round 2.

| Code | Story | Expected | Rules |
| --- | --- | --- | --- |
| SCN-01 | Clean plot: one owner, mutated, tax paid | Clear | none |
| SCN-02 | Seller is selling a plot recorded in a khas khatian | Stop | R01, R07 |
| SCN-03 | Plot on the vested property list | Stop | R02 |
| SCN-04 | Active acquisition notice for a road project | Stop | R03 |
| SCN-05 | Title suit with a stay order | Stop | R05 |
| SCN-06 | Partition suit between heirs, no stay | Caution | R06 |
| SCN-07 | Seller's name only resembles the real owner's | Stop | R07 |
| SCN-08 | Seller owns one third but offers the whole plot | Caution | R08 |
| SCN-09 | Two sale deeds from the same seller 12 days apart | Stop | R09 |
| SCN-10 | Deed registered five months ago, mutation never filed | Caution | R10 |
| SCN-11 | Four owners in 18 months | Caution | R11 |
| SCN-12 | Three unpaid tax years and an active mortgage | Caution | R13, R14 |
| SCN-13 | Deed area off by 25% and an RS versus BS khatian conflict | Caution | R15, R16 |
| SCN-14 | Clean plot 60 m from a planned railway corridor | Caution | R04 |
| SCN-15 | Inherited land with a minor co-sharer, agricultural class | Caution | R17, R18 |

A live twist for the pitch: after showing SCN-01 as Clear, an admin freezes it (rule R19) and the same check now says Stop. This shows records, rules and alerts working together.

## Build Round 1: Foundation (shell, design system, logins, Supabase)

**Goal.** Leave the 3D map working exactly as it does now, and add the new app around it: design system, Bangla/English UI, Supabase connection, two separate logins with role checks, and the first database tables. **Ends with** a deployable site where / is the map with two new buttons, and /portal/login and /admin/login both work and land on an empty dashboard.

### Manual steps for you (the AI must stop and ask for these)

- Create a free Supabase project in the region nearest Bangladesh (South Asia or Singapore, whichever is offered).

- Copy the **Project URL** and the **anon (publishable) key** into a local .env.local file; the AI creates .env.example to show the two names, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

- In Supabase, Authentication > Users > Add user (tick auto-confirm), and create the two demo logins below. Then paste 002_demo_roles.sql into the SQL editor.

- At the end of the round, connect the GitHub repository to Vercel and add the same two variables there.

| Portal | Demo email | Dummy password (change freely) |
| --- | --- | --- |
| Citizen | citizen.demo@example.com | Citizen@2026 |
| Admin | admin.demo@example.com | Admin@2026 |

If Supabase refuses these addresses, use any address you control. The README must say these are demo-only credentials.

### Tasks

**A. Safety net and repository hygiene**

- **1.1** Create branch p5-verification from main and tag the current main as baseline-3d-map. Run npm ci and npm run build; record the result and the bundle sizes (today: 805 kB JS, 28 kB CSS) in the round report.

- **1.2** Create docs/PLAN.md (this plan), docs/CONTEXT.md (one-page digest of rulebook sections 3, 7, 8, 9, 10 and 11), docs/ARCHITECTURE.md (skeleton), docs/EXPLAIN-IT.md, docs/LEGACY_MAP_CHECKLIST.md and the folder docs/rounds/.

- **1.3** Write the README: what V-Land is, setup steps, demo credentials, a **synthetic-data statement**, an **AI tool disclosure** (Claude by Anthropic used for planning and code generation, reviewed by the students), a credits and licences table (three.js, Leaflet, Esri imagery, OpenStreetMap, Nominatim, Noto Sans Bengali, React, Tailwind, shadcn/ui, Radix, lucide, Supabase, Vite and every other library added later), and an empty "Changes since Round 1" section.

- **1.4** Extend .gitignore with .env* (keeping .env.example), supabase/.temp, coverage and playwright-report. Keep the existing ignore patterns for *.before-*, *.bak* and *.working.

**B. Tooling for new code only**

- **1.5** Add React 18, TypeScript, Tailwind, shadcn/ui primitives, lucide-react, React Router, TanStack Query, Zod, Vitest, ESLint and Prettier. Type-check and lint only src/app/**; legacy JavaScript stays untouched (allowJs on, checkJs off).

- **1.6** Configure Vite for two entries: index.html (the map) and app.html (the React app). Add an alias @ for src/app, and a small dev-server plugin that serves app.html for /portal/*, /admin/* and /verify/*. Add vercel.json with the same rewrites.

- **1.7** Add scripts: dev, build, preview, typecheck, lint, test, test:e2e. The build must still emit the map as before.

**C. Bridge into the existing map** (only the edits listed in Section 2)

- **1.8** Write src/portal-bridge.js and src/portal-bridge.css (plain JavaScript, no React). It adds to the #top header a primary **Verify a Plot / প্লট যাচাই করুন** button and a **Sign in / লগইন** menu (Citizen, Admin). It reads the same lang key and listens to the existing [data-l] language buttons. On screens under 640 px it collapses to icons.

- **1.9** Area sheet: when an area is clicked at level 3, show a bottom sheet with the area name in the current language and two actions, **Verify plots here** (goes to /portal/verify?area=<glb_key>) and **Open satellite map** (the old behaviour). Build glb_key from the path, for example Dhaka__Dhaka__Uttara, keeping the _2 suffix for duplicate names.

- **1.10** Fix src/mapping/dock.js to find the tools panel by #tools.

- **1.11** Write docs/LEGACY_MAP_CHECKLIST.md: loads and shows Bangladesh; drill division, district and area; hover tooltips; labels in Bangla and English; keyboard controls; Mapping tool opens, draws a polygon, shows area in Bigha, Katha and Decimal, splits among heirs; the Google embed still opens. Add a Playwright smoke test (page loads, #c exists, new buttons exist, no unexpected console errors).

**D. Design system**

- **1.12** Tokens as CSS variables. Brand green #006A4E (the rulebook's green), deep surfaces #0f1d17 and #1b3a2b from the map, cyan accent #5cf2ff for highlights on dark, **red ****#F42A41**** reserved for Stop and danger**, amber for Caution, green for Clear. All text must reach contrast 4.5:1. The citizen portal defaults to light (readable in sunlight on a phone), the admin portal and the map default to dark, and both have a theme toggle.

- **1.13** Typography: Noto Sans Bengali with Inter for Latin text, 16 px base, and a "Large text" switch (125%) for older users.

- **1.14** Components: Button, Input, Select, searchable Combobox, Card, Badge, **VerdictBadge**, **FindingCard**, **Timeline**, Stat, Tabs, Sheet, Dialog, Toast, Skeleton, EmptyState, DataTable (sort, filter, paginate), Stepper, LanguageToggle, ThemeToggle, and a **DemoRibbon** that reads "Demo data, not real records". Add a dev-only page /portal/_ui that shows them all.

- **1.15** Layouts: PortalLayout (top bar with logo, navigation, language, sign-in; bottom navigation with four icons on phones), AdminLayout (collapsible sidebar, breadcrumbs, user menu), AuthLayout.

- **1.16** Language: a t() helper and useLang() hook, bn.json and en.json files per feature, the shared lang key, <html lang> updated on change. Re-export num, digits and the unit helpers from src/mapping/units.js. Add a test that fails when a key exists in one language but not the other.

**E. Supabase and sign-in**

- **1.17** scripts/gen-geo-units.mjs reads the node names inside public/models/*.glb (plain JSON chunk, no three.js) and src/names-bn.js, and writes supabase/migrations/003_geo_units_seed.sql with all 8 divisions, 64 districts and 546 areas, each with its exact glb_key and Bangla name.

- **1.18** supabase/migrations/001_core.sql: extensions (postgis, pgcrypto, pg_trgm, unaccent), app_role enum, profiles with a trigger that creates a profile for each new auth user, is_admin(), geo_units, mouzas, and Row Level Security on all of them. 002_demo_roles.sql promotes the admin demo user by joining auth.users.

- **1.19** Client: lib/supabase.ts, an AuthProvider (session, profile, role), a RequireRole guard, and a redirect that remembers where the user was going.

- **1.20** Citizen login: email and password, a **Use demo account** button that fills the credentials, clear errors in both languages. Admin login: visually distinct (dark, "Authorised staff"), signs out and explains if a non-admin tries it, and signs out after 30 minutes of inactivity.

- **1.21** If the Supabase variables are missing, show a friendly setup screen that names the missing variables instead of a blank page.

**F. Placeholder pages and deploy**

- **1.22** /portal (hero, four entry cards marked "coming in Round 3"), /portal/verify (shows the decoded area from ?area=), /portal/my, /admin (shell with the sidebar items disabled), a 404 page and an error boundary.

- **1.23** Deploy a preview to Vercel with the two variables, and note the live URL in the round report.

### Done when

- ☐ npm run build passes and produces both entries; the map bundle has not grown by more than 5% (the bridge excluded).

- ☐ Every item of LEGACY_MAP_CHECKLIST.md passes and the Playwright smoke test is green.

- ☐ Clicking an area shows the sheet; **Open satellite map** still opens the Google embed; **Verify plots here** opens /portal/verify showing the area name.

- ☐ Citizen login and admin login work; each rejects the other's account; a refresh keeps the session; opening /admin while signed out redirects to /admin/login.

- ☐ With only the anon key, select * from profiles returns nothing, and a citizen cannot change their own role (a scripted test proves both).

- ☐ Bangla and English both work on every new page with no missing keys; Bangla digits show correctly.

- ☐ Login pages score 90 or more for accessibility in Lighthouse, work by keyboard alone, and fit a 360 px phone.

- ☐ README, docs/* and the round report exist; tag build-r1 is pushed.

**Never in this round:** rewrite main.js, rename or remove any DOM id, touch the .glb files, delete any existing file, or commit a key.

## Build Round 2: Data and verification engine (backend)

**Goal.** Build the whole back end before any citizen screen exists: land-record tables, a realistic synthetic dataset with 15 scripted scenarios, the verification functions, the 20-rule engine, certificate signing, change tracking and automated tests. **Ends with** an admin-only sandbox page where you pick a plot and see the raw JSON and the readable verdict, and a test run that proves all 15 scenarios.

### Manual steps for you

- Paste the migration files into the Supabase SQL editor in numeric order (010 onward). The AI lists them in the round report.

- Paste the seed files in order. They are split into chunks under 500 kB so the editor accepts them.

- Optional, for people comfortable with a terminal: put the service-role key in .env.local and run npm run seed instead. The key stays on your machine and the script never prints it.

- Run npm run test:engine and send the AI any failures.

### Tasks

**A. Schema** (supabase/migrations/010_*.sql onward)

- **2.1** Create every table in the Section 3 data model with enums for survey type, khatian kind, land class, deed type, flag kind, case type and status, mutation status, severity and verdict. Add checks (shares are fractions between 0 and 1; a deed has at least one seller and one buyer) and a trigger that warns when current shares on a plot do not add up to 1. Add plots.scenario_code and persons.is_minor.

- **2.2** Indexes: GiST on plots.geom and acquisition_zones.geom; trigram on persons.name_key; B-tree on survey records by survey type, khatian and dag; a partial index on current ownerships (to_date is null).

- **2.3** Row Level Security on every table. Land tables get **no** public or citizen policy; admins get full access through is_admin(); citizen tables allow a user to see only their own rows.

- **2.4** plot_events triggers on ownerships, deeds, mutations, cases, flags and tax records. Each trigger records the change and creates a notification for everyone watching that plot. Add plot_state_hash(plot_id), a SHA-256 over a canonical text of every verdict-relevant fact.

- **2.5** audit_log with a function audit_write(...) that stores hash = sha256(prev_hash + canonical record), plus audit_verify() that re-walks the chain and returns the first broken row, if any.

**B. Synthetic dataset** (scripts/seed/, output in supabase/seed/)

- **2.6** A deterministic generator (--seed 2026 always gives the same data) that writes chunked SQL. Coverage: four upazilas that exist in geo_units and sit in different divisions so the 3D map demo spreads across the country (for example Uttara, Gazipur Sadar, Sylhet Sadar and one more; the AI checks the names), three fictional mouzas each, 150 to 250 plots per mouza, about 2,500 plots in total.

- **2.7** Geometry: coordinates around each upazila's centre, polygons from a jittered grid so neighbours share edges, areas of 3 to 60 decimal computed from the shape itself, so the Mapping tool and the database agree.

- **2.8** People and history: Bangla and English names assembled from name lists, with deliberate look-alike pairs; fictional village text; one to four survey records per plot (CS, SA, RS, BS) with consistent khatian and dag numbers; ownership chains of one to four steps through inheritance and deeds; deeds with believable numbers, years and sub-registry offices; mostly approved mutations; six years of tax records. About 8% of ordinary plots carry a small issue (one unpaid year, a late mutation) so the data does not look uniform, while SCN-01 stays truly clean.

- **2.9** The 15 scenario plots from Section 4, with fixed codes, are written by hand-built SQL rather than random generation.

- **2.10** Every row is marked is_synthetic = true; **no NID, phone number or real address field exists anywhere**. Write docs/DATA.md explaining how the data is generated and why it satisfies rulebook 8.1 and 8.2.

- **2.11** reset_demo_data(): restores the 15 scenario plots (and anything the demo changed on them) to their original state from a snapshot in private. Round 4 calls it from a button.

**C. Functions the app will call (RPC)**

All are security definer with a fixed search_path and return JSON.

| Function | Who | Returns |
| --- | --- | --- |
| search_plots_by_record(mouza, survey, khatian, dag) | Citizen | Matching plots with a masked label |
| plot_at_point(lat, lng) | Citizen | The plot containing the point, or the nearest within 30 m |
| find_by_deed(deed_no, year, office) | Citizen | Plot or plots linked to that deed |
| plots_in_bbox(...) | Anyone | Up to 500 plots as GeoJSON with a status colour only, no personal data |
| quick_check(plot, seller_name) | Anyone | Verdict, up to three reasons, masked owner names |
| run_verification(plot, seller_name, seller_father, share_claimed, area_claimed, intent) | Citizen | Verification id, full dossier, evaluation, next steps; rate limited |
| compare_measurement(plot, polygon) | Citizen | Area difference %, overlap %, area outside the record |
| check_deed(deed_no, year, office, seller, area, date) | Citizen | Field-by-field match table |
| issue_report(verification) | Citizen | Code, hash, signature, expiry (7 days) |
| verify_report(code) | Anyone | Genuine, expired, revoked or **changed since issued**; issue date; verdict at issue; no personal data |
| toggle_watch(plot), get_changes_since(plot, state_hash) | Citizen | Watch status; list of changes since a check |
| my_land(), my_land_check_counts() | Citizen | Plots linked to the profile; non-identifying check counts |
| submit_objection(...), submit_fraud_report(...) | Citizen | Ticket id |

**D. The verdict engine**

- **2.12** risk_rules holds the 20 rules below; evaluate_plot(...) runs the enabled ones. **Any Blocker gives Stop. Otherwise 15 or more risk points gives Caution, and anything less gives Clear.** Points are High 30, Medium 15, Info 0, capped at 100. Thresholds and weights live in risk_rules.params, never in code, because Round 4's Rule Studio edits them.

- **2.13** Every finding returns: rule code, severity, title and detail in both languages with the real numbers filled in, evidence rows (table and id), buyer advice, and points. The evaluation also returns next_steps, the documents to ask for and actions to take, which Round 3 turns into the checklist.

- **2.14** Name matching: normalise by lower-casing, stripping honorifics (Md., Mohammad, Mst., মোঃ, মোহাম্মদ, মোসাম্মৎ) and punctuation, and unifying Bangla look-alike characters. Score with trigram similarity plus a father's-name agreement bonus. At or above 0.85 is a match, 0.6 to 0.85 is a "possible look-alike" (High), below 0.6 is a mismatch (Blocker). Document it in docs/NAME_MATCHING.md.

| Code | Rule | Triggers when | Severity | Buyer advice |
| --- | --- | --- | --- | --- |
| R01 | Khas land | Survey record or flag marks the plot khas or government | Blocker | Government land cannot be sold by a private person; pay nothing |
| R02 | Vested property | Plot is on the vested property list | Blocker | Do not proceed; confirm status with the land office |
| R03 | Acquisition active | Plot intersects an active acquisition notice | Blocker | The land may be taken by the government; compensation goes to the recorded owner |
| R04 | Acquisition nearby | Plot is within 100 m of a planned corridor (editable) | Medium | Ask the project office if the alignment can change |
| R05 | Court stay | A pending case carries a stay or injunction | Blocker | Transfers are barred while the order stands |
| R06 | Pending suit | A pending title, partition or similar suit, no stay | High | A buyer can be bound by the suit's outcome; see a lawyer first |
| R07 | Seller mismatch | Seller name and father's name do not match any current owner | Blocker (look-alike: High) | Do not pay; ask for ID and ownership papers |
| R08 | Partial share | Seller holds less than the whole plot but offers more than their share | High | Get written consent from every co-sharer |
| R09 | Double sale | Another registered sale deed from the same seller covers overlapping land within 90 days, or a later deed follows an unmutated one | Blocker | Do not pay; report it |
| R10 | Mutation pending | A deed is more than 60 days old and mutation is pending or never filed | Medium | Ask the seller to complete mutation first |
| R11 | Rapid transfers | Three or more ownership changes in 24 months | Medium | Find out why the land is changing hands so often |
| R12 | Chain gap | The current owner has no deed, mutation, inheritance or allotment behind them | High | Ask for the missing links before paying |
| R13 | Tax due | Land development tax unpaid for 1 to 2 years (Medium) or 3 or more (High) | Medium / High | Have the seller clear dues and show receipts |
| R14 | Mortgage or lien | An active mortgage, lien or attachment is recorded | High | Get a written release before buying |
| R15 | Area mismatch | Deed, claimed or measured area differs from the record by more than 10% | Medium | Re-measure with a surveyor before signing |
| R16 | Survey conflict | Two khatians from different surveys claim the same dag, or ownership breaks between surveys | High | Ask the land office to reconcile the records |
| R17 | Minor co-sharer | A current owner is a minor | High | A sale may need court permission; take legal advice |
| R18 | Agricultural land | Land class is agricultural | Info | Check if conversion permission is needed for your plan |
| R19 | Admin hold | An administrator froze the plot | Blocker | Wait for the land office to lift the hold |
| R20 | Thin record | A survey generation or recent update is missing | Info | Treat this result with less confidence |

**E. Tests** (scripts/test-engine.mjs, run with npm run test:engine)

- **2.15** Sign in as the demo citizen, run each SCN-01 to SCN-15, and assert the verdict and the exact set of rule codes from the Section 4 table.

- **2.16** Security tests: anonymous users cannot read plots, ownerships or persons; a citizen cannot read audit_log or another user's verifications; a citizen cannot call admin functions; the rate limit trips (the test lowers the limit); verify_report output contains no personal names; changing one character of a stored payload makes verify_report return invalid; audit_verify() reports the first tampered row.

- **2.17** Measure the dossier call on about 2,500 plots and record it (target under 400 ms) in the round report.

**F. Sandbox page**

- **2.18** /admin/sandbox, admin only: search a plot four ways, enter a seller name, press run, and see the raw JSON next to a readable list of findings.

### Done when

- ☐ Every migration and seed file runs on a fresh Supabase project in order without errors.

- ☐ npm run test:engine passes: 15 of 15 scenarios, all security tests, the audit-chain test.

- ☐ About 2,500 synthetic plots exist, with no NID or phone field in any table, and docs/DATA.md is written.

- ☐ A certificate verifies as genuine, then reports **changed since issued** after a scenario plot receives a new case.

- ☐ A watcher receives a notification row when a watched plot changes.

- ☐ reset_demo_data() restores all scenarios.

- ☐ Round report, EXPLAIN-IT.md update, tag build-r2.

**Never in this round:** put the signing secret in client code, grant table access to anon or citizens, or use any real name, ID or land record.

## Build Round 3: Citizen portal (the "check before you buy" experience)

**Goal.** Turn the Round 2 engine into a clear, mobile-first, Bangla-first experience: find a plot four ways, tell the system who is selling, read an explainable verdict, get a certified report, and keep watching the plot until you sign. **Ends with** a complete demo flow for all 15 scenarios. This is the point at which the project is submittable if the October 16 deadline still stands.

### Manual steps for you

None required. Please try the portal on your own phone and send the AI anything that feels confusing; the plan treats "a first-time buyer understands it without help" as the real test.

### Design rules for every screen

- **Bangla first**, with a one-tap switch to English; Bangla digits; areas in the user's regional unit.

- **Phone first**: designed at 360 px wide, thumb-reachable actions, 44 px touch targets.

- **Never colour alone**: Clear, Caution and Stop each have an icon and a word as well as a colour, and the verdict is announced to screen readers.

- Plain words over legal terms; every legal term (mutation, khas, khatian, dag, vested) has a one-line tap-to-explain tooltip in both languages.

- Every page shows the **Demo data** ribbon and the "decision support, not legal advice" line.

- Performance: /portal loads at most 250 kB of gzipped JavaScript; Leaflet, the QR library and print styles load only when needed; no 3D model is ever fetched on portal pages.

### Tasks

**A. Citizen home (****/portal****)**

- **3.1** A hero headline, "Check before you buy / কেনার আগে যাচাই করুন", and five entry cards: **By record numbers**, **On the 3D map** (opens / with a hint to tap an area), **I am at the plot** (GPS), **By deed number**, and **Check a certificate** (code or QR).

- **3.2** A three-step "how it works" strip, short explainer cards (reading a porcha, what mutation means, what khas means) in both languages, and, when signed in, recent checks and watched plots.

**B. The check wizard (****/portal/verify****)**

- **3.3** *Step 1, Where.* Record method: Division, District, Upazila (from geo_units, Bangla names), searchable Mouza, survey type with a plain-language hint ("which one is printed on your porcha?"), khatian number, dag number. A ?area= link from the 3D map preselects the first three. One match shows a confirm card with a small map and a masked label ("Is this the plot?"); several matches show a list; none shows help (check the survey type, try another survey, report a missing record).

- **3.4** GPS method: explain why location is needed, show the accuracy circle, pick the plot containing the point or the nearest within 30 m, and fall back gracefully if permission is denied. Deed method: number, year, sub-registry office.

- **3.5** *Step 2, Who and why.* Seller name in Bangla or English, seller's father's name (recommended), what the seller says is on offer (whole plot, a fraction, or an area with a unit picker from units.js), and your purpose (buy, lend against, rent, just checking).

- **3.6** *Step 3, Run.* Show the seven checks being made (ownership, mutation, court cases, khas/vested/acquisition, tax, survey records, boundary) while one run_verification call runs; keep it visible at least 1.5 seconds so it can be read. Handle errors with a retry.

- **3.7** Not signed in? Call quick_check and show the verdict with three reasons and a **Sign in for the full dossier** button that returns to the same result.

**C. The Plot Dossier (****/portal/report/:id****)**

- **3.8** *Verdict hero:* a large VerdictBadge, a one-sentence summary in the current language, the top three reasons, and the primary actions: **Get certified report**, **Watch this plot**, **Share**, **Start checklist**.

- **3.9** *Findings:* every finding as a FindingCard grouped by severity, with plain explanation, evidence chips that jump to the matching tab, buyer advice and the rule code.

- **3.10** *Tabs.* **Overview**: location breadcrumb, mouza and JL number, the survey cross-reference (CS, SA, RS, BS numbers side by side, conflicts highlighted), area in local units and decimal, land class. **Owners and chain**: current owners with share bars; a **Seller match** card showing which owner was matched, the confidence and what matched; a timeline across survey generations, deeds and mutations with gaps marked. **Cases and restrictions**: cases with stay chips, flags, acquisition notices. **Tax and mutation**: a fiscal-year grid (paid, unpaid) and a mutation stepper (deed, filed, decision). **Map and boundary**: Leaflet with the plot polygon, neighbours coloured by status, acquisition corridors, satellite or street toggle.

- **3.11** *Measure and compare.* The Mapping tool on the 3D page has global side effects, so it is not embedded here. Instead the Map tab offers two ways in: pick a land already saved in the Mapping tool (read from its mapping.v1 storage), or draw a new boundary with a small built-in drawer that reuses geo.js. Either calls compare_measurement and shows the area difference, overlap and the part outside the record.

- **3.12** *Checklist tab (guided journey).* Built from the engine's next_steps plus a fixed backbone: verify records, visit and match the boundary, ask for specific documents (the list changes with the findings), confirm the seller's identity and co-sharer consent, lawyer review (share link), pay by bank transfer rather than cash, register the deed, apply for mutation, pay land tax. Progress is saved to purchase_cases. The wording of the fixed steps is reviewed by your mentors.

- **3.13** *Certified report.* **Get certified report** calls issue_report and shows the code, a QR code and the expiry. The print route /portal/report/:id/print is an A4 layout in either language with the QR, short URL, hash fragment, the disclaimer and a Demo data watermark; "Save as PDF" uses the browser. Add copy-link and a WhatsApp share link.

- **3.14** *Watch and re-check.* A watch toggle; when changes exist, a banner reads "N changes since your check" with a list from get_changes_since, and **Re-run check** produces a new verification that shows the old verdict beside the new one.

- **3.15** *Report a problem.* Two forms: **This record looks wrong** and **Suspicious seller or listing**. Each confirms with a ticket id.

**D. Public certificate page (****/verify/:code****)**

- **3.16** Calls verify_report and shows one clear state: **Genuine and current**, **Genuine but changed since issued** (amber, "re-check before relying on it"), **Expired**, **Revoked**, or **Not found or invalid** (red). It shows issue date, the plot label (mouza and dag only), the verdict at issue and the hash fingerprint, and **never any personal data**.

- **3.17** A scan button using the browser's barcode detector where available, with manual code entry as the fallback.

**E. My space**

- **3.18** /portal/my with tabs: My checks, Watchlist (change badges), Purchases (progress bars), Notifications (a bell in the header).

- **3.19** /portal/my-land (**Owner shield**): the plots linked to the demo profile, each with a self-check verdict, the number of times it was checked in the last 30 days (never who), and an alert feed for new deeds, mutations and cases. The demo citizen is linked to the owner of SCN-01 so this screen is not empty. Real use would need national ID verification, which the concept note lists as future work.

- **3.20** /portal/deed-check: enter deed number, year, office and the seller's claims; get a field-by-field table (found or not, office, year, parties, area, date). "Not found" is explained as a possible forgery and advises not to pay.

**F. Quality**

- **3.21** Skeletons for loading, helpful empty and error states, an offline banner, focus management in the wizard, and reduced-motion support.

- **3.22** Playwright end-to-end tests: (1) not signed in, quick check of SCN-09 shows Stop; (2) sign in, check SCN-01 shows Clear, issue a certificate, open /verify/<code> in a fresh browser context and see Genuine; (3) SCN-08 shows the share problem in the Seller match card; (4) watch SCN-06, add a case with a test helper, see the banner and see the public page say "changed"; (5) record not found and GPS-denied paths; (6) axe accessibility scans of home, wizard, dossier and public page.

### Done when

- ☐ All 15 scenarios show the correct verdict and findings in both languages.

- ☐ A citizen can go from the 3D map to a verdict in under 60 seconds, and from a GPS point to a verdict in under 30 seconds on a phone.

- ☐ A certificate verifies publicly, and shows "changed since issued" after the plot changes.

- ☐ The printed report is a clean A4 page in Bangla and in English.

- ☐ Lighthouse mobile scores are 85 or more for performance and 90 or more for accessibility on the home page, wizard and dossier; no horizontal scrolling at 360 px.

- ☐ The Playwright suite and npm run test:engine both pass; the legacy map checklist still passes.

- ☐ Round report, EXPLAIN-IT.md update, tag build-r3.

**Never in this round:** compute a verdict in the browser, read land tables directly, or show an owner's name to an anonymous visitor.

## Build Round 4: Admin portal (operations, integrity and fraud intelligence)

**Goal.** Give land-office staff a console that keeps records correct, turns citizen activity into fraud signals, lets them tune the rules safely, and proves its own integrity. **Ends with** an admin portal where every live-demo twist works: approve a mutation, freeze a plot, revoke a certificate, simulate a rule change, verify the audit chain, and reset everything with one button.

### Manual steps for you

- Paste the new migrations (020 onward) into the Supabase SQL editor in order.

- No new accounts are needed; the Round 1 admin login is used.

### Tasks

**A. Back end** (supabase/migrations/020_admin_*.sql)

- **4.1** Admin write functions, each one calling audit_write(...) so nothing changes without a trace: admin_upsert_plot, admin_record_deed, admin_file_mutation, admin_decide_mutation (approval runs the ownership transfer in a single transaction: closes the seller's rows, opens the buyer's, updates the survey record, writes the change event), admin_add_case, admin_update_case, admin_set_flag, admin_release_flag, admin_record_tax_payment, admin_save_zone (flags every intersecting plot), admin_freeze_plot, admin_revoke_report, admin_resolve_ticket, admin_update_rule (writes risk_rules_history), admin_import_rows (with a dry-run mode that validates and changes nothing), run_fraud_detection() and admin_reset_demo().

- **4.2** fraud_signals generation with six detectors, each storing evidence and a dedupe key: **Double sale** (overlapping sale deeds from one seller), **Rapid transfers** (three or more owners in 24 months), **Registration-mutation gap** (deed with no mutation after 60 days), **Seller probing** (one seller name checked against five or more plots they do not own within 24 hours), **Check spike** (five or more different users check the same plot within 48 hours, a sign of an active sale), **Cross-survey conflict**.

- **4.3** Reporting views for the dashboard: KPIs, verifications per day, rule hits, and Stop counts per upazila.

- **4.4** Security: a script that signs in as the citizen and proves each admin function is refused.

**B. The console**

| Module | Route | What an admin can do |
| --- | --- | --- |
| Dashboard | /admin | KPI cards (checks today, 7 and 30 days; share of Stop, Caution and Clear; open fraud signals; open tickets; record coverage); a line chart of checks per day; a verdict mix chart; a bar chart of the most-triggered rules; a map of Stop counts per upazila; a live activity feed |
| Records | /admin/records, /admin/records/:id | Filter and search plots; open a plot with tabs for owners, chain, deeds, mutations, cases, flags, tax, survey records and map. Actions: record a deed, file or decide a mutation, add or close a case with stay order, set or release a flag, record a tax payment, edit area or boundary by clicking and dragging points on a Leaflet map, freeze the plot. CSV import with a dry-run table showing row-level errors; CSV export |
| Acquisition zones | /admin/records/zones | Draw a corridor, add project, notice number and stage, and see "N plots affected" before saving |
| Fraud center | /admin/fraud | Filter signals by type, status and upazila; open evidence; move a signal from New to Investigating to Confirmed or Dismissed; actions: freeze plot, notify the owner (creates an Owner shield alert), add a case; **Run detection now** |
| Inbox | /admin/inbox | Record-correction requests and suspicious-seller reports; resolve with a note, which notifies the citizen; age badges for old tickets |
| Rule Studio | /admin/rules | Toggle rules, edit weights, thresholds (typed fields) and advice text in both languages; **Simulate** on the 15 scenarios and see a before and after verdict table with changed rows highlighted; save with a reason; roll back to an earlier version. Blocker rules R01, R02, R03, R05 and R19 need a typed confirmation to disable |
| Reports | /admin/reports | Issued certificates with status; revoke with a reason (the public page then shows Revoked); verification logs with filters; abuse view of rate-limit hits |
| Audit log | /admin/audit | Searchable table of admin actions and a **Verify chain** button that says "Intact, N entries" or "Broken at entry X"; CSV export |
| System | /admin/system | **Scenario launcher** (15 cards that open the citizen check prefilled), **Reset demo data** (typed confirmation), citizen accounts (disable or enable), settings (rate limits, report validity days), and the synthetic-data statement |

**C. Experience rules**

- **4.5** Dark by default, dense but readable tables, keyboard shortcut / to search, filters kept in the URL so a view can be shared, and usable down to a 768 px tablet.

- **4.6** Every destructive action has a confirm dialog; every save shows a toast; every write shows who did it and when.

- **4.7** One admin role for now. The concept note describes the real-world split (registrar, AC Land officer, analyst, auditor); a capability matrix and a "view as" switch are a stretch goal.

**D. Tests**

- **4.8** Playwright: (1) approve the mutation on SCN-10, see ownership change, and see a watcher's notification; (2) freeze SCN-01, re-run the citizen check and see Stop with rule R19, and see the earlier certificate say "changed"; (3) in Rule Studio change R11's weight, simulate and see SCN-11 move, save, confirm the citizen engine follows, then roll back; (4) run detection and find a Double sale signal on SCN-09; (5) verify the audit chain is intact, run scripts/demo-tamper.mjs (service key, local only) and see it report broken; (6) revoke a certificate and see Revoked publicly; (7) a CSV import with three bad rows reports all three and imports nothing.

### Done when

- ☐ All nine modules work end to end, and every admin write appears in the audit log.

- ☐ The seven Playwright flows and the admin-function refusal script pass, along with all earlier tests.

- ☐ **Reset demo data** restores the 15 scenarios in under 10 seconds.

- ☐ The Rule Studio simulator shows the same verdicts the real engine returns after saving.

- ☐ The admin console is usable on a 1366 px laptop and a 768 px tablet.

- ☐ Round report, EXPLAIN-IT.md update, tag build-r4.

**Never in this round:** let a UI button write to a table directly (every write goes through an audited function), or leave a function callable by non-admins.

## Build Round 5: Integration, hardening and the submission kit

**Goal.** Make the 3D map, the citizen portal and the admin portal feel like one product, make it work on weak networks, harden security and privacy, run the full regression, and produce everything the rulebook asks you to submit. **Ends with** a tagged v1.0, a live URL, a README, a concept note, a demo video script and a pitch pack.

### Manual steps for you

- Ask a Bangla-speaking friend, mentor or classmate to read every Bangla screen and mark awkward or wrong wording, especially land terms (নামজারি, খাস, খতিয়ান, দাগ, মৌজা). Send the corrections to the AI.

- Ask your faculty mentor or the Law department to review the 20 rules (Round 2) and the checklist wording (Round 3).

- Record the demo video yourself from the storyboard; the AI writes the script, not the recording.

- Make the GitHub repository public or share it with the organizers, and submit on the LandTech platform.

### Tasks

**A. One product, not three**

- **5.1** *Coverage on the 3D map.* Add a public function area_coverage() that returns only counts per area (plots, share flagged), never personal data. The bridge uses it to put a subtle ring on areas that have data, and the area sheet shows "1,240 plots, 6% flagged". This needs one more small edit in main.js: a read-only navigation hook (about 20 lines) exposing the visible meshes and a flyToPath([division, district, area]) function. It is added to the allowed-edit list in Section 2.

- **5.2** *Deep links both ways.* /?focus=Dhaka__Dhaka__Uttara flies the 3D map to that area. The Plot Dossier overview has a **View on 3D map** button that uses it.

- **5.3** *Shared look.* A tokens.css file imported by index.html through a new <link> (not by editing style.css) so the map, portal and admin share colours, radius and the logo; the same splash; the lang key kept in sync across tabs through the storage event.

- **5.4** *Saved measurements.* A measured_lands table so signed-in users can import their Mapping tool lands (a one-way, one-time import from mapping.v1) and reuse them in comparisons. Add plots_overlapping(polygon) so a drawn polygon can start a check ("which recorded plots does this land overlap?"). The Mapping tool itself is not edited.

**B. Weak networks and phones**

- **5.5** Installable app with vite-plugin-pwa: a manifest built from the logo, a cached app shell for the portal, a cache-first rule for /models/*.glb and /draco/* so the 3D map reopens offline, and a store in IndexedDB for the last 10 dossiers with a clear "Saved offline, updated <time>" label. A saved dossier is never shown as current: it always carries its timestamp and a re-check button. The service worker never caches Supabase API calls.

- **5.6** Self-host the Noto Sans Bengali and Inter subsets as woff2 and remove the runtime Google Fonts requests, so Bangla renders even with no connection to Google.

- **5.7** Split bundles: the Leaflet-based pieces, the QR library and the print styles load on demand; three.js stays in the map entry; record bundle sizes against the Round 1 baseline.

- **5.8** *Could have:* a read-aloud button for the verdict using the browser's speech synthesis, hidden when no Bangla voice exists.

**C. Security and privacy review**

- **5.9** scripts/audit-rls.mjs lists every table and policy and fails if any land table has an anon or citizen policy, or if any function is callable by a role it should not be.

- **5.10** Secret hygiene: a scan for keys in git history and in dist/, .env* untracked, and a check that the service-role key and signing secret appear nowhere in the bundle.

- **5.11** Security headers in vercel.json: Content-Security-Policy (self, the Supabase URL, Esri and OpenStreetMap tiles, the Google Maps embed, Nominatim), X-Content-Type-Options, Referrer-Policy, Permissions-Policy (geolocation for self only) and frame-ancestors. Start in report-only mode, test every screen, then enforce.

- **5.12** Input and output: Zod validation on every form, no string-built SQL, a recorded review of every innerHTML in the legacy code (the Mapping tool escapes its values; the crumbs and tooltips use text), safe post-login redirects, admin idle timeout confirmed.

- **5.13** docs/PRIVACY.md: what is stored, what an anonymous visitor can see, what the public certificate page reveals (nothing personal), how long checks are kept, and why the Owner shield shows counts but never identities. All security testing is on your own prototype only (rulebook 8.4).

**D. Quality gates**

- **5.14** Run every Playwright flow from Rounds 3 and 4 on Chromium and on a WebKit iPhone profile; repeat the main flows with Slow 4G and 4x CPU throttling; run axe on every route; run Lighthouse and keep the budgets; check for broken links and missing translation keys.

- **5.15** A small concurrency check: 50 parallel dossier calls must all return correctly and stay under the Supabase free-tier limits.

- **5.16** An admin-only health page showing database reachability, latency and row counts, so you can see before a demo that the project is awake. Free Supabase projects can pause after about a week of inactivity, so open the project the day before.

**E. Submission kit** (rulebook 10.1, 10.2 and 11)

- **5.17** *README final:* set up in about ten minutes (install, env, SQL order, seed), demo credentials, data sources and the synthetic-data statement, **AI disclosure** (Claude used for planning and code generation over five build rounds, reviewed by the students), the credits and licences table, an architecture overview, a "Changes since Round 1" section, known limitations and a roadmap.

- **5.18** *Concept note* (docs/CONCEPT_NOTE.md, exported to a PDF of at most four pages) with the sections rulebook 10.1 requires: the chosen problem (P5) and the Bangladesh context; the solution; architecture and stack (with the diagram); key features; the **countrywide plan**; team and mentors.

- Countrywide plan content: Phase 1, a pilot with one upazila land office and sub-registry through read-only data exchange; Phase 2, district rollout with Union Digital Centres as assisted points and SMS or USSD for feature phones; Phase 3, national rollout joining records, mutation, registration, land tax and court-case systems through official data-sharing agreements, with national ID sign-in. Also covered: legal review of certificate wording, data protection, scaling (partition by district, spatial indexes, read replicas, caching public verification) and who runs it.

- **5.19** *Demo video storyboard* (3 minutes maximum), below.

- **5.20** *Final Round pack:* a 5-minute pitch script plus 3-minute Q&A guide that gives **both students** speaking parts (mentors may not answer for the team, rule 11.3); a pitch deck outline of at most 10 slides (title and team, problem, who suffers, solution, live demo, unique features, architecture, trust and privacy, countrywide plan, next steps); and docs/QA-PREP.md with the likely judge questions and answer points: how it differs from separate government portals, what happens when the record is wrong, misuse and scraping, privacy, name-matching accuracy, the legal standing of a certificate, scaling to 64 districts, rural access, how real data would arrive without scraping, and why Supabase (open-source Postgres that can be hosted by the government).

- **5.21** docs/EXPLAIN-IT.md finished: for each module, a plain-language paragraph, the files to open, and a sample judge question, with the modules split between the two student members so each can explain the code (rule 9.3).

- **5.22** Deliver docs/DEMO_SCRIPT.md, scripts/demo-tamper.mjs, a set of fallback screenshots and a recorded run in docs/demo-fallback/ in case the venue network fails, then tag v1.0 and push.

| Time | Scene | What the screen shows | Narration point |
| --- | --- | --- | --- |
| 0:00 to 0:15 | The problem | Title card: forged deeds, split records | A buyer must interpret records from several offices alone |
| 0:15 to 0:45 | From map to check | 3D map, tap an area, **Verify plots here**, choose a plot | The existing 3D map is the front door |
| 0:45 to 1:25 | A Stop | SCN-09 double sale, seller mismatch card, findings with advice | Not just data: a verdict, the reason and the next step |
| 1:25 to 1:55 | A Clear and a certificate | SCN-01 Clear, certified report, scan the QR on a phone, Genuine | A bank or lawyer can verify it in seconds |
| 1:55 to 2:25 | Records change | Admin freezes SCN-01; citizen re-checks and sees Stop; old certificate says "changed" | The answer stays trustworthy after the check |
| 2:25 to 2:50 | Fraud and integrity | Fraud center signal, Rule Studio simulation, audit chain verified | Governable, explainable, tamper-evident |
| 2:50 to 3:00 | Close | Countrywide map and one-line plan | From pilot upazila to national rollout |

**F. Stretch** (only if everything above is done): Bangla read-aloud, role split with a capability matrix, e-mail alerts through an Edge Function, recent registered deed values per mouza as a price sanity check (clearly not a valuation), an OCR hook that reads deed numbers from a photo (links to P1), and an assisted mode with large type for Union Digital Centre operators.

### Done when

- ☐ The 3D map shows coverage, area sheets show counts, and deep links work in both directions.

- ☐ The portal installs as an app and the last 10 dossiers open offline with their timestamps; the 3D map reopens offline after one visit.

- ☐ audit-rls, the secret scan, the header check and every Playwright flow pass on Chromium and WebKit; accessibility and performance budgets hold.

- ☐ A Bangla-speaking reviewer has signed off the Bangla copy, and the rules and checklist wording have been reviewed by a mentor.

- ☐ README, concept note PDF (four pages or fewer), demo storyboard, pitch pack, QA-PREP.md and EXPLAIN-IT.md exist.

- ☐ The live Vercel URL works from a phone on mobile data; v1.0 is tagged and pushed with the commit history intact.

**Never in this round:** enforce a Content-Security-Policy before testing it on every screen, cache API responses in the service worker, or write statistics into the concept note that you cannot source.

## Risks, open questions and final definition of done

The biggest risk is time: the rulebook's Round 1 deadline is October 16, 2026. Everything else below is manageable if each round stays deployable.

### Risks and fallbacks

| Risk | What could go wrong | Fallback |
| --- | --- | --- |
| Deadline | Five rounds do not fit before October 16 | The product is submittable after Build Round 3; submit with README, a short concept note and the video, and use Rounds 4 and 5 for the Final (rule 6.2.2) |
| Breaking the 3D map | A new feature changes how the map behaves | A strict allowed-edit list, the regression checklist, a Playwright smoke test, and the tag baseline-3d-map to compare against |
| Rule accuracy and legal wording | A rule gives advice a lawyer would not give | "Decision support, not legal advice" on every screen; mentor or Law department review of the 20 rules; rules editable without code; every finding shows its evidence |
| Supabase setup | SQL errors when pasting, an extension not enabled, free-tier limits (a free project can pause after inactivity and has a size cap, so check the dashboard) | Small numbered SQL files each ending with a check query; send any error back to the AI; open the project the day before a demo; the dataset is small (about 2,500 plots) |
| Venue network | Wi-Fi fails or Google services are blocked during the Final | Self-hosted fonts, offline cache of the app and 3D models, fallback screenshots and a recorded run |
| Synthetic data looks real | A generated name matches a real person | Names are assembled randomly, no NID, phone or street address exists, and a Demo data ribbon is always visible |
| Scope creep | Stretch items eat the must-haves | Priorities M, S and C in Section 4; stretch work starts only when a round's "Done when" list is complete |
| Explaining the code | A student cannot answer a judge (rulebook 9.3) | An EXPLAIN-IT.md update at the end of every round and a simple architecture |
| AI loses context between rounds | A new session repeats or contradicts earlier work | docs/PLAN.md and a report after every round, read at the start of the next |

### Questions for you

- **Is the October 16 deadline still in force?** If yes, do you want to submit after Build Round 3 (recommended) or wait for all five?

- **Can you send the Judging Rubric?** The plan is currently weighted toward a working, explainable, safe product with a strong demo.

- **Is the GitHub repository already linked as ****origin**** the one to submit**, and are you happy for it to be public or shared with the organizers? Do you already have a Supabase project and a Vercel account?

- **Team names and mentor names** for the README and concept note.

- **Technology assumption to confirm:** the new screens use React, TypeScript and Tailwind while the map stays vanilla JavaScript. Tell me if you would rather keep everything in plain JavaScript.

- **Pitch language:** Bangla, English, or both? This sets the default language of the demo.

- **Demo coverage:** should the AI choose the four upazilas, or do you want specific ones?

### Assumptions I made

Hosting on Vercel; Supabase free tier; the two demo logins in Round 1; about 2,500 synthetic plots in four upazilas; Bangla as the default language; light theme for the citizen portal and dark for the admin portal; one admin role; PDF made by the browser's print function.

### Final definition of done (v1.0)

- ☐ Your existing 3D map works as before and is still the home page.

- ☐ A citizen can check any of the 15 scenarios by four methods and gets the right verdict in Bangla and English.

- ☐ A certified report verifies publicly and reveals when the record has changed since it was issued.

- ☐ An admin can maintain records, run fraud detection, tune rules with a simulation, revoke certificates and verify the audit chain.

- ☐ Only synthetic data exists: no NID, phone number or real address; the Demo data ribbon is always visible; the README discloses AI use and credits every library.

- ☐ The submission items exist: concept note (4 pages or fewer), repository with README, demo video (3 minutes or less), live link, and a pitch deck (10 slides or fewer) for the Final.

- ☐ Both students can explain every module.