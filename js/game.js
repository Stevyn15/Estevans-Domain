// The game runtime: renderer, player, input, mining/placing, inventory, mobs, day/night, HUD.
import * as THREE from 'three';
import { World, CH, WH, SEA } from './world.js';
import { B, BLOCKS, AIR, buildAtlas, setAtlasCanvas, blockIcon, blockColor } from './blocks.js';
import { skinById, skinTexture, buildHumanoid, animateHumanoid, disposeObject } from './skins.js';
import { profile, stats, addCoins, addXP, questProgress, onProfileChange } from './profile.js';
import { XP_REWARDS, BP } from './catalog.js';
import { $, clamp, lerp, store, toast, mulberry32 } from './util.js';
import { ITEMS, RARITY_DMG, RARITIES, slotHtml, slotName, RARITY_COL } from './items.js';
import { legendById } from './legends.js';
import { Royale, rollLoot } from './royale.js';
import { buildMonument, confetti } from './easter.js';

const REACH = 5.5;
const DAY_LENGTH = 300;               // seconds per day/night cycle
const EYE = 1.62;
const MAX_STACK = 99;
const SAVE_PREFIX = 'pixelrealms.world.';

export const CREATIVE_HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.LAMP, B.WOOL_RED];

export const RECIPES = [
  { out: [B.PLANKS, 4], in: [[B.LOG, 1]] },
  { out: [B.BRICK, 4], in: [[B.COBBLE, 4]] },
  { out: [B.SANDSTONE, 2], in: [[B.SAND, 4]] },
  { out: [B.GLASS, 2], in: [[B.SAND, 2], [B.COAL_ORE, 1]] },
  { out: [B.LAMP, 1], in: [[B.GLASS, 1], [B.COAL_ORE, 1]] },
  { out: [B.WOOL_WHITE, 2], in: [[B.LEAVES, 4]] },
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
    this.camera.rotation.order = 'YXZ';
    this.atlas = buildAtlas(); setAtlasCanvas(this.atlas.canvas);
    this.mode = 'idle';            // idle | backdrop | play
    this.paused = true;
    this.world = null;
    this.keys = new Set();
    this.mouse = [false, false, false];
    this.touch = { jx: 0, jy: 0, mine: false, lookId: null, joyId: null, last: null };
    this.hooks = {};
    this.particles = [];
    this.mobs = [];
    let last = performance.now(); this.clock = { getDelta: () => { const n = performance.now(), d = (n - last) / 1000; last = n; return d; } };
    this.locked = false;
    this.isTouch = false;
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000 }));
    this.outline.visible = false; this.scene.add(this.outline);
    // sun & moon
    const disc = (color, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false })); m.renderOrder = -1; m.frustumCulled = false; this.scene.add(m); return m; };
    this.sun = disc(0xfff2b0, 40); this.moon = disc(0xdfe6f5, 28);
    this.partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.model = null; this.modelSkin = null;
    this.B = B; this.ammo = 0; this.mats = 0; this.fireCd = 0; this.abilityCd = 0; this.moonUntil = 0; this.emoteT = 0; this.emoteCount = 0;
    this.tracers = []; this.pings = []; this.sonar = []; this.sonarUntil = 0; this.grapple = null; this.supplySet = new Set(); this.royale = null;
    this.grappleLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.grappleLine.visible = false; this.grappleLine.frustumCulled = false; this.scene.add(this.grappleLine);
    this.bindInput();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.offProfile = onProfileChange(() => this.refreshHud());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------------ lifecycle
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  clearWorld() {
    for (const m of this.mobs) { this.scene.remove(m.mesh); disposeObject(m.mesh); }
    this.mobs = [];
    this.royale?.dispose(); this.royale = null;
    for (const t of [...this.tracers, ...this.pings, ...this.sonar]) { this.scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); }
    this.tracers = []; this.pings = []; this.sonar = []; this.grapple = null; this.grappleLine.visible = false; this.supplySet.clear();
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
    if (this.model) { this.scene.remove(this.model); disposeObject(this.model); this.model = null; this.modelSkin = null; }
    if (this.world) { this.world.dispose(); this.world = null; }
  }

  startBackdrop() {
    this.clearWorld();
    this.mode = 'backdrop'; this.paused = false;
    this.world = new World({ seed: 20240, scene: this.scene, atlas: this.atlas });
    this.world.renderDist = 4;
    this.world.prime(0, 0);
    this.world.renderDist = 4;
    this.orbit = 0; this.time = DAY_LENGTH * 0.2;
    $('#hud').classList.add('hidden');
  }

  startWorld(meta) {
    this.clearWorld();
    this.meta = meta;
    const saved = store.get(SAVE_PREFIX + meta.id, null) || {};
    this.mode = 'play'; this.gameMode = meta.mode;
    const royale = meta.mode === 'royale';
    if (royale) { delete saved.player; delete saved.inv; delete saved.edits; }   // every Storm Royale match is fresh
    this.world = new World({ seed: meta.seed, scene: this.scene, atlas: this.atlas, edits: saved.edits || [] });
    this.world.renderDist = profile.settings.renderDist;
    this.time = saved.time ?? DAY_LENGTH * 0.12;
    this.p = {
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), w: 0.6, h: 1.8,
      yaw: saved.player?.yaw ?? 0, pitch: saved.player?.pitch ?? 0,
      onGround: false, inWater: false, flying: false,
      health: saved.player?.health ?? stats().maxHealth, shield: 0, gliding: false, dashT: 0, hurtCd: 0, regen: 0, fallFrom: null, phoenixUsed: false,
      mineT: 0, mineKey: '', attackCd: 0, bobT: 0, speedXZ: 0,
    };
    // inventory
    this.inv = Array.from({ length: 36 }, () => null);
    this.selected = 0;
    if (saved.inv) saved.inv.forEach((s, i) => { this.inv[i] = !s ? null : Array.isArray(s) ? { id: s[0], count: s[1] } : s; });
    else if (this.gameMode === 'creative') CREATIVE_HOTBAR.forEach((id, i) => { this.inv[i] = { id, count: -1 }; });
    // spawn
    if (saved.player) this.p.pos.set(saved.player.x, saved.player.y, saved.player.z);
    else this.findSpawn();
    this.spawn = this.findSpawnPoint();
    this.ammo = 0; this.mats = 0; this.abilityCd = 0; this.emoteT = 0; this.moonUntil = 0;
    if (!saved.player && /estevan/i.test(meta.seedText || '')) buildMonument(this, Math.floor(this.spawn.x) + 7, Math.floor(this.spawn.z));
    this.world.prime(this.p.pos.x, this.p.pos.z);
    if (royale) { this.royale = new Royale(this); this.royale.start(); this.world.prime(this.p.pos.x, this.p.pos.z); }
    $('#royaleHud').classList.toggle('hidden', !royale);
    $('#abilityBtn').classList.remove('hidden'); this.paintAbility();
    for (const id of ['#btnBuild', '#btnRamp', '#btnFloor']) $(id).classList.toggle('hidden', !(royale || this.gameMode === 'creative'));
    this.cam = 0; this.minuteAcc = 0; this.spawnT = 0; this.saveT = 0; this.dead = false;
    this.hudDirty = true;
    $('#hud').classList.remove('hidden');
    this.isTouch = profile.settings.touch === 'on' || (profile.settings.touch === 'auto' && matchMedia('(pointer: coarse)').matches);
    $('#touch').classList.toggle('hidden', !this.isTouch);
    this.refreshHud();
    this.paused = false;
    this.camera.fov = profile.settings.fov; this.camera.updateProjectionMatrix();
  }

  findSpawnPoint() {
    for (let r = 0; r < 40; r += 2) for (let a = 0; a < 8; a++) {
      const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
      const y = this.world.surfaceY(x, z);
      if (y > SEA + 1 && this.world.getBlock(x, y - 1, z) !== B.WATER) return new THREE.Vector3(x + 0.5, y + 0.05, z + 0.5);
    }
    return new THREE.Vector3(0.5, WH - 4, 0.5);
  }
  findSpawn() { this.p.pos.copy(this.findSpawnPoint()); }

  saveWorld() {
    if (this.mode !== 'play' || !this.meta || this.royale) return;
    store.set(SAVE_PREFIX + this.meta.id, {
      edits: this.world.serializeEdits(), time: this.time,
      player: { x: this.p.pos.x, y: this.p.pos.y, z: this.p.pos.z, yaw: this.p.yaw, pitch: this.p.pitch, health: this.p.health },
      inv: this.inv.slice(),
    });
    this.hooks.onSaved?.();
  }

  exitWorld() {
    this.saveWorld();
    document.exitPointerLock?.();
    this.keys.clear(); this.mouse = [false, false, false];
    this.startBackdrop();
  }

  setPaused(v) {
    if (this.mode !== 'play' || this.dead) return;
    if (v === this.paused) return;
    this.paused = v;
    if (v) { document.exitPointerLock?.(); this.keys.clear(); this.mouse = [false, false, false]; this.touch.mine = false; this.saveWorld(); this.hooks.onPause?.(); }
    else this.hooks.onResume?.();
  }

  // ------------------------------------------------------------------ input
  bindInput() {
    const c = this.canvas;
    addEventListener('keydown', (e) => {
      if (this.mode !== 'play' || e.repeat && e.code !== 'Space') return;
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (this.paused || this.dead) return;
      if (e.code === 'Space') {
        const now = performance.now();
        if (this.gameMode === 'creative' && now - (this.lastSpace || 0) < 280) { this.p.flying = !this.p.flying; this.p.vel.y = 0; }
        this.lastSpace = now;
      }
      if (e.code === 'KeyE') this.hooks.onInventory?.();
      if (e.code === 'KeyQ') this.useAbility();
      if (e.code === 'KeyG') this.ping();
      if (e.code === 'KeyH') this.emote();
      if (e.code === 'KeyZ') this.build('wall');
      if (e.code === 'KeyX') this.build('ramp');
      if (e.code === 'KeyC') this.build('floor');
      if (e.code === 'KeyV') this.cam = (this.cam + 1) % 3;
      if (e.code === 'KeyF' && this.gameMode === 'creative') this.p.flying = !this.p.flying;
      const d = /^Digit([1-9])$/.exec(e.code); if (d) this.select(+d[1] - 1);
      if (e.code === 'Escape' && !this.locked) this.setPaused(true);
      e.preventDefault?.();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    c.addEventListener('mousedown', (e) => {
      if (this.mode !== 'play' || this.paused) return;
      if (!this.locked && !this.isTouch) { c.requestPointerLock?.(); }
      this.mouse[e.button] = true;
      if (e.button === 0) this.firePressed = true;
      if (e.button === 1) { e.preventDefault(); this.ping(); }
      if (e.button === 2) this.placeBlock();
    });
    addEventListener('mouseup', (e) => { this.mouse[e.button] = false; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked || this.paused) return;
      const s = 0.0022 * profile.settings.sens;
      this.p.yaw -= e.movementX * s; this.p.pitch = clamp(this.p.pitch - e.movementY * s, -1.5, 1.5);
    });
    addEventListener('wheel', (e) => { if (this.mode === 'play' && !this.paused) this.select((this.selected + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      if (!this.locked && this.mode === 'play' && !this.paused && !this.uiOpen) this.setPaused(true);
    });
    this.bindTouch();
  }

  bindTouch() {
    const t = this.touch, root = $('#touch');
    const joy = $('#joy'), knob = $('#joyKnob');
    const hit = (el, x, y) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
    const press = (id, down) => { const el = $(id); el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); down(true); el.classList.add('on'); }, { passive: false }); el.addEventListener('touchend', (e) => { e.preventDefault(); down(false); el.classList.remove('on'); }, { passive: false }); el.addEventListener('touchcancel', () => { down(false); el.classList.remove('on'); }); };
    press('#btnJump', (d) => { if (d) this.keys.add('Space'); else this.keys.delete('Space'); });
    press('#btnMine', (d) => { t.mine = d; if (d) this.firePressed = true; });
    press('#btnPlace', (d) => { if (d) this.placeBlock(); });
    press('#btnFly', (d) => { if (d && this.gameMode === 'creative') this.p.flying = !this.p.flying; });
    press('#btnInv', (d) => { if (d) this.hooks.onInventory?.(); });
    press('#btnCam', (d) => { if (d) this.cam = (this.cam + 1) % 3; });
    press('#btnBuild', (d) => { if (d) this.build('wall'); });
    press('#btnRamp', (d) => { if (d) this.build('ramp'); });
    press('#btnFloor', (d) => { if (d) this.build('floor'); });
    $('#abilityBtn').addEventListener('click', () => this.useAbility());
    const start = (e) => {
      for (const tc of e.changedTouches) {
        if (e.target.closest('.tbtn,#hotbar,#btnPause')) continue;
        if (tc.clientX < innerWidth * 0.42 && t.joyId == null) {
          t.joyId = tc.identifier; t.jox = tc.clientX; t.joy0 = tc.clientY;
          joy.style.left = `${tc.clientX - 60}px`; joy.style.top = `${tc.clientY - 60}px`; joy.classList.add('show');
        } else if (t.lookId == null) { t.lookId = tc.identifier; t.last = [tc.clientX, tc.clientY]; }
      }
    };
    const move = (e) => {
      for (const tc of e.changedTouches) {
        if (tc.identifier === t.joyId) {
          let dx = tc.clientX - t.jox, dy = tc.clientY - t.joy0; const m = Math.hypot(dx, dy), max = 50;
          if (m > max) { dx = dx / m * max; dy = dy / m * max; }
          t.jx = dx / max; t.jy = -dy / max; knob.style.transform = `translate(${dx}px,${dy}px)`;
        } else if (tc.identifier === t.lookId) {
          const s = 0.005 * profile.settings.sens;
          this.p.yaw -= (tc.clientX - t.last[0]) * s; this.p.pitch = clamp(this.p.pitch - (tc.clientY - t.last[1]) * s, -1.5, 1.5);
          t.last = [tc.clientX, tc.clientY];
        }
      }
      if (this.mode === 'play') e.preventDefault();
    };
    const end = (e) => {
      for (const tc of e.changedTouches) {
        if (tc.identifier === t.joyId) { t.joyId = null; t.jx = t.jy = 0; knob.style.transform = ''; joy.classList.remove('show'); }
        if (tc.identifier === t.lookId) t.lookId = null;
      }
    };
    this.canvas.addEventListener('touchstart', start, { passive: true });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    void hit; void root;
  }

  select(i) { this.selected = i; this.hudDirty = true; }

  // ------------------------------------------------------------------ inventory
  slot(i) { return this.inv[i]; }
  held() { return this.inv[this.selected]; }
  addItem(id, n = 1) {
    if (this.gameMode === 'creative') return;
    for (const s of this.inv) if (s && s.id === id && s.count < MAX_STACK) { const a = Math.min(n, MAX_STACK - s.count); s.count += a; n -= a; if (!n) break; }
    for (let i = 0; i < this.inv.length && n > 0; i++) if (!this.inv[i]) { const a = Math.min(n, MAX_STACK); this.inv[i] = { id, count: a }; n -= a; }
    this.hudDirty = true;
  }
  addItemObj(o) {
    if (o.id) return this.addItem(o.id, o.count || 1);
    const stackable = ITEMS[o.item].type === 'consumable';
    if (stackable) { const s = this.inv.find((x) => x && x.item === o.item && x.rar === o.rar); if (s) { s.count += o.count; this.hudDirty = true; return; } }
    const i = this.inv.findIndex((x) => !x); if (i >= 0) this.inv[i] = { ...o }; else toast('Inventory full', '');
    this.hudDirty = true;
  }
  countOf(id) { return this.inv.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0); }
  removeItem(id, n) {
    for (const s of this.inv) if (s && s.id === id && n > 0) { const a = Math.min(n, s.count); s.count -= a; n -= a; }
    this.inv = this.inv.map((s) => (s && s.count > 0 ? s : s && s.count < 0 ? s : null));
    this.hudDirty = true;
  }
  swapSlots(a, b) { [this.inv[a], this.inv[b]] = [this.inv[b], this.inv[a]]; this.hudDirty = true; }
  setSlot(i, id) { this.inv[i] = id ? { id, count: -1 } : null; this.hudDirty = true; }
  canCraft(r) { return r.in.every(([id, n]) => this.countOf(id) >= n); }
  craft(r) { if (!this.canCraft(r)) return false; r.in.forEach(([id, n]) => this.removeItem(id, n)); this.addItem(r.out[0], r.out[1]); return true; }

  // ------------------------------------------------------------------ player actions
  look() {
    const cp = Math.cos(this.p.pitch);
    return new THREE.Vector3(-Math.sin(this.p.yaw) * cp, Math.sin(this.p.pitch), -Math.cos(this.p.yaw) * cp);
  }
  eye() { return new THREE.Vector3(this.p.pos.x, this.p.pos.y + EYE, this.p.pos.z); }

  targetBlock() { return this.world.raycast(this.eye(), this.look(), REACH); }

  targetMob(maxDist, dir) {
    const ray = new THREE.Ray(this.eye(), dir || this.look()); let best = null, bd = maxDist;
    const tmp = new THREE.Vector3();
    for (const m of this.mobs) {
      const box = new THREE.Box3(new THREE.Vector3(m.pos.x - m.w / 2, m.pos.y, m.pos.z - m.w / 2), new THREE.Vector3(m.pos.x + m.w / 2, m.pos.y + m.h, m.pos.z + m.w / 2));
      if (ray.intersectBox(box, tmp)) { const d = tmp.distanceTo(ray.origin); if (d < bd) { bd = d; best = m; } }
    }
    return best ? { mob: best, dist: bd } : null;
  }

  placeBlock() {
    if (this.mode !== 'play' || this.paused || this.dead) return;
    const t = this.targetBlock();
    if (t && t.id === B.CHEST) return this.openChest(t);
    const s = this.held(); if (!s) return;
    if (s.item) return this.useItem(s);
    if (!t) return;
    const x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
    if (y < 0 || y >= WH) return;
    const cur = BLOCKS[this.world.getBlock(x, y, z)];
    if (cur.solid) return;
    // don't place inside the player or a mob
    const hit = (b) => x + 1 > b.pos.x - b.w / 2 && x < b.pos.x + b.w / 2 && z + 1 > b.pos.z - b.w / 2 && z < b.pos.z + b.w / 2 && y + 1 > b.pos.y && y < b.pos.y + b.h;
    if (hit({ pos: this.p.pos, w: this.p.w, h: this.p.h }) || this.mobs.some(hit)) return;
    this.world.setBlock(x, y, z, s.id);
    if (this.gameMode !== 'creative' && !stats().freeBuild) { s.count--; if (s.count <= 0) this.inv[this.selected] = null; this.hudDirty = true; }
    addXP(XP_REWARDS.place); questProgress('place');
    this.hudPulse();
  }

  breakBlock(t) {
    const b = BLOCKS[t.id];
    if (t.id === B.TNT) { this.world.setBlock(t.x, t.y, t.z, AIR); return this.explode(t.x + 0.5, t.y + 0.5, t.z + 0.5, 3.2); }
    this.world.setBlock(t.x, t.y, t.z, AIR);
    if (this.royale) { this.mats += t.id === B.LOG || t.id === B.PLANKS ? 8 : 3; }
    this.burst(t.x + 0.5, t.y + 0.5, t.z + 0.5, blockColor(t.id));
    if (this.gameMode !== 'creative' && b.drop) this.addItem(b.drop, 1);
    if (b.coins) { const c = b.coins * stats().oreCoinMul; addCoins(c); this.floatText(`+${c}`); }
    addXP(XP_REWARDS.mine); questProgress('mine');
  }

  hurt(amount, from, opts = {}) {
    if (this.gameMode === 'creative' || this.dead) return;
    const p = this.p;
    if (!opts.storm) { if (p.hurtCd > 0) return; p.hurtCd = 0.3; }
    if (p.shield > 0) { const a = Math.min(p.shield, amount); p.shield -= a; amount -= a; this.hudDirty = true; }
    $('#hurt').classList.add('on'); setTimeout(() => $('#hurt').classList.remove('on'), 160);
    if (amount <= 0) return;
    if (p.health - amount <= 0 && stats().phoenix && !p.phoenixUsed) {
      p.phoenixUsed = true; p.health = 6; toast('Phoenix Charm saved you!', 'gold'); this.hudDirty = true; return;
    }
    p.health = Math.max(0, p.health - amount);
    if (from) { const d = new THREE.Vector3().subVectors(p.pos, from.pos).setY(0).normalize(); p.vel.x += d.x * 4; p.vel.z += d.z * 4; p.vel.y = Math.max(p.vel.y, 3); }
    this.hudDirty = true;
    if (p.health <= 0) this.die();
  }

  die() {
    if (this.royale) { this.royale.end(false); return; }
    this.dead = true; document.exitPointerLock?.();
    this.keys.clear(); this.mouse = [false, false, false]; this.touch.mine = false;
    if (!stats().keepInventory && this.gameMode === 'survival') this.inv = this.inv.map(() => null);
    this.hooks.onDeath?.({ kept: stats().keepInventory });
  }

  respawn() {
    const p = this.p; p.pos.copy(this.spawn); p.vel.set(0, 0, 0);
    p.health = stats().maxHealth; p.phoenixUsed = false; p.fallFrom = null; this.dead = false;
    this.mobs.filter((m) => m.type === 'zombie').forEach((m) => this.killMob(m, false));
    this.hudDirty = true; this.hooks.onRespawn?.();
  }

  // ------------------------------------------------------------------ physics
  solidAt(x, y, z) { return BLOCKS[this.world.getBlock(x, y, z)].solid; }
  boxHits(px, py, pz, w, h) {
    const r = w / 2;
    for (let x = Math.floor(px - r); x <= Math.floor(px + r - 1e-4); x++)
      for (let z = Math.floor(pz - r); z <= Math.floor(pz + r - 1e-4); z++)
        for (let y = Math.floor(py); y <= Math.floor(py + h - 1e-4); y++)
          if (this.solidAt(x, y, z)) return true;
    return false;
  }

  moveBody(b, dt) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vel.x), Math.abs(b.vel.y), Math.abs(b.vel.z)) * dt / 0.4));
    const sd = dt / steps; b.onGround = false; b.hitWall = false;
    for (let i = 0; i < steps; i++) {
      let nx = b.pos.x + b.vel.x * sd;
      if (this.boxHits(nx, b.pos.y, b.pos.z, b.w, b.h)) { b.vel.x = 0; b.hitWall = true; } else b.pos.x = nx;
      let nz = b.pos.z + b.vel.z * sd;
      if (this.boxHits(b.pos.x, b.pos.y, nz, b.w, b.h)) { b.vel.z = 0; b.hitWall = true; } else b.pos.z = nz;
      let ny = b.pos.y + b.vel.y * sd;
      if (this.boxHits(b.pos.x, ny, b.pos.z, b.w, b.h)) {
        if (b.vel.y < 0) { b.onGround = true; b.pos.y = Math.floor(ny) + 1; }
        b.vel.y = 0;
      } else b.pos.y = ny;
    }
    if (b.pos.y < -20) { b.pos.y = WH; b.vel.set(0, 0, 0); }
  }

  updatePlayer(dt) {
    const p = this.p, st = stats();
    p.hurtCd = Math.max(0, p.hurtCd - dt); p.attackCd = Math.max(0, p.attackCd - dt);
    const k = this.keys, t = this.touch;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + t.jy;
    let s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + t.jx;
    if (p.gliding && Math.hypot(f, s) < 0.05) f = 0.5;
    const m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; }
    const sprint = (k.has('ShiftLeft') || k.has('ControlLeft') || Math.hypot(t.jx, t.jy) > 0.92) && f > 0.3;
    const feet = BLOCKS[this.world.getBlock(p.pos.x, p.pos.y + 0.2, p.pos.z)];
    p.inWater = feet.liquid;
    const base = p.gliding ? 15 : p.flying ? 10.5 : p.inWater ? 2.6 : sprint ? 6.2 : 4.3;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const tx = (-sin * f + cos * s) * base, tz = (-cos * f - sin * s) * base;
    p.dashT = Math.max(0, p.dashT - dt);
    const a = p.dashT > 0 ? 0 : Math.min(1, (p.onGround || p.flying || p.inWater || p.gliding ? 14 : 4) * dt);
    p.vel.x += (tx - p.vel.x) * a; p.vel.z += (tz - p.vel.z) * a;
    if (p.gliding) { const tgt = p.pitch < -0.55 ? -16 : -5.5; p.vel.y += (tgt - p.vel.y) * Math.min(1, 3 * dt); }
    else if (p.flying) {
      const up = (k.has('Space') ? 1 : 0) - (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0);
      p.vel.y += (up * 8 - p.vel.y) * Math.min(1, 10 * dt);
    } else {
      p.vel.y -= (p.inWater ? 6 : this.time < this.moonUntil ? 7 : 28) * dt;
      if (p.inWater) { p.vel.y = Math.max(p.vel.y, -3); if (k.has('Space')) p.vel.y = Math.min(p.vel.y + 22 * dt, 3.2); }
      else if (k.has('Space') && p.onGround) { p.vel.y = 8.6 * st.jumpMul * (this.time < this.moonUntil ? 1.5 : 1); p.onGround = false; }
      p.vel.y = Math.max(p.vel.y, -50);
    }
    if (this.grapple) {
      const gr = this.grapple; gr.t -= dt;
      const to = gr.pt.clone().sub(new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z)), d = to.length();
      if (gr.t <= 0 || d < 2) { this.grapple = null; this.grappleLine.visible = false; p.vel.y = Math.max(p.vel.y, 4); }
      else { p.vel.copy(to.normalize().multiplyScalar(20)); p.fallFrom = null; }
    }
    const prevY = p.pos.y, wasGround = p.onGround;
    this.moveBody(p, dt);
    if (p.gliding) { p.fallFrom = null; if (p.onGround || p.inWater) { p.gliding = false; this.announce('Landed — find loot chests!', 2000); } }
    if (p.onGround && this.world.getBlock(p.pos.x, p.pos.y - 0.2, p.pos.z) === B.JUMPPAD) { p.vel.y = 17; p.onGround = false; p.fallFrom = null; }
    // fall damage
    if (!p.flying && !p.inWater && !p.gliding && p.vel.y < -0.1 && !p.onGround) { if (p.fallFrom == null) p.fallFrom = prevY; }
    if (p.onGround || p.inWater || p.flying) {
      if (p.fallFrom != null && p.onGround && !wasGround || (p.fallFrom != null && p.onGround)) {
        const d = p.fallFrom - p.pos.y;
        if (d > 3.6 && !st.noFallDamage && this.gameMode === 'survival') this.hurt(Math.floor((d - 3) * 2));
      }
      p.fallFrom = null;
    }
    p.speedXZ = Math.hypot(p.vel.x, p.vel.z);
    p.bobT += dt * p.speedXZ;
    // regen
    if (this.gameMode === 'survival' && p.health < st.maxHealth) { p.regen += dt; if (p.regen > 4) { p.regen = 0; p.health++; this.hudDirty = true; } }
    if (p.health > st.maxHealth) { p.health = st.maxHealth; this.hudDirty = true; }
  }

  updateActions(dt) {
    const p = this.p;
    const wantMine = this.mouse[0] || this.touch.mine;
    const fp = this.firePressed; this.firePressed = false;
    const held = this.held();
    if (held?.item && ITEMS[held.item].type === 'weapon') {
      this.outline.visible = false; $('#mineBar').classList.remove('on');
      if (ITEMS[held.item].auto ? wantMine : fp) this.fire(held);
      return;
    }
    const bt = this.targetBlock();
    const mt = this.targetMob(bt ? bt.dist : REACH);
    // outline
    if (bt && !(mt)) { this.outline.visible = true; this.outline.position.set(bt.x + 0.5, bt.y + 0.5, bt.z + 0.5); } else this.outline.visible = false;
    const bar = $('#mineBar'), fill = bar.firstElementChild;
    if (wantMine && mt) {
      p.mineT = 0; bar.classList.remove('on');
      if (p.attackCd <= 0) { p.attackCd = 0.45; this.hitMob(mt.mob, this.gameMode === 'creative' ? 99 : 2); }
      return;
    }
    if (wantMine && bt && BLOCKS[bt.id].hard !== Infinity) {
      const key = `${bt.x},${bt.y},${bt.z}`;
      if (key !== p.mineKey) { p.mineKey = key; p.mineT = 0; }
      const need = this.gameMode === 'creative' ? 0.12 : BLOCKS[bt.id].hard * 0.9 / stats().mineSpeed;
      p.mineT += dt;
      bar.classList.add('on'); fill.style.width = `${Math.min(100, p.mineT / need * 100)}%`;
      if (p.mineT >= need) { this.breakBlock(bt); p.mineT = 0; p.mineKey = ''; }
    } else { p.mineT = 0; p.mineKey = ''; bar.classList.remove('on'); }
  }

  // ------------------------------------------------------------------ mobs
  makePig(golden = false) {
    const g = new THREE.Group(); const pink = new THREE.MeshBasicMaterial({ color: golden ? 0xffd24a : 0xf0a8b8 }), dark = new THREE.MeshBasicMaterial({ color: golden ? 0xd9a300 : 0xd98ca0 });
    const add = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
    add(0.6, 0.5, 0.95, 0, 0.6, 0, pink); add(0.46, 0.44, 0.44, 0, 0.75, 0.6, pink); add(0.24, 0.16, 0.1, 0, 0.7, 0.85, dark);
    add(0.06, 0.06, 0.02, -0.12, 0.84, 0.83, new THREE.MeshBasicMaterial({ color: 0x111 })); add(0.06, 0.06, 0.02, 0.12, 0.84, 0.83, new THREE.MeshBasicMaterial({ color: 0x111 }));
    for (const [x, z] of [[-0.18, -0.32], [0.18, -0.32], [-0.18, 0.32], [0.18, 0.32]]) add(0.16, 0.36, 0.16, x, 0.18, z, dark);
    return g;
  }

  spawnMob(type, x, z, opts = {}) {
    const y = this.world.surfaceY(x, z);
    let mesh, w, h, hp, golden = false;
    if (type === 'zombie') {
      const z0 = skinById('explorer');
      const zs = { id: 'zombie', spec: { skin: '#5e9a52', hair: '#2f5a2a', shirt: '#2f6f8f', pants: '#2a3358', shoes: '#1d1d22', paint: null } };
      void z0; mesh = buildHumanoid(skinTexture(zs)); mesh.userData.parts.armR.rotation.x = mesh.userData.parts.armL.rotation.x = -1.4;
      w = 0.6; h = 1.8; hp = 8;
    } else if (type === 'bot') { mesh = opts.model; w = 0.6; h = 1.8; hp = 20; }
    else { golden = Math.random() < 0.04; mesh = this.makePig(golden); w = 0.8; h = 0.9; hp = golden ? 8 : 4; }
    mesh.position.set(x, y, z); this.scene.add(mesh);
    const m = { type, mesh, pos: new THREE.Vector3(x, y + 0.05, z), vel: new THREE.Vector3(), w, h, hp, golden, onGround: false, cd: 0, wander: 0, dir: new THREE.Vector3(), yaw: 0, burn: 0 };
    this.mobs.push(m); return m;
  }

  killMob(m, reward = true) {
    this.scene.remove(m.mesh); disposeObject(m.mesh);
    this.mobs.splice(this.mobs.indexOf(m), 1);
    if (m.type === 'bot') this.royale?.botDown(m, reward);
    this.burst(m.pos.x, m.pos.y + m.h / 2, m.pos.z, m.type === 'zombie' ? 0x5e9a52 : 0xf0a8b8);
    if (reward) {
      const c = m.golden ? 100 : m.type === 'zombie' ? 8 : m.type === 'bot' ? 0 : 3;
      if (c) { addCoins(c); this.floatText(`+${c}`); }
      if (m.golden) { toast('✨ You found the Golden Pig! +100 coins', 'gold'); confetti(50); }
      if (m.type === 'zombie') { questProgress('kill'); addXP(XP_REWARDS.kill); }
    }
  }

  hitMob(m, dmg) {
    m.hp -= dmg; m.burn = 0;
    const d = new THREE.Vector3().subVectors(m.pos, this.p.pos).setY(0).normalize();
    const kb = m.type === 'bot' ? 0.35 : 1; m.vel.x = d.x * 7 * kb; m.vel.z = d.z * 7 * kb; m.vel.y = 5 * kb;
    m.flash = 0.2;
    if (m.hp <= 0) this.killMob(m);
  }

  get daylight() { const s = Math.sin((this.time / DAY_LENGTH) * Math.PI * 2); return clamp(s * 1.5 + 0.35, 0, 1); }

  updateMobs(dt) {
    const p = this.p, st = stats(), day = this.daylight;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 2.5;
      const zc = this.mobs.filter((m) => m.type === 'zombie').length, pc = this.mobs.filter((m) => m.type === 'pig').length;
      const R = this.world.renderDist * CH - 10;
      const ring = (min, max) => { const a = Math.random() * 6.283, d = min + Math.random() * (max - min); return [p.pos.x + Math.cos(a) * d, p.pos.z + Math.sin(a) * d]; };
      if (this.gameMode === 'survival' && day < 0.35 && zc < Math.round(6 * st.mobSpawnMul) && Math.random() < 0.8) {
        const [x, z] = ring(14, Math.min(26, R)); const y = this.world.surfaceY(x, z);
        if (y > SEA) this.spawnMob('zombie', x, z);
      }
      if (!this.royale && day > 0.5 && pc < 5 && Math.random() < 0.5) {
        const [x, z] = ring(10, Math.min(24, R)); const y = this.world.surfaceY(x, z);
        if (y > SEA + 1 && this.world.getBlock(Math.floor(x), y - 1, Math.floor(z)) === B.GRASS) this.spawnMob('pig', x, z);
      }
    }
    for (const m of [...this.mobs]) {
      const dx = p.pos.x - m.pos.x, dz = p.pos.z - m.pos.z, dist = Math.hypot(dx, dz);
      m.cd = Math.max(0, m.cd - dt); m.flash = Math.max(0, (m.flash || 0) - dt);
      if (dist > 60 && m.type !== 'bot') { this.killMob(m, false); continue; }
      if (m.type === 'zombie') {
        if (day > 0.65) { m.burn += dt; if (m.burn > 3) { this.killMob(m, false); continue; } }
        if (dist < 28 && !this.dead) {
          const sp = 2.7; m.vel.x += (dx / dist * sp - m.vel.x) * Math.min(1, 6 * dt); m.vel.z += (dz / dist * sp - m.vel.z) * Math.min(1, 6 * dt);
          m.yaw = Math.atan2(dx, dz);
          if (m.onGround && m.hitWall) m.vel.y = 8;
          if (dist < 1.25 && Math.abs(p.pos.y - m.pos.y) < 1.6 && m.cd <= 0) { m.cd = 1.1; this.hurt(Math.round(4 * st.mobDamageMul), m); }
        } else { m.vel.x *= 0.9; m.vel.z *= 0.9; }
      } else if (m.type === 'bot') { this.royale.botAI(m, dt);
      } else {
        m.wander -= dt;
        if (m.wander <= 0) { m.wander = 2 + Math.random() * 3; const a = Math.random() * 6.283; m.dir.set(Math.random() < 0.4 ? 0 : Math.cos(a), 0, Math.random() < 0.4 ? 0 : Math.sin(a)); if (m.dir.lengthSq()) m.yaw = Math.atan2(m.dir.x, m.dir.z); }
        m.vel.x += (m.dir.x * 1.2 - m.vel.x) * Math.min(1, 5 * dt); m.vel.z += (m.dir.z * 1.2 - m.vel.z) * Math.min(1, 5 * dt);
        if (m.onGround && m.hitWall) m.vel.y = 7;
      }
      m.vel.y -= 28 * dt;
      this.moveBody(m, dt);
      m.mesh.position.copy(m.pos); m.mesh.rotation.y = m.yaw;
      if (m.type === 'zombie' || m.type === 'bot') animateHumanoid(m.mesh, Math.hypot(m.vel.x, m.vel.z) / 2.7, this.time * 1.4 + m.pos.x);
      const tint = lerp(0.5, 1, day); const hot = m.flash > 0 || m.burn > 0;
      m.mesh.traverse((o) => { if (o.material?.color) o.material.color.setRGB(hot ? 1 : tint, hot ? 0.45 : tint, hot ? 0.45 : tint); });
    }
  }

  // ------------------------------------------------------------------ effects / HUD
  burst(x, y, z, color) {
    for (let i = 0; i < 9; i++) {
      const mesh = new THREE.Mesh(this.partGeo, new THREE.MeshBasicMaterial({ color }));
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6);
      this.scene.add(mesh);
      this.particles.push({ mesh, vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4), life: 0.6 + Math.random() * 0.3 });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i]; q.life -= dt; q.vel.y -= 16 * dt;
      q.mesh.position.addScaledVector(q.vel, dt);
      if (q.life <= 0) { this.scene.remove(q.mesh); q.mesh.material.dispose(); this.particles.splice(i, 1); }
    }
  }

  floatText(txt) {
    const el = document.createElement('div'); el.className = 'floaty'; el.textContent = `🪙 ${txt}`;
    $('#hud').appendChild(el); setTimeout(() => el.remove(), 1200);
    this.hudPulse();
  }
  hudPulse() { const c = $('#coinChip'); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }

  refreshHud() {
    if (this.mode !== 'play') return;
    $('#coinCount').textContent = profile.coins.toLocaleString();
    const tier = Math.min(BP.tiers, Math.floor(profile.xp / BP.xpPerTier));
    $('#passTier').textContent = tier >= BP.tiers ? 'MAX' : `T${tier}`;
    $('#passBar').firstElementChild.style.width = `${tier >= BP.tiers ? 100 : (profile.xp % BP.xpPerTier) / BP.xpPerTier * 100}%`;
  }

  renderHud() {
    this.hudDirty = false;
    const max = stats().maxHealth, h = this.p.health;
    const hearts = $('#hearts');
    if (this.gameMode === 'creative') hearts.innerHTML = '<span class="mode">CREATIVE</span>';
    else {
      let s = '';
      for (let i = 0; i < max / 2; i++) s += `<i class="${h >= (i + 1) * 2 ? 'full' : h === i * 2 + 1 ? 'half' : 'empty'}"></i>`;
      hearts.innerHTML = s;
    }
    const hb = $('#hotbar'); let out = '';
    for (let i = 0; i < 9; i++) {
      const s = this.inv[i];
      out += `<div class="slot ${i === this.selected ? 'sel' : ''}" data-i="${i}" ${s?.item ? `style="border-color:${RARITY_COL[s.rar || 'common']}"` : ''}>${slotHtml(s)}</div>`;
    }
    hb.innerHTML = out;
    const held = this.held(); $('#heldName').textContent = held ? slotName(held) + (held.item && ITEMS[held.item].type === 'weapon' ? `  🔸${this.ammo}` : '') : '';
    const sb = $('#shieldBar'); sb.classList.toggle('hidden', !(this.royale || this.p.shield > 0)); sb.firstElementChild.style.width = `${this.p.shield / 50 * 100}%`;
    this.refreshHud();
  }

  // ------------------------------------------------------------------ items, abilities, fx
  announce(text, ms = 2500) {
    const a = $('#announce'); a.textContent = text; a.classList.add('on');
    clearTimeout(this._annT); this._annT = setTimeout(() => a.classList.remove('on'), ms);
  }

  tracer(from, to, color) {
    const g = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true }));
    mesh.frustumCulled = false; this.scene.add(mesh); this.tracers.push({ mesh, life: 0.09 });
  }

  fire(slot) {
    if (this.fireCd > 0) return;
    const it = ITEMS[slot.item], creative = this.gameMode === 'creative';
    if (!creative && this.ammo < 1) { toast('Out of ammo — find chests', ''); this.fireCd = 0.6; return; }
    if (!creative) this.ammo--;
    this.fireCd = it.cd;
    const dmg = it.dmg * RARITY_DMG[RARITIES.indexOf(slot.rar || 'common')];
    const eye = this.eye(), base = this.look(), p = this.p;
    const muzzle = eye.clone().addScaledVector(base, 0.7); muzzle.x += Math.cos(p.yaw) * 0.22; muzzle.z -= Math.sin(p.yaw) * 0.22; muzzle.y -= 0.18;
    let hit = false;
    for (let i = 0; i < it.pellets; i++) {
      const d = base.clone().add(new THREE.Vector3((Math.random() - 0.5) * it.spread * 2, (Math.random() - 0.5) * it.spread * 2, (Math.random() - 0.5) * it.spread * 2)).normalize();
      const bh = this.world.raycast(eye, d, 70), bd = bh ? bh.dist : 70, mh = this.targetMob(bd, d);
      if (mh) { this.hitMob(mh.mob, dmg); hit = true; }
      if (i < 3) this.tracer(muzzle, eye.clone().addScaledVector(d, mh ? mh.dist : bd), it.color);
    }
    if (hit) { const c = $('#crosshair'); c.style.transform = 'translate(-50%,-50%) scale(1.6)'; setTimeout(() => { c.style.transform = ''; }, 90); }
    p.pitch = Math.min(1.5, p.pitch + 0.012); this.hudDirty = true;
  }

  useItem(slot) {
    const it = ITEMS[slot.item], p = this.p, st = stats();
    const consume = () => { slot.count--; if (slot.count <= 0) this.inv[this.selected] = null; this.hudDirty = true; };
    if (it.type === 'consumable') {
      if (it.heal) { if (p.health >= st.maxHealth) return toast('Health is full', ''); p.health = Math.min(st.maxHealth, p.health + it.heal); toast('+5 hearts', 'gold'); consume(); }
      if (it.shield) { if (p.shield >= 50) return toast('Shield is full', ''); p.shield = Math.min(50, p.shield + it.shield); toast('+25 shield', 'gold'); consume(); }
    } else if (it.type === 'gadget' && slot.item === 'grapple') {
      if (this.grappleCd > this.time) return;
      const t = this.world.raycast(this.eye(), this.look(), it.range); if (!t) return toast('Nothing to grapple', '');
      this.grapple = { pt: new THREE.Vector3(t.x + 0.5, t.y + 0.5, t.z + 0.5), t: 1.1 }; this.grappleCd = this.time + it.cd;
      this.grappleLine.visible = true;
    }
  }

  openChest(t) {
    const key = `${t.x},${t.y},${t.z}`, supply = this.supplySet.has(key);
    this.world.setBlock(t.x, t.y, t.z, AIR); this.royale?.beamOff(t.x, t.y, t.z); this.supplySet.delete(key);
    this.burst(t.x + 0.5, t.y + 0.7, t.z + 0.5, 0xffd24a);
    const loot = rollLoot({ luck: stats().lootLuck, supply });
    if (!supply && Math.random() < 1 / 60) { loot.push({ item: 'longshot', rar: 'legendary', count: 1 }); addCoins(150); toast('✨ GOLDEN CHEST! +150 coins', 'gold'); confetti(50); }
    const names = [];
    for (const o of loot) {
      if (o.ammo) { this.ammo += o.ammo; names.push(`+${o.ammo} ammo`); }
      else if (o.mats) { this.mats += o.mats; names.push(`+${o.mats} 🧱`); }
      else { this.addItemObj(o); names.push(`${o.count > 1 ? o.count + '× ' : ''}${slotName(o)}`); }
    }
    toast(`${supply ? '📦 ' : ''}${names.join(' · ')}`, 'gold'); this.hudDirty = true;
  }

  explode(x, y, z, r) {
    const R = Math.ceil(r), w = this.world; const chain = [];
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz, id = w.getBlock(bx, by, bz);
      if (id === AIR || BLOCKS[id].hard === Infinity || BLOCKS[id].liquid) continue;
      w.setBlock(bx, by, bz, AIR); if (id === B.TNT) chain.push([bx, by, bz]);
      if ((dx + dy + dz) % 3 === 0) this.burst(bx + 0.5, by + 0.5, bz + 0.5, blockColor(id));
    }
    const hurtD = (pos) => Math.hypot(pos.x - x, pos.y + 0.9 - y, pos.z - z);
    const pd = hurtD(this.p.pos); if (pd < r + 2.5) { this.hurt(Math.round((r + 3 - pd) * 2)); const d = new THREE.Vector3(this.p.pos.x - x, 0.6, this.p.pos.z - z).normalize(); this.p.vel.addScaledVector(d, 10); }
    for (const m of [...this.mobs]) { const d = hurtD(m.pos); if (d < r + 2.5) this.hitMob(m, Math.round((r + 3 - d) * 3)); }
    chain.forEach(([bx, by, bz], i) => setTimeout(() => this.world && this.explode(bx + 0.5, by + 0.5, bz + 0.5, r), 150 + i * 90));
    if (this.mode === 'play') { toast('💥', ''); }
  }

  paintAbility() { const l = legendById(profile.legend); $('#abilityIcon').textContent = l.icon; $('#abilityBtn').title = `${l.ability} (Q)`; }

  useAbility() {
    if (this.mode !== 'play' || this.paused || this.dead || this.abilityCd > 0) return;
    const l = legendById(profile.legend), p = this.p;
    if (l.id === 'vex') { p.vel.x = -Math.sin(p.yaw) * 22; p.vel.z = -Math.cos(p.yaw) * 22; p.vel.y = Math.max(p.vel.y, 3.5); p.dashT = 0.28; p.hurtCd = 0.6; }
    else if (l.id === 'bulwark') { p.shield = Math.min(50, p.shield + 25); this.hudDirty = true; toast('Aegis: +25 shield', 'gold'); }
    else if (l.id === 'scout') this.startSonar();
    this.abilityCd = l.cd;
  }

  startSonar() {
    this.sonarUntil = this.time + 6;
    const mk = (color) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false, fog: false })); m.renderOrder = 999; this.scene.add(m); return m; };
    for (const c of this.world.chunks.values()) for (let i = 0; i < c.data.length; i++) if (c.data[i] === B.CHEST) {
      const x = c.cx * CH + (i % CH), z = c.cz * CH + (((i / CH) | 0) % CH), y = (i / (CH * CH)) | 0;
      if (Math.hypot(x - this.p.pos.x, z - this.p.pos.z) > 90) continue;
      const mesh = mk(0xffd24a); mesh.position.set(x + 0.5, y + 1.6, z + 0.5); this.sonar.push({ mesh });
    }
    for (const m of this.mobs) if (m.type !== 'pig') this.sonar.push({ mesh: mk(0xff4455), mob: m });
    toast('📡 Sonar active', 'gold');
  }

  ping() {
    if (this.mode !== 'play' || this.paused || this.dead) return;
    const t = this.world.raycast(this.eye(), this.look(), 200); if (!t) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 30, 6), new THREE.MeshBasicMaterial({ color: 0x40e0ff, transparent: true, opacity: 0.55, depthWrite: false }));
    m.position.set(t.x + 0.5 + t.nx, t.y + 15.5 + t.ny, t.z + 0.5 + t.nz); this.scene.add(m);
    this.pings.push({ mesh: m, life: 8 }); if (this.pings.length > 3) { const o = this.pings.shift(); this.scene.remove(o.mesh); }
    toast(`📍 Ping · ${Math.round(t.dist)}m`, '');
  }

  emote() {
    if (this.mode !== 'play' || this.paused || this.dead || this.emoteT > 0) return;
    this.emoteT = 2.5; this.camBefore = this.cam; this.cam = 1; this.emoteCount++;
    if (this.emoteCount === 10) { document.body.classList.add('disco'); confetti(80); toast('🪩 Disco secret unlocked!', 'gold'); setTimeout(() => document.body.classList.remove('disco'), 15000); }
  }

  build(kind) {
    if (this.mode !== 'play' || this.paused || this.dead) return;
    const creative = this.gameMode === 'creative';
    if (!this.royale && !creative) return toast('Building is available in Storm Royale & Creative', '');
    if (!creative && this.mats < 10) return toast('Need 10 🧱 — break blocks to gather', '');
    const p = this.p, l = this.look();
    const ax = Math.abs(l.x) > Math.abs(l.z) ? Math.sign(l.x) : 0, az = ax ? 0 : Math.sign(l.z) || 1;
    const lx = -az, lz = ax, px = Math.floor(p.pos.x), py = Math.floor(p.pos.y + 0.05), pz = Math.floor(p.pos.z);
    const cells = [];
    if (kind === 'wall') for (let i = -1; i <= 1; i++) for (let j = 0; j < 3; j++) cells.push([px + ax * 2 + lx * i, py + j, pz + az * 2 + lz * i]);
    if (kind === 'floor') for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) cells.push([px + ax + i, py - 1, pz + az + j]);
    if (kind === 'ramp') for (let k = 1; k <= 4; k++) for (let i = -1; i <= 1; i++) cells.push([px + ax * k + lx * i, py + k - 1, pz + az * k + lz * i]);
    let n = 0;
    for (const [x, y, z] of cells) {
      if (BLOCKS[this.world.getBlock(x, y, z)].solid) continue;
      if (x + 1 > p.pos.x - 0.3 && x < p.pos.x + 0.3 && z + 1 > p.pos.z - 0.3 && z < p.pos.z + 0.3 && y + 1 > p.pos.y && y < p.pos.y + 1.8) continue;
      this.world.setBlock(x, y, z, B.PLANKS); n++;
    }
    if (n) { if (!creative) this.mats -= 10; addXP(XP_REWARDS.place); questProgress('place', n); }
  }

  updateFx(dt) {
    if (this.mode !== 'play') return;
    if (!this.paused) {
      this.fireCd = Math.max(0, this.fireCd - dt); this.abilityCd = Math.max(0, this.abilityCd - dt);
      if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.cam = this.camBefore ?? 0; }
    }
    const b = $('#abilityBtn'); b.classList.toggle('ready', this.abilityCd <= 0); $('#abilityCd').textContent = Math.ceil(this.abilityCd);
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.life -= dt; t.mesh.material.opacity = Math.max(0, t.life / 0.09); if (t.life <= 0) { this.scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); this.tracers.splice(i, 1); } }
    for (let i = this.pings.length - 1; i >= 0; i--) { const t = this.pings[i]; t.life -= dt; if (t.life <= 0) { this.scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); this.pings.splice(i, 1); } }
    const sonarOn = this.time < this.sonarUntil;
    for (let i = this.sonar.length - 1; i >= 0; i--) {
      const s = this.sonar[i];
      if (!sonarOn || (s.mob && !this.mobs.includes(s.mob))) { this.scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); this.sonar.splice(i, 1); continue; }
      if (s.mob) s.mesh.position.set(s.mob.pos.x, s.mob.pos.y + s.mob.h + 0.6, s.mob.pos.z);
      s.mesh.rotation.y += dt * 3;
    }
    if (this.grapple) { const pos = this.grappleLine.geometry.attributes.position; pos.setXYZ(0, this.p.pos.x, this.p.pos.y + 1.2, this.p.pos.z); pos.setXYZ(1, this.grapple.pt.x, this.grapple.pt.y, this.grapple.pt.z); pos.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ frame
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.world) { this.renderer.render(this.scene, this.camera); return; }
    if (this.mode === 'backdrop') {
      this.orbit += dt * 0.05; this.time += dt * 2;
      const r = 52, cy = 72;
      this.camera.position.set(Math.cos(this.orbit) * r, cy, Math.sin(this.orbit) * r);
      this.camera.lookAt(0, 26, 0);
      this.environment(0, 0, this.camera.position, false);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (!this.paused && !this.dead) {
      this.time += dt;
      this.updatePlayer(dt); this.updateActions(dt); this.updateMobs(dt); this.royale?.update(dt);
      this.minuteAcc += dt; if (this.minuteAcc >= 60) { this.minuteAcc = 0; addXP(XP_REWARDS.minute); }
      this.saveT += dt; if (this.saveT > 20) { this.saveT = 0; this.saveWorld(); }
    }
    this.updateParticles(dt); this.updateFx(dt);
    this.world.renderDist = profile.settings.renderDist;
    this.world.update(this.p.pos.x, this.p.pos.z, 2);
    this.placeCamera(dt);
    this.environment(this.p.pos.x, this.p.pos.z, this.camera.position, true);
    if (this.hudDirty) this.renderHud();
    if (this.dbg) this.dbg.textContent = `${this.p.pos.x.toFixed(1)}, ${this.p.pos.y.toFixed(1)}, ${this.p.pos.z.toFixed(1)}  chunks:${this.world.chunks.size}`;
    this.renderer.render(this.scene, this.camera);
  }

  placeCamera(dt) {
    const p = this.p, eye = this.eye();
    const bob = p.onGround ? Math.sin(p.bobT * 2.2) * 0.035 * Math.min(1, p.speedXZ / 4) : 0;
    // model for third person
    const skin = profile.equipped;
    if (this.modelSkin !== skin) {
      if (this.model) { this.scene.remove(this.model); disposeObject(this.model); }
      const sk = skinById(skin); this.model = buildHumanoid(skinTexture(sk), sk.hat); this.scene.add(this.model); this.modelSkin = skin;
    }
    this.model.visible = this.cam !== 0;
    this.model.position.copy(p.pos); this.model.rotation.y = p.yaw + Math.PI;
    animateHumanoid(this.model, p.speedXZ / 4.3, this.time);
    if (this.emoteT > 0) { const pp = this.model.userData.parts; pp.armR.rotation.x = -3 + Math.sin(this.time * 12) * 0.4; pp.armL.rotation.x = -3 - Math.sin(this.time * 12) * 0.4; this.model.rotation.y += this.time * 5; this.model.position.y += Math.abs(Math.sin(this.time * 8)) * 0.15; }
    const day = this.daylight; this.model.traverse((o) => { if (o.material?.color && !o.material.transparent) o.material.color.setScalar(lerp(0.55, 1, day)); });
    let pos = eye; pos.y += bob;
    if (this.cam !== 0) {
      const dir = this.look().multiplyScalar(this.cam === 1 ? -1 : 1);
      let d = 4.2; const hit = this.world.raycast(eye, dir, d + 0.3); if (hit) d = Math.max(0.6, hit.dist - 0.3);
      pos = eye.clone().addScaledVector(dir, d);
    }
    this.camera.position.copy(pos);
    this.camera.rotation.set(this.cam === 2 ? -p.pitch : p.pitch, this.cam === 2 ? p.yaw + Math.PI : p.yaw, 0);
  }

  environment(px, pz, camPos, play) {
    const day = this.daylight;
    this.world.setLight(lerp(0.32, 1, day));
    const dayC = new THREE.Color(0x8fc8f2), nightC = new THREE.Color(0x070b1f), dusk = new THREE.Color(0xe8855a);
    const sky = nightC.clone().lerp(dayC, day);
    const edge = 1 - Math.abs(day - 0.5) * 2; if (day > 0.1 && day < 0.9) sky.lerp(dusk, Math.max(0, edge - 0.6) * 0.5);
    const under = play && BLOCKS[this.world.getBlock(camPos.x, camPos.y, camPos.z)].liquid;
    if (under) sky.set(0x1f4f9a).multiplyScalar(lerp(0.4, 1, day));
    this.scene.background = sky;
    const R = this.world.renderDist * CH;
    if (!this.scene.fog) this.scene.fog = new THREE.Fog(sky, 20, R);
    this.scene.fog.color.copy(sky);
    this.scene.fog.near = under ? 1 : R * 0.55; this.scene.fog.far = under ? 18 : R * 0.95;
    const a = (this.time / DAY_LENGTH) * Math.PI * 2;
    for (const [m, s] of [[this.sun, 1], [this.moon, -1]]) {
      m.position.set(camPos.x + Math.cos(a) * 180 * s * 0.0 + 0, camPos.y + Math.sin(a) * 180 * s, camPos.z + Math.cos(a) * 180 * s);
      m.lookAt(camPos);
    }
  }
}
