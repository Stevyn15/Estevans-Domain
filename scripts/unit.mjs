// Unit tests for security/privacy-critical logic. Run: npm test
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
register('./loader.mjs', import.meta.url);

// minimal browser stubs
const mem = new Map();
globalThis.window = globalThis;
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
globalThis.document = { querySelector: () => null };

let pass = 0; const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { console.error('  FAIL', name, '\n', e.message); process.exitCode = 1; } };

const { profile, save } = await import('../js/profile.js');
const viral = await import('../js/viral.js');
const privacy = await import('../js/privacy.js');
const { rollLoot, rollRarity } = await import('../js/royale.js');
const { policy, sha256 } = await import('./csp.mjs');

await t('deep links: accepts valid daily/seed/invite', () => {
  assert.equal(viral.parseDeepLink('pixelrealms://daily').type, 'daily');
  assert.equal(viral.parseDeepLink('https://example.com/pixelrealms?daily=1&ref=ABCD23').ref, 'ABCD23');
  assert.deepEqual(viral.parseDeepLink('pixelrealms://seed/my-seed'), { type: 'seed', seed: 'my-seed', ref: null });
  assert.equal(viral.parseDeepLink('pixelrealms://invite?ref=ABCD23').type, 'invite');
});
await t('deep links: rejects hostile input', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'pixelrealms://seed/<script>', 'pixelrealms://seed/' + 'a'.repeat(40), 'x'.repeat(400), 42, null, 'pixelrealms://invite?ref=0O1Il!', 'ftp://example.com/?daily=1'])
    assert.equal(viral.parseDeepLink(bad), null, String(bad).slice(0, 40));
});
await t('daily challenge: stable per day, different across days', () => {
  const a = viral.dailyMeta(); assert.equal(a.mode, 'royale'); assert.equal(a.seed, viral.dailyMeta().seed);
  assert.ok(viral.dailyNumber(new Date('2026-01-01T12:00:00Z')) === 1 && viral.dailyNumber(new Date('2026-01-02T00:00:01Z')) === 2);
});
await t('referral: blocked for children, validated, one-time, no self-use', () => {
  profile.ageGroup = 'child'; assert.equal(viral.redeemRefCode('ABCD23').ok, false);
  profile.ageGroup = 'adult';
  assert.equal(viral.redeemRefCode('bad!').ok, false);
  assert.equal(viral.redeemRefCode(viral.myRefCode()).ok, false);
  const before = profile.coins; assert.equal(viral.redeemRefCode('abcd23').ok, true); assert.equal(profile.coins, before + 100);
  assert.equal(viral.redeemRefCode('ZZZZ22').ok, false, 'second redeem must fail');
});
await t('streak: pays once per day', () => {
  profile.streak = { last: null, count: 0 }; const first = viral.claimStreak(); assert.ok(first && first.count === 1);
  assert.equal(viral.claimStreak(), null);
});
await t('save integrity: edited save falls back to safe state, keeps receipt-backed items', async () => {
  profile.coins = 500; profile.receipts = [{ productId: 'perk_fastHands', usd: 99, at: 1 }, { productId: 'nonexistent', usd: 1, at: 1 }]; profile.perks.fastHands = true; save(true);
  const stored = JSON.parse(localStorage.getItem('pixelrealms.profile.v1')); assert.ok(stored._sig);
  stored.coins = 9_999_999; stored.perks.satchel = true; localStorage.setItem('pixelrealms.profile.v1', JSON.stringify(stored));
  const fresh = (await import('../js/profile.js?reload=1')).profile;
  assert.ok(fresh.tamperedAt); assert.equal(fresh.coins, 250); assert.equal(fresh.perks.satchel, undefined); assert.equal(fresh.perks.fastHands, true);
  assert.equal(fresh.receipts.length, 1, 'unknown product receipts are dropped');
});
await t('privacy: export includes saved data; delete wipes all game keys', () => {
  localStorage.setItem('pixelrealms.world.x', JSON.stringify({ a: 1 })); localStorage.setItem('other.app', '1');
  const ex = privacy.exportData(); assert.ok(ex.data['pixelrealms.world.x'] && !ex.data['other.app']);
  privacy.deleteAllData(); assert.equal([...mem.keys()].filter((k) => k.startsWith('pixelrealms.') && k !== 'pixelrealms.profile.v1').length, 0);
  assert.equal(localStorage.getItem('other.app'), '1', "must not touch other apps' keys");
});
await t('consent: analytics can never be enabled for children', () => {
  profile.ageGroup = 'child'; privacy.recordConsent({ analytics: true }); assert.equal(profile.consent.analytics, false);
  profile.ageGroup = 'adult'; privacy.recordConsent({ analytics: true }); assert.equal(profile.consent.analytics, true);
});
await t('loot: chests always give ammo; supply drops roll epic+', () => {
  for (let i = 0; i < 300; i++) assert.ok(rollLoot().some((o) => o.ammo));
  for (let i = 0; i < 100; i++) for (const o of rollLoot({ supply: true })) if (o.item && ['blaster', 'rifle', 'scatter', 'longshot'].includes(o.item)) assert.ok(['epic', 'legendary'].includes(o.rar));
  assert.ok(['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(rollRarity()));
});
await t('CSP: index.html policy matches importmap hash and forbids inline/eval scripts', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const im = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.ok(html.includes(policy([sha256(im)])), 'run `npm run csp` after editing the importmap');
  assert.ok(!/script-src[^;]*unsafe-(inline|eval)/.test(html));
  assert.ok(!/<script(?![^>]*(src=|type="importmap"))[^>]*>/.test(html), 'no inline scripts besides the import map');
});
console.log(`\n${pass} passed`);
