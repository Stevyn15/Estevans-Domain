// Pre-launch gate: enforces the checklist in docs/SECURITY.md and docs/STORE_AND_MARKETING.md so nothing
// slips through. Blocking items fail the run (exit 1). Use --warn to print without failing (CI on every push).
//   npm run release:check          strict
//   npm run release:check -- --warn
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const warnOnly = process.argv.includes('--warn');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { APP } = await import('../js/config.js');
const appJson = JSON.parse(read('mobile/app.json')).expo;
const eas = existsSync(new URL('../mobile/eas.json', import.meta.url)) ? JSON.parse(read('mobile/eas.json')) : null;
const main = read('js/main.js'), html = read('index.html'), purchases = read('mobile/src/purchases.ts');

const checks = [
  ['APP.testPayments is false (no simulated purchases)', APP.testPayments === false, 'set testPayments: false in js/config.js'],
  ['Privacy/terms/share URLs are real (not example.com)', ![APP.privacyUrl, APP.termsUrl, APP.shareUrl].some((u) => /example\.com/.test(u)), 'edit js/config.js'],
  ['Support email is real', !/example\.com/.test(APP.supportEmail), 'edit js/config.js'],
  ['iOS bundleIdentifier is yours', !/com\.example/.test(appJson.ios?.bundleIdentifier || 'com.example'), 'edit mobile/app.json'],
  ['Android package is yours', !/com\.example/.test(appJson.android?.package || 'com.example'), 'edit mobile/app.json'],
  ['Debug handle is gated (window.__game)', /__DEBUG__/.test(main) && !/^window\.__game = game;/m.test(main), 'gate window.__game in js/main.js'],
  ['CSP present, no unsafe-eval / script unsafe-inline', /Content-Security-Policy/.test(html) && !/script-src[^;]*unsafe-(eval|inline)/.test(html), 'run npm run csp'],
  ['Native purchases refuse to simulate in release', /if \(!__DEV__\) return \{ ok: false \}/.test(purchases) || !/Alert\.alert/.test(purchases), 'see mobile/src/purchases.ts — wire RevenueCat'],
  ['Real purchase provider wired (RevenueCat/StoreKit/Billing)', /^\s*import .* from 'react-native-purchases'/m.test(purchases), 'implement purchaseProduct() with react-native-purchases'],
  ['EAS production profile exists', !!eas?.build?.production, 'mobile/eas.json'],
  ['iOS privacy manifest declares no tracking', appJson.ios?.privacyManifests?.NSPrivacyTracking === false, 'mobile/app.json'],
  ['Android backups disabled', appJson.android?.allowBackup === false, 'mobile/app.json'],
  ['App icon is not the Expo template', existsSync(new URL('../mobile/assets/icon.png', import.meta.url)) && createHash('sha1').update(readFileSync(new URL('../mobile/assets/icon.png', import.meta.url))).digest('hex') !== TEMPLATE_ICON_SHA(), 'design a real icon → mobile/assets/icon.png'],
];
function TEMPLATE_ICON_SHA() { try { return readFileSync(new URL('../mobile/assets/.template-icon.sha1', import.meta.url), 'utf8').trim(); } catch { return ''; } }

let failed = 0;
for (const [name, ok, fix] of checks) { console.log(`${ok ? '✔' : '✖'} ${name}${ok ? '' : `\n    → ${fix}`}`); if (!ok) failed++; }
console.log(`\n${checks.length - failed}/${checks.length} release checks pass${warnOnly && failed ? ' (warn-only mode: not failing)' : ''}`);
process.exit(failed && !warnOnly ? 1 : 0);
