// Headless smoke test: boots the game, opens menus, creates a world and plays a few frames.
// Usage: node scripts/smoke.mjs [shots-dir]   (needs `playwright` installed and the server running on :8080)
import { chromium } from 'playwright';
const out = process.argv[2] || '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.addInitScript(() => { if (!localStorage.getItem('pixelrealms.profile.v1')) localStorage.setItem('pixelrealms.profile.v1', JSON.stringify({ ageGroup: 'adult' })); });
await page.goto('http://localhost:8080/');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/01-title.png` });
for (const [act, arg, name] of [['go', 'shop', '02-shop'], ['tab', 'boosts', '03-boosts'], ['go', 'pass', '04-pass'], ['go', 'skins', '05-skins'], ['go', 'settings', '06-settings']]) {
  await page.evaluate(([a, b]) => { const el = document.createElement('i'); el.dataset.act = a; el.dataset.arg = b; document.querySelector('#ui').appendChild(el); el.click(); el.remove(); }, [act, arg]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
}
const mode = process.env.MODE || 'survival';
await page.evaluate((mode) => { window.__game.clearWorld(); window.__game.startWorld({ id: 'smoke', name: 'smoke', seed: 1234, seedText: '', mode }); document.querySelector('#ui').innerHTML = ''; }, mode);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/07-game-${mode}.png` });
console.log(JSON.stringify(await page.evaluate(() => ({ pos: window.__game.p.pos, chunks: window.__game.world.chunks.size }))));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
