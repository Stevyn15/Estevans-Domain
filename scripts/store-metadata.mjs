// Generates store-ready files from the single source of truth (js/catalog.js, skins, config):
//   store/iap-products.csv  — every in-app product with type + price, ready to create in App Store Connect / Play Console / RevenueCat
//   store/listing.md        — name, subtitle, descriptions, keywords, age-rating + privacy answers
// Run: npm run store:meta     (re-run whenever prices/products change)
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { PRODUCTS, PERKS, BP, TIERS } from '../js/catalog.js';
import { APP } from '../js/config.js';

const SKIN_COUNT = (readFileSync(new URL('../js/skins.js', import.meta.url), 'utf8').match(/^  \{ id: '/gm) || []).length;
mkdirSync('store', { recursive: true });

const type = (id, p) => (id.startsWith('coins_') || id === 'bp_tiers' || id === 'xp_boost' ? 'consumable' : id === 'bp_premium' ? 'non-consumable (season pass)' : 'non-consumable');
const rows = [['product_id', 'type', 'display_name', 'price_usd', 'grants'], ...Object.entries(PRODUCTS).map(([id, p]) => [id, type(id, p), p.name, (p.usd / 100).toFixed(2), JSON.stringify(p.grants).replace(/"/g, "'")])];
writeFileSync('store/iap-products.csv', rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n');

const perks = Object.values(PERKS).map((p) => `- ${p.icon} ${p.name}: ${p.desc}`).join('\n');
writeFileSync('store/listing.md', `# Store listing (generated — edit the generator or copy from here)

**Name:** ${APP.name}   *(check availability on both stores + trademark search first)*
**Subtitle (iOS, ≤30):** Build, craft & outlast the storm
**Promotional text (iOS, ≤170):** New daily challenge every day! Drop in, loot, build and outlast the storm — or relax in a huge block world. ${SKIN_COUNT}+ skins and a ${BP.tiers}-tier battle pass.
**Category:** Games → Adventure (secondary: Simulation)
**Keywords (iOS, ≤100):** block,craft,build,survival,battle royale,sandbox,pixel,skins,daily challenge,voxel
**Support / privacy / terms URLs:** ${APP.supportEmail} · ${APP.privacyUrl} · ${APP.termsUrl}

## Short description (Google Play, ≤80)
Build, craft and outlast the storm in a pixel-block world.

## Full description
Explore an endless block world, build anything you can imagine, and survive the night.

**Storm Royale** — glide in, loot chests, quick-build walls and ramps, and outlast the shrinking storm against 7 rivals. Pick a Legend with its own ability: dash, sonar or shield.

**New Daily Challenge** — everyone plays the same map each day. Share your result and clip with friends!

**Make it yours** — ${SKIN_COUNT}+ skins and hats, a ${BP.tiers}-tier ${BP.name} with free and premium rewards, and daily quests.

**Play your way** — Survival, Creative and Storm Royale modes. Grapple hooks, jump pads, TNT and hidden secrets to find.

*Optional in-app purchases: ${Object.keys(PRODUCTS).length} items from $0.99 to $4.99, including small permanent boosts that make the game easier. Real money is never required to play. Loot chests are earned by playing and are never sold.*

### Boosts (listed in the in-app shop)
${perks}

## Age rating questionnaire (typical answers — verify in each store's form)
- Cartoon/fantasy violence: **Infrequent/Mild** (pixel monsters and rival bots, no blood)
- Realistic violence, sexual content, nudity, profanity, alcohol/drugs, gambling (simulated or real): **None**
- In-app purchases: **Yes** · Unrestricted web access: **No** · User-generated content visible to others: **No** · Chat: **No**
- Suggested rating: **9+/PEGI 7 (iOS 9+, ESRB Everyone 10+)**; audience in store setup: **13+** (see docs/PRIVACY.md before choosing kids categories)

## Privacy answers (current build)
- Apple App Privacy: **Data Not Collected**; Tracking: **No** · Google Data safety: **No data collected or shared**
- Update both when you add accounts, analytics or RevenueCat (docs/PRIVACY.md).

## Screenshots
Run \`npm run store:assets\` → store/screenshots/ (iOS 6.7" and Android phone, landscape, with captions).
`);
console.log(`store/iap-products.csv (${rows.length - 1} products), store/listing.md`);
