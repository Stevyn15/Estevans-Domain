# Privacy & data protection

*Engineering notes and a policy starting point — not legal advice. Have a lawyer review the public Privacy Policy and Terms before launch, especially because this game appeals to children.*

## Principles built into the app
1. **Data minimisation** — no accounts, no ads, no analytics SDKs, no device identifiers. We store only what gameplay needs.
2. **On-device by default** — all progress lives in local storage on the player's device.
3. **Privacy by default** — analytics is **off** until the player opts in, and **can never be enabled for under-13 profiles**.
4. **Age-appropriate design** — an age gate (birth *year* only, **not stored**) switches children into a protected profile: no purchases, no invites/referrals, no clip sharing, no analytics.
5. **User control** — in-app *Privacy & Data* screen: view policy/terms, toggle analytics, **export my data** (JSON), **delete all my data**.
6. **Consent is versioned** — bumping `APP.policyVersion` re-prompts everyone; the consent record is also kept in the OS secure store on mobile.

## Data inventory (current build)
| Data | Where | Purpose | Leaves device? | Retention |
|---|---|---|---|---|
| Game progress: coins, XP, skins, settings, worlds (block edits), streak, daily best | Local storage (WebView) | Gameplay | No | Until the user deletes it / uninstalls |
| Age group (`child`/`teen`/`adult`) | Local storage | Age-appropriate settings | No | Same |
| Consent record (policy version, timestamp, analytics yes/no) | Local storage + Keychain/Keystore | Prove/respect consent | No | Same |
| Purchase receipts (product id, time, price) | Local storage | Restore purchases | **Yes, to Apple/Google (and RevenueCat once added)** | Per store rules |
| Invite code (random, not tied to identity) | Local storage | Referral feature | Only when the player shares it | Same |
| Clips | Memory → temp file → deleted after share sheet closes | Sharing | Only where the player sends it | Deleted immediately |
| Analytics events (opt-in only, no IDs) | Not collected until a sink is configured | Improve the game | Only if opted in | Define when you add a provider (≤ 13 months typical) |

## Rights & how the app honours them
- **Access / portability (GDPR Art. 15/20, CCPA):** *Export my data* button.
- **Erasure (GDPR Art. 17, CCPA, Apple guideline 5.1.1(v)):** *Delete all my data* button wipes local data and secure storage. **When you add accounts you must also delete the server-side account and data from inside the app.**
- **Withdraw consent:** analytics toggle; clear-all deletes the consent record too.
- **Children (COPPA, GDPR-K, UK Children's Code):** see principle 4. For a child-directed product you also need verifiable parental consent for any personal-data collection and must enrol in Apple Kids Category / Google Families — which restricts third-party SDKs. Simplest compliant approach: **target 13+**, keep the gate, and don't market to under-13s.

## Store privacy forms (answers for the current build)
**Apple – App Privacy ("nutrition label")**: Data Not Collected *(until you add analytics/accounts/RevenueCat — then declare Purchases, Identifiers, Usage Data as applicable)*. Tracking: **No** (don't add `NSUserTrackingUsageDescription`; no ATT prompt needed). `mobile/app.json` already sets `NSPrivacyTracking:false` and an empty collected-types list; update both together when this changes.
**Google Play – Data safety**: No data collected or shared *(update when you add accounts/analytics/IAP provider)*. Declare in-app purchases. Target audience: 13+ (or "Families" if you choose kids).
**Other:** content/age rating questionnaires — mention cartoon violence (bots/zombies), in-app purchases, user interaction: none (no chat/UGC exposed to others yet).

## Things that change the picture (update this file + forms when you add them)
- **Accounts / cloud save** → you hold personal data (email/ID): add retention, access controls, deletion API, breach process, DPA with your host.
- **RevenueCat / Apple / Google purchase data** → processors; list them in the policy.
- **Analytics / crash reporting** → choose EU-hostable provider, disable for children, honour the toggle, document retention.
- **Ad attribution (AppsFlyer/Adjust/SKAdNetwork)** → counts as tracking in some cases (ATT on iOS 14.5+; GDPR consent in the EU). Prefer privacy-preserving SKAdNetwork/Play Install Referrer only, and never for child profiles.
- **Chat, usernames, UGC galleries** → moderation, reporting, profanity filtering, extra child-safety duties (e.g. UK Online Safety Act, EU DSA).
- **Push notifications** → opt-in, never marketing to children.

## Privacy-policy skeleton (fill in the brackets)
1. Who we are & contact: [company, address, support/privacy email, EU/UK representative if needed]
2. What we collect (table above) and why; legal bases (contract/legitimate interests/consent)
3. Children: not directed to under-13s; age gate; what is disabled; how parents can ask for deletion
4. Sharing: Apple/Google (payments), [RevenueCat], [analytics provider if opted in]; no sale of personal data; no ad profiling
5. Retention & deletion (in-app button; how to contact us)
6. Your rights (access, export, correction, deletion, objection, withdraw consent, complain to a regulator)
7. Security measures (see `docs/SECURITY.md`) and breach notification
8. International transfers: [if any]
9. Changes to this policy (version `APP.policyVersion`, re-consent)
