// Local demo only: tampers with one audit row on YOUR OWN prototype database, shows the chain break, then restores it.
import { execFileSync } from 'node:child_process';
const q = (sql) => {
  const o = execFileSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const j = JSON.parse(o); return j.rows ?? j;
};
const verify = () => {
  const r = q("select public.audit_verify() as r");
  return JSON.stringify(r[0].r);
};
const target = q('select id from public.audit_log order by id desc limit 1')[0]?.id;
if (!target) { console.log('No audit rows yet. Run npm run test:admin first.'); process.exit(1); }
console.log('1. before tamper :', verify());
q(`update public.audit_log set diff = coalesce(diff,'{}'::jsonb) || '{"tampered":true}'::jsonb where id = ${target}`);
console.log('2. after tamper  :', verify(), '  <- should report a break at row', target);
q(`update public.audit_log set diff = diff - 'tampered' where id = ${target}`);
console.log('3. after restore :', verify());
