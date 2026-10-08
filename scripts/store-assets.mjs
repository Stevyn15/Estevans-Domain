// Generates captioned store screenshots at store-required sizes into store/screenshots/.
//   npm run store:assets        (needs: npx playwright install chromium)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 19000 + Math.floor(Math.random() * 500), BASE = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 100)); }

const DEVICES = [
  { dir: 'ios-6.7in-2796x1290', viewport: { width: 932, height: 430 }, scale: 3 },
  { dir: 'android-phone-1920x1080', viewport: { width: 960, height: 540 }, scale: 2 },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

for (const d of DEVICES) {
  const out = `store/screenshots/${d.dir}`; mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.scale });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('pixelrealms.profile.v1', JSON.stringify({ ageGroup: 'adult', coins: 1250, xp: 1850, equipped: 'neon', ownedSkins: ['explorer', 'miner', 'neon', 'knight'],
      consent: { version: 1, ts: 1, analytics: false }, streak: { last: new Date().toISOString().slice(0, 10), count: 3 } }));
  });
  await page.goto(BASE); await page.waitForFunction(() => window.__game); await page.waitForTimeout(1200);
  const caption = (t, solid) => page.evaluate(([t, solid]) => { document.getElementById('cap')?.remove(); document.querySelectorAll('.topbar h2').forEach((h) => { h.style.visibility = 'hidden'; }); const c = document.createElement('div'); c.id = 'cap'; c.textContent = t; c.style.cssText = 'position:fixed;left:0;right:0;top:0;padding:14px 20px;text-align:center;font:700 clamp(14px,3.4vw,26px)/1.3 "Press Start 2P",monospace;color:#fff;text-shadow:3px 3px 0 #000;background:' + (solid ? '#0b1020f2' : 'linear-gradient(#000a,#0000)') + ';z-index:99;pointer-events:none'; document.body.appendChild(c); }, [t, solid]);
  const shot = async (name, cap, solid = false) => { await caption(cap, solid); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${name}.png` }); };
  const ui = (a, arg) => page.evaluate(([x, y]) => { const el = document.createElement('i'); el.dataset.act = x; if (y !== undefined) el.dataset.arg = y; document.querySelector('#ui').appendChild(el); el.click(); el.remove(); }, [a, arg]);

  await shot('01-title', 'BUILD. SURVIVE. OUTLAST THE STORM.');
  await ui('daily'); await page.waitForTimeout(2500);
  await page.evaluate(async () => { const g = window.__game, p = g.p; p.pos.y = g.world.surfaceY(Math.floor(p.pos.x), Math.floor(p.pos.z)) + 0.1; p.gliding = false; p.vel.set(0, 0, 0); p.pitch = -0.05; await new Promise((r) => setTimeout(r, 500)); g.build('wall'); g.build('ramp'); g.startSonar(); g.cam = 1; await new Promise((r) => setTimeout(r, 600)); });
  await shot('02-storm-royale', 'DROP IN. LOOT. BUILD. WIN.');
  await page.evaluate(() => { const g = window.__game; g.exitWorld(); });
  await page.evaluate(() => { const g = window.__game; g.startWorld({ id: 'shot', name: 'shot', seed: 2024, seedText: '', mode: 'creative' }); document.querySelector('#ui').innerHTML = ''; g.p.pitch = -0.25; g.cam = 1; });
  await page.waitForTimeout(1800); await shot('03-creative', 'BUILD ANYTHING YOU CAN IMAGINE');
  await page.evaluate(() => window.__game.exitWorld()); await ui('go', 'skins'); await page.waitForTimeout(900); await shot('04-skins', '16+ SKINS TO COLLECT', true);
  await ui('go', 'pass'); await page.waitForTimeout(500); await page.evaluate(() => { document.querySelector('#track').scrollIntoView({ block: 'end' }); }); await shot('05-battle-pass', '30-TIER BATTLE PASS', true);
  await ctx.close();
}
await browser.close(); server.kill();
console.log('screenshots → store/screenshots/');
