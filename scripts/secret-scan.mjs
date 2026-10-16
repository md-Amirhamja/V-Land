import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
let bad = 0, anon = 0;
const fail = (m) => { console.log('FAIL', m); bad++; };
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter((f) => f && !f.startsWith('public/') && !f.includes('package-lock') && /\.(js|mjs|ts|tsx|json|md|sql|html|css|sh|example)$/.test(f));
const files = [...tracked, ...(statSync('dist', { throwIfNoEntry: false }) ? walk('dist') : [])];
for (const f of files) {
  let s; try { s = readFileSync(f, 'utf8'); } catch { continue; }
  for (const m of s.match(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g) ?? []) {
    try {
      const role = JSON.parse(Buffer.from(m.split('.')[1], 'base64url').toString()).role;
      if (role === 'anon') anon++; else fail(`${f}: JWT with role "${role}"`);
    } catch { /* not a JWT */ }
  }
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(s)) fail(`${f}: sb_secret_ key`);
}
const env = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter((f) => /(^|\/)\.env/.test(f) && !f.endsWith('.env.example'));
if (env.length) fail(`tracked env files: ${env.join(', ')}`);
console.log(`anon keys found: ${anon} (expected, they are public by design)`);
console.log(bad ? `${bad} problem(s)` : 'secret-scan: OK');
process.exit(bad ? 1 : 0);
