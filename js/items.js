// Non-block items (weapons, consumables, gadgets) and rarity tiers. Inspired by hero-shooter /
// battle-royale loot systems; all names and art here are original.
import { blockIcon, BLOCKS } from './blocks.js';

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_COL = { common: '#9aa4b2', uncommon: '#58c46a', rare: '#4aa3ff', epic: '#b266ff', legendary: '#ffb020' };
export const RARITY_DMG = [1, 1.15, 1.3, 1.5, 1.8];

export const ITEMS = {
  blaster: { name: 'Blaster', emoji: '🔫', type: 'weapon', dmg: 5, cd: 0.38, pellets: 1, spread: 0.008, auto: false, color: 0xffe066 },
  rifle: { name: 'Pulse Rifle', emoji: '🔦', type: 'weapon', dmg: 3, cd: 0.11, pellets: 1, spread: 0.03, auto: true, color: 0x66e0ff },
  scatter: { name: 'Scatter Gun', emoji: '💥', type: 'weapon', dmg: 2.2, cd: 0.9, pellets: 8, spread: 0.1, auto: false, color: 0xffa94d },
  longshot: { name: 'Longshot', emoji: '🎯', type: 'weapon', dmg: 16, cd: 1.4, pellets: 1, spread: 0.0, auto: false, color: 0xff6b9d },
  medkit: { name: 'Medkit', emoji: '🩹', type: 'consumable', heal: 10 },
  shield: { name: 'Shield Potion', emoji: '🧪', type: 'consumable', shield: 25 },
  grapple: { name: 'Grapple Hook', emoji: '🪝', type: 'gadget', range: 38, cd: 2.5 },
};

export const isItem = (s) => !!s?.item;
export const slotName = (s) => (!s ? '' : s.item ? `${s.rar && s.rar !== 'common' ? s.rar[0].toUpperCase() + s.rar.slice(1) + ' ' : ''}${ITEMS[s.item].name}` : BLOCKS[s.id].name);
export function slotHtml(s) {
  if (!s) return '';
  const cnt = s.count > 1 ? `<b>${s.count}</b>` : '';
  if (s.item) return `<span class="emoji" style="--rc:${RARITY_COL[s.rar || 'common']}">${ITEMS[s.item].emoji}</span>${cnt}`;
  return `<img src="${blockIcon(s.id)}" alt="">${cnt}`;
}
