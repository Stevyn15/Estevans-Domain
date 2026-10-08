// Copies the deployable web build into _site/ (used by the GitHub Pages workflow; handy for any static host).
import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
const out = '_site'; rmSync(out, { recursive: true, force: true }); mkdirSync(out);
for (const p of ['index.html', 'css', 'js', 'vendor']) cpSync(p, `${out}/${p}`, { recursive: true });
writeFileSync(`${out}/.nojekyll`, '');
console.log(`web build → ${out}/`);
