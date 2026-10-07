// Player profile: currency, owned items, pass progress, settings. Persisted to localStorage.
import { store, toast } from './util.js';
import { BP, PERKS, PRODUCTS, QUESTS, TIERS } from './catalog.js';
import { SKINS, skinById } from './skins.js';

const KEY = 'pixelrealms.profile.v1';
const today = () => new Date().toISOString().slice(0, 10);

const defaults = () => ({
  coins: 250, xp: 0, premium: false, ageGroup: null,  // 'child' (<13) | 'teen' (13-17) | 'adult'
  claimed: { free: [], premium: [] },
  ownedSkins: ['explorer', 'miner'], equipped: 'explorer', legend: 'vex',
  perks: {}, xpBoostUntil: 0,
  quests: { date: today(), prog: {}, done: {} },
  settings: { renderDist: 4, sens: 1, fov: 72, touch: 'auto' },
  receipts: [],
});

const listeners = new Set();
export const onProfileChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const profile = Object.assign(defaults(), store.get(KEY, {}));
profile.settings = Object.assign(defaults().settings, profile.settings);
profile.claimed = Object.assign({ free: [], premium: [] }, profile.claimed);

let saveTimer = 0;
export function save(now = false) {
  const run = () => { store.set(KEY, profile); listeners.forEach((f) => f(profile)); };
  if (now) return run();
  clearTimeout(saveTimer); saveTimer = setTimeout(run, 400);
}
export function resetProfile() { Object.assign(profile, defaults()); save(true); }

// ---- derived state ----
export const hasPerk = (id) => !!profile.perks[id];
export const xpBoostActive = () => profile.xpBoostUntil > Date.now();
export const tierOf = (xp = profile.xp) => Math.min(BP.tiers, Math.floor(xp / BP.xpPerTier));
export const tierProgress = () => (tierOf() >= BP.tiers ? 1 : (profile.xp % BP.xpPerTier) / BP.xpPerTier);

/** Gameplay-facing numbers. Game code reads these instead of checking individual perks. */
export function stats() {
  return {
    mineSpeed: hasPerk('fastHands') ? 2 : 1,
    maxHealth: 20 + (hasPerk('hearty') ? 6 : 0),
    oreCoinMul: hasPerk('lucky') ? 2 : 1,
    noFallDamage: hasPerk('feather'),
    jumpMul: hasPerk('feather') ? 1.2 : 1,
    mobSpawnMul: hasPerk('calm') ? 0.25 : 1,
    mobDamageMul: hasPerk('calm') ? 0.5 : 1,
    freeBuild: hasPerk('satchel'),
    keepInventory: hasPerk('keeper'),
    phoenix: hasPerk('phoenix'),
    lootLuck: hasPerk('scavenger') ? 1 : 0,
    stormMul: hasPerk('stormproof') ? 0.5 : 1,
  };
}

// ---- currency / xp ----
export function addCoins(n) { profile.coins = Math.max(0, profile.coins + Math.round(n)); save(); }
export function spendCoins(n) { if (profile.coins < n) return false; profile.coins -= n; save(true); return true; }

export function addXP(n) {
  const before = tierOf();
  profile.xp = Math.min(BP.tiers * BP.xpPerTier, profile.xp + Math.round(n * (xpBoostActive() ? 2 : 1)));
  const after = tierOf();
  if (after > before) toast(`Battle Pass tier ${after} reached!`, 'gold');
  save();
}

// ---- grants (the single place where purchases/rewards take effect) ----
export function applyGrants(g) {
  if (g.coins) profile.coins += g.coins;
  if (g.premium) { profile.premium = true; toast('Premium Battle Pass unlocked!', 'gold'); }
  if (g.tiers) { const before = tierOf(); profile.xp = Math.min(BP.tiers * BP.xpPerTier, (before + g.tiers) * BP.xpPerTier + (profile.xp % BP.xpPerTier)); }
  if (g.xpBoostHours) profile.xpBoostUntil = Math.max(Date.now(), profile.xpBoostUntil) + g.xpBoostHours * 3600e3;
  for (const p of g.perks || []) { profile.perks[p] = true; toast(`${PERKS[p].name} activated`, 'gold'); }
  for (const s of g.skins || []) unlockSkin(s);
  save(true);
}

export function unlockSkin(id) {
  if (!profile.ownedSkins.includes(id)) { profile.ownedSkins.push(id); toast(`New skin: ${skinById(id).name}`, 'gold'); }
  save(true);
}
export const ownsSkin = (id) => profile.ownedSkins.includes(id);
export function equipSkin(id) { if (ownsSkin(id)) { profile.equipped = id; save(true); } }
export function buySkinWithCoins(id) {
  const s = skinById(id);
  if (!s.how.coins || ownsSkin(id)) return false;
  if (!spendCoins(s.how.coins)) return false;
  unlockSkin(id); return true;
}

// ---- battle pass ----
export function canClaim(track, tier) {
  if (tier > tierOf()) return false;
  if (track === 'premium' && !profile.premium) return false;
  return !profile.claimed[track].includes(tier);
}
export function claim(track, tier) {
  if (!canClaim(track, tier)) return false;
  const r = TIERS[tier - 1][track];
  profile.claimed[track].push(tier);
  if (r.coins) { profile.coins += r.coins; toast(`+${r.coins} coins`, 'gold'); }
  if (r.skin) unlockSkin(r.skin);
  if (r.xpBoostHours) applyGrants({ xpBoostHours: r.xpBoostHours }), toast(`2× XP for ${r.xpBoostHours}h`, 'gold');
  save(true); return true;
}
export function claimAll() { let n = 0; for (const t of TIERS) for (const tr of ['free', 'premium']) if (claim(tr, t.tier)) n++; return n; }
export const unclaimedCount = () => { let n = 0; for (const t of TIERS) for (const tr of ['free', 'premium']) if (canClaim(tr, t.tier)) n++; return n; };

// ---- daily quests ----
function rollQuests() { if (profile.quests.date !== today()) profile.quests = { date: today(), prog: {}, done: {} }; }
export function questProgress(id, n = 1) {
  rollQuests();
  const q = QUESTS.find((x) => x.id === id); if (!q || profile.quests.done[id]) return;
  profile.quests.prog[id] = (profile.quests.prog[id] || 0) + n;
  if (profile.quests.prog[id] >= q.goal) {
    profile.quests.done[id] = true; profile.coins += q.coins; addXP(q.xp);
    toast(`Quest complete: ${q.name}  (+${q.coins} coins)`, 'gold');
  }
  save();
}
export const questState = () => { rollQuests(); return profile.quests; };

export function recordReceipt(productId) {
  profile.receipts.push({ productId, at: Date.now(), usd: PRODUCTS[productId].usd, test: true });
  if (profile.receipts.length > 50) profile.receipts.shift();
}
export { SKINS };
