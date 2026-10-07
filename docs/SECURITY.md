# Security

## The one rule
**Never trust the device.** Everything that runs on a phone or in a browser (this game, its save data, its purchase messages) can be inspected and edited by its user. Controls below make casual tampering and accidents visible and limit blast radius; **anything involving real money, rankings or other players must be validated on a server before launch.**

## What is implemented in this repo

| Control | Where | What it protects against |
|---|---|---|
| Content-Security-Policy (hash-based, no `unsafe-eval`, no inline scripts except the hashed import map / hashed bundle) | `index.html`, `scripts/csp.mjs`, `mobile/scripts/build-game.mjs` | Script injection / XSS, loading code from other origins. Unit-tested (`npm test`) |
| HTTP security headers (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`) | `server.mjs` (copy to your real host) | Clickjacking, MIME sniffing, referrer leaks, unwanted camera/mic/location |
| HTML-escaping of user-entered text (world names, seeds) | `ui.js` `esc()` | Stored XSS through world names |
| Strict deep-link parser (scheme/length/charset allowlists) | `viral.js` `parseDeepLink` | Malicious links opening arbitrary content or injecting values. Unit-tested |
| Native bridge validation: allowlisted message types, size caps, product-ID allowlist, URL allowlist (`https`/`mailto` only), filename/MIME allowlist | `mobile/src/bridge.ts` (tested) | A compromised/buggy web layer triggering arbitrary native actions, path traversal, huge payloads |
| WebView lockdown: no file access, no multi-window, no mixed content, navigation allowlist, geolocation off | `mobile/App.tsx` | Loading remote pages inside the game, local file exfiltration |
| Purchases cannot be simulated in release builds; web test payments flag must be turned off | `mobile/src/purchases.ts`, `config.js` `testPayments` | Shipping a build that gives paid items away |
| Tamper-evident save (checksum → safe fallback rebuilt from receipts) | `profile.js` | Corrupted/edited saves, casual coin editing. **Not** real protection |
| Secure OS storage for consent record (Keychain/Keystore, this-device-only) | `mobile/src/secure.ts` | Leaking sensitive values via backups or plain files |
| Android `allowBackup:false`, no unnecessary permissions, iOS privacy manifest, no tracking | `mobile/app.json` | Data leaving the device via backup, over-broad permissions |
| Clip files deleted from cache right after sharing | `mobile/App.tsx` | Leaving user videos on disk |
| Cryptographically random referral codes (`crypto.getRandomValues`) | `viral.js` | Guessable codes |
| Analytics gate (opt-in, never for children, no IDs) | `analytics.js` | Silent data collection |
| Unit tests for all of the above | `scripts/unit.mjs`, `mobile/scripts/bridge.test.mjs` | Regressions |

## Known gaps (must close before real launch)
1. **Entitlements are client-side.** Anyone can edit local storage or call `applyGrants`. Fix: accounts + server as source of truth. Use RevenueCat (or your own backend validating App Store Server API / Google Play Developer API receipts), store entitlements server-side, and have the game *read* them at startup.
2. **No accounts / cloud save.** Needed for restore, cross-device play and server validation. Use Sign in with Apple / Google Play Games; store a short-lived token in `secure.ts`.
3. **Referral rewards, daily leaderboard and streaks** are client-trusted. Verify server-side with rate limits and device/account checks.
4. **Anti-cheat** is irrelevant for single-player but required once rankings or real opponents exist: server-authoritative scoring, input sanity checks, replay verification.
5. **`style-src 'unsafe-inline'`** is used because the UI templates use inline `style=` attributes. Tightening means moving them into CSS classes.
6. **Dependency hygiene:** `three` is vendored (MIT) — pin and review upgrades; run `npm audit` in `mobile/` and enable Dependabot/Renovate. Expo SDK upgrades roughly every 3–4 months.
7. **Transport:** when a backend exists, HTTPS only (ATS/Network Security Config enforce this), consider certificate pinning for the purchase/entitlement endpoints, never put secrets (API keys with write access, signing keys) in the app bundle — assume anything in the bundle is public.

## Production checklist
- [ ] `APP.testPayments = false`; real IAP wired; server validates receipts; restore works
- [ ] Remove `window.__game` debug handle in `main.js` for release builds
- [ ] Release builds: Hermes, minified bundle, ProGuard/R8 enabled (Expo default for release), no dev menu
- [ ] CSP verified on the real host + headers mirrored; `npm run csp` after any import-map change
- [ ] Rate limits and abuse monitoring on every endpoint; logs without personal data
- [ ] Secrets in CI/EAS secrets, never in git; rotate on staff changes
- [ ] Independent penetration test / mobile app review against **OWASP MASVS** (L1 at minimum) before launch
- [ ] Incident response: who is on call, how to push a hotfix (EAS Update), how to notify users/regulators (GDPR: 72 hours)
- [ ] Vulnerability reporting address published (`security@…`) and `/.well-known/security.txt` on your site

## Reporting
Send findings to the address in `APP.supportEmail` (replace before launch) — please don't open public issues for vulnerabilities.
