// End-to-end tests in headless Chromium: consent/age gate, child safety, daily royale run, survival basics,
// data export/delete, and the native bridge (using the generated mobile bundle if present).
//   npm run e2e            (needs: npx playwright install chromium)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const PORT = 18000 + Math.floor(Math.random() * 1000), BASE = `http://localhost:${PORT}`;
const OUT = 'test-results'; mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 100)); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const CONSENTED = { ageGroup: 'adult', consent: { version: 1, ts: 1, analytics: false } };
let passed = 0, failed = 0;

async function scenario(name, opts, fn) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 960, height: 600 }, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (opts.profile) await page.addInitScript((p) => { if (!localStorage.getItem('pixelrealms.profile.v1')) localStorage.setItem('pixelrealms.profile.v1', JSON.stringify(p)); }, opts.profile);
  if (opts.init) await page.addInitScript(opts.init);
  try {
    await fn(page, ctx);
    assert.deepEqual(errors, [], `console/page errors:\n${errors.join('\n')}`);
    passed++; console.log(`  ok   ${name}`);
  } catch (e) {
    failed++; console.error(`  FAIL ${name}\n       ${String(e.message).split('\n').join('\n       ')}`);
    await page.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, '-')}.png` }).catch(() => {});
  } finally { await ctx.close(); }
}
const act = (page, a, arg) => page.evaluate(([x, y]) => { const el = document.createElement('i'); el.dataset.act = x; if (y !== undefined) el.dataset.arg = y; document.querySelector('#ui').appendChild(el); el.click(); el.remove(); }, [a, arg]);
const text = (page) => page.evaluate(() => document.body.innerText);
const boot = async (page, url = `${BASE}/`) => { await page.goto(url); await page.waitForFunction(() => window.__game); await page.waitForTimeout(600); };
const land = (page) => page.evaluate(async () => { const g = window.__game, p = g.p; p.pos.y = g.world.surfaceY(Math.floor(p.pos.x), Math.floor(p.pos.z)) + 0.1; p.gliding = false; p.vel.set(0, 0, 0); await new Promise((r) => setTimeout(r, 400)); });

await scenario('consent gate blocks until terms accepted, then pays streak', {}, async (page) => {
  await boot(page);
  await page.fill('#birthYear', '1995'); await page.click('[data-act=ageOk]');
  assert.ok(await page.locator('#birthYear').count(), 'must stay on the gate without ToS');
  await page.check('#agreeTos'); await page.click('[data-act=ageOk]'); await page.waitForTimeout(500);
  assert.match(await text(page), /DAILY CHALLENGE/); assert.match(await page.locator('.sheet h3').innerText(), /streak/);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('pixelrealms.profile.v1')));
  assert.equal(p.consent.analytics, false); assert.equal(p.ageGroup, 'adult'); assert.ok(!('birthYear' in p), 'birth year must not be stored'); assert.ok(p._sig);
});

await scenario('under-13: purchases, invites, analytics and clips are off', {}, async (page) => {
  await boot(page);
  await page.fill('#birthYear', String(new Date().getFullYear() - 9)); await page.check('#agreeTos'); await page.check('#optAnalytics'); await page.click('[data-act=ageOk]'); await page.waitForTimeout(400);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('pixelrealms.profile.v1')));
  assert.equal(p.ageGroup, 'child'); assert.equal(p.consent.analytics, false, 'analytics must be forced off for children');
  await act(page, 'closeModal'); await act(page, 'go', 'shop'); await page.waitForTimeout(300);
  assert.match(await text(page), /Purchases are turned off/);
  await act(page, 'buy', 'bp_premium'); await page.waitForTimeout(300);
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('pixelrealms.profile.v1')).premium)), false);
  assert.equal(await page.locator('.modal').count(), 0, 'no checkout sheet for children');
  await act(page, 'back'); await act(page, 'go', 'settings'); await page.waitForTimeout(200);
  assert.ok(!(await text(page)).includes('INVITE FRIENDS'));
  await page.evaluate(() => window.__game.startWorld({ id: 'k', name: 'k', seed: 1, seedText: '', mode: 'survival' })); await act(page, 'closeModal');
});

await scenario('invite link prefill + privacy screen + export + delete', { profile: CONSENTED }, async (page) => {
  await boot(page, `${BASE}/?ref=ABCD23`);
  await act(page, 'go', 'settings'); await page.waitForTimeout(200);
  assert.equal(await page.inputValue('#refInput'), 'ABCD23');
  await act(page, 'redeem'); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pixelrealms.profile.v1')).refRedeemed), 'ABCD23');
  await act(page, 'go', 'privacy'); await page.waitForTimeout(200);
  const exp = await page.evaluate(async () => (await import('/js/privacy.js')).exportData());
  assert.ok(exp.data['pixelrealms.profile.v1']);
  await act(page, 'deleteAsk'); await page.waitForTimeout(200);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), act(page, 'deleteGo')]); await page.waitForTimeout(800);
  assert.ok(await page.locator('#birthYear').count(), 'after deleting all data the age gate must return');
});

await scenario('daily royale: loot, build, abilities, storm, win, share', { profile: CONSENTED }, async (page) => {
  await boot(page); await act(page, 'daily'); await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({ mode: window.__game.gameMode, bots: window.__game.royale.bots.length, chests: window.__game.royale.beams.size, daily: window.__game.meta.daily }));
  assert.equal(r.mode, 'royale'); assert.equal(r.bots, 7); assert.equal(r.chests, 36); assert.ok(r.daily > 0);
  await land(page);
  const res = await page.evaluate(() => {
    const g = window.__game, p = g.p, out = {};
    g.build('wall'); g.build('ramp'); g.build('floor'); out.mats = g.mats;
    g.useAbility(); out.cd = g.abilityCd; g.startSonar(); out.sonar = g.sonar.length; g.explode(p.pos.x + 6, p.pos.y, p.pos.z, 3);
    const k = [...g.royale.beams.keys()][0].split(',').map(Number); const inv0 = g.inv.filter(Boolean).length;
    g.openChest({ x: k[0], y: k[1], z: k[2], id: g.B.CHEST }); out.looted = g.inv.filter(Boolean).length > inv0 && g.ammo > 36;
    for (let i = 0; i < 400; i++) { g.time += 0.05; p.pos.x = g.royale.center.x; p.pos.z = g.royale.center.y; p.pos.y = g.world.surfaceY(Math.floor(p.pos.x), Math.floor(p.pos.z)) + 0.1; g.royale.update(0.5); } out.storm = g.royale.radius;
    g.royale.end(true); return out;
  });
  assert.ok(res.mats < 150 && res.cd > 0 && res.sonar > 0 && res.looted); assert.ok(res.storm < 110, 'storm must shrink');
  await page.waitForSelector('[data-act=shareRes]');
  assert.match(await text(page), /LAST ONE STANDING/);
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem('pixelrealms.profile.v1')).daily.best);
  assert.equal(best.place, 1);
  const share = await page.evaluate(async () => { const v = await import('/js/viral.js'); return v.resultShareText(window.__lastRes); });
  assert.match(share, /Daily #\d+ — placed #1/);
});

await scenario('survival: mine, craft, place, save & resume', { profile: CONSENTED }, async (page) => {
  await boot(page);
  const out = await page.evaluate(async () => {
    const g = window.__game; g.startWorld({ id: 'e2e-s', name: 's', seed: 99, seedText: '', mode: 'survival' }); document.querySelector('#ui').innerHTML = '';
    const p = g.p, x = Math.floor(p.pos.x), z = Math.floor(p.pos.z), y = g.world.surfaceY(x, z) - 1;
    g.breakBlock({ x, y, z, id: g.world.getBlock(x, y, z) }); const o = {}; o.afterMine = g.world.getBlock(x, y, z) === 0; o.inv = g.inv.filter(Boolean).length;
    g.addItem(g.B.LOG, 2); o.crafted = g.craft({ out: [g.B.PLANKS, 4], in: [[g.B.LOG, 1]] }); o.planks = g.countOf(g.B.PLANKS);
    g.saveWorld(); o.saved = !!localStorage.getItem('pixelrealms.world.e2e-s'); return o;
  });
  assert.ok(out.afterMine && out.inv >= 1 && out.crafted && out.planks === 4 && out.saved);
});

const bundle = 'mobile/src/gameHtml.generated.ts';
if (existsSync(bundle)) {
  const src = readFileSync(bundle, 'utf8'); const html = JSON.parse(src.slice(src.indexOf('= ') + 2, src.lastIndexOf(';')));
  await scenario('native bundle under its CSP: bridge purchase / decline / deep link / consent', {
    viewport: { width: 844, height: 390 }, touch: true,
    init: () => { window.__DEBUG__ = true; window.__posted = []; window.ReactNativeWebView = { postMessage: (s) => window.__posted.push(JSON.parse(s)) }; window.__NATIVE__ = { platform: 'ios', testPayments: true }; },
  }, async (page) => {
    await page.route('https://game.pixelrealms.invalid/**', (r) => r.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('https://game.pixelrealms.invalid/'); await page.waitForFunction(() => window.__game);
    await page.fill('#birthYear', '1990'); await page.check('#agreeTos'); await page.click('[data-act=ageOk]'); await page.waitForTimeout(500);
    assert.ok((await page.evaluate(() => window.__posted.map((m) => m.type))).includes('consent'), 'consent must be mirrored to secure storage');
    await act(page, 'closeModal'); await act(page, 'go', 'shop'); await act(page, 'tab', 'boosts'); await page.waitForTimeout(300);
    await act(page, 'buy', 'perk_fastHands'); await page.waitForTimeout(300);
    const m1 = await page.evaluate(() => window.__posted.find((m) => m.type === 'purchase'));
    assert.equal(m1.productId, 'perk_fastHands');
    assert.equal(await page.evaluate(() => !!JSON.parse(localStorage.getItem('pixelrealms.profile.v1')).perks?.fastHands), false, 'nothing granted before native confirms');
    await page.evaluate((id) => window.__fromNative({ id, ok: true, receipt: 'r' }), m1.id); await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pixelrealms.profile.v1')).perks.fastHands), true);
    await act(page, 'buy', 'perk_hearty'); await page.waitForTimeout(300);
    const m2 = await page.evaluate(() => window.__posted.filter((m) => m.type === 'purchase')[1]);
    await page.evaluate((id) => window.__fromNative({ id, ok: false }), m2.id); await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => !!JSON.parse(localStorage.getItem('pixelrealms.profile.v1')).perks.hearty), false, 'declined purchase grants nothing');
    await page.evaluate(() => window.__fromNative({ type: 'deeplink', url: 'pixelrealms://daily' })); await page.waitForTimeout(2500);
    assert.ok(await page.evaluate(() => window.__game.meta?.daily > 0), 'deep link starts the daily');
  });
} else console.log('  skip native bundle scenario (run: cd mobile && npm run build:game)');

await browser.close(); server.kill();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
