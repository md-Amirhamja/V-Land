// npm run test:engine  -> runs supabase/tests/engine.sql through the logged-in Supabase CLI
import { spawnSync } from 'node:child_process';
const r = spawnSync('supabase', ['db', 'query', '--linked', '-f', 'supabase/tests/engine.sql'], { encoding: 'utf8' });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
const fails = (r.stdout || '').split('\n').filter((l) => /\bFAIL\b/.test(l)).length;
if (r.status) process.exit(r.status);
if (fails) { console.error(`\n${fails} check(s) FAILED`); process.exit(1); }
console.log('\nAll checks passed');
