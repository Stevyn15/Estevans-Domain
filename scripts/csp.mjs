// Regenerates the Content-Security-Policy <meta> in index.html (hashing the inline import map).
// Run after editing the importmap:  node scripts/csp.mjs        (npm run csp)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const policy = (scriptHashes) => [
  "default-src 'none'",
  `script-src 'self' ${scriptHashes.map((h) => `'sha256-${h}'`).join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",   // inline styles are used by the UI templates
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'",
].join('; ');
export const sha256 = (s) => createHash('sha256').update(s).digest('base64');

if (process.argv[1].endsWith('csp.mjs')) {
  const file = new URL('../index.html', import.meta.url);
  let html = readFileSync(file, 'utf8');
  const im = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1];
  const meta = `<!-- csp:start --><meta http-equiv="Content-Security-Policy" content="${policy([sha256(im)])}"><!-- csp:end -->`;
  html = /<!-- csp:start -->[\s\S]*?<!-- csp:end -->/.test(html) ? html.replace(/<!-- csp:start -->[\s\S]*?<!-- csp:end -->/, meta) : html.replace('<title>', `${meta}\n  <meta name="referrer" content="no-referrer">\n  <title>`);
  writeFileSync(file, html); console.log('CSP updated');
}
