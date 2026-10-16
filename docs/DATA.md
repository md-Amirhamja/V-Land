# Synthetic data statement

All land data in V-Land P5 is synthetic (rulebook 8.1 and 8.2). No real person, NID, phone number, address or land record is used.

Seed file: supabase/seed/01_seed.sql. It creates 2,415 plots, 2,464 persons, 2,421 deeds, 2,422 ownerships, 6,030 survey records, 14,490 tax records and 2 acquisition zones, in four upazilas: Uttara, Gazipur Sadar, Khulna Sadar and Sylhet Sadar (Dhaka, Dhaka, Khulna and Sylhet divisions).

Fifteen plots carry the fixed scenario codes SCN-01 to SCN-15. Each has an expected verdict that scripts/test-engine.mjs checks.

Every land row has is_synthetic = true. The schema has no NID, phone or e-mail column on land tables. Check with:
select table_name, column_name from information_schema.columns where table_schema = 'public' and column_name ~* '(nid|phone|mobile|passport)';
Expected result: no rows.

Demo reset: private.snapshot_demo() stores the 15 scenario plots and their records. reset_demo_data() (admin only) restores them.
