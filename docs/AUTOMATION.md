# Automation: what runs by itself, and what only you can do

## Automated (nothing to do)
| What | How | When |
|---|---|---|
| Lint (syntax, leftover debug code, secret patterns) | `npm run lint` | every commit (git hook) + CI |
| Unit tests (security/privacy logic, loot rules, CSP hash) | `npm test` | every commit + CI |
| Browser end-to-end tests (consent gate, child safety, daily royale run, survival, data delete, native bridge) | `npm run e2e` | CI on every push/PR |
| Mobile bridge tests + TypeScript check + Expo bundle for iOS & Android | `mobile`: `npm test`, `npm run typecheck`, `expo export` | CI |
| Pre-launch gate (test payments off, real URLs/IDs, real purchase provider, debug handle gated…) | `npm run release:check` | informational on every push; **blocking** for production builds |
| Web demo deploy (shareable play-in-browser link) | `.github/workflows/pages.yml` | every push to the default branch |
| iOS + Android cloud builds, optional store submission, GitHub release notes | `.github/workflows/release.yml` (EAS) | tag `v*`, or run manually |
| Store screenshots (iOS 6.7" + Android, captioned), IAP product CSV, listing text/age-rating/privacy answers | `npm run store:all` or the *Store assets* workflow | on demand |
| Dependency updates | Dependabot (weekly; Expo core packages are held for `expo install --fix`) | weekly |
| Cloud-session setup (deps + mobile bundle) | `.claude/hooks/session-start.sh` | every Claude Code cloud session |
| One-command local setup | `npm run setup` | once per clone |

Everything above is also one command locally: **`npm run verify`**.

## Your checklist (needs your identity, money or signature — I can't do these)
1. **Developer accounts** — Apple Developer Program ($99/yr) and Google Play Console ($25 once).
2. **Expo account** → create an access token → add it as the GitHub secret `EXPO_TOKEN` (repo Settings → Secrets → Actions). Run `npx eas-cli login && npx eas-cli build:configure` once in `mobile/` so EAS can manage signing keys.
3. **Choose a real app name + IDs** and edit `mobile/app.json` (`bundleIdentifier`, `package`), `js/config.js` (`shareUrl`, `privacyUrl`, `termsUrl`, `supportEmail`). `npm run release:check` lists exactly what is still a placeholder.
4. **Publish a privacy policy + terms** at those URLs (start from `docs/PRIVACY.md`; have a lawyer review).
5. **Create the in-app products** in App Store Connect / Play Console / RevenueCat using `store/iap-products.csv` (product IDs must match `js/catalog.js`).
6. **Wire RevenueCat** in `mobile/src/purchases.ts` (`react-native-purchases`), set `testPayments: false`. This is the one coding step left on the payments side — ask me and I'll do it once you have the RevenueCat keys.
7. **Design the app icon + splash** (`mobile/assets/`), run `npm run store:assets`, paste `store/listing.md` into both consoles, answer the age-rating and privacy forms with the generated answers.
8. **Ship:** `git tag v0.1.0 && git push --tags` → EAS builds → (with `submit` on) it lands in TestFlight / Play internal testing. Test on real devices, then promote to review.
9. **Pages (optional):** repo Settings → Pages → Source: *GitHub Actions* for the web-demo link.

## Next automations I can add (tell me which)
- RevenueCat integration + a tiny entitlement/leaderboard backend (Supabase) so purchases and the Daily Challenge are server-verified
- Scheduled "daily challenge" social posts (needs your TikTok/Instagram API access — they restrict automated posting)
- A/B-tested clip watermarks and auto-captioned share videos
- EAS Update (instant over-the-air fixes without store review)
- Crash reporting + opt-in analytics funnel dashboards (install → first match → purchase)
