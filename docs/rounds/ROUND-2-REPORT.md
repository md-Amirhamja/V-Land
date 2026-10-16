# Round 2 report

Built: schema (010), verdict engine (011), RPC functions (012), reset function (013), synthetic seed (01_seed.sql, 2,415 plots, 15 scenarios), engine and security tests (scripts/test-engine.mjs, 27 of 27 passing), admin sandbox at /admin/sandbox, docs/DATA.md and docs/NAME_MATCHING.md.

Run: apply migrations 001, 002, 003, 010, 011, 012, 013 in order with `supabase db query --linked -f <file>`, seed with supabase/seed/01_seed.sql, take the snapshot with `select private.snapshot_demo()`, then `npm run test:engine`.

Known gaps: dossier timing measurement (target under 400 ms). npm audit: 2 moderate react-router advisories (fix needs v7, a breaking change), deferred.
