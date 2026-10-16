# Round 2 report

Built: schema (010), verdict engine (011), RPC functions (012), synthetic seed (01_seed.sql, 2,415 plots, 15 scenarios), engine and security tests (scripts/test-engine.mjs, 27 of 27 passing).

Run: apply migrations 001, 002, 003, 010, 011, 012 in order with `supabase db query --linked -f <file>`, then seed with supabase/seed/01_seed.sql, then `npm run test:engine`.

Known gaps: /admin/sandbox page, reset_demo_data(), docs/DATA.md, docs/NAME_MATCHING.md, dossier timing measurement. npm audit: 2 moderate react-router advisories (fix needs v7, a breaking change), deferred.
