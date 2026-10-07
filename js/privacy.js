// Data-subject features required by store policies and privacy law (GDPR/CCPA/COPPA):
// consent record, export, deletion. All game data is stored ON DEVICE only (localStorage) in this build.
import { APP } from './config.js';
import { profile, save, resetProfile } from './profile.js';
import { toToNativeSafe } from './privacyNative.js';

export const KEY_PREFIX = 'pixelrealms.';

export function needsConsent() { return !profile.ageGroup || (profile.consent?.version ?? 0) < APP.policyVersion; }

export function recordConsent({ analytics }) {
  profile.consent = { version: APP.policyVersion, ts: Date.now(), analytics: !!analytics && profile.ageGroup !== 'child' };
  save(true);
  toToNativeSafe('consent', { consent: profile.consent });   // native keeps a copy in the OS secure store
}

export function setAnalyticsConsent(on) { recordConsent({ analytics: on }); }

/** Everything we hold about the player, as a plain object (GDPR "right of access / portability"). */
export function exportData() {
  const out = { exportedAt: new Date().toISOString(), app: APP.name, data: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k.startsWith(KEY_PREFIX)) continue;
    try { out.data[k] = JSON.parse(localStorage.getItem(k)); } catch { out.data[k] = '[unreadable]'; }
  }
  return out;
}

/** Erase everything locally (and ask the native shell to erase secure storage). Server deletion goes here too once accounts exist. */
export function deleteAllData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(KEY_PREFIX)) keys.push(k); }
  keys.forEach((k) => localStorage.removeItem(k));
  toToNativeSafe('wipe', {});
  resetProfile();
}
