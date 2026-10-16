import { execFileSync } from 'node:child_process';
const q = (sql) => {
  const j = JSON.parse(execFileSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  return j.rows ?? j;
};
let bad = 0;
const fail = (m) => { console.log('FAIL', m); bad++; };
const LAND = ['plots', 'persons', 'ownerships', 'deeds', 'deed_parties', 'mutations', 'cases', 'land_flags', 'tax_records', 'survey_records', 'mouzas', 'acquisition_zones', 'fraud_signals', 'risk_rules', 'risk_rules_history', 'reports', 'plot_events', 'audit_log'];

for (const r of q("select table_name, privilege_type from information_schema.role_table_grants where grantee='anon' and table_schema='public'"))
  if (!(r.table_name === 'geo_units' && r.privilege_type === 'SELECT')) fail(`anon grant ${r.privilege_type} on ${r.table_name}`);

for (const r of q("select table_name, privilege_type from information_schema.role_table_grants where grantee='authenticated' and table_schema='public'")) {
  if (['TRUNCATE', 'REFERENCES', 'TRIGGER'].includes(r.privilege_type)) fail(`authenticated ${r.privilege_type} on ${r.table_name}`);
  if (LAND.includes(r.table_name) && ['INSERT', 'UPDATE', 'DELETE'].includes(r.privilege_type)) fail(`authenticated direct write ${r.privilege_type} on ${r.table_name}`);
}
const OWN_OK = new Set(['reports_own_select']);
for (const r of q("select tablename, policyname, qual from pg_policies where schemaname='public'"))
  if (LAND.includes(r.tablename) && !(OWN_OK.has(r.policyname) && String(r.qual ?? '').includes('auth.uid()')) && !String(r.qual ?? '').includes('is_admin')) fail(`non-admin policy ${r.policyname} on ${r.tablename}`);

for (const r of q("select tablename from pg_tables where schemaname='public' and not rowsecurity")) fail(`RLS off: ${r.tablename}`);

for (const r of q("select p.proname from pg_proc p where p.pronamespace='public'::regnamespace and (left(p.proname,6)='admin_' or p.proname in ('run_fraud_detection','reset_demo_data','audit_write','audit_verify','plot_dossier')) and has_function_privilege('anon', p.oid, 'execute')"))
  fail(`anon can execute ${r.proname}`);
for (const r of q("select p.proname from pg_proc p where p.pronamespace='private'::regnamespace and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))"))
  fail(`private function exposed: ${r.proname}`);

console.log(bad ? `${bad} problem(s)` : 'audit-rls: all checks passed');
process.exit(bad ? 1 : 0);
