// Round 1 security check: node scripts/test-auth-rls.mjs   (reads VITE_SUPABASE_* from .env.local; uses ONLY the anon key)
// Proves: (1) anon cannot read profiles, (2) a citizen cannot promote themselves, (3) a citizen cannot see other profiles,
//         (4) anon CAN read the public geo hierarchy, (5) anon cannot read mouzas.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key } = env;
if (!url || !key) { console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local'); process.exit(2); }

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };

const anon = createClient(url, key);
{
  const { data, error } = await anon.from('profiles').select('*');
  check('anon: select * from profiles returns nothing', !error && data.length === 0 || !!error, error ? `(refused: ${error.message})` : `(${data.length} rows)`);
}
{
  const { data, error } = await anon.from('geo_units').select('id', { count: 'exact', head: true });
  check('anon: can read public geo hierarchy', !error, error?.message ?? '');
}
{
  const { data, error } = await anon.from('mouzas').select('*');
  check('anon: cannot read mouzas', !!error || data.length === 0);
}

const cit = createClient(url, key);
const { error: le } = await cit.auth.signInWithPassword({ email: 'citizen.demo@example.com', password: 'Citizen@2026' });
check('citizen demo user can sign in', !le, le?.message ?? '');
if (!le) {
  const { data: mine } = await cit.from('profiles').select('id, role');
  check('citizen: sees exactly their own profile', mine?.length === 1 && mine[0].role === 'citizen', `(${mine?.length} rows)`);
  const { error: upErr } = await cit.from('profiles').update({ role: 'admin' }).eq('id', mine[0].id);
  const { data: after } = await cit.from('profiles').select('role').eq('id', mine[0].id).single();
  check('citizen: cannot change own role to admin', after.role === 'citizen', upErr ? `(refused: ${upErr.message})` : '(update ignored)');
  const { error: nameErr } = await cit.from('profiles').update({ display_name: 'Demo Citizen' }).eq('id', mine[0].id);
  check('citizen: can still edit display_name', !nameErr, nameErr?.message ?? '');
  const { data: admin } = await cit.rpc('is_admin');
  check('citizen: is_admin() is false', admin === false);
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
