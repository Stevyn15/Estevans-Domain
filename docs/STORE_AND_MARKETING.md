# Shipping to the App Store / Google Play and advertising on TikTok & Instagram

This is a practical checklist of what the stores and ad platforms will check — the prototype is already shaped around most of it. Not legal advice; have a lawyer review the privacy policy/terms before launch.

## 1. Turn the web game into an app
- **Wrap it** with [Capacitor](https://capacitorjs.com) (`npx cap add ios android`) — it packages `index.html` + `js/` + `vendor/` as native apps and gives you the native plugins you need (IAP, haptics, push, safe areas).
- Apple rejects thin "website in a box" apps (guideline 4.2). Ours is a real game with offline play, but add native touches (haptics, native IAP, push, game-center / play-games leaderboards).
- Performance: the Three.js voxel renderer is fine for a prototype. If mobile frame-rate is a problem on older phones, the same design ports well to **Unity** or **Godot** — `catalog.js`, `profile.js`, `royale.js` are plain logic you can port 1:1.
- Cloud save: required in practice (device change = lost purchases). Add accounts (Sign in with Apple / Google Play Games) and move `profile` to a server.

## 2. Real-money purchases (most important)
- **Apple App Store / Google Play require their own in-app purchase systems for digital goods** (skins, coins, passes, boosts). Do **not** use Stripe/PayPal inside the app for these (guideline 3.1.1; Google Play Payments policy). Stores take 15–30%.
- Implement the `{ checkout(productId) }` interface in `js/payments.js` with StoreKit / Google Play Billing — easiest via **RevenueCat** (handles both stores, receipts, subscriptions, restore).
- **Validate receipts on a server** and grant entitlements there. Anything granted only on the client can be edited in dev tools.
- Provide a working **Restore Purchases** button (included in Shop; wire it to the provider).
- Battle pass: if you sell a time-limited season, state the end date clearly. If the pass is a subscription, follow subscription disclosure rules.
- Each IAP needs a store listing (name, description, price tier, screenshot of the purchase UI).

## 3. Be upfront about what purchases do  *(this affects approval and ad delivery)*
You asked for small purchases that make the game easier and stay low-key. Keep them **low-pressure, not hidden**:
- ✅ Fine: a small "Boosts" tab, no pop-ups, no nagging, every boost described plainly with its price (already how the Shop works).
- ❌ Risky: hiding what a purchase costs or does, unclear currency conversions, dark patterns (fake timers, confirm-shaming, accidental-purchase buttons). Apple/Google reject or pull apps for these, and TikTok/Meta ad review checks the app's store page and landing page.
- Pay-to-win is allowed, but heavy P2W in the competitive mode hurts retention and reviews. Consider making **boosts apply to Survival/Creative only** and keep Storm Royale cosmetic-first (the code already isolates this in `profile.stats()`).
- **Loot odds**: Apple requires odds disclosure for randomised paid items. Our chests are free-to-earn, never sold, and the odds are shown in Settings. If you ever sell random packs, you must show odds before purchase (and some countries restrict them).

## 4. Kids and age (this is the big one for TikTok/Instagram targeting)
This style of game appeals to kids, which triggers strict rules:
- **Under 13 (COPPA, US; GDPR-K, EU)**: no behavioural advertising, no collecting personal data without verifiable parental consent. The prototype includes an **age gate** and **turns off real-money purchases for under-13s**. If you decide kids are your audience, you must enrol in Apple's **Kids Category** / Google's **Families Program**, which bans most third-party analytics/ad SDKs and external links.
- **13–17**: allowed, but ad platforms limit targeting (Meta removed interest/behaviour targeting for under-18s; TikTok restricts it too). You can still reach teens broadly by country/age range, and then optimise on in-app events.
- Easiest compliant plan: set the store age rating at **12+ / Teen**, state the audience as 13+, run ads to **18+ or 13+ with broad targeting**, and use "lookalike" audiences from adult players. Don't design ads that appeal primarily to under-13s if you're not in the Kids programs.
- Publish a **Privacy Policy** and **Terms** URL (required by both stores and by Meta/TikTok app-install campaigns) and fill in Apple's *Privacy Nutrition Label* / Google's *Data Safety* form accurately.
- Add parental-consent flow and a parental gate for purchases if any under-18 users are expected.

## 5. Advertising on TikTok and Instagram/Meta
- **App-install campaigns**: TikTok Ads Manager and Meta Ads Manager. You'll need the app live in the stores, a **mobile measurement partner** (AppsFlyer, Adjust, Singular) or SKAdNetwork/Play Install Referrer wiring, and conversion events (install → tutorial done → first purchase). Add event hooks in `profile.js`/`payments.js`.
- **Creative that works for this genre**: 9:16 gameplay clips 8–20s — a skin reveal, a clutch storm-circle win, a TNT/grapple trick, "can you find the secret" easter-egg teasers. Record with the in-game 3rd-person camera/emotes.
- **Rules**: ads must show real gameplay, no misleading "play now" fake UI, no claims you can't back up, and must not promote gambling-like mechanics to minors. Both platforms review the destination store page.
- Budget the funnel before spending: with typical casual-game numbers you need an install-to-payer rate and LTV that exceed your CPI; test with small spend on 1–2 creatives first.
- Organic: TikTok/Reels/Shorts creators love easter eggs and skin drops — the secret system in `easter.js` is built for that. Seasonal pass launches are natural content beats.

## 6. Trademarks & copyright (avoid takedowns)
- Don't use names, logos, art, or phrases from other games (e.g. "Fortnite", "Apex Legends", "3D Pixel World", "Minecraft", "Victory Royale", "Steve", "Creeper"). The prototype borrows **mechanics** (storm circle, loot rarities, abilities, quick-build), which aren't protected — names and art are original.
- Keep audio/fonts/art licensed. `Press Start 2P` (Google Fonts) is OFL-licensed; Three.js is MIT (`vendor/THREE_LICENSE`).
- Pick a unique app name and search the stores + USPTO/EUIPO before committing to "Pixel Realms" (it is a very common phrase).

## 7. Launch checklist
- [ ] Real IAP + server receipt validation + restore
- [ ] Accounts + cloud save
- [ ] Age gate → parental consent / Kids Category decision
- [ ] Privacy Policy, Terms, support email, account deletion in-app (required by Apple)
- [ ] Privacy label / Data Safety forms, age rating questionnaires
- [ ] Crash reporting + analytics (respect age gate)
- [ ] TestFlight / Play internal testing with real devices (low-end Android too)
- [ ] Store screenshots + 15–30s preview video, app icon, localized text
- [ ] Ad accounts, MMP/SKAN wiring, 3–5 vertical creatives
