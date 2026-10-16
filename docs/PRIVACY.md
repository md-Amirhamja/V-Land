# Privacy and data handling

**All data is synthetic** (rulebook 8.1, 8.2). There is no NID, phone number or real address field in any table. Every page shows a "Demo data" ribbon.

| Who | What they can see |
| --- | --- |
| Anonymous visitor | The area hierarchy (names only), a quick-check verdict with masked owner names, and certificate authenticity by code. |
| Citizen | The above plus the full dossier from `run_verification`, their own checks, certificates, watches and notifications. Own rows only, enforced by row-level security. |
| Admin | Records, rules, queues and the audit log, through audited functions only. |

- Land tables have row-level security on and **no** public or citizen policy. The browser never reads them; it calls security-definer functions with a fixed search_path.
- The public certificate page (`verify_report`) returns status, issue date, verdict at issue and a hash fingerprint. It returns no personal names (tested in `npm run test:engine`).
- The Owner shield shows how many times a plot was checked, never who checked it.
- The signing secret lives in `private.app_secrets`, which is not exposed through the API. The service-role key is never in the bundle or in git (`npm run scan:secrets`).
- Admin writes are hash-chained in `audit_log`; `audit_verify()` detects tampering (`npm run demo:tamper`).
- Security testing was done only against our own prototype (rulebook 8.4). No government system was queried or scraped (8.3).
- Retention: verification records are kept for the life of the demo project. A real deployment would set a retention period with the land office.
