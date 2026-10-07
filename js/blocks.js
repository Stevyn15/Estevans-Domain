// Block definitions + a procedurally drawn 16x16 texture atlas (no image files needed).
import * as THREE from 'three';
import { mulberry32 } from './util.js';

export const TILE = 16;
const COLS = 16;

export const AIR = 0;
// face order for `tex`: [top, side, bottom]
const defs = [
  ['air', 'Air', null],
  ['grass', 'Grass', ['grass_top', 'grass_side', 'dirt'], { hard: 0.6 }],
  ['dirt', 'Dirt', ['dirt', 'dirt', 'dirt'], { hard: 0.5 }],
  ['stone', 'Stone', ['stone', 'stone', 'stone'], { hard: 1.6, drop: 'cobble' }],
  ['sand', 'Sand', ['sand', 'sand', 'sand'], { hard: 0.5 }],
  ['log', 'Log', ['log_top', 'log_side', 'log_top'], { hard: 1.0 }],
  ['leaves', 'Leaves', ['leaves', 'leaves', 'leaves'], { hard: 0.2, cutout: true }],
  ['planks', 'Planks', ['planks', 'planks', 'planks'], { hard: 0.9 }],
  ['cobble', 'Cobblestone', ['cobble', 'cobble', 'cobble'], { hard: 1.6 }],
  ['brick', 'Bricks', ['brick', 'brick', 'brick'], { hard: 1.6 }],
  ['glass', 'Glass', ['glass', 'glass', 'glass'], { hard: 0.3, glass: true, drop: null }],
  ['water', 'Water', ['water', 'water', 'water'], { liquid: true, hard: Infinity }],
  ['snow', 'Snow', ['snow', 'snow', 'snow'], { hard: 0.3 }],
  ['bedrock', 'Bedrock', ['bedrock', 'bedrock', 'bedrock'], { hard: Infinity }],
  ['coal_ore', 'Coal Ore', ['coal', 'coal', 'coal'], { hard: 2.0, coins: 3 }],
  ['iron_ore', 'Iron Ore', ['iron', 'iron', 'iron'], { hard: 2.4, coins: 6 }],
  ['gold_ore', 'Gold Ore', ['gold', 'gold', 'gold'], { hard: 2.6, coins: 12 }],
  ['crystal_ore', 'Crystal Ore', ['crystal', 'crystal', 'crystal'], { hard: 3.0, coins: 30 }],
  ['sandstone', 'Sandstone', ['sandstone', 'sandstone', 'sandstone'], { hard: 1.0 }],
  ['lamp', 'Lamp', ['lamp', 'lamp', 'lamp'], { hard: 0.4 }],
  ['wool_red', 'Red Wool', ['wool_red', 'wool_red', 'wool_red'], { hard: 0.4 }],
  ['wool_blue', 'Blue Wool', ['wool_blue', 'wool_blue', 'wool_blue'], { hard: 0.4 }],
  ['wool_white', 'White Wool', ['wool_white', 'wool_white', 'wool_white'], { hard: 0.4 }],
  ['chest', 'Loot Chest', ['chest_top', 'chest_side', 'chest_top'], { hard: Infinity }],
  ['jumppad', 'Jump Pad', ['jump_top', 'jump_side', 'jump_side'], { hard: 0.5 }],
  ['tnt', 'TNT', ['tnt_top', 'tnt_side', 'tnt_top'], { hard: 0.2, drop: null }],
];

export const B = {};          // B.stone === 3
export const BLOCKS = [];     // indexed by id
export const tileNames = [];

defs.forEach(([key, name, tex, opts = {}], id) => {
  B[key.toUpperCase()] = id;
  const faces = tex ? tex.map((t) => { let i = tileNames.indexOf(t); if (i < 0) i = tileNames.push(t) - 1; return i; }) : null;
  BLOCKS[id] = {
    id, key, name, faces,
    hard: opts.hard ?? 1,
    liquid: !!opts.liquid,
    solid: id !== AIR && !opts.liquid,
    opaque: id !== AIR && !opts.liquid && !opts.cutout && !opts.glass,
    cutout: !!opts.cutout,
    glass: !!opts.glass,
    coins: opts.coins || 0,
    dropKey: opts.drop === undefined ? key : opts.drop,
    placeable: id !== AIR && !opts.liquid && key !== 'bedrock',
  };
});
for (const b of BLOCKS) b.drop = b.dropKey == null ? null : B[b.dropKey.toUpperCase()];

// ---------- procedural tile painting ----------
const painters = {
  grass_top: (p) => speckle(p, [88, 160, 60], 22),
  grass_side: (p) => { speckle(p, [134, 96, 62], 18); for (let x = 0; x < 16; x++) { const d = 3 + ((x * 7) % 3); for (let y = 0; y < d; y++) p.set(x, y, shade([88, 160, 60], p.rnd() * 30 - 15)); } },
  dirt: (p) => speckle(p, [134, 96, 62], 20),
  stone: (p) => speckle(p, [126, 126, 130], 18),
  sand: (p) => speckle(p, [221, 207, 148], 12),
  log_side: (p) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) p.set(x, y, shade([102, 78, 46], (x % 4 === 0 ? -14 : 0) + p.rnd() * 14 - 7)); },
  log_top: (p) => { speckle(p, [160, 124, 74], 10); ring(p, [102, 78, 46]); },
  leaves: (p) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) { if (p.rnd() < 0.16) p.clear(x, y); else p.set(x, y, shade([52, 128, 48], p.rnd() * 40 - 20)); } },
  planks: (p) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) p.set(x, y, shade(y % 4 === 3 ? [120, 88, 48] : [178, 140, 82], p.rnd() * 12 - 6)); },
  cobble: (p) => { speckle(p, [110, 110, 114], 30); mortar(p, [70, 70, 74], false); },
  brick: (p) => { speckle(p, [160, 76, 62], 14); mortar(p, [196, 190, 180], true); },
  glass: (p) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; if (edge) p.set(x, y, [200, 230, 240, 255]); else if ((x + y) % 7 === 0 && x < 8) p.set(x, y, [255, 255, 255, 120]); else p.set(x, y, [190, 225, 240, 70]); } },
  water: (p) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) p.set(x, y, [...shade([50, 100, 210], Math.sin((x + y * 2) * 0.9) * 10 + p.rnd() * 8), 255]); },
  snow: (p) => speckle(p, [244, 248, 252], 8),
  bedrock: (p) => speckle(p, [50, 50, 54], 40),
  coal: (p) => ore(p, [28, 28, 30]),
  iron: (p) => ore(p, [214, 168, 138]),
  gold: (p) => ore(p, [250, 214, 60]),
  crystal: (p) => ore(p, [90, 235, 235]),
  sandstone: (p) => { speckle(p, [214, 196, 140], 10); for (let x = 0; x < 16; x++) p.set(x, 4, [180, 160, 110, 255]); },
  lamp: (p) => { speckle(p, [255, 224, 140], 16); for (let i = 0; i < 16; i++) { p.set(i, 0, [150, 110, 50, 255]); p.set(i, 15, [150, 110, 50, 255]); p.set(0, i, [150, 110, 50, 255]); p.set(15, i, [150, 110, 50, 255]); } },
  wool_red: (p) => speckle(p, [200, 52, 52], 14),
  wool_blue: (p) => speckle(p, [56, 92, 210], 14),
  wool_white: (p) => speckle(p, [238, 238, 238], 10),
  chest_top: (p) => { speckle(p, [150, 100, 40], 12); for (let i = 0; i < 16; i++) { p.set(i, 0, [70, 45, 15, 255]); p.set(i, 15, [70, 45, 15, 255]); p.set(0, i, [70, 45, 15, 255]); p.set(15, i, [70, 45, 15, 255]); } },
  chest_side: (p) => { speckle(p, [160, 108, 44], 12); for (let i = 0; i < 16; i++) { p.set(i, 0, [70, 45, 15, 255]); p.set(i, 15, [70, 45, 15, 255]); p.set(0, i, [70, 45, 15, 255]); p.set(15, i, [70, 45, 15, 255]); p.set(i, 6, [70, 45, 15, 255]); } for (let x = 6; x < 10; x++) for (let y = 5; y < 9; y++) p.set(x, y, [255, 214, 74, 255]); },
  jump_top: (p) => { speckle(p, [40, 200, 120], 14); for (let i = 3; i < 13; i++) { p.set(i, 3, [255, 255, 255, 255]); p.set(i, 12, [255, 255, 255, 255]); } for (let k = 0; k < 4; k++) { p.set(7 - k, 5 + k, [255, 255, 255, 255]); p.set(8 + k, 5 + k, [255, 255, 255, 255]); } },
  jump_side: (p) => { speckle(p, [30, 150, 90], 14); for (let i = 0; i < 16; i++) p.set(i, 0, [255, 255, 255, 255]); },
  tnt_top: (p) => { speckle(p, [210, 60, 50], 14); ring(p, [60, 40, 30]); },
  tnt_side: (p) => { speckle(p, [214, 64, 54], 14); for (let x = 0; x < 16; x++) for (let y = 5; y < 11; y++) p.set(x, y, shade([235, 230, 220], p.rnd() * 8)); for (let x = 3; x < 13; x += 3) for (let y = 6; y < 10; y++) p.set(x, y, [40, 40, 40, 255]); },
};

const shade = (c, d) => c.map((v) => Math.max(0, Math.min(255, v + d)));
function speckle(p, base, amt) { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) p.set(x, y, shade(base, p.rnd() * amt - amt / 2)); }
function ring(p, c) { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); if (Math.floor(d) % 3 === 2 || d > 7) p.set(x, y, shade(c, p.rnd() * 10)); } }
function mortar(p, c, brick) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = Math.floor(y / 4); const off = brick ? (row % 2) * 4 : 0;
    if (y % 4 === 3 || (x + off) % 8 === 7) p.set(x, y, shade(c, p.rnd() * 10));
  }
}
function ore(p, c) {
  speckle(p, [126, 126, 130], 18);
  for (let i = 0; i < 9; i++) { const x = 1 + Math.floor(p.rnd() * 13), y = 1 + Math.floor(p.rnd() * 13); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) p.set(x + dx, y + dy, shade(c, p.rnd() * 24 - 12)); }
}

export function buildAtlas() {
  const rows = Math.ceil(tileNames.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE; canvas.height = Math.max(1, rows) * TILE;
  const ctx = canvas.getContext('2d');
  tileNames.forEach((name, i) => {
    const rnd = mulberry32(i * 7919 + 13);
    const img = ctx.createImageData(TILE, TILE);
    const p = {
      rnd,
      set: (x, y, c) => { if (x < 0 || y < 0 || x > 15 || y > 15) return; const o = (y * 16 + x) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c[3] ?? 255; },
      clear: (x, y) => { const o = (y * 16 + x) * 4; img.data[o + 3] = 0; },
    };
    (painters[name] || painters.stone)(p);
    ctx.putImageData(img, (i % COLS) * TILE, Math.floor(i / COLS) * TILE);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture: tex, cols: COLS, rows };
}

// CSS icon for UI: draw a tile onto a data URL (cached)
const iconCache = new Map();
let atlasCanvas = null;
export function setAtlasCanvas(c) { atlasCanvas = c; }
export function blockIcon(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const b = BLOCKS[id]; if (!b?.faces || !atlasCanvas) return '';
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const t = b.faces[1];
  ctx.drawImage(atlasCanvas, (t % COLS) * TILE, Math.floor(t / COLS) * TILE, TILE, TILE, 0, 0, 32, 32);
  const topT = b.faces[0];
  ctx.drawImage(atlasCanvas, (topT % COLS) * TILE, Math.floor(topT / COLS) * TILE, TILE, 5, 0, 0, 32, 10);
  const url = c.toDataURL();
  iconCache.set(id, url);
  return url;
}

// Average colour of a block's side tile (used for break particles)
const colorCache = new Map();
export function blockColor(id) {
  if (colorCache.has(id)) return colorCache.get(id);
  const b = BLOCKS[id]; let col = 0x888888;
  if (b?.faces && atlasCanvas) {
    const t = b.faces[1];
    const d = atlasCanvas.getContext('2d').getImageData((t % COLS) * TILE, Math.floor(t / COLS) * TILE, TILE, TILE).data;
    let r = 0, g = 0, bl = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; }
    if (n) col = ((r / n) << 16) | ((g / n) << 8) | (bl / n);
  }
  colorCache.set(id, col); return col;
}
