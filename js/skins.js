// Skin catalog, procedural skin painting (64x32 classic layout) and the blocky humanoid model.
import * as THREE from 'three';
import { mulberry32, hashStr } from './util.js';

// ---- catalog -------------------------------------------------------------
// `how` documents where a skin comes from; the shop/battle pass read it for display.
export const RARITY = { common: '#9aa4b2', rare: '#4aa3ff', epic: '#b266ff', legendary: '#ffb020' };

const P = (o) => ({ skin: '#e0ac86', hair: '#4a2f1a', shirt: '#3a7bd5', pants: '#2b3a67', shoes: '#1d1d22', ...o });

export const SKINS = [
  { id: 'explorer', name: 'Explorer', rarity: 'common', how: { free: true }, spec: P({ shirt: '#3fa34d', pants: '#5b4630', hair: '#5a3a1c' }) },
  { id: 'miner', name: 'Miner', rarity: 'common', how: { free: true }, spec: P({ shirt: '#c9822b', pants: '#3b3b46', hair: '#2b2118', paint: 'miner' }), hat: 'hardhat' },
  { id: 'farmer', name: 'Farmer', rarity: 'common', how: { bp: { tier: 5, track: 'free' } }, spec: P({ shirt: '#c43b3b', pants: '#3560a8', hair: '#d8b14a', paint: 'overalls' }), hat: 'straw' },
  { id: 'chef', name: 'Chef', rarity: 'common', how: { coins: 300 }, spec: P({ shirt: '#f2f2f2', pants: '#3b3b46', hair: '#2a2a2a' }), hat: 'chef' },
  { id: 'ninja', name: 'Shadow Ninja', rarity: 'rare', how: { coins: 450 }, spec: P({ shirt: '#1d1d26', pants: '#1d1d26', hair: '#111', shoes: '#111', paint: 'ninja' }) },
  { id: 'pirate', name: 'Captain Pixel', rarity: 'rare', how: { coins: 500 }, spec: P({ shirt: '#8b1e2d', pants: '#2a2f45', hair: '#2a1b10', paint: 'pirate' }), hat: 'pirate' },
  { id: 'knight', name: 'Iron Knight', rarity: 'rare', how: { bp: { tier: 15, track: 'free' } }, spec: P({ shirt: '#a9b2bd', pants: '#7b838d', shoes: '#555c66', paint: 'armor' }), hat: 'helm' },
  { id: 'astronaut', name: 'Astronaut', rarity: 'epic', how: { coins: 900 }, spec: P({ shirt: '#e9edf2', pants: '#e9edf2', shoes: '#9aa4b2', paint: 'astro' }), hat: 'bubble' },
  { id: 'robot', name: 'Bolt-9 Robot', rarity: 'epic', how: { usd: 199 }, spec: P({ skin: '#8e9aa8', shirt: '#6f7c8b', pants: '#4b5663', hair: '#8e9aa8', shoes: '#2d343c', paint: 'robot' }), hat: 'antenna' },
  { id: 'samurai', name: 'Ronin', rarity: 'epic', how: { usd: 199 }, spec: P({ shirt: '#2a3a6b', pants: '#1b1f33', hair: '#111', paint: 'samurai' }), hat: 'kabuto' },
  { id: 'vampire', name: 'Count Nocturne', rarity: 'epic', how: { usd: 299 }, spec: P({ skin: '#d9d3dc', shirt: '#2b0f1c', pants: '#15101a', hair: '#0e0a10', paint: 'vampire' }) },
  { id: 'glitch', name: 'Glitch Ghost', rarity: 'legendary', how: { secret: true }, spec: P({ skin: '#101018', shirt: '#101018', pants: '#101018', hair: '#00ffa3', shoes: '#ff2bd6', paint: 'glitch' }) },
  // Battle pass (Season 1) premium track
  { id: 'neon', name: 'Neon Runner', rarity: 'rare', how: { bp: { tier: 1, track: 'premium' } }, spec: P({ shirt: '#15152b', pants: '#15152b', hair: '#00e5ff', shoes: '#ff2bd6', paint: 'neon' }) },
  { id: 'frostmage', name: 'Frost Mage', rarity: 'epic', how: { bp: { tier: 10, track: 'premium' } }, spec: P({ shirt: '#5ec6ff', pants: '#2c5fa6', hair: '#e8f7ff', paint: 'frost' }), hat: 'wizard' },
  { id: 'dragon', name: 'Ember Dragon', rarity: 'epic', how: { bp: { tier: 20, track: 'premium' } }, spec: P({ skin: '#c0392b', shirt: '#7a1f17', pants: '#4a130f', hair: '#e67e22', shoes: '#2a0f0b', paint: 'dragon' }), hat: 'horns' },
  { id: 'cosmic', name: 'Cosmic Emperor', rarity: 'legendary', how: { bp: { tier: 30, track: 'premium' } }, spec: P({ skin: '#cdb6ff', shirt: '#241552', pants: '#160d36', hair: '#ffd86b', shoes: '#ffd86b', paint: 'cosmic' }), hat: 'crown' },
];
export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

// ---- painting ------------------------------------------------------------
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const css = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

export function paintSkin(spec, seedKey = 'x', size = [64, 32]) {
  const cv = document.createElement('canvas'); cv.width = size[0]; cv.height = size[1];
  const ctx = cv.getContext('2d');
  const rnd = mulberry32(hashStr(seedKey));
  // every call fills a rect with subtle per-pixel noise so it reads as hand-painted pixel art
  const rect = (x, y, w, h, color, noise = 10) => {
    const [r, g, b] = hex(color);
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
      const d = (rnd() - 0.5) * noise;
      ctx.fillStyle = css(r + d, g + d, b + d); ctx.fillRect(x + i, y + j, 1, 1);
    }
  };
  const px = (x, y, color) => rect(x, y, 1, 1, color, 0);
  // face-local helpers (offset into each box's front face)
  const head = (x, y, w, h, c) => rect(8 + x, 8 + y, w, h, c, 0);
  const body = (x, y, w, h, c) => rect(20 + x, 20 + y, w, h, c, 0);
  const bodyBack = (x, y, w, h, c) => rect(32 + x, 20 + y, w, h, c, 0);
  const H = { rect, px, head, body, bodyBack };

  const s = spec;
  // head: whole area skin, then hair on top + fringe + back
  rect(0, 8, 32, 8, s.skin); rect(8, 0, 16, 8, s.skin);
  rect(8, 0, 8, 8, s.hair, 14);                        // top
  rect(0, 8, 32, 2, s.hair, 14); rect(24, 8, 8, 8, s.hair, 14); // fringe + back of head
  rect(0, 10, 8, 2, s.hair, 14); rect(16, 10, 8, 2, s.hair, 14);
  head(1, 4, 2, 1, '#ffffff'); head(5, 4, 2, 1, '#ffffff');       // eyes
  head(2, 4, 1, 1, '#2a3a8a'); head(5, 4, 1, 1, '#2a3a8a');
  head(3, 6, 2, 1, '#b5745a');                                    // mouth
  // torso
  rect(20, 16, 8, 4, s.shirt); rect(16, 20, 24, 12, s.shirt, 12);
  // arms (short sleeve look: shirt shoulders, skin forearms)
  rect(44, 16, 4, 4, s.shirt); rect(40, 20, 16, 12, s.skin, 10); rect(40, 20, 16, 5, s.shirt, 12);
  // legs
  rect(4, 16, 4, 4, s.pants); rect(0, 20, 16, 12, s.pants, 12); rect(0, 29, 16, 3, s.shoes, 8);

  const custom = {
    miner() { body(2, 0, 4, 12, '#e0a21b'); body(0, 8, 8, 1, '#5c4a2a'); },
    overalls() { body(1, 3, 6, 9, '#3560a8'); body(1, 0, 1, 3, '#3560a8'); body(6, 0, 1, 3, '#3560a8'); body(3, 6, 2, 2, '#244777'); },
    ninja() { head(0, 3, 8, 3, '#111'); head(1, 4, 2, 1, '#fff'); head(5, 4, 2, 1, '#fff'); head(0, 6, 8, 2, '#111'); body(0, 8, 8, 1, '#b3202e'); },
    pirate() { head(1, 3, 2, 2, '#111'); head(0, 3, 8, 1, '#111'); body(0, 0, 1, 12, '#e8d9b0'); body(7, 0, 1, 12, '#e8d9b0'); body(0, 8, 8, 1, '#3a2615'); body(3, 8, 2, 1, '#ffd24a'); },
    armor() { body(0, 0, 8, 3, '#d3dae2'); body(3, 3, 2, 8, '#8d97a3'); rect(40, 20, 16, 4, '#d3dae2', 6); rect(44, 28, 8, 4, '#8d97a3', 6); },
    astro() { body(1, 2, 3, 3, '#2a2f3a'); body(5, 3, 2, 1, '#e5484d'); body(5, 5, 2, 1, '#3b82f6'); head(1, 2, 6, 4, '#1a2438'); head(1, 2, 3, 1, '#4a6a9a'); },
    robot() { head(1, 4, 2, 2, '#00e5ff'); head(5, 4, 2, 2, '#00e5ff'); head(2, 7, 4, 1, '#2d343c'); head(3, 7, 1, 1, '#9aa4b2'); head(5, 7, 1, 1, '#9aa4b2'); body(1, 1, 6, 6, '#58636f'); body(2, 2, 2, 2, '#ff4d4d'); body(5, 2, 1, 1, '#4dff88'); body(5, 4, 1, 1, '#ffd24a'); body(0, 9, 8, 1, '#2d343c'); },
    samurai() { head(0, 3, 8, 1, '#7a1f1f'); body(0, 0, 3, 12, '#7a1f1f'); body(5, 0, 3, 12, '#7a1f1f'); body(0, 8, 8, 2, '#c9a227'); },
    vampire() { head(2, 7, 1, 1, '#fff'); head(5, 7, 1, 1, '#fff'); head(1, 4, 2, 1, '#ff2b2b'); head(5, 4, 2, 1, '#ff2b2b'); body(2, 0, 4, 6, '#f5f0e8'); body(3, 0, 2, 3, '#8a1030'); body(0, 0, 2, 12, '#15101a'); body(6, 0, 2, 12, '#15101a'); },
    neon() { for (let i = 0; i < 12; i += 4) body(0, i, 8, 1, '#00e5ff'); body(3, 0, 2, 12, '#ff2bd6'); rect(0, 20, 16, 1, '#00e5ff', 0); rect(0, 26, 16, 1, '#ff2bd6', 0); rect(40, 25, 16, 1, '#00e5ff', 0); head(1, 4, 2, 1, '#00e5ff'); head(5, 4, 2, 1, '#00e5ff'); },
    frost() { for (let i = 0; i < 14; i++) { px(16 + ((i * 7) % 24), 20 + ((i * 5) % 12), '#ffffff'); } body(0, 9, 8, 1, '#ffffff'); body(0, 10, 8, 2, '#e8f7ff'); head(1, 4, 2, 1, '#6df'); head(5, 4, 2, 1, '#6df'); },
    dragon() { for (let i = 0; i < 40; i++) px(16 + ((i * 11) % 24), 20 + ((i * 7) % 12), i % 3 ? '#8e2a1e' : '#e67e22'); body(2, 2, 4, 8, '#f0b45a'); head(0, 5, 1, 1, '#2a0f0b'); head(7, 5, 1, 1, '#2a0f0b'); head(1, 4, 2, 1, '#ffd24a'); head(5, 4, 2, 1, '#ffd24a'); head(3, 6, 2, 1, '#2a0f0b'); },
    glitch() { for (let i = 0; i < 90; i++) px((i * 17) % 64, (i * 11) % 32, ['#00ffa3', '#ff2bd6', '#00e5ff', '#ffffff'][i % 4]); head(1, 4, 2, 1, '#00ffa3'); head(5, 4, 2, 1, '#ff2bd6'); rect(0, 24, 16, 1, '#00ffa3', 0); rect(40, 26, 16, 1, '#ff2bd6', 0); },
    cosmic() { for (let i = 0; i < 70; i++) px((i * 13) % 56, (i * 7) % 32, i % 4 ? '#ffffff' : '#ffd86b'); body(0, 0, 8, 2, '#ffd86b'); body(3, 4, 2, 2, '#ff6bd6'); head(1, 4, 2, 1, '#6bf'); head(5, 4, 2, 1, '#6bf'); body(0, 9, 8, 1, '#ffd86b'); },
  };
  if (s.paint && custom[s.paint]) custom[s.paint](H);
  return cv;
}

export function skinTexture(skin) {
  const t = new THREE.CanvasTexture(paintSkin(skin.spec, skin.id));
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- model ---------------------------------------------------------------
const PX = 1.8 / 32; // one skin pixel in world units

function box(w, h, d, u, v, mat, texW = 64, texH = 32) {
  const g = new THREE.BoxGeometry(w * PX, h * PX, d * PX);
  // three face order: +x, -x, +y, -y, +z, -z  => left, right, top, bottom, front, back
  const rects = [
    [u + d + w, v + d, d, h], [u, v + d, d, h], [u + d, v, w, d],
    [u + d + w, v, w, d], [u + d, v + d, w, h], [u + d + w + d, v + d, w, h],
  ];
  const uv = g.attributes.uv;
  rects.forEach(([x, y, rw, rh], f) => {
    const u0 = x / texW, u1 = (x + rw) / texW, vt = 1 - y / texH, vb = 1 - (y + rh) / texH;
    uv.setXY(f * 4 + 0, u0, vt); uv.setXY(f * 4 + 1, u1, vt);
    uv.setXY(f * 4 + 2, u0, vb); uv.setXY(f * 4 + 3, u1, vb);
  });
  return new THREE.Mesh(g, mat);
}

const flat = (hexColor, extra = {}) => new THREE.MeshBasicMaterial({ color: hexColor, ...extra });
function hatFor(kind) {
  const g = new THREE.Group(); const u = PX;
  const add = (w, h, d, x, y, z, color, extra) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * u, h * u, d * u), flat(color, extra)); m.position.set(x * u, y * u, z * u); g.add(m); return m; };
  switch (kind) {
    case 'hardhat': add(9, 3, 9, 0, 4.5, 0, '#f2c230'); add(9, 1, 3, 0, 3, 5, '#f2c230'); break;
    case 'straw': add(14, 1, 14, 0, 4, 0, '#d9b45a'); add(8, 3, 8, 0, 5.5, 0, '#e5c673'); break;
    case 'chef': add(9, 2, 9, 0, 4, 0, '#fafafa'); add(10, 7, 10, 0, 8, 0, '#ffffff'); break;
    case 'pirate': add(11, 2, 9, 0, 4.2, 0, '#15151a'); add(7, 2, 9, 0, 6, 0, '#15151a'); add(2, 1, 1, 0, 5.2, 4.7, '#f2f2f2'); break;
    case 'helm': add(9, 5, 9, 0, 2.8, 0, '#b7c0ca'); add(1, 4, 1, 0, 5.5, 3, '#d33'); add(9, 1, 1, 0, 0.5, 4.6, '#78818c'); break;
    case 'bubble': add(10, 10, 10, 0, 0, 0, '#9fd8ff', { transparent: true, opacity: 0.28 }); break;
    case 'antenna': add(1, 6, 1, 0, 7, 0, '#6f7c8b'); add(2, 2, 2, 0, 10.5, 0, '#ff4d4d'); break;
    case 'kabuto': add(10, 3, 10, 0, 4.4, 0, '#2d343c'); add(2, 5, 1, -3, 7, 3, '#c9a227'); add(2, 5, 1, 3, 7, 3, '#c9a227'); break;
    case 'wizard': add(12, 1, 12, 0, 4, 0, '#2c4a9a'); add(8, 4, 8, 0, 6.5, 0, '#2c4a9a'); add(4, 4, 4, 0, 10.5, 0, '#2c4a9a'); add(1, 1, 1, 0, 8.5, 4.2, '#fff'); break;
    case 'horns': add(2, 5, 2, -4, 6, 0, '#f0e0b0'); add(2, 5, 2, 4, 6, 0, '#f0e0b0'); add(2, 2, 2, -5, 9, 0, '#f0e0b0'); add(2, 2, 2, 5, 9, 0, '#f0e0b0'); break;
    case 'crown': add(9, 2, 9, 0, 4, 0, '#ffd24a'); for (const x of [-3.5, 0, 3.5]) { add(2, 3, 2, x, 6, 3.5, '#ffd24a'); add(2, 3, 2, x, 6, -3.5, '#ffd24a'); } add(2, 2, 2, 0, 7, 3.5, '#ff4d9d'); break;
    default: break;
  }
  return g;
}

/** Build a humanoid. `tex` is a skin texture; limbs pivot at shoulders/hips so they can swing. */
export function buildHumanoid(tex, hat = null) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
  const root = new THREE.Group();
  const parts = {};
  const mk = (name, w, h, d, u, v, px, py, pz, pivotDown) => {
    const pivot = new THREE.Group(); pivot.position.set(px * PX, py * PX, pz * PX);
    const m = box(w, h, d, u, v, mat); m.position.y = pivotDown ? -h * PX / 2 : h * PX / 2;
    pivot.add(m); root.add(pivot); parts[name] = pivot; return pivot;
  };
  mk('legR', 4, 12, 4, 0, 16, -2, 12, 0, true);
  mk('legL', 4, 12, 4, 0, 16, 2, 12, 0, true);
  mk('body', 8, 12, 4, 16, 16, 0, 12, 0, false);
  mk('armR', 4, 12, 4, 40, 16, -6, 24, 0, true);
  mk('armL', 4, 12, 4, 40, 16, 6, 24, 0, true);
  const headPivot = mk('head', 8, 8, 8, 0, 0, 0, 24, 0, false);
  if (hat) { const h = hatFor(hat); h.position.y = 4 * PX; headPivot.add(h); parts.hat = h; }
  root.userData.parts = parts;
  return root;
}

export function animateHumanoid(model, speed, t) {
  const p = model.userData.parts; const s = Math.sin(t * 9) * Math.min(1, speed) * 0.9;
  p.legR.rotation.x = s; p.legL.rotation.x = -s; p.armR.rotation.x = -s; p.armL.rotation.x = s;
}

export function disposeObject(o) {
  o.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) { if (n.material.map && !n.material.map.userData?.shared) n.material.map.dispose(); n.material.dispose(); } });
}
