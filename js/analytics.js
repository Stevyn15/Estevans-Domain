// Privacy-first analytics wrapper. Does NOTHING unless (a) the player opted in and (b) they are not a child.
// No identifiers, no device fingerprinting. Plug a sink in with setSink() once you pick a provider
// (and update docs/PRIVACY.md + the store privacy forms to match).
import { profile } from './profile.js';

let sink = null;
export const setSink = (fn) => { sink = fn; };
export const analyticsAllowed = () => !!profile.consent?.analytics && profile.ageGroup && profile.ageGroup !== 'child';

export function track(event, props = {}) {
  if (!sink || !analyticsAllowed()) return;
  try { sink({ event, props, t: Date.now() }); } catch { /* never break the game for analytics */ }
}
