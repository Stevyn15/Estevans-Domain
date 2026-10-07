// All menu screens and overlays. Plain DOM + event delegation: every clickable element carries
// data-act="name" (and optional data-arg), handled in `acts` below.
import * as THREE from 'three';
import { $, $$, store, usd, toast, hashStr } from './util.js';
import { BLOCKS, blockIcon } from './blocks.js';
import { SKINS, RARITY, skinById, paintSkin, skinTexture, buildHumanoid, animateHumanoid, disposeObject } from './skins.js';
import { PERKS, PRODUCTS, BP, TIERS, QUESTS } from './catalog.js';
import { LEGENDS, legendById } from './legends.js';
import { slotHtml, slotName } from './items.js';
import { RECIPES } from './game.js';
import { buy, setConfirmUI, restorePurchases } from './payments.js';
import {
  profile, save, resetProfile, hasPerk, xpBoostActive, tierOf, tierProgress, ownsSkin, equipSkin,
  buySkinWithCoins, canClaim, claim, claimAll, unclaimedCount, questState, onProfileChange,
} from './profile.js';
import { logoTap } from './easter.js';
import { APP } from './config.js';
import { openLink, shareFile, onNativeEvent } from './native.js';
import { recordConsent, setAnalyticsConsent, exportData, deleteAllData, needsConsent } from './privacy.js';
import { dailyMeta, dailyNumber, recordDaily, shareResult, claimStreak, myRefCode, redeemRefCode, shareInvite, referralsAllowed, parseDeepLink, startClip, stopClip, isRecording, shareClip } from './viral.js';
import { track } from './analytics.js';

const root = () => $('#ui');
const WORLDS_KEY = 'pixelrealms.worlds';
const SAVE_PREFIX = 'pixelrealms.world.';
const MODE_LABEL = { survival: 'Survival', creative: 'Creative', royale: 'Storm Royale' };

let pendingRef = null, game, cur = 'title', shopTab = 'featured', invSel = null, preview = null, newMode = 'survival';

// ------------------------------------------------------------------ helpers
const worlds = () => store.get(WORLDS_KEY, []);
const saveWorlds = (w) => store.set(WORLDS_KEY, w);
const faceCache = new Map();
function skinFace(id) {
  if (faceCache.has(id)) return faceCache.get(id);
  const src = paintSkin(skinById(id).spec, id), c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 8, 8, 8, 8, 0, 0, 32, 32);
  const u = c.toDataURL(); faceCache.set(id, u); return u;
}
const price = (usdCents) => usd(usdCents);
const topbar = (title, withBack = true) => `
  <div class="topbar">
    ${withBack ? '<button class="btn small" data-act="back">◀ BACK</button>' : ''}
    <h2>${title}</h2>
    <div class="chip">🪙 ${profile.coins.toLocaleString()} <button class="plus" data-act="tab" data-arg="coins">+</button></div>
    <button class="iconbtn" data-act="tab" data-arg="boosts" title="Boosts" style="pointer-events:auto">⚡</button>
  </div>`;

function mount(name, html, cls = '') {
  cur = name;
  stopPreview();
  root().innerHTML = html ? `<div class="screen ${cls}" data-screen="${name}">${html}</div>` : '';
}
const modal = (html) => { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="sheet">${html}</div>`; root().appendChild(m); return m; };
const closeModal = () => $$('.modal', root()).forEach((m) => m.remove());

// ------------------------------------------------------------------ screens
const screens = {
  agegate() {
    return [`<div style="margin:auto;width:min(400px,92vw);text-align:center"><h1 class="logo" style="font-size:24px">PIXEL<br><b>REALMS</b></h1>
      <div class="panel"><p style="font-size:10px">What year were you born?</p>
      <input type="text" id="birthYear" inputmode="numeric" maxlength="4" placeholder="YYYY" style="text-align:center;font-size:16px">
      <p style="font-size:8px;color:var(--dim)">Used only to pick age-appropriate settings (e.g. purchases, sharing and invites are off for players under 13). We do not store your birth year.</p>
      <label class="check"><input type="checkbox" id="agreeTos"> <span>I agree to the <a href="#" data-act="link" data-arg="${APP.termsUrl}">Terms</a> and <a href="#" data-act="link" data-arg="${APP.privacyUrl}">Privacy Policy</a></span></label>
      <label class="check"><input type="checkbox" id="optAnalytics"> <span>Optional: share anonymous usage stats to help improve the game (never for under 13s)</span></label>
      <button class="btn green" data-act="ageOk" style="margin-top:12px">CONTINUE</button></div></div>`, 'title'];
  },
  title() {
    const ub = unclaimedCount();
    return [`
      <h1 class="logo" id="logo">PIXEL<br><b>REALMS</b></h1>
      <div class="tagline">BUILD · SURVIVE · LAST ONE STANDING</div>
      <div class="menu">
        <button class="btn green" data-act="go" data-arg="worlds">▶ PLAY</button>
        <button class="btn" style="background:#8b5cf6;box-shadow:inset -3px -3px 0 #5b34b0" data-act="daily">🔥 DAILY CHALLENGE #${dailyNumber()}${profile.daily.n === dailyNumber() && profile.daily.best ? `<span class="badge" style="background:#2e7d4f">BEST #${profile.daily.best.place}</span>` : ''}</button>
        <button class="btn" data-act="go" data-arg="skins">SKINS &amp; LEGENDS</button>
        <button class="btn gold" data-act="go" data-arg="pass">BATTLE PASS${ub ? `<span class="badge">${ub}</span>` : ''}</button>
        <button class="btn" data-act="go" data-arg="shop">SHOP</button>
        <button class="btn" data-act="go" data-arg="settings">SETTINGS</button>
      </div>
      <div class="tagline" style="margin-top:22px">🔥 ${profile.streak.count}-day streak · 🪙 ${profile.coins.toLocaleString()}</div>`, 'title'];
  },

  worlds() {
    const list = worlds().sort((a, b) => b.last - a.last);
    return [`${topbar('SELECT WORLD')}
      <button class="btn green" data-act="newWorld" style="margin-bottom:12px">+ NEW WORLD</button>
      ${list.length ? list.map((w) => `
        <div class="world"><div class="info">${esc(w.name)}<span class="modebadge ${w.mode}">${MODE_LABEL[w.mode]}</span>
          <small>Seed ${esc(String(w.seedText || w.seed))} · ${new Date(w.last).toLocaleDateString()}</small></div>
          <button class="btn small green" data-act="play" data-arg="${w.id}">PLAY</button>
          <button class="btn small red" data-act="delWorld" data-arg="${w.id}">✕</button></div>`).join('')
        : '<div class="panel" style="text-align:center;color:var(--dim)">No worlds yet.<br><br>Create one to start!</div>'}`, ''];
  },

  shop() {
    const tabs = [['featured', 'FEATURED'], ['skins', 'SKINS'], ['boosts', 'BOOSTS'], ['coins', 'COINS']];
    let body = '';
    if (shopTab === 'featured') {
      body = `
        <div class="hero"><div style="flex:1;min-width:200px"><h3>${BP.name}</h3>
          <p>✔ 30 tiers of rewards</p><p>✔ Instant skin: <b>Neon Runner</b></p><p>✔ Exclusive legendary <b>Cosmic Emperor</b></p><p>✔ Bonus XP boosts &amp; coins</p></div>
          <div style="text-align:center">${profile.premium ? '<span class="tag">OWNED</span>' : `<button class="btn gold small" data-act="buy" data-arg="bp_premium">GET PASS<br>${price(BP.priceUsd)}</button>`}</div></div>
        ${row('🎁', 'Starter Bundle', 'Quick Hands + Feather Boots + Heart Container + 500 coins', 'bundle_starter', false)}
        ${row('⚡', '2× Pass XP — 7 days', 'Level the battle pass twice as fast.', 'xp_boost', false, xpBoostActive() ? 'ACTIVE' : '')}`;
    } else if (shopTab === 'skins') {
      body = `<div class="grid">${SKINS.filter((s) => !s.how.free && !s.how.bp && !s.how.secret).map(skinCard).join('')}</div>
        <p style="color:var(--dim);font-size:8px;margin-top:12px">Battle pass skins are earned on the pass track.</p>`;
    } else if (shopTab === 'boosts') {
      body = `<p style="color:var(--dim);font-size:8px;margin:0 0 10px">Small permanent upgrades. Each one applies in every world and mode.</p>
        ${Object.entries(PERKS).map(([id, p]) => row(p.icon, p.name, p.desc, `perk_${id}`, hasPerk(id))).join('')}`;
    } else {
      body = `<div class="grid">${['coins_s', 'coins_m', 'coins_l'].map((id) => `
        <div class="card"><div style="font-size:30px">🪙</div><div class="name">${PRODUCTS[id].name}</div>
        <button class="btn small gold" data-act="buy" data-arg="${id}">${price(PRODUCTS[id].usd)}</button></div>`).join('')}</div>`;
    }
    const kid = profile.ageGroup === 'child';
    return [`${topbar('SHOP')}${kid ? '<div class="testnote">Purchases are turned off for this profile (under 13). Everything can still be earned by playing!</div>' : ''}<div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${shopTab === k ? 'on' : ''}" data-act="tab" data-arg="${k}">${l}</button>`).join('')}</div>${body}<div style="margin-top:14px"><button class="btn small" data-act="restore">RESTORE PURCHASES</button></div>`, ''];
  },

  pass() {
    const tier = tierOf(), prog = tierProgress(), qs = questState();
    const cell = (t, track) => {
      const r = t[track]; const can = canClaim(track, t.tier); const done = profile.claimed[track].includes(t.tier);
      const locked = track === 'premium' && !profile.premium;
      const icon = r.skin ? `<img class="skinmini" src="${skinFace(r.skin)}">` : r.coins ? '<div class="big">🪙</div>' : '<div class="big">⚡</div>';
      const label = r.skin ? skinById(r.skin).name : r.coins ? `${r.coins} coins` : `2× XP ${r.xpBoostHours}h`;
      return `<div class="rw ${track === 'premium' ? 'prem' : ''} ${locked ? 'locked' : ''} ${done ? 'claimed' : ''}">
        ${locked ? '<span class="lock">🔒</span>' : ''}${icon}<div>${label}</div>
        ${can ? `<button class="btn small green" data-act="claim" data-arg="${track}:${t.tier}">CLAIM</button>` : done ? '<div>✔</div>' : ''}</div>`;
    };
    return [`${topbar('BATTLE PASS')}
      <div class="passhead panel">
        <div style="flex:1;min-width:180px"><div style="color:var(--gold);font-size:12px">${BP.name}</div>
          <div style="margin:8px 0">TIER ${tier}/${BP.tiers} ${xpBoostActive() ? '<span class="tag">2× XP</span>' : ''}</div>
          <div class="bar" style="width:100%"><i style="width:${tier >= BP.tiers ? 100 : prog * 100}%"></i></div></div>
        <div style="display:grid;gap:8px">
          ${profile.premium ? '<span class="tag">PREMIUM ACTIVE</span>' : `<button class="btn gold small" data-act="buy" data-arg="bp_premium">UNLOCK PREMIUM ${price(BP.priceUsd)}</button>`}
          ${tier < BP.tiers ? `<button class="btn small" data-act="buy" data-arg="bp_tiers">+${BP.skipTiersCount} TIERS ${price(BP.skipTiersUsd)}</button>` : ''}
          ${unclaimedCount() ? '<button class="btn small green" data-act="claimAll">CLAIM ALL</button>' : ''}
        </div></div>
      <div class="panel" style="margin:12px 0"><div style="margin-bottom:8px">DAILY QUESTS</div>
        ${QUESTS.map((q) => { const v = Math.min(q.goal, qs.prog[q.id] || 0); return `<div class="row"><div class="txt">${q.name}<small>+${q.xp} XP · +${q.coins} 🪙</small></div><div style="width:90px"><div class="bar"><i style="width:${v / q.goal * 100}%"></i></div></div><div>${qs.done[q.id] ? '✔' : `${v}/${q.goal}`}</div></div>`; }).join('')}</div>
      <div style="display:flex;gap:8px;font-size:8px;margin-bottom:6px"><span class="tag" style="background:#9b7bff">PREMIUM (top)</span><span class="tag" style="background:#9aa4b2">FREE (bottom)</span></div>
      <div class="track" id="track"><div class="track-inner">${TIERS.map((t) => `<div class="tcol"><div class="tnum ${t.tier <= tier ? 'reached' : ''}">${t.tier}</div>${cell(t, 'premium')}${cell(t, 'free')}</div>`).join('')}</div></div>`, ''];
  },

  skins() {
    const owned = (s) => ownsSkin(s.id);
    const eq = skinById(profile.equipped);
    return [`${topbar('SKINS & LEGENDS')}
      <div class="split"><div><canvas class="preview" id="previewCanvas" width="240" height="320"></canvas>
        <div style="text-align:center;margin-top:8px"><div>${eq.name}</div><div style="color:${RARITY[eq.rarity]};font-size:8px">${eq.rarity.toUpperCase()}</div></div></div>
      <div><div class="grid">${SKINS.map((s) => `
        <div class="card ${owned(s) ? 'owned' : ''} ${profile.equipped === s.id ? 'eq' : ''}" data-act="${owned(s) ? 'equip' : 'tab'}" data-arg="${owned(s) ? s.id : 'skins'}">
          <img class="skinmini" src="${skinFace(s.id)}"><div class="name">${s.name}</div>
          <div class="rar" style="background:${RARITY[s.rarity]}"></div>
          <div class="sub">${owned(s) ? (profile.equipped === s.id ? 'EQUIPPED' : 'OWNED') : s.how.bp ? `PASS T${s.how.bp.tier}${s.how.bp.track === 'premium' ? ' ★' : ''}` : s.how.coins ? `🪙 ${s.how.coins}` : s.how.secret ? '???' : price(s.how.usd)}</div>
          ${!owned(s) && s.how.coins ? `<button class="btn small gold" data-act="buySkin" data-arg="${s.id}">BUY</button>` : ''}
          ${!owned(s) && s.how.usd ? `<button class="btn small gold" data-act="buy" data-arg="skin_${s.id}">BUY</button>` : ''}
        </div>`).join('')}</div>
      <h3 style="margin:18px 0 8px;font-size:11px">LEGEND (Storm Royale ability)</h3>
      ${LEGENDS.map((l) => `<div class="row" data-act="legend" data-arg="${l.id}" style="${profile.legend === l.id ? 'border-color:var(--gold)' : ''}"><div class="ico">${l.icon}</div><div class="txt">${l.name} — ${l.ability}<small>${l.desc} (${l.cd}s)</small></div>${profile.legend === l.id ? '<span class="tag">PICKED</span>' : ''}</div>`).join('')}
      </div></div>`, ''];
  },

  settings() {
    const s = profile.settings;
    return [`${topbar('SETTINGS')}<div class="panel">
      <label class="f">RENDER DISTANCE: <span id="v-renderDist">${s.renderDist}</span> chunks</label><input type="range" min="2" max="8" step="1" value="${s.renderDist}" data-set="renderDist">
      <label class="f">LOOK SENSITIVITY: <span id="v-sens">${s.sens}</span></label><input type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}" data-set="sens">
      <label class="f">FIELD OF VIEW: <span id="v-fov">${s.fov}</span></label><input type="range" min="60" max="110" step="1" value="${s.fov}" data-set="fov">
      <label class="f">TOUCH CONTROLS</label><div class="seg">${['auto', 'on', 'off'].map((m) => `<button class="${s.touch === m ? 'on' : ''}" data-act="touchMode" data-arg="${m}">${m.toUpperCase()}</button>`).join('')}</div>
      <h3 style="font-size:10px;margin:16px 0 6px">LOOT ODDS (loot chests are never sold)</h3>
      <div style="font-size:8px;line-height:1.9;color:var(--dim)">Rarity per roll — Common 50% · Uncommon 28% · Rare 14% · Epic 6% · Legendary 2%.<br>
      With Scavenger Lens boost — Common 34% · Uncommon 28% · Rare 20% · Epic 12% · Legendary 6%.<br>
      Supply drops always roll Epic or better. Weapon type — Blaster 34% · Pulse Rifle 26% · Scatter Gun 22% · Longshot 18%.<br>
      Rare golden chest: 1 in 60.</div>
      <button class="btn small" data-act="go" data-arg="privacy" style="margin-top:12px">PRIVACY &amp; DATA</button>
      ${referralsAllowed() ? `<h3 style="font-size:10px;margin:16px 0 6px">INVITE FRIENDS</h3>
        <div class="row"><div class="txt">Your code: <b style="color:var(--gold);font-size:14px">${myRefCode()}</b><small>Share it — friends can enter it for a bonus.</small></div><button class="btn small green" data-act="invite">SHARE</button></div>
        <div style="display:flex;gap:6px"><input type="text" id="refInput" maxlength="6" placeholder="FRIEND'S CODE" value="${pendingRef || ''}" style="text-transform:uppercase"><button class="btn small gold" data-act="redeem">REDEEM</button></div>` : ''}
      <div class="testnote">TEST MODE: purchases are simulated — no real money is charged. See README to connect a real payment provider.</div>
      <button class="btn red small" data-act="resetProfile">RESET ALL PROGRESS</button></div>
      <div class="panel" style="margin-top:12px;font-size:8px;color:var(--dim)">PC: WASD move · Space jump (double-tap to fly in creative) · Shift sprint · LMB mine/attack/fire · RMB place/use · 1-9 / wheel hotbar · E inventory · Q ability · Z/X/C build wall/ramp/floor (Royale) · G ping · V camera · H emote<br>Touch: left stick move · drag right side to look · buttons on the right.</div>`, ''];
  },

  privacy() {
    const child = profile.ageGroup === 'child', an = !!profile.consent?.analytics;
    return [`${topbar('PRIVACY & DATA')}<div class="panel" style="font-size:9px;line-height:1.8">
      <b>Your data stays on this device.</b> This version has no accounts, no ads and no tracking. It stores your game progress, purchases receipts, settings and age group (not your birth year) in local storage.<br><br>
      <b>Age group:</b> ${profile.ageGroup || '—'} ${child ? '· under-13 protections ON: purchases, invites, clips-sharing and analytics are off.' : ''}<br>
      <b>Policy accepted:</b> ${profile.consent ? `v${profile.consent.version} on ${new Date(profile.consent.ts).toLocaleDateString()}` : 'not yet'}</div>
      <div class="row" style="margin-top:10px"><div class="txt">Anonymous usage stats<small>${child ? 'Always off for players under 13.' : 'Counts of sessions and feature use. No names, no device IDs.'}</small></div>
        <button class="btn small ${an ? 'green' : ''}" ${child ? 'disabled' : ''} data-act="analytics">${an ? 'ON' : 'OFF'}</button></div>
      <div class="grid" style="margin-top:10px;grid-template-columns:1fr 1fr">
        <button class="btn small" data-act="link" data-arg="${APP.privacyUrl}">PRIVACY POLICY</button>
        <button class="btn small" data-act="link" data-arg="${APP.termsUrl}">TERMS</button>
        <button class="btn small" data-act="exportData">EXPORT MY DATA</button>
        <button class="btn small red" data-act="deleteAsk">DELETE ALL MY DATA</button></div>
      <p style="font-size:8px;color:var(--dim)">Questions or requests: ${APP.supportEmail}</p>`, ''];
  },

  pause() {
    const m = game.gameMode;
    return [`<div style="margin:auto;width:min(340px,92vw)"><h2 style="text-align:center">PAUSED</h2><div class="menu" style="width:100%">
      <button class="btn green" data-act="resume">RESUME</button>
      <button class="btn gold" data-act="go" data-arg="pass">BATTLE PASS${unclaimedCount() ? `<span class="badge">${unclaimedCount()}</span>` : ''}</button>
      <button class="btn" data-act="go" data-arg="skins">SKINS &amp; LEGENDS</button>
      <button class="btn" data-act="go" data-arg="shop">SHOP</button>
      <button class="btn" data-act="go" data-arg="settings">SETTINGS</button>
      <button class="btn red" data-act="quit">SAVE &amp; QUIT</button></div>
      <p style="text-align:center;color:var(--dim);font-size:8px">${MODE_LABEL[m]}</p></div>`, 'dim'];
  },
};

function row(icon, name, desc, productId, owned, label = '') {
  const p = PRODUCTS[productId];
  return `<div class="row"><div class="ico">${icon}</div><div class="txt">${name}<small>${desc}</small></div>
    ${owned || label ? `<span class="tag">${label || 'OWNED'}</span>` : `<button class="btn small gold" data-act="buy" data-arg="${productId}">${price(p.usd)}</button>`}</div>`;
}
function skinCard(s) {
  const owned = ownsSkin(s.id);
  return `<div class="card ${owned ? 'owned' : ''}"><img class="skinmini" src="${skinFace(s.id)}"><div class="name">${s.name}</div>
    <div class="rar" style="background:${RARITY[s.rarity]}"></div>
    ${owned ? '<span class="tag">OWNED</span>' : s.how.coins ? `<button class="btn small gold" data-act="buySkin" data-arg="${s.id}">🪙 ${s.how.coins}</button>` : `<button class="btn small gold" data-act="buy" data-arg="skin_${s.id}">${price(s.how.usd)}</button>`}</div>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function show(name) {
  const [html, cls] = screens[name]();
  mount(name, html, cls);
  if (name === 'skins') startPreview();
  if (name === 'title') $('#logo')?.addEventListener('click', (e) => { logoTap(e.currentTarget); });
}
const refresh = () => { if ($('.modal', root())) return; const sc = $('.screen', root()); const keep = sc?.scrollTop; const tr = $('#track')?.scrollLeft; show(cur); const n = $('.screen', root()); if (n && keep) n.scrollTop = keep; if ($('#track') && tr) $('#track').scrollLeft = tr; };

// ------------------------------------------------------------------ skin preview
function startPreview() {
  const cv = $('#previewCanvas'); if (!cv) return;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true });
  r.setSize(240, 320, false);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 240 / 320, 0.1, 50);
  cam.position.set(0, 1.1, 4.6); cam.lookAt(0, 0.95, 0);
  let id = null, model = null, raf = 0, t0 = performance.now();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (id !== profile.equipped) {
      if (model) { sc.remove(model); disposeObject(model); }
      const s = skinById(profile.equipped); model = buildHumanoid(skinTexture(s), s.hat); sc.add(model); id = profile.equipped;
    }
    const t = (performance.now() - t0) / 1000;
    model.rotation.y = t * 0.9; animateHumanoid(model, 0.25, t);
    r.render(sc, cam);
  };
  loop();
  preview = { stop() { cancelAnimationFrame(raf); if (model) disposeObject(model); r.dispose(); } };
}
function stopPreview() { preview?.stop(); preview = null; }

// ------------------------------------------------------------------ overlays
export function openPurchaseSheet({ title, price: pr, test }) {
  return new Promise((resolve) => {
    const m = modal(`<h3>Confirm purchase</h3><div style="font-size:12px;margin:10px 0">${esc(title)}</div><div class="price" style="font-size:16px">${pr}</div>
      ${profile.ageGroup === 'teen' ? '<p>Under 18? Get a parent or guardian\'s permission before buying.</p>' : ''}${test ? '<div class="testnote">TEST MODE — nothing is charged. This sheet is where a real store checkout (Stripe / App Store / Google Play) would appear.</div>' : ''}
      <div class="btns"><button class="btn green" id="pOk">CONFIRM</button><button class="btn" id="pNo">CANCEL</button></div>`);
    $('#pOk', m).onclick = () => { m.remove(); resolve(true); };
    $('#pNo', m).onclick = () => { m.remove(); resolve(false); };
  });
}

export function toggleInventory() {
  if ($('[data-screen="inventory"]', root())) return closeInventory();
  game.uiOpen = true; game.paused = true; document.exitPointerLock?.();
  invSel = null; renderInventory();
}
function closeInventory() {
  mount('none', ''); game.uiOpen = false; game.paused = false; invSel = null;
  if (!game.isTouch) game.canvas.requestPointerLock?.();
}
function renderInventory() {
  const creative = game.gameMode === 'creative';
  const slots = game.inv.map((s, i) => `<div class="slot ${invSel === i ? 'sel' : ''}" data-act="invSlot" data-arg="${i}" title="${esc(slotName(s))}">${slotHtml(s)}</div>`).join('');
  const palette = BLOCKS.filter((b) => b.placeable).map((b) => `<div class="slot" data-act="palette" data-arg="${b.id}" title="${b.name}"><img src="${blockIcon(b.id)}"></div>`).join('');
  const recipes = RECIPES.map((r, i) => `<div class="recipe"><span>${r.in.map(([id, n]) => `${n}× ${BLOCKS[id].name}`).join(' + ')} → <b>${r.out[1]}× ${BLOCKS[r.out[0]].name}</b></span>
    <button class="btn small ${game.canCraft(r) ? 'green' : ''}" ${game.canCraft(r) ? '' : 'disabled'} data-act="craft" data-arg="${i}">CRAFT</button></div>`).join('');
  mount('inventory', `<div style="margin:auto;width:min(540px,100%)"><div class="topbar"><h2>INVENTORY</h2><button class="btn small" data-act="closeInv">✕ CLOSE</button></div>
    <p style="font-size:8px;color:var(--dim)">Tap a slot, then another to swap. Top row = hotbar.</p>
    <div class="slots">${slots}</div>
    <h3 style="font-size:11px;margin:16px 0 8px">${creative ? 'ALL BLOCKS — tap to put in selected hotbar slot' : 'CRAFTING'}</h3>
    ${creative ? `<div class="palette">${palette}</div>` : recipes}</div>`, 'dim');
}

// ------------------------------------------------------------------ actions
const acts = {
  go: (a) => show(a),
  back: () => show(game.mode === 'play' ? 'pause' : 'title'),
  tab: (a) => { shopTab = a; show('shop'); },
  buy: async (id) => { if (await buy(id)) refresh(); },
  buySkin: (id) => { if (buySkinWithCoins(id)) refresh(); else toast('Not enough coins', ''); },
  equip: (id) => { equipSkin(id); refresh(); },
  legend: (id) => { profile.legend = id; save(true); refresh(); },
  claim: (a) => { const [tr, t] = a.split(':'); if (claim(tr, +t)) refresh(); },
  claimAll: () => { claimAll(); refresh(); },
  touchMode: (m) => { profile.settings.touch = m; save(true); refresh(); },
  resetProfile: () => { if (confirm('Erase coins, skins, pass progress and settings?')) { resetProfile(); show('settings'); } },
  link: (u) => openLink(u),
  daily: () => startGame(dailyMeta()),
  invite: () => shareInvite(),
  redeem: () => { const r = redeemRefCode($('#refInput').value); toast(r.msg, r.ok ? 'gold' : ''); if (r.ok) { pendingRef = null; refresh(); } },
  analytics: () => { setAnalyticsConsent(!profile.consent?.analytics); refresh(); },
  exportData: async () => { const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' }); const r = await shareFile(blob, 'pixel-realms-data.json', 'My Pixel Realms data'); if (r) toast('Data export ready', 'gold'); },
  deleteAsk: () => modal(`<h3 style="color:var(--red)">Delete everything?</h3><p>This permanently erases your progress, skins, purchases record and settings from this device. Purchases made with real money can be restored from the store afterwards.</p>
    <div class="btns"><button class="btn red" data-act="deleteGo">DELETE</button><button class="btn" data-act="closeModal">CANCEL</button></div>`),
  deleteGo: () => { deleteAllData(); closeModal(); toast('All data deleted', 'gold'); location.reload(); },
  clipShare: () => { const b = window.__clip; closeModal(); if (b) shareClip(b); },
  shareRes: () => { if (window.__lastRes) shareResult(window.__lastRes); },
  ageOk: () => {
    if (!$('#agreeTos').checked) return toast('Please accept the Terms and Privacy Policy to continue', '');
    const y = parseInt($('#birthYear').value, 10), now = new Date().getFullYear();
    if (!y || y < 1900 || y > now) return toast('Enter a valid birth year', '');
    const age = now - y; profile.ageGroup = age < 13 ? 'child' : age < 18 ? 'teen' : 'adult'; recordConsent({ analytics: $('#optAnalytics').checked }); track('age_gate_done'); show('title'); bootStreak();
  },
  restore: () => restorePurchases(),
  newWorld: () => newWorldModal(),
  pickMode: (m) => { newMode = m; $$('.seg button', root()).forEach((b) => b.classList.toggle('on', b.dataset.arg === m)); },
  createWorld: () => {
    const name = $('#wName').value.trim() || `World ${worlds().length + 1}`;
    const seedText = $('#wSeed').value.trim();
    const seed = seedText ? (/^-?\d+$/.test(seedText) ? parseInt(seedText, 10) : hashStr(seedText)) : (Math.random() * 2 ** 31) | 0;
    const meta = { id: `w${Date.now().toString(36)}`, name, seed, seedText, mode: newMode, created: Date.now(), last: Date.now() };
    saveWorlds([...worlds(), meta]); closeModal(); startGame(meta);
  },
  delWorld: (id) => { if (confirm('Delete this world?')) { saveWorlds(worlds().filter((w) => w.id !== id)); store.del(SAVE_PREFIX + id); refresh(); } },
  play: (id) => { const m = worlds().find((w) => w.id === id); if (m) { m.last = Date.now(); saveWorlds(worlds()); startGame(m); } },
  resume: () => { mount('none', ''); game.setPaused(false); if (!game.isTouch) game.canvas.requestPointerLock?.(); },
  quit: () => { game.exitWorld(); show('title'); },
  invSlot: (i) => { i = +i; if (invSel == null) invSel = i; else { if (invSel !== i) game.swapSlots(invSel, i); invSel = null; } renderInventory(); },
  palette: (id) => { game.setSlot(game.selected, +id); renderInventory(); },
  craft: (i) => { game.craft(RECIPES[+i]); renderInventory(); },
  closeInv: () => closeInventory(),
  respawn: () => { closeModal(); game.respawn(); if (!game.isTouch) game.canvas.requestPointerLock?.(); },
  results: () => { closeModal(); game.exitWorld(); show('title'); },
};

function newWorldModal() {
  newMode = 'survival';
  const m = modal(`<h3>NEW WORLD</h3>
    <label class="f" style="text-align:left">NAME</label><input type="text" id="wName" maxlength="24" placeholder="My World">
    <label class="f" style="text-align:left">SEED (optional)</label><input type="text" id="wSeed" maxlength="24" placeholder="random">
    <label class="f" style="text-align:left">MODE</label>
    <div class="seg">${Object.entries(MODE_LABEL).map(([k, v]) => `<button data-act="pickMode" data-arg="${k}" class="${k === 'survival' ? 'on' : ''}">${v.toUpperCase()}</button>`).join('')}</div>
    <p id="modeHelp">Survival: gather, craft, fight monsters at night.<br>Storm Royale: drop in, loot, build and outlast the storm &amp; 7 rivals.</p>
    <div class="btns"><button class="btn green" data-act="createWorld">CREATE</button><button class="btn" data-act="closeModal">CANCEL</button></div>`);
  void m;
}
acts.closeModal = closeModal;

function startGame(meta) {
  mount('none', '');
  game.startWorld(meta);
  $('#btnRec').classList.toggle('hidden', profile.ageGroup === 'child');
  track('world_start', { mode: meta.mode });
  if (!game.isTouch) game.canvas.requestPointerLock?.();
}

export function showDeath(info) {
  modal(`<h3 style="color:var(--red)">YOU FELL</h3><p>${info.kept ? 'Soul Keeper saved your items.' : (game.gameMode === 'survival' ? 'You dropped your items.' : '')}</p>
    <div class="btns"><button class="btn green" data-act="respawn">RESPAWN</button></div>`);
}
export function showResults(res) {
  const best = recordDaily(res); window.__lastRes = res;
  const t = `${Math.floor(res.time / 60)}:${String(res.time % 60).padStart(2, '0')}`;
  modal(`<h3 style="color:${res.win ? 'var(--gold)' : 'var(--red)'}">${res.win ? '🏆 LAST ONE STANDING!' : 'ELIMINATED'}</h3>
    ${res.daily ? `<p>Daily Challenge #${res.daily} ${best ? '<span class="tag">NEW BEST</span>' : ''}</p>` : ''}
    <p>Placement <b style="color:#fff">#${res.place}</b> · Eliminations <b style="color:#fff">${res.kills}</b> · Time <b style="color:#fff">${t}</b></p>
    <p>+${res.xp} pass XP · +${res.coins} 🪙</p>
    <div class="btns">${profile.ageGroup !== 'child' ? '<button class="btn gold" data-act="shareRes">SHARE RESULT</button>' : ''}<button class="btn green" data-act="results">CONTINUE</button></div>`);
  track('royale_end', { win: res.win, place: res.place, daily: !!res.daily });
}

function bootStreak() {
  const r = claimStreak(); if (!r) return;
  modal(`<h3 style="color:var(--gold)">🔥 ${r.count}-day streak!</h3><p>Come back every day — day 7 pays the most.</p><div class="price" style="font-size:16px">+${r.reward} 🪙</div>
    <div class="btns"><button class="btn green" data-act="closeModal">COLLECT</button></div>`);
}

function handleLink(url) {
  const l = parseDeepLink(url); if (!l) return;
  if (l.ref) pendingRef = l.ref;   // validated format; only usable later if the profile is allowed to redeem
  if (l.ref && referralsAllowed() && !profile.refRedeemed) toast('Invite code ready in Settings', 'gold');
  if (!profile.ageGroup || game.mode === 'play') return;
  if (l.type === 'daily') startGame(dailyMeta());
  if (l.type === 'seed') { newWorldModal(); $('#wSeed').value = l.seed; }
}

// ------------------------------------------------------------------ init
export function initUI(g) {
  game = g;
  setConfirmUI(openPurchaseSheet);
  const r = root();
  r.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    if (el.tagName === 'A') e.preventDefault();
    const fn = acts[el.dataset.act]; if (fn) fn(el.dataset.arg);
  });
  r.addEventListener('input', (e) => {
    const k = e.target.dataset?.set; if (!k) return;
    profile.settings[k] = +e.target.value; $(`#v-${k}`).textContent = e.target.value; save();
    if (k === 'fov') { game.camera.fov = +e.target.value; game.camera.updateProjectionMatrix(); }
  });
  $('#btnPause').addEventListener('click', () => { game.setPaused(true); });
  $('#hotbar').addEventListener('click', (e) => { const s = e.target.closest('.slot'); if (s) game.select(+s.dataset.i); });
  const rb = $('#btnRec');
  rb.addEventListener('click', () => {
    if (isRecording()) return stopClip();
    if (startClip(game.canvas, 15, (blob) => {
      rb.textContent = '⏺'; window.__clip = blob;
      modal(`<h3>🎬 Clip ready</h3><p>${Math.round(blob.size / 1024)} KB · up to 15 seconds</p><div class="btns"><button class="btn gold" data-act="clipShare">SHARE / SAVE</button><button class="btn" data-act="closeModal">DISCARD</button></div>`);
    })) { rb.textContent = '⏹'; toast('Recording up to 15s — tap again to stop', ''); }
  });
  onNativeEvent((m) => { if (m.type === 'deeplink') handleLink(m.url); });
  game.hooks.onPause = () => show('pause');
  game.hooks.onResume = () => mount('none', '');
  game.hooks.onInventory = toggleInventory;
  game.hooks.onDeath = showDeath;
  game.hooks.onResults = showResults;
  onProfileChange(() => { if (cur === 'title' && game.mode !== 'play') refresh(); });
  game.startBackdrop();
  if (needsConsent()) show('agegate'); else { show('title'); bootStreak(); }
  if (profile.tamperedAt && !profile.tamperNotified) { profile.tamperNotified = true; save(true); toast('Save data failed a safety check and was restored from your purchase records.', ''); }
  handleLink(location.href);
}
