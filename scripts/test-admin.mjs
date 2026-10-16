import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const mk = async (email, password) => {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
};
const find = (o, k) => { if (!o || typeof o !== 'object') return undefined; if (k in o) return o[k]; for (const v of Object.values(o)) { const r = find(v, k); if (r !== undefined) return r; } };
const rows = [];
const t = (test, ok, got = '') => rows.push({ test, result: ok ? 'PASS' : 'FAIL', got: String(got).slice(0, 90) });

const cit = await mk('citizen.demo@example.com', 'Citizen@2026');
const adm = await mk('admin.demo@example.com', 'Admin@2026');

const refused = [
  ['admin_freeze_plot', { p_plot: 1, p_reason: 'x' }], ['admin_release_flag', { p_flag: 1 }],
  ['admin_add_case', { p_plot: 1, p_court: 'c', p_case_no: 'n', p_case_type: 'other', p_stay: false }],
  ['admin_file_mutation', { p_plot: 1, p_deed: 1, p_office: 'o' }], ['admin_decide_mutation', { p_mutation: 1, p_approve: true }],
  ['admin_revoke_report', { p_code: 'x', p_reason: 'x' }],
  ['admin_update_rule', { p_code: 'R11', p_enabled: true, p_weight: 1, p_params: {}, p_reason: 'x' }],
  ['admin_resolve_ticket', { p_kind: 'objection', p_id: 1, p_resolution: 'x' }], ['admin_set_signal_status', { p_id: 1, p_status: 'dismissed' }],
  ['run_fraud_detection', {}], ['admin_stats', {}], ['admin_audit_verify', {}], ['admin_reset_demo', {}],
];
for (const [fn, args] of refused) { const { error } = await cit.rpc(fn, args); t(`citizen refused: ${fn}`, !!error, error?.message); }

const { data: p } = await adm.from('plots').select('id').eq('scenario_code', 'SCN-01').single();
const run = async () => { const { data, error } = await cit.rpc('run_verification', { p_plot: p.id }); if (error) throw error; return data; };
const before = await run();
t('SCN-01 clear before freeze', find(before, 'verdict') === 'clear', find(before, 'verdict'));
const cert = await cit.rpc('issue_report', { p_verification: find(before, 'verification_id') ?? find(before, 'id') });
const code = find(cert.data, 'code');
t('certificate issued', !!code, cert.error?.message ?? code);
const ver = async () => { const r = await cit.rpc('verify_report', { p_code: code }); return r.error ? r.error.message : find(r.data, 'status'); };
t('certificate genuine', (await ver()) === 'genuine', await ver());

const fr = await adm.rpc('admin_freeze_plot', { p_plot: p.id, p_reason: 'test freeze' });
t('admin froze SCN-01', !fr.error, fr.error?.message);
const after = await run();
t('SCN-01 stop with R19 after freeze', find(after, 'verdict') === 'stop' && JSON.stringify(after).includes('R19'), find(after, 'verdict'));
t('old certificate says changed', (await ver()) === 'changed', await ver());
if (fr.data?.flag_id) { const rel = await adm.rpc('admin_release_flag', { p_flag: fr.data.flag_id }); t('admin released hold', !rel.error, rel.error?.message); }

const rv = await adm.rpc('admin_revoke_report', { p_code: code, p_reason: 'test revoke' });
t('admin revoked certificate', !rv.error, rv.error?.message);
t('public page says revoked', (await ver()) === 'revoked', await ver());

const blk = await adm.rpc('admin_update_rule', { p_code: 'R19', p_enabled: false, p_weight: 100, p_params: {}, p_reason: 'test' });
t('blocker rule needs typed confirmation', !!blk.error, blk.error?.message);
const fd = await adm.rpc('run_fraud_detection');
t('fraud detection runs', !fd.error, fd.error?.message ?? JSON.stringify(fd.data));
const av = await adm.rpc('admin_audit_verify');
t('audit chain verify runs', !av.error, av.error?.message ?? JSON.stringify(av.data));
const rs = await adm.rpc('admin_reset_demo');
t('reset demo data', !rs.error, rs.error?.message ?? JSON.stringify(rs.data));

console.table(rows);
process.exit(rows.some((r) => r.result === 'FAIL') ? 1 : 0);
