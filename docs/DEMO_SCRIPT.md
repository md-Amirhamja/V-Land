# Demo script (3 minutes)
Setup: open the Supabase project the day before (free projects can pause). Run `select private.snapshot_demo()` once, then `select private.restore_demo()` before each run (or Admin > System > Reset). Citizen: citizen.demo@example.com. Admin: admin.demo@example.com (demo-only credentials, see README).

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Title card | A buyer must interpret records from several offices alone. |
| 0:15 | 3D map, tap Uttara, Verify plots here | The 3D map is the front door. |
| 0:45 | Check the SCN-09 plot as a citizen | Stop, with the reason and the next step. |
| 1:25 | Check SCN-01, get certified report, open /verify/CODE | Clear, and a bank can verify the report in seconds. |
| 1:55 | Admin > Records: freeze SCN-01. Re-run the citizen check | Same plot now says Stop (R19), and the old certificate says changed. |
| 2:25 | Admin > System: run detection. Admin > Audit: Verify chain | Governable and tamper-evident. |
| 2:50 | Close | From a pilot upazila to national rollout. |

Fallback if the network fails: screenshots and a screen recording in docs/demo-fallback/.
Optional live twist: `npm run demo:tamper` shows the audit chain breaking and restoring.
