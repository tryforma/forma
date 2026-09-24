# Nibble — Apple Search Ads launch plan — LIVE Sep 16 2026, campaign ID 2144691217 ($100 promo credit; Ray, Sep 16 2026: "start running apple ads for whatever is already out")

Account: Apple Ads "Macra_ads" (id 23872540). The $100 credit was earmarked for Landed (Sep 3) then Lapis
(Sep 9); on Sep 16 Ray redirected it to whatever is live, and only Nibble is live (1.7, READY_FOR_SALE).
App: Nibble: AI Calorie Tracker (ASC 6755325879) · subtitle "Photo Food Log: Macros & Diet".
Why these keywords: the generic head terms (calorie counter, calorie tracker) clear at $3–5 CPT against
MyFitnessPal/Lose It/Cal AI and would burn $100 on ~25 taps. Nibble's edge is photo/AI logging, so the
money goes to AI-photo intent first, macro/protein intent second, and a capped competitor-overflow group.

## Campaign
- Name: `Nibble - US - Search - Exact`
- Placement: Search results · Country: United States · Search Match: OFF
- Budget: **$100 lifetime cap** (hard; never past the credit) · Daily cap: $12
- Devices: iPhone only · Age: 18+ · Gender: all · Customer type: new users
- Creative: default App Store product page (screenshots lead with snap → logged plate).

## Ad group 1 — `Exact - AI photo intent`  (max CPT $2.00)
ai calorie tracker · ai calorie counter · photo calorie counter · calorie counter camera ·
food scanner calories · calorie scanner · snap calorie counter · picture calorie counter ·
ai food tracker · ai macro tracker · calorie ai · food photo calories · scan food calories ·
calorie photo app · take picture of food calories

## Ad group 2 — `Exact - macro / protein`  (max CPT $1.50)
macro tracker · macro counter · protein tracker · track macros · macros app · protein counter ·
macro tracking app · protein intake tracker · carb tracker · cico app

## Ad group 3 — `Exact - competitor overflow (capped)`  (max CPT $1.50)
cal ai · calai · snap calorie · foodvisor · macrofactor · calorie counter ai

## Negative keywords (campaign level)
game, games, recipe, recipes, near me, jobs, pet, dog, cat, baby, formula, coupon, delivery,
restaurant, menu, printable, chart, pdf, calculator only

## Kill / scale rules (check daily)
- Pause any keyword with > $8 spend and 0 installs.
- If a keyword gets ≥ 2 installs under $4 each, raise its CPT 20%.
- At $100 spent: report installs, CPI, trial starts (RevenueCat), which ad group won.
- The credit is gone after this; a Lapis campaign later needs new money or Ray's say-so.

## Status (Sep 16 2026)
- Campaign 2144691217 "Nibble - US - Search - Exact" RUNNING in account Macra_ads 23872540.
- Apple Ads no longer offers a lifetime budget, so the cap is the END DATE: Sep 16 → Sep 24 2026 12:00 AM PT, 8 days × $10/day = $80 nominal (kept under the $100 credit on purpose).
- All three ad groups Running, Search Match OFF, iPhone only, new users, age 18–65+, default product page:
  AI photo intent (15 exact kws @ $2.00) · macro / protein (10 @ $1.50) · competitor overflow (6 @ $1.50). 18 campaign negatives.
- Pre-existing "Macra - US - Search - Exact" campaign in the same account stays PAUSED.
## Result (checked Sep 23 2026, day 7 of 8)
- **Zero delivery for the entire run:** $0.00 spend, 0 impressions, 0 taps, 0 installs across all 3 ad groups and all 31 keywords (Last 30 days). The credit is effectively unspent.
- Everything inside the campaign checks out: campaign "Running (ends in 1 day)", all ad groups Running, every keyword Running, the Default Ad "Active", Search Match off as intended, Nibble 1.7 live on the US storefront (12+, Health & Fitness), no delivery warning in Recommendations or Notifications (the 225 notifications are all keyword suggestions).
- So the block is at the account level, which the automation is not allowed to open: most likely the $100 promo credit was never redeemed / no payment method on file, or the advertiser account is still pending verification. Ray checks Account Settings → Payment/Billing himself.
- Daily pass could not run Sep 17–22 (Apple Ads session expired; sign-in is Ray's). It would not have mattered — nothing served.
- Next: once billing/verification is fixed, push the end date out (or duplicate the campaign) — the keyword build is sound and does not need redoing.
## Correction + relaunch (Sep 23 2026)
The "account-level billing block" theory from earlier today was **wrong**. Verified in Account Settings:
- Business Details complete and error-free: RZ International LLC, Tax ID on file, 1322 Miette Way, Sunnyvale CA 94087, US.
- Billing → Payment Card: card ••••6458 on file, billing address set, promo credit entry dated September 2, 2026.
- No warning or hold anywhere in the console.

So the account can pay. The remaining explanation for 0 impressions is that the ads never won (or never entered)
an auction: exact-match only, Search Match off, and $1.50–$2.00 bids in a category where calorie-tracker CPTs
run $3–5. Most keywords also showed 1-of-5 popularity.

Changes made Sep 23 (all reversible, daily budget still $10):
- Campaign end date Sep 24 → **Oct 15 2026** (22 days left) so the run isn't dead before it can be tested.
- Ad group "Exact - AI photo intent": default Max CPT Bid $2.00 → **$3.00** (the plan's own cap) and
  **Search Match ON**. Ad groups 2 and 3 left exact-only at $1.50 as the control.
- Everything else unchanged: iPhone only, new users, 18–65+, US, Search Results, 18 campaign negatives.

This is also the decisive test. If Search Match at $3.00 still returns 0 impressions after 24–48 h, the cause is
app/account eligibility, not bidding, and it becomes a question for Apple Ads support rather than a settings fix.
## Sep 24 2026 — every in-console lever is now exhausted
Checked ~18 h after the Sep 23 changes: **still $0.00 / 0 impressions** on all three ad groups, with
Search Match confirmed ON and the $3.00 default bid live on "Exact - AI photo intent".

Also verified today (so these can be ruled out for good):
- Each of the three ad groups has a **Default Ad, status Active** (creative source = default product page).
  A missing ad was the last plausible in-campaign defect; it is not the problem.
- Campaign Running to Oct 15, all ad groups Running, all 31 keywords Running.

Final optimisation applied Sep 24: ad group "Exact - AI photo intent" audience switched from
**Choose Specific Audiences → Reach All Eligible Users**. The narrowing filters (iPhone only, new users,
age 18–65+) were stacking multiplicatively on a campaign that had never served; an age range in particular
excludes every user Apple cannot age-verify. Ad groups 2 and 3 keep the narrow targeting as controls.

Current state of ad group 1: Search Match ON, default Max CPT $3.00, Reach All Eligible Users, keyword-level
bids still $2.00 (they override the default for those exact terms; the $3.00 applies to Search Match traffic).

**If this still shows 0 impressions by Sep 25–26, stop tuning.** Nothing inside the console is left to change.
The remaining explanations are app/account ad eligibility, and the next step is Apple Ads support via
Contact Us in the console, quoting campaign 2144691217 and "zero impressions since Sep 16 with Search Match on
and a $3.00 bid".

