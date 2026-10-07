# Viral growth ideas (technically feasible)

Ranked by *viral pull ÷ build effort*. **Status** shows what already exists in the MVP. Effort: **S** = days, **M** = 1–3 weeks, **L** = a month+.
"Backend" = needs a server you don't have yet. Kids note: anything social/incentivised must stay **off for under-13 profiles** (already enforced for invites, sharing and analytics).

| # | Idea | Why it spreads | Effort | Backend | Status |
|---|---|---|---|---|---|
| 1 | **Daily Challenge** — everyone gets the same seed (same map, chests, rivals) each day | Gives people something to compare ("what did you get on today's?") and a reason to open the app daily | S | No (seed = date). Verified leaderboard needs one | ✅ built |
| 2 | **One-tap result share card** ("🏆 placed #1, 5 eliminations, 3:12 — beat me") | Every match ends in a post-ready brag; deep link drops the friend straight into the same Daily | S | No | ✅ built |
| 3 | **15-second clip button** → native share sheet (TikTok / Reels / Shorts ready) | Short-form video is the growth channel for this genre; one tap removes all friction | S–M | No | ✅ built (record + share; add watermark/branding next) |
| 4 | **Daily login streak** with escalating rewards | Habit loop; streak-saving is a classic sharing/return trigger | S | No (server clock prevents cheating later) | ✅ built |
| 5 | **Invite code → both get coins** | Direct incentive to bring a friend; code travels in the share link | S client / M proper | **Yes** to verify (client-only version is farmable) | ✅ UI + flow built (client stub) |
| 6 | **Deep links** (`pixelrealms://daily`, `…/seed/NAME`, invite links) | Every shared link opens the exact challenge/world | S | No (+ domain for universal links) | ✅ built |
| 7 | **Secret hunts / easter eggs** with a community "secret of the week" | Creators love "I found it first" content; costs little to add more | S | No | ✅ 6 secrets built |
| 8 | **Seed sharing / world codes** ("try my seed, it has a floating island") | Cheap UGC: players share short codes, no hosting needed | S | No | ✅ built (seed field + `seed/NAME` links) |
| 9 | **Ghost replay challenge** — race a friend's recorded run (positions per second) | Async multiplayer feel without realtime servers; "beat my ghost" is a perfect share hook | M | Small (store/serve replays) | — |
| 10 | **Creator codes** (support-a-creator at checkout, creator gets a share of revenue) | Turns every streamer/TikToker into a distribution partner; proven in major F2P games | M | **Yes** (attribution + payouts) | — |
| 11 | **Skin gifting** ("send this skin to a friend") | Gifts bring new users in and create social obligation to return | M | **Yes** (store gifting rules, accounts) | — |
| 12 | **Co-op duos / squads** in Storm Royale (join via link) | Games you play with friends retain far better and recruit friends | L | **Yes** (realtime: WebSocket/UDP, matchmaking) | — |
| 13 | **Limited-time seasonal events** (weekend storm modes, "TNT Tuesday") | Fresh content beats = repeatable marketing moments | S–M | Optional (remote config) | — |
| 14 | **Photo mode + postcards** (free camera, filters, branded frame) | Screenshots of builds are shareable even without winning | S | No | — |
| 15 | **Build-of-the-week gallery** (export a build as a share image + seed/coords) | UGC showcase; creators compete for the feature | M | Yes for gallery; no for share image | — |
| 16 | **Spectate the final circle** (watch the last 2 alive after you're out) | Keeps eliminated players engaged and creates highlight moments | M | No (bots) / Yes (real) | — |
| 17 | **Community goals** ("together we open 1M chests → everyone gets a skin") | Collective hype and a reason to share progress | S–M | **Yes** (global counter) | — |
| 18 | **Emote / skin "drops" tied to creators' birthdays or milestones** | Gives creators exclusive reveal content | S | Remote config | — |

## What I would do next (highest ROI)
1. **Watermarked clips** — burn the logo + `pixelrealms.app/CODE` into the exported video (canvas overlay while recording). Free brand impressions on every share. *(S)*
2. **Verified daily leaderboard + invite verification** — one tiny backend (Supabase/Firebase) covers both, plus cloud save and receipt validation. *(M)*
3. **Ghost replays** — biggest "compete with a friend" feature available without realtime netcode. *(M)*
4. **Creator codes** — start with 10–20 micro-creators; pair with the clip button so their videos have a ready-made call-to-action. *(M)*

## Guardrails
- Don't pay or reward under-13s for referrals; keep share features off for them (done).
- Rewards for invites need server verification or they will be farmed (fake accounts).
- Moderate any UGC names/codes shown to others (profanity filter + report button) before enabling galleries.
- Ads/UGC that feature minors need parental consent in many jurisdictions.
- Ad platforms review landing pages: the privacy policy and age rating must match what the app does (see `docs/PRIVACY.md`).
