// Dependency-free "lint": syntax-checks every JS/MJS file (catches typos before they hit a device) and
// flags leftovers that must never ship. Run: npm run lint
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const skip = new Set(['node_modules', '.git', 'vendor', 'test-results', 'store']);
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (skip.has(n)) continue;
    const p = join(d, n); const s = statSync(p);
    if (s.isDirectory()) walk(p); else if (['.js', '.mjs'].includes(extname(n))) files.push(p);
  }
})(root);

let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { bad++; console.error(`✖ syntax: ${f}\n${r.stderr}`); }
  const src = readFileSync(f, 'utf8');
  if (/^\s*debugger\s*;?\s*$/m.test(src) || /console\.log\(.*(password|secret|token)/i.test(src)) { bad++; console.error(`✖ leftover debug/secret logging in ${f}`); }
  if (/\b(AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{20,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----)/.test(src)) { bad++; console.error(`✖ possible secret committed in ${f}`); }
}
console.log(bad ? `\n${bad} problem(s)` : `lint ok (${files.length} files)`);
process.exit(bad ? 1 : 0);
