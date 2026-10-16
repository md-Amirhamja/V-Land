// Local demo only: tampers with one audit row on YOUR OWN prototype database, shows the chain break, then restores it.
import { execFileSync } from 'node:child_process';
const q = (sql) => {
  const o = execFileSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const j = JSON.parse(o); return j.rows ?? j;
};
const verify = () => {
  const r = q(`with x as (select id, actor, action, entity, entity_id, diff, created_at, prev_hash, hash, lag(hash) over (order by id) as ph from public.audit_log),
y as (select id, (prev_hash = coalesce(ph, repeat('0',64)) and hash = encode(extensions.digest(coalesce(ph, repeat('0',64)) || '|' || id || '|' || coalesce(actor::text,'') || '|' || action || '|' || entity || '|' || coalesce(entity_id,'') || '|' || diff::text || '|' || to_char(created_at at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.US'), 'sha256'), 'hex')) as ok from x)
select jsonb_build_object('intact', coalesce(bool_and(ok), true), 'broken_at', min(id) filter (where not ok), 'entries', count(*)) as r from y`);
  return JSON.stringify(r[0].r);
};
const target = q('select id from public.audit_log order by id desc limit 1')[0]?.id;
if (!target) { console.log('No audit rows yet. Run npm run test:admin first.'); process.exit(1); }
console.log('1. before tamper :', verify());
q(`update public.audit_log set diff = coalesce(diff,'{}'::jsonb) || '{"tampered":true}'::jsonb where id = ${target}`);
console.log('2. after tamper  :', verify(), '  <- should report a break at row', target);
q(`update public.audit_log set diff = diff - 'tampered' where id = ${target}`);
console.log('3. after restore :', verify());
