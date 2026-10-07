// "Storm Royale": a drop-in last-one-standing mode (shrinking storm, loot chests, supply drops,
// 7 bot rivals). Mechanics are generic battle-royale ideas; names, art and numbers are original.
import * as THREE from 'three';
import { B, AIR } from './blocks.js';
import { SKINS, skinTexture, buildHumanoid } from './skins.js';
import { ITEMS, RARITIES, RARITY_DMG, RARITY_COL } from './items.js';
import { WH, SEA } from './world.js';
import { stats, addXP, addCoins, questProgress } from './profile.js';
import { toast, mulberry32 } from './util.js';

const ARENA_R = 110;
const PHASES = [
  { wait: 45, shrink: 40, r: 70, dps: 1 },
  { wait: 35, shrink: 35, r: 42, dps: 2 },
  { wait: 30, shrink: 30, r: 22, dps: 3 },
  { wait: 25, shrink: 25, r: 8, dps: 5 },
  { wait: 15, shrink: 20, r: 2, dps: 8 },
];
const NAMES = ['Rex', 'Nova', 'Kilo', 'Juno', 'Blitz', 'Ozzy', 'Echo', 'Pixel', 'Zed', 'Mako'];
const WEAPON_KEYS = ['blaster', 'rifle', 'scatter', 'longshot'];

// ---------- loot ----------
export function rollRarity(luck = 0, min = 0) {
  const w = luck ? [34, 28, 20, 12, 6] : [50, 28, 14, 6, 2];
  let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
  while (i < w.length - 1 && (r -= w[i]) > 0) i++;
  return RARITIES[Math.max(min, i)];
}
const pickWeapon = () => { const r = Math.random(); return r < 0.34 ? 'blaster' : r < 0.6 ? 'rifle' : r < 0.82 ? 'scatter' : 'longshot'; };

export function rollLoot({ luck = 0, supply = false } = {}) {
  const out = [];
  for (let i = 0; i < (supply ? 2 : 1); i++) if (supply || Math.random() < 0.65) out.push({ item: pickWeapon(), rar: rollRarity(luck, supply ? 3 : 0), count: 1 });
  const r = Math.random();
  if (supply || r < 0.45) out.push({ item: 'shield', rar: 'rare', count: supply ? 2 : 1 });
  if (supply || r > 0.6) out.push({ item: 'medkit', rar: 'common', count: supply ? 2 : 1 });
  if (supply || r > 0.88) out.push({ item: 'grapple', rar: 'epic', count: 1 });
  if (r > 0.3 && r < 0.55) out.push({ id: B.JUMPPAD, count: 2 });
  if (!out.some((o) => o.item && ITEMS[o.item].type === 'weapon') && !supply) out.push({ item: 'shield', rar: 'rare', count: 1 });
  out.push({ ammo: Math.round((supply ? 60 : 14 + Math.random() * 16) * (luck ? 1.5 : 1)) });
  out.push({ mats: supply ? 80 : 20 + Math.round(Math.random() * 20) });
  return out;
}

export class Royale {
  constructor(game) {
    this.game = game; this.beams = new Map(); this.bots = []; this.kills = 0; this.ended = false;
    this.feedT = 0; this.startedAt = performance.now(); this.stormTick = 0; this.fightT = 30;
    this.center = new THREE.Vector2(0, 0); this.radius = ARENA_R;
    this.phase = -1; this.state = 'calm'; this.t = 25;
    this.nextCenter = new THREE.Vector2(0, 0); this.nextRadius = ARENA_R; this.fromC = new THREE.Vector2(); this.fromR = ARENA_R;
    const mk = (color, op) => new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 170, 64, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.storm = mk(0x8a3cff, 0.3); this.ring = mk(0xffffff, 0.1);
    for (const m of [this.storm, this.ring]) { m.position.y = 60; m.frustumCulled = false; game.scene.add(m); }
  }

  start() {
    const g = this.game, w = g.world;
    this.rnd = mulberry32(g.meta.seed ^ 0x5eed);
    w.edits.clear();
    // chests
    let placed = 0, tries = 0;
    while (placed < 36 && tries++ < 400) {
      const a = this.rnd() * 6.283, d = Math.sqrt(this.rnd()) * (ARENA_R - 8);
      const x = Math.floor(Math.cos(a) * d), z = Math.floor(Math.sin(a) * d), y = w.surfaceY(x, z);
      if (y <= SEA + 1 || w.getBlock(x, y - 1, z) === B.WATER) continue;
      w.setBlock(x, y, z, B.CHEST); this.addBeam(x, y, z, 0xffd24a, 9); placed++;
    }
    // bots
    const skins = SKINS.filter((s) => !s.how.secret);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.283 + this.rnd(), d = 35 + this.rnd() * 55;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const sk = skins[Math.floor(this.rnd() * skins.length)];
      const m = g.spawnMob('bot', x, z, { model: buildHumanoid(skinTexture(sk), sk.hat) });
      m.name = NAMES[i]; m.bot = { weapon: WEAPON_KEYS[Math.floor(this.rnd() * 4)], rar: RARITIES[Math.floor(this.rnd() * 3)], cd: 1 + this.rnd() * 2, strafe: 1, strafeT: 0, wp: null, wpT: 0 };
      this.bots.push(m); w.pins.push(m.pos);
    }
    // player drop: glide in from above
    const a = this.rnd() * 6.283, d = this.rnd() * 55;
    g.p.pos.set(Math.cos(a) * d, WH + 48, Math.sin(a) * d); g.p.vel.set(0, 0, 0);
    g.p.gliding = true; g.p.pitch = -0.35;
    g.mats = 150; g.ammo = 36;
    g.inv = g.inv.map(() => null);
    g.addItemObj({ item: 'blaster', rar: 'common', count: 1 }); g.addItemObj({ item: 'medkit', rar: 'common', count: 2 });
    g.select(0);
    g.announce('GLIDE IN — land, loot, build, outlast the storm!', 4000);
  }

  addBeam(x, y, z, color, h) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, h, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false }));
    m.position.set(x + 0.5, y + h / 2 + 0.5, z + 0.5); this.game.scene.add(m); this.beams.set(`${x},${y},${z}`, m);
  }
  beamOff(x, y, z) {
    const k = `${x},${y},${z}`, m = this.beams.get(k);
    if (m) { this.game.scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.beams.delete(k); }
  }

  feed(text) { this.game.announce(text, 2600); }

  supplyDrop() {
    const g = this.game, w = g.world;
    for (let i = 0; i < 30; i++) {
      const a = this.rnd() * 6.283, d = Math.sqrt(this.rnd()) * Math.max(2, this.nextRadius - 3);
      const x = Math.floor(this.nextCenter.x + Math.cos(a) * d), z = Math.floor(this.nextCenter.y + Math.sin(a) * d), y = w.surfaceY(x, z);
      if (y <= SEA + 1) continue;
      w.setBlock(x, y, z, B.CHEST); g.supplySet.add(`${x},${y},${z}`); this.addBeam(x, y, z, 0xb266ff, 60);
      const dist = Math.round(Math.hypot(x - g.p.pos.x, z - g.p.pos.z));
      g.announce(`📦 SUPPLY DROP landed — ${dist}m away`, 3500); return;
    }
  }

  nextPhase() {
    this.phase++;
    const P = PHASES[this.phase]; if (!P) return;
    this.state = 'wait'; this.t = P.wait;
    this.fromC.copy(this.center); this.fromR = this.radius;
    // next safe zone lives fully inside the current one
    const maxOff = Math.max(0, this.radius - P.r - 1), a = this.rnd() * 6.283, d = Math.sqrt(this.rnd()) * maxOff;
    this.nextCenter.set(this.center.x + Math.cos(a) * d, this.center.y + Math.sin(a) * d); this.nextRadius = P.r;
    this.game.announce(`🌀 Storm closing in ${P.wait}s — head to the white circle`, 3500);
    this.supplyDrop();
  }

  get dps() { return PHASES[Math.max(0, this.phase)]?.dps ?? 1; }

  update(dt) {
    if (this.ended) return;
    const g = this.game, p = g.p;
    // storm timeline
    this.t -= dt;
    if (this.state === 'calm') { if (this.t <= 0) this.nextPhase(); }
    else if (this.state === 'wait') { if (this.t <= 0) { this.state = 'shrink'; this.t = PHASES[this.phase].shrink; g.announce('🌀 The storm is shrinking!', 2500); } }
    else if (this.state === 'shrink') {
      const k = 1 - Math.max(0, this.t) / PHASES[this.phase].shrink;
      this.radius = this.fromR + (this.nextRadius - this.fromR) * k;
      this.center.lerpVectors(this.fromC, this.nextCenter, k);
      if (this.t <= 0) { this.radius = this.nextRadius; this.center.copy(this.nextCenter); if (this.phase < PHASES.length - 1) this.nextPhase(); else this.state = 'final'; }
    }
    const showNext = this.state === 'wait' || this.state === 'shrink';
    this.storm.scale.set(this.radius, 1, this.radius); this.storm.position.x = this.center.x; this.storm.position.z = this.center.y;
    this.ring.visible = showNext; this.ring.scale.set(this.nextRadius, 1, this.nextRadius); this.ring.position.x = this.nextCenter.x; this.ring.position.z = this.nextCenter.y;
    // storm damage
    const outside = (x, z) => Math.hypot(x - this.center.x, z - this.center.y) > this.radius;
    this.stormTick += dt;
    if (this.stormTick >= 1) {
      this.stormTick = 0;
      if (!p.gliding && outside(p.pos.x, p.pos.z) && !g.dead) g.hurt(Math.max(1, Math.round(this.dps * stats().stormMul)), null, { storm: true });
      for (const m of [...this.bots]) if (outside(m.pos.x, m.pos.z)) { m.hp -= this.dps * 1.5; if (m.hp <= 0) { g.killMob(m, false); this.feed(`${m.name} was lost to the storm`); } }
    }
    // off-screen skirmishes keep the match moving
    this.fightT -= dt;
    if (this.fightT <= 0 && this.bots.length > 1) {
      this.fightT = 22 + Math.random() * 14;
      const far = this.bots.filter((m) => Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z) > 40);
      if (far.length > 1) { const [a, b] = far.sort(() => Math.random() - 0.5); g.killMob(a, false); this.feed(`${b.name} eliminated ${a.name}`); }
    }
    this.hud();
  }

  hud() {
    const g = this.game, s = Math.max(0, Math.ceil(this.t));
    $$id('rAlive').textContent = `👥 ${this.bots.length + 1}`;
    $$id('rAmmo').textContent = `🔸 ${g.ammo}`;
    $$id('rMats').textContent = `🧱 ${g.mats}`;
    const out = Math.hypot(g.p.pos.x - this.center.x, g.p.pos.z - this.center.y) > this.radius;
    const txt = this.state === 'calm' ? `Storm forms ${s}s` : this.state === 'wait' ? `Closes in ${s}s` : this.state === 'shrink' ? 'SHRINKING' : 'FINAL ZONE';
    $$id('rStorm').textContent = `🌀 ${txt}${out ? ' ⚠' : ''}`;
    $$id('rStorm').style.borderColor = out ? '#ff5a6a' : '';
  }

  // ----- bots -----
  botAI(m, dt) {
    const g = this.game, p = g.p, b = m.bot, w = g.world;
    const dx = p.pos.x - m.pos.x, dz = p.pos.z - m.pos.z, dist = Math.hypot(dx, dz) || 1;
    b.cd -= dt; b.strafeT -= dt; b.wpT -= dt;
    if (b.strafeT <= 0) { b.strafeT = 1 + Math.random() * 1.5; b.strafe = Math.random() < 0.5 ? -1 : 1; }
    const eyeB = new THREE.Vector3(m.pos.x, m.pos.y + 1.6, m.pos.z), eyeP = g.eye();
    let vis = false;
    if (!g.dead && !p.gliding && dist < 46) {
      const dir = eyeP.clone().sub(eyeB), L = dir.length(); dir.normalize();
      const hit = w.raycast(eyeB, dir, L); vis = !hit || hit.dist > L - 0.7;
    }
    const cDist = Math.hypot(m.pos.x - this.center.x, m.pos.z - this.center.y);
    let mx = 0, mz = 0, sp = 3.4;
    if (cDist > this.radius - 3) { mx = this.center.x - m.pos.x; mz = this.center.y - m.pos.z; sp = 4.4; }
    else if (vis) {
      m.yaw = Math.atan2(dx, dz);
      const k = dist > 15 ? 1 : dist < 7 ? -1 : 0;
      mx = dx / dist * k - dz / dist * b.strafe * 0.8; mz = dz / dist * k + dx / dist * b.strafe * 0.8;
      if (b.cd <= 0) this.botShoot(m, dist, eyeB, eyeP);
    } else {
      if (!b.wp || b.wpT <= 0 || Math.hypot(b.wp.x - m.pos.x, b.wp.z - m.pos.z) < 2) { b.wpT = 6; const a = Math.random() * 6.283, d = Math.random() * Math.max(3, this.radius * 0.7); b.wp = { x: this.center.x + Math.cos(a) * d, z: this.center.y + Math.sin(a) * d }; }
      mx = b.wp.x - m.pos.x; mz = b.wp.z - m.pos.z; sp = 2.8;
    }
    const L = Math.hypot(mx, mz);
    if (L > 0.01) { mx /= L; mz /= L; if (!vis) m.yaw = Math.atan2(mx, mz); }
    const a = Math.min(1, 6 * dt);
    m.vel.x += (mx * sp - m.vel.x) * a; m.vel.z += (mz * sp - m.vel.z) * a;
    if (m.onGround && m.hitWall) m.vel.y = 8;
  }

  botShoot(m, dist, from, to) {
    const g = this.game, b = m.bot, wp = ITEMS[b.weapon];
    b.cd = wp.cd * 1.6 + 0.5 + Math.random() * 0.5;
    const hit = Math.random() < Math.min(0.5, Math.max(0.12, 0.55 - dist * 0.013));
    const aim = to.clone(); if (!hit) aim.add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3));
    g.tracer(from, aim, wp.color);
    if (hit) g.hurt(Math.max(1, Math.round(wp.dmg * RARITY_DMG[RARITIES.indexOf(b.rar)] * (b.weapon === 'scatter' ? 2 : 0.9) * stats().mobDamageMul)), m);
  }

  botDown(m, byPlayer) {
    this.bots = this.bots.filter((x) => x !== m);
    this.game.world.pins = this.game.world.pins.filter((x) => x !== m.pos);
    if (byPlayer) {
      this.kills++; questProgress('kill'); this.feed(`You eliminated ${m.name}!`);
      const x = Math.floor(m.pos.x), y = Math.floor(m.pos.y), z = Math.floor(m.pos.z);
      if (this.game.world.getBlock(x, y, z) === AIR) { this.game.world.setBlock(x, y, z, B.CHEST); this.addBeam(x, y, z, 0xff6b6b, 9); }
    }
    if (this.bots.length === 0 && !this.ended) this.end(true);
  }

  end(win) {
    if (this.ended) return; this.ended = true;
    const g = this.game, place = win ? 1 : this.bots.length + 1;
    const xp = 40 + this.kills * 15 + (win ? 100 : 0), coins = 20 + this.kills * 10 + (win ? 150 : 0);
    addXP(xp); addCoins(coins);
    g.dead = true; g.keys.clear(); g.mouse = [false, false, false]; g.touch.mine = false; document.exitPointerLock?.();
    setTimeout(() => g.hooks.onResults?.({ win, place, kills: this.kills, xp, coins, time: Math.round((performance.now() - this.startedAt) / 1000), daily: g.meta?.daily || 0 }), win ? 600 : 300);
  }

  dispose() {
    const g = this.game;
    for (const m of [this.storm, this.ring]) { g.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    for (const k of [...this.beams.keys()]) { const [x, y, z] = k.split(',').map(Number); this.beamOff(x, y, z); }
    if (g.world) g.world.pins = [];
  }
}

function $$id(id) { return document.getElementById(id); }
