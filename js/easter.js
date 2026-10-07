// Easter eggs. Keep them cheap, silly and discoverable.
//  1. Tap the title logo 7 times.            2. Konami code anywhere.
//  3. Type "moon" in-game (low gravity).     4. Name a world seed "estevan" (builds the Domain monument).
//  5. 1-in-25 pigs are Golden Pigs.          6. Emote (H) ten times in a row -> disco.
import { toast, $ } from './util.js';
import { profile, addCoins, unlockSkin, save } from './profile.js';

const flags = () => (profile.eggs ||= {});
export const confetti = (n = 60) => {
  const cols = ['#ffc233', '#4be08a', '#4aa3ff', '#b266ff', '#ff5a6a'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i'); c.className = 'confetti';
    c.style.left = `${Math.random() * 100}vw`; c.style.background = cols[i % cols.length]; c.style.animationDelay = `${Math.random() * 0.6}s`;
    document.body.appendChild(c); setTimeout(() => c.remove(), 3200);
  }
};

let taps = 0, tapT = 0;
export function logoTap(el) {
  const now = performance.now(); taps = now - tapT < 900 ? taps + 1 : 1; tapT = now;
  el.classList.remove('spin'); void el.offsetWidth; el.classList.add('spin');
  if (taps >= 7) {
    taps = 0; confetti();
    if (!flags().logo) { flags().logo = true; addCoins(77); toast('You found the Logo Secret! +77 coins', 'gold'); save(true); }
    else toast('Still spinning. Still pixel-y.', '');
  }
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let kPos = 0, typed = '';
export function initEasterEggs(game) {
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    kPos = e.code === KONAMI[kPos] ? kPos + 1 : (e.code === KONAMI[0] ? 1 : 0);
    if (kPos === KONAMI.length) {
      kPos = 0; confetti(90); document.body.classList.add('disco'); setTimeout(() => document.body.classList.remove('disco'), 12000);
      if (!flags().konami) { flags().konami = true; unlockSkin('glitch'); toast('↑↑↓↓←→←→BA — Glitch skin unlocked!', 'gold'); save(true); }
      else toast('Retro mode engaged.', 'gold');
    }
    typed = (typed + (e.key.length === 1 ? e.key.toLowerCase() : '')).slice(-8);
    if (game.mode === 'play' && typed.endsWith('moon')) { typed = ''; game.moonUntil = game.time + 60; toast('🌙 Moon gravity for 60 seconds!', 'gold'); }
  });
}

/** Called by the game when it creates a world whose seed text contains "estevan". */
export function buildMonument(game, cx, cz) {
  const w = game.world, y0 = w.surfaceY(cx, cz);
  const set = (x, y, z, id) => w.setBlock(cx + x, y0 + y, cz + z, id);
  const B = game.B;
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) set(x, 0, z, B.GOLD_ORE);
  for (let y = 1; y <= 7; y++) for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) set(x, y, z, y % 2 ? B.LAMP : B.CRYSTAL_ORE);
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) set(x, 8, z, [B.WOOL_RED, B.WOOL_BLUE, B.WOOL_WHITE][(x + z + 4) % 3]);
  set(0, 1, 0, B.CHEST);
  game.chestSet?.add(`${cx},${y0 + 1},${cz}`);
  toast("Estevan's Domain monument appeared nearby!", 'gold');
}
export const eggFlag = (k) => !!flags()[k];
export const setEggFlag = (k) => { flags()[k] = true; save(true); };
