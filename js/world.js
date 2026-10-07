// Chunked voxel world: terrain generation, editing and mesh building.
import * as THREE from 'three';
import { B, BLOCKS, TILE, AIR } from './blocks.js';
import { fbm, noise3, hash3, mulberry32 } from './util.js';

export const CH = 16;      // chunk width/depth
export const WH = 64;      // world height
export const SEA = 20;

const idx = (x, y, z) => x + z * CH + y * CH * CH;
const key = (cx, cz) => `${cx},${cz}`;

// face table: normal, 4 corners (CCW from outside), shade, face index into [top, side, bottom]
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.82, t: 1 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.82, t: 1 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, t: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, t: 2 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.66, t: 1 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.66, t: 1 },
];
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];

export class World {
  constructor({ seed, scene, atlas, edits = [] }) {
    this.seed = seed | 0;
    this.scene = scene;
    this.atlas = atlas;
    this.chunks = new Map();
    this.edits = new Map();
    for (let i = 0; i < edits.length; i += 4) this.edits.set(`${edits[i]},${edits[i + 1]},${edits[i + 2]}`, edits[i + 3]);
    this.opaqueMat = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5 });
    this.transMat = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false });
    this.renderDist = 4;
    this.pins = [];   // objects with x/z whose surrounding chunks must stay loaded (e.g. bots)
  }

  setLight(v) { this.opaqueMat.color.setScalar(v); this.transMat.color.setScalar(v); }

  serializeEdits() {
    const out = [];
    for (const [k, id] of this.edits) { const [x, y, z] = k.split(',').map(Number); out.push(x, y, z, id); }
    return out;
  }

  // ----- data access -----
  chunkAt(cx, cz, create = true) {
    const k = key(cx, cz);
    let c = this.chunks.get(k);
    if (!c && create) { c = this.generate(cx, cz); this.chunks.set(k, c); }
    return c;
  }

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= WH) return AIR;
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    const cx = x >> 4, cz = z >> 4;
    return this.chunkAt(cx, cz).data[idx(x - cx * CH, y, z - cz * CH)];
  }

  setBlock(x, y, z, id, record = true) {
    if (y < 0 || y >= WH) return;
    const cx = x >> 4, cz = z >> 4, lx = x - cx * CH, lz = z - cz * CH;
    const c = this.chunkAt(cx, cz);
    c.data[idx(lx, y, lz)] = id;
    if (record) this.edits.set(`${x},${y},${z}`, id);
    c.dirty = true;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CH - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CH - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx, cz) { const c = this.chunks.get(key(cx, cz)); if (c) c.dirty = true; }

  surfaceY(x, z) {
    for (let y = WH - 1; y > 0; y--) { const b = BLOCKS[this.getBlock(x, y, z)]; if (b.solid) return y + 1; }
    return SEA + 1;
  }

  // ----- terrain -----
  heightAt(wx, wz) {
    const s = this.seed;
    const base = fbm(wx / 70, wz / 70, s, 4);
    const mount = Math.pow(fbm(wx / 120 + 40, wz / 120 - 17, s + 9, 3), 2.2);
    return Math.floor(SEA - 2 + base * 16 + mount * 42);
  }

  generate(cx, cz) {
    const data = new Uint8Array(CH * CH * WH);
    const s = this.seed;
    const heights = new Int16Array(CH * CH);
    for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
      const wx = cx * CH + lx, wz = cz * CH + lz;
      const h = Math.min(WH - 8, this.heightAt(wx, wz));
      heights[lx + lz * CH] = h;
      const beach = h <= SEA + 1;
      const snowy = h > 44;
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let id;
        if (y === 0) id = B.BEDROCK;
        else if (y > h) id = B.WATER;
        else if (y === h) id = beach ? B.SAND : snowy ? B.SNOW : B.GRASS;
        else if (y > h - 4) id = beach ? B.SAND : B.DIRT;
        else {
          id = B.STONE;
          if (y < h - 3 && y > 2 && noise3(wx / 11, y / 7, wz / 11, s + 77) > 0.74) id = AIR; // caves
          else {
            const r = hash3(wx, y, wz, s + 5);
            if (r < 0.0014 && y < 16) id = B.CRYSTAL_ORE;
            else if (r < 0.0035 && y < 24) id = B.GOLD_ORE;
            else if (r < 0.0095 && y < 38) id = B.IRON_ORE;
            else if (r < 0.022) id = B.COAL_ORE;
          }
        }
        data[idx(lx, y, lz)] = id;
      }
    }
    // trees (kept inside the chunk so generation stays chunk-local)
    const rnd = mulberry32((cx * 73856093) ^ (cz * 19349663) ^ s);
    const n = Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const lx = 3 + Math.floor(rnd() * 10), lz = 3 + Math.floor(rnd() * 10);
      const h = heights[lx + lz * CH];
      if (data[idx(lx, h, lz)] !== B.GRASS) continue;
      const th = 4 + Math.floor(rnd() * 2);
      for (let y = 1; y <= th; y++) data[idx(lx, h + y, lz)] = B.LOG;
      for (let dy = th - 2; dy <= th + 1; dy++) {
        const r = dy > th - 1 ? 1 : 2;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && rnd() < 0.5) continue;
          const yy = h + dy; if (yy >= WH) continue;
          const o = idx(lx + dx, yy, lz + dz);
          if (data[o] === AIR) data[o] = B.LEAVES;
        }
      }
    }
    // player edits that fall in this chunk
    for (const [k, id] of this.edits) {
      const [x, y, z] = k.split(',').map(Number);
      if ((x >> 4) === cx && (z >> 4) === cz) data[idx(x - cx * CH, y, z - cz * CH)] = id;
    }
    return { cx, cz, data, dirty: true, opaque: null, trans: null };
  }

  // ----- streaming -----
  update(px, pz, budget = 2) {
    const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH), R = this.renderDist;
    const want = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
      want.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
    }
    want.sort((a, b) => a[2] - b[2]);
    let built = 0;
    for (const [cx, cz] of want) {
      const c = this.chunkAt(cx, cz);
      if (c.dirty && built < budget) { this.buildMesh(c); built++; }
    }
    for (const [k, c] of this.chunks) {
      if ((Math.abs(c.cx - pcx) > R + 2 || Math.abs(c.cz - pcz) > R + 2) && !this.pinned(c)) { this.disposeChunk(c); this.chunks.delete(k); }
    }
    return built;
  }

  /** Build every chunk around a point immediately (used for spawn & menu backdrop). */
  prime(px, pz) {
    const old = this.renderDist; this.update(px, pz, 9999); this.renderDist = old;
  }

  pinned(c) { return this.pins.some((p) => Math.abs((p.x >> 4) - c.cx) <= 1 && Math.abs((p.z >> 4) - c.cz) <= 1); }

  disposeChunk(c) {
    for (const m of [c.opaque, c.trans]) if (m) { this.scene.remove(m); m.geometry.dispose(); }
  }

  buildMesh(c) {
    c.dirty = false;
    this.disposeChunk(c); c.opaque = c.trans = null;
    const O = { p: [], uv: [], col: [], i: [] }, T = { p: [], uv: [], col: [], i: [] };
    const ox = c.cx * CH, oz = c.cz * CH;
    const atlas = this.atlas, ts = TILE / (atlas.cols * TILE), tv = TILE / (atlas.rows * TILE);
    for (let y = 0; y < WH; y++) for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
      const id = c.data[idx(lx, y, lz)];
      if (id === AIR) continue;
      const b = BLOCKS[id];
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        const nx = lx + F.n[0], ny = y + F.n[1], nz = lz + F.n[2];
        let nid;
        if (ny < 0) nid = B.BEDROCK; else if (ny >= WH) nid = AIR;
        else if (nx >= 0 && nx < CH && nz >= 0 && nz < CH) nid = c.data[idx(nx, ny, nz)];
        else nid = this.getBlock(ox + nx, ny, oz + nz);
        if (nid === id) continue;
        const nb = BLOCKS[nid];
        if (nb.opaque) continue;
        if (b.liquid && f !== 2 && nb.solid) continue;
        const M = b.liquid || b.glass ? T : O;
        const base = M.p.length / 3;
        const tile = b.faces[F.t];
        const u0 = (tile % atlas.cols) * ts, v0 = 1 - (Math.floor(tile / atlas.cols) + 1) * tv;
        const e = 0.0005;
        const yOff = b.liquid && f === 2 ? -0.12 : 0;
        for (let k = 0; k < 4; k++) {
          const cc = F.c[k];
          M.p.push(ox + lx + cc[0], y + cc[1] + (cc[1] ? yOff : 0), oz + lz + cc[2]);
          M.uv.push(u0 + (UVS[k][0] ? ts - e : e), v0 + (UVS[k][1] ? tv - e : e));
          const sh = F.s * (0.92 + 0.08 * hash3(ox + lx, y, oz + lz, 3));
          M.col.push(sh, sh, sh);
        }
        M.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const make = (M, mat) => {
      if (!M.i.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(M.p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(M.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(M.col, 3));
      g.setIndex(M.i);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.matrixAutoUpdate = false;
      this.scene.add(m);
      return m;
    };
    c.opaque = make(O, this.opaqueMat);
    c.trans = make(T, this.transMat);
    if (c.trans) c.trans.renderOrder = 1;
  }

  /** Voxel DDA raycast. Returns {x,y,z,id,nx,ny,nz,dist} or null. */
  raycast(origin, dir, maxDist = 6) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x) || 1, stepY = Math.sign(dir.y) || 1, stepZ = Math.sign(dir.z) || 1;
    const inv = (d) => (d === 0 ? Infinity : Math.abs(1 / d));
    const dX = inv(dir.x), dY = inv(dir.y), dZ = inv(dir.z);
    let tX = dir.x === 0 ? Infinity : ((stepX > 0 ? x + 1 - origin.x : origin.x - x)) * dX;
    let tY = dir.y === 0 ? Infinity : ((stepY > 0 ? y + 1 - origin.y : origin.y - y)) * dY;
    let tZ = dir.z === 0 ? Infinity : ((stepZ > 0 ? z + 1 - origin.z : origin.z - z)) * dZ;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      if (id !== AIR && !BLOCKS[id].liquid) return { x, y, z, id, nx, ny, nz, dist: t };
      if (tX < tY && tX < tZ) { x += stepX; t = tX; tX += dX; nx = -stepX; ny = 0; nz = 0; }
      else if (tY < tZ) { y += stepY; t = tY; tY += dY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tZ; tZ += dZ; nx = 0; ny = 0; nz = -stepZ; }
    }
    return null;
  }

  dispose() { for (const c of this.chunks.values()) this.disposeChunk(c); this.chunks.clear(); }
}
