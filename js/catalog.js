// Everything that can be bought or earned lives here, so balancing/pricing is a one-file change.
// Prices are in US cents. Coins are the soft currency earned by playing.

export const PERKS = {
  fastHands: { name: 'Quick Hands', icon: '⛏️', desc: 'Mine blocks twice as fast.', usd: 99 },
  hearty: { name: 'Heart Container', icon: '❤️', desc: '+3 hearts of maximum health.', usd: 99 },
  lucky: { name: 'Lucky Miner', icon: '🍀', desc: 'Ores drop double coins.', usd: 99 },
  feather: { name: 'Feather Boots', icon: '🪶', desc: 'No fall damage and a higher jump.', usd: 199 },
  calm: { name: 'Calm Aura', icon: '🕊️', desc: 'Monsters spawn far less and hit softer.', usd: 199 },
  satchel: { name: "Builder's Satchel", icon: '🎒', desc: 'Placing blocks never uses them up.', usd: 199 },
  keeper: { name: 'Soul Keeper', icon: '👻', desc: 'Keep your items when you fall.', usd: 199 },
  scavenger: { name: 'Scavenger Lens', icon: '🔍', desc: 'Loot chests roll better rarities and give more ammo.', usd: 199 },
  stormproof: { name: 'Stormproof Cloak', icon: '🌀', desc: 'Take half damage from the storm.', usd: 199 },
  phoenix: { name: 'Phoenix Charm', icon: '🔥', desc: 'Once per life, a deadly hit leaves you with 3 hearts.', usd: 299 },
};

export const BP = {
  season: 1,
  name: 'Season 1: Crystal Dawn',
  priceUsd: 499,
  tiers: 30,
  xpPerTier: 120,
  skipTiersUsd: 99,   // price for +5 tiers
  skipTiersCount: 5,
};

// Products the shop sells for real money. `grants` is applied by profile.applyGrants().
export const PRODUCTS = {
  bp_premium: { name: 'Premium Battle Pass', usd: BP.priceUsd, grants: { premium: true } },
  bp_tiers: { name: `+${BP.skipTiersCount} Pass Tiers`, usd: BP.skipTiersUsd, grants: { tiers: BP.skipTiersCount } },
  xp_boost: { name: '2× Pass XP (7 days)', usd: 99, grants: { xpBoostHours: 24 * 7 } },
  coins_s: { name: '500 Coins', usd: 99, grants: { coins: 500 } },
  coins_m: { name: '1,400 Coins', usd: 299, grants: { coins: 1400 } },
  coins_l: { name: '2,600 Coins', usd: 499, grants: { coins: 2600 } },
  bundle_starter: { name: 'Starter Bundle', usd: 299, grants: { perks: ['fastHands', 'feather', 'hearty'], coins: 500 } },
  skin_robot: { name: 'Bolt-9 Robot', usd: 199, grants: { skins: ['robot'] } },
  skin_samurai: { name: 'Ronin', usd: 199, grants: { skins: ['samurai'] } },
  skin_vampire: { name: 'Count Nocturne', usd: 299, grants: { skins: ['vampire'] } },
};
for (const [id, p] of Object.entries(PERKS)) PRODUCTS[`perk_${id}`] = { name: p.name, usd: p.usd, grants: { perks: [id] } };

// Battle pass reward track. Reward: {coins} | {skin} | {xpBoostHours}
export function buildTiers() {
  const tiers = [];
  for (let t = 1; t <= BP.tiers; t++) {
    const free = { coins: t % 5 === 0 ? 60 : 25 };
    const premium = { coins: t % 5 === 0 ? 150 : 50 };
    tiers.push({ tier: t, free, premium });
  }
  const set = (t, track, reward) => { tiers[t - 1][track] = reward; };
  set(5, 'free', { skin: 'farmer' });
  set(15, 'free', { skin: 'knight' });
  set(25, 'free', { coins: 200 });
  set(30, 'free', { coins: 400 });
  set(1, 'premium', { skin: 'neon' });
  set(3, 'premium', { xpBoostHours: 24 });
  set(7, 'premium', { coins: 200 });
  set(10, 'premium', { skin: 'frostmage' });
  set(13, 'premium', { xpBoostHours: 48 });
  set(17, 'premium', { coins: 250 });
  set(20, 'premium', { skin: 'dragon' });
  set(25, 'premium', { coins: 500 });
  set(30, 'premium', { skin: 'cosmic' });
  return tiers;
}
export const TIERS = buildTiers();

// Daily quests feed pass XP + coins
export const QUESTS = [
  { id: 'mine', name: 'Mine 40 blocks', goal: 40, xp: 120, coins: 40 },
  { id: 'place', name: 'Place 40 blocks', goal: 40, xp: 120, coins: 40 },
  { id: 'kill', name: 'Defeat 3 monsters', goal: 3, xp: 150, coins: 60 },
];

export const XP_REWARDS = { mine: 2, place: 1, kill: 15, minute: 12 };
