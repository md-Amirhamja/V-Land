import { execSync } from 'node:child_process';
const q = (sql) => JSON.parse(execSync(`supabase db query --linked -o json ${JSON.stringify(sql)}`, { encoding: 'utf8' }));
let bad = 0;
const g = q("select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name<>'geo_units'");
const rows = g.rows ?? g;
for (const r of rows) {
  if (r.grantee === 'anon') { console.log('FAIL anon grant', r.table_name, r.privilege_type); bad++; }
  if (r.grantee === 'authenticated' && r.privilege_type !== 'SELECT' && ['plots','ownerships','persons','deeds','audit_log'].includes(r.table_name)) { console.log('FAIL citizen write', r.table_name, r.privilege_type); bad++; }
}
const nr = q("select tablename from pg_tables where schemaname='public' and not rowsecurity");
for (const r of (nr.rows ?? nr)) { console.log('FAIL no RLS', r.tablename); bad++; }
console.log(bad ? `${bad} problem(s)` : 'audit-rls: all checks passed');
process.exit(bad ? 1 : 0);
