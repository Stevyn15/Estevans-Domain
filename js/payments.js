// Payment layer. The rest of the game only calls `buy(productId)`.
//
// TestProvider simulates a successful checkout so the whole loop can be built and tested
// without charging anyone. To go live, implement the same `{ checkout(product) }` interface for
// Stripe Checkout / Apple StoreKit / Google Play Billing and set it with `setProvider()`.
// NEVER trust the client for real money: validate receipts on a server before granting.

import { PRODUCTS } from './catalog.js';
import { applyGrants, recordReceipt, save, profile } from './profile.js';
import { usd, toast } from './util.js';

let confirmUI = async () => true;           // set by ui.js (shows the checkout sheet)
export const setConfirmUI = (fn) => { confirmUI = fn; };

export const TestProvider = {
  name: 'test',
  async checkout(productId) {
    const p = PRODUCTS[productId];
    const ok = await confirmUI({ title: p.name, price: usd(p.usd), test: true });
    return ok ? { ok: true, receipt: `test-${Date.now()}` } : { ok: false };
  },
};

let provider = TestProvider;
export const setProvider = (p) => { provider = p; };

export async function buy(productId) {
  const p = PRODUCTS[productId];
  if (!p) throw new Error(`Unknown product ${productId}`);
  // Store/COPPA rule of thumb: no real-money purchases for children under 13.
  if (profile.ageGroup === 'child') { toast('Purchases are turned off for this profile. Ask a parent or guardian.', ''); return false; }
  const res = await provider.checkout(productId);
  if (!res.ok) return false;
  applyGrants(p.grants);
  recordReceipt(productId);
  save(true);
  toast(`Purchased: ${p.name}`, 'gold');
  return true;
}

/** Apple/Google require a "Restore purchases" path. With a real provider, fetch the user's entitlements
 *  from your server/store here. The test provider just re-applies local receipts (idempotent grants only). */
export function restorePurchases() {
  let n = 0;
  for (const r of profile.receipts) {
    const g = PRODUCTS[r.productId]?.grants; if (!g) continue;
    const durable = { perks: g.perks, skins: g.skins, premium: g.premium };
    if (durable.perks || durable.skins || durable.premium) { applyGrants(durable); n++; }
  }
  toast(n ? `Restored ${n} purchase${n > 1 ? 's' : ''}` : 'Nothing to restore', n ? 'gold' : '');
}
