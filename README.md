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
```

**Adding a purchasable boost:** add it to `PERKS` in `catalog.js`, read it in `profile.stats()`, use the stat in `game.js`. The shop lists it automatically.
**Adding a skin:** add an entry to `SKINS` in `skins.js` (colours + optional `paint` function + `hat`).
**Adding a battle pass season:** edit `BP`, `buildTiers()` in `catalog.js`.

## Important: purchases are simulated
`payments.js` uses a `TestProvider` that shows a confirm sheet and grants the item. **No money moves.** See `docs/STORE_AND_MARKETING.md` for wiring Apple/Google in-app purchases and server-side receipt validation before launch.
