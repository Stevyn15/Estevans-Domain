// Shareable / habit-forming features. Everything here is client-side MVP; see docs/VIRAL_IDEAS.md for
// what needs a backend (leaderboards, verified referrals) and docs/SECURITY.md for the trust model.
import { APP } from './config.js';
import { profile, save, addCoins } from './profile.js';
import { hashStr, toast } from './util.js';
import { shareText, shareFile } from './native.js';
import { track } from './analytics.js';

// ---------------- daily challenge ----------------
const DAY = 86400000;
export const dailyNumber = (d = new Date()) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - APP.epoch) / DAY) + 1;
export function dailyMeta() {
  const n = dailyNumber();
  return { id: 'daily', name: `Daily #${n}`, seed: hashStr(`pixelrealms-daily-${n}`) | 0, seedText: `daily-${n}`, mode: 'royale', daily: n };
}

/** Record a finished daily run; returns true if it is the player's best today. */
export function recordDaily(res) {
  if (!res.daily) return false;
  if (profile.daily.n !== res.daily) profile.daily = { n: res.daily, best: null };
  const b = profile.daily.best;
  const better = !b || res.place < b.place || (res.place === b.place && (res.kills > b.kills || (res.kills === b.kills && res.time < b.time)));
  if (better) profile.daily.best = { place: res.place, kills: res.kills, time: res.time };
  save(true); return better;
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export function resultShareText(res) {
  const head = res.daily ? `Pixel Realms Daily #${res.daily}` : 'Pixel Realms';
  return `${res.win ? '🏆' : '💀'} ${head} — placed #${res.place}, ${res.kills} elimination${res.kills === 1 ? '' : 's'}, survived ${fmtTime(res.time)}. Can you beat me?`;
}
export async function shareResult(res) {
  track('share_result', { daily: !!res.daily, win: res.win });
  const r = await shareText(resultShareText(res), `${APP.shareUrl}${res.daily ? `?daily=1&ref=${myRefCode()}` : `?ref=${myRefCode()}`}`);
  if (r === 'copied') toast('Copied to clipboard — paste it anywhere!', 'gold');
}

// ---------------- daily login streak ----------------
const STREAK_REWARDS = [25, 25, 50, 50, 75, 75, 150];
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
/** Call once per app open. Returns {count, reward} if a new day was just claimed, else null. */
export function claimStreak() {
  const today = dayKey(), s = profile.streak;
  if (s.last === today) return null;
  const yesterday = dayKey(new Date(Date.now() - DAY));
  s.count = s.last === yesterday ? s.count + 1 : 1; s.last = today;
  const reward = STREAK_REWARDS[(s.count - 1) % 7];
  addCoins(reward); save(true);
  return { count: s.count, reward };
}

// ---------------- referral (MVP, client-only) ----------------
// A real referral program MUST be verified server-side (otherwise anyone can farm rewards). This stub
// exists so the UI/flow can be built and tested; it is disabled for child profiles.
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function myRefCode() {
  if (!profile.refCode) {
    const a = new Uint32Array(6); crypto.getRandomValues(a);
    profile.refCode = [...a].map((v) => ALPHA[v % ALPHA.length]).join(''); save(true);
  }
  return profile.refCode;
}
export const referralsAllowed = () => profile.ageGroup && profile.ageGroup !== 'child';
export function redeemRefCode(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!referralsAllowed()) return { ok: false, msg: 'Invites are turned off for this profile.' };
  if (profile.refRedeemed) return { ok: false, msg: 'You already used an invite code.' };
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return { ok: false, msg: 'That code looks wrong (6 letters/numbers).' };
  if (code === myRefCode()) return { ok: false, msg: "You can't use your own code." };
  profile.refRedeemed = code; addCoins(100); save(true); track('referral_redeemed');
  return { ok: true, msg: 'Invite accepted: +100 coins!' };
}
export async function shareInvite() {
  const r = await shareText('Join me in Pixel Realms — build, survive and outlast the storm! Use my code for a bonus:', `${APP.shareUrl}?ref=${myRefCode()}`);
  if (r === 'copied') toast('Invite copied — paste it anywhere!', 'gold');
}

// ---------------- deep links (strictly validated: they come from outside the app) ----------------
export function parseDeepLink(url) {
  if (typeof url !== 'string' || url.length > 300) return null;
  let u; try { u = new URL(url); } catch { return null; }
  const okScheme = u.protocol === `${APP.scheme}:` || u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'file:';
  if (!okScheme) return null;
  const path = (u.protocol === `${APP.scheme}:` ? `${u.hostname}${u.pathname}` : u.pathname).replace(/^\/+|\/+$/g, '');
  const q = u.searchParams;
  const ref = q.get('ref'); const refOk = ref && /^[A-HJ-NP-Z2-9]{6}$/.test(ref) ? ref : null;
  if (path === 'daily' || q.get('daily') === '1') return { type: 'daily', ref: refOk };
  const m = /^seed\/([\w .-]{1,24})$/.exec(path) || (q.get('seed') && /^[\w .-]{1,24}$/.test(q.get('seed')) ? [null, q.get('seed')] : null);
  if (m) return { type: 'seed', seed: m[1], ref: refOk };
  if (refOk) return { type: 'invite', ref: refOk };
  return null;
}

// ---------------- clip recorder (TikTok/Reels-ready) ----------------
let rec = null;
export const isRecording = () => !!rec;
export function startClip(canvas, seconds = 15, onDone) {
  if (rec || typeof MediaRecorder === 'undefined' || !canvas.captureStream) { if (!rec) toast('Clip recording is not supported on this device', ''); return false; }
  const mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const chunks = []; const mr = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 2_500_000 });
  mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mr.onstop = () => { clearTimeout(rec?.t); rec = null; onDone(new Blob(chunks, { type: mime?.split(';')[0] || 'video/webm' })); };
  mr.start(1000); rec = { mr, t: setTimeout(() => mr.state !== 'inactive' && mr.stop(), seconds * 1000) };
  track('clip_started'); return true;
}
export const stopClip = () => { if (rec?.mr.state !== 'inactive') rec.mr.stop(); };
export async function shareClip(blob) {
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const r = await shareFile(blob, `pixel-realms-clip.${ext}`, 'Clip from Pixel Realms');
  if (r === 'saved') toast('Clip saved to your downloads', 'gold');
  track('clip_shared');
}
