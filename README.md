# Pixel Realms (working title)

A voxel sandbox + "last one standing" game that runs in any browser and is built to be wrapped as an iOS/Android app.
Three.js, no build step, no runtime dependencies (Three.js is vendored in `vendor/`).

```bash
npm start            # http://localhost:8080  (or any static file server)
```

## What's in the prototype

| Area | What exists |
|---|---|
| **Menu flow** | Age gate → Title (live 3D backdrop) → Worlds → New World (Survival / Creative / Storm Royale) · Skins & Legends · Battle Pass · Shop · Settings · Pause |
| **Sandbox** | Infinite chunked terrain (caves, ores, trees, water, snow), mine/place, hotbar + inventory, crafting, day/night, zombies at night, pigs, fall damage, saves |
| **Storm Royale** | Glide in, 36 loot chests, shrinking storm, supply drops, 7 bot rivals, weapons with 5 rarities, shield/medkit, quick-build walls/ramps/floors, results screen paying pass XP |
| **Legends** (Q) | Vex *Phase Dash*, Scout *Sonar Ping*, Bulwark *Aegis* |
| **Cool items** | Grapple Hook, Jump Pad, TNT, Loot Chests, ping markers (G), emotes (H) |
| **Cosmetics** | 16 procedurally painted skins + hats, live 3D preview |
| **Monetization** | Battle pass (free + premium track, 30 tiers, daily quests), coin packs, skins, small permanent boosts, starter bundle, XP boost, tier skips |
| **Easter eggs** | See `js/easter.js` — try the title logo, the Konami code, typing `moon`, seed `estevan`, golden pigs/chests, emoting 10×. |

Controls — PC: `WASD` move, `Space` jump (double-tap = fly in Creative), `Shift` sprint, `LMB` mine/attack/fire, `RMB` place/use/open chest, `1-9` hotbar, `E` inventory, `Q` ability, `Z/X/C` build wall/ramp/floor, `G` ping, `H` emote, `V` camera. Touch: left stick + right-side drag + on-screen buttons.

## Code map

```
index.html, css/style.css      shell, HUD, menus (pixel UI)
js/main.js                     boot
js/game.js                     runtime: physics, input, mining, items, abilities, mobs, HUD, saves
js/world.js                    chunks, terrain gen, meshing, voxel raycast
js/blocks.js                   block table + procedural texture atlas
js/royale.js                   Storm Royale: storm, bots, loot tables, supply drops, results
js/items.js, js/legends.js     weapons/consumables/rarities; legend abilities (data)
js/skins.js                    skin catalog, procedural painter, humanoid model, hats
js/catalog.js                  ALL prices, perks, products, battle pass tiers, quests  <- balance here
js/profile.js                  save data, coins/xp, grants, perk -> gameplay stats()
js/payments.js                 payment provider interface (TestProvider now)
js/ui.js                       every menu screen and overlay
js/easter.js                   secrets
scripts/smoke.mjs              headless Chromium smoke test (needs playwright)
docs/STORE_AND_MARKETING.md    what you need to ship + advertise this (READ THIS)
docs/VIRAL_IDEAS.md            growth ideas ranked by effort, with status
docs/SECURITY.md, PRIVACY.md   threat model, controls, known gaps, data map, store-form answers
js/viral.js, native.js, privacy.js, analytics.js, config.js   shareable features, native bridge, data rights, consent-gated analytics
mobile/                        Expo app (WebView shell + native bridge)
```

**Adding a purchasable boost:** add it to `PERKS` in `catalog.js`, read it in `profile.stats()`, use the stat in `game.js`. The shop lists it automatically.
**Adding a skin:** add an entry to `SKINS` in `skins.js` (colours + optional `paint` function + `hat`).
**Adding a battle pass season:** edit `BP`, `buildTiers()` in `catalog.js`.

## Mobile app (React Native + Expo) — same repo, one codebase

`mobile/` is an Expo (React Native) app that bundles the game into a single offline HTML file and runs it in a locked-down WebView, with a **validated native bridge** for purchases (store seam), share sheet, haptics, deep links, secure storage and clip sharing. The game code in `js/` is the single source of truth for both web and mobile.

```bash
cd mobile
npm install                 # first time only
npm start                   # builds the game bundle, then starts Expo — scan the QR with the Expo Go app,
                            # or press i / a for the iOS simulator / Android emulator
npm run typecheck && npm test
```
You need Node 20+ (22 recommended). For App Store / Play builds use [EAS Build](https://docs.expo.dev/build/introduction/): `npx eas-cli build --platform all` (requires an Expo account and your Apple/Google developer accounts). Edit `bundleIdentifier`/`package` in `mobile/app.json` first.
`Expo Go` is fine for the MVP; the native modules used (WebView, haptics, sharing, secure-store…) are all included in it.

New in this layer: **Daily Challenge, share-result, 15s clip recorder, daily streak, invite codes, deep links** (`docs/VIRAL_IDEAS.md`), plus the **age gate + consent, Privacy & Data screen (export / delete), CSP, tamper-evident saves and bridge validation** (`docs/SECURITY.md`, `docs/PRIVACY.md`).

```bash
npm test                    # (repo root) security/privacy unit tests
npm run csp                 # regenerate the CSP hash after editing the import map
```

## Important: purchases are simulated
`payments.js` uses a `TestProvider` that shows a confirm sheet and grants the item. **No money moves.** See `docs/STORE_AND_MARKETING.md` for wiring Apple/Google in-app purchases and server-side receipt validation before launch.
