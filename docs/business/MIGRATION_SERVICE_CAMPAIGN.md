# Google Ads Performance Max Campaign — Next.js Migration Service

Reference document for the migration service paid acquisition campaign. Created 2026-03-10.

## Campaign Settings

| Setting           | Value                                        |
| ----------------- | -------------------------------------------- |
| Campaign type     | Performance Max                              |
| Goal              | Conversions (purchases)                      |
| Account           | hello@spike.land                      |
| Google Ads ID     | `AW-17978085462`                             |
| Daily budget      | $30 (GBP equivalent ~£24)                   |
| Location          | United Kingdom + United States + EU (DE, NL, FR) |
| Language          | English                                      |
| Landing page      | https://spike.land/migrate                   |
| Bid strategy      | Maximize conversions (switch to Target CPA @30d) |
| Business name     | spike.land                                   |
| Business category | Software / Developer Tools                   |

---

## Ad Assets

### Headlines (15, max 30 chars each)

Pain-point-first. Every headline targets a real frustration or a concrete number from the blog post.

```
40 Min Builds → 4 Seconds
Your $75 Vercel Bill → $0
Next.js Migration Done Right
Escape Slow Next.js Builds
Cut Your Build Time by 90%
We Migrate Next.js for You
No More $74/mo Build Waste
From Next.js to Vite Fast
Done-For-You Framework Move
Ship Faster. Pay Less.
Next.js to TanStack Done
Migrate Without Breaking Prod
4-Second Deploys. Guaranteed.
Stop Paying for Slow Builds
Migration Blog — $420
```

### Long Headlines (5, max 90 chars each)

Conversion-focused. Lead with the number, end with the outcome.

```
Stop Paying $74/month in Build Minutes — Migrate Your Next.js App Today
Your Next.js App Takes 40 Minutes to Build. We'll Fix That in One Week.
From 40-Minute Builds to 4-Second Deploys. Proven Next.js Migration Path.
Three Tiers: $420 Blog, £1k Script, $10k MCP Server. Pick Your Level.
We've Migrated Next.js to TanStack + Vite. Read the 8,700-Word Breakdown.
```

### Descriptions (5, max 90 chars each)

One idea per description. Focus on tier clarity and outcome confidence.

```
$420 migration blog: every step documented. £1k script: automate the move.
Done-for-you at $10k: MCP server opens a PR on your repo automatically.
Real numbers: $75.40 Vercel bill → $0. 40-min builds → 4 seconds.
TanStack Router + Vite replaces Next.js. Faster builds, cheaper hosting.
One blog post, one script, or full-service. All paths lead to faster CI.
```

---

## Search Themes (15)

### Build Speed Pain
1. next.js slow builds
2. vercel build minutes cost
3. reduce next.js build time
4. next.js to vite migration

### Cost Pain
5. vercel expensive alternative
6. reduce vercel bill
7. vercel pricing too high
8. next.js hosting cost

### Migration Intent
9. next.js migration guide
10. migrate next.js to tanstack
11. next.js migration service
12. framework migration tool

### Discovery / Alternatives
13. tanstack start tutorial
14. tanstack router vs next.js
15. next.js alternative 2025

---

## Negative Keywords (10)

Block searchers who want to learn or use Next.js, not leave it.

```
next.js tutorial
next.js beginner
learn next.js
next.js course
next.js hosting
deploy next.js
next.js free hosting
next.js documentation
how to use next.js
next.js for beginners
```

---

## Audience Signals

### Custom Segments (people who searched for or visited)
- Visited: nextjs.org/docs
- Visited: vercel.com/pricing
- Visited: tanstack.com
- Searched: "vercel too expensive"
- Searched: "next.js migration"
- Searched: "next.js slow build times"

### In-Market Segments
- Web development services
- Software consulting
- Developer tools and platforms

### Demographics
- Ages: 25-45
- Income: top 40% (HHI)
- No gender restriction
- Interests: software development, cloud computing, programming

---

## Conversion Actions

Set all five in Google Ads > Tools > Conversions before launch.

| Conversion Action           | Priority  | Value   | Notes                                      |
| --------------------------- | --------- | ------- | ------------------------------------------ |
| `migration_blog_checkout`   | Primary   | $420    | Purchase of $420 blog / guide tier         |
| `migration_script_checkout` | Primary   | £1,000  | Purchase of £1k automation script tier     |
| `migration_mcp_checkout`    | Primary   | $10,000 | Purchase of $10k MCP server service tier   |
| `migration_page_view`       | Secondary | —       | Visited /migrate (top-of-funnel signal)    |
| `migration_interest`        | Secondary | —       | Scrolled >60% of /migrate page             |

### Implementation Notes

- Reuse the `trackGoogleAdsEvent()` helper from `src/frontend/platform-frontend/core-logic/google-ads.ts`
- Fire `migration_blog_checkout` on the purchase success page for the $420 tier
- Fire `migration_script_checkout` on the purchase success page for the £1k tier
- Fire `migration_mcp_checkout` on the purchase success page for the $10k tier
- Fire `migration_page_view` on first load of `/migrate`
- Fire `migration_interest` via scroll-depth listener at 60%

---

## Budget Recommendation

| Phase          | Days   | Budget   | Rationale                                         |
| -------------- | ------ | -------- | ------------------------------------------------- |
| Learning       | 1-14   | $30/day  | Let Google AI find buyers; conversion data sparse |
| Optimize       | 15-30  | $30/day  | Add negatives, prune weak placements              |
| Scale          | 30+    | Increase | If CPA < $40, scale toward $60-80/day             |

Lower than the main campaign because:
- The offer is narrower (migration service, not platform)
- Conversion values are high ($29-$999), so Target CPA can be loose
- Volume needed is low — even 3 sales/month at $999 = positive ROI

---

## Step-by-Step Setup in Google Ads

1. Sign in at ads.google.com with hello@spike.land
2. New Campaign > Performance Max
3. Goal: Conversions (select all five conversion actions above)
4. Business info: spike.land, Software / Developer Tools
5. Budget: $30/day
6. Bid strategy: Maximize conversions
7. Location: United Kingdom + United States + Germany + Netherlands + France
8. Language: English
9. Asset group: "Next.js Migration Service"
10. Final URL: https://spike.land/migrate
11. Paste all 15 headlines above
12. Paste all 5 long headlines above
13. Paste all 5 descriptions above
14. Upload images: before/after build time screenshots, Vercel bill screenshot, migration diagram
15. Add all 15 search themes above
16. Add audience signals (custom segments + in-market + demographics listed above)
17. Add all 10 negative keywords from day 1
18. Verify all five conversion actions are live and firing in Tag Assistant
19. Review and launch

---

## A/B Tests to Run at Launch

### Subject line equivalents — headline variants to test after 7 days

| Slot | Variant A (current)              | Variant B (to test)              |
| ---- | -------------------------------- | -------------------------------- |
| 1    | 40 Min Builds → 4 Seconds        | From 40 Minutes to 4 Seconds     |
| 2    | Your $75 Vercel Bill → $0        | $75 Vercel Bill → $0             |
| 3    | Migration Blog — $420            | 8-Project Migration Blog — $420  |

Google Ads rotates headlines automatically. Pull the asset performance report at day 14 to see which phrasing wins.

---

## Success Metrics

### After 7 days
- CTR > 3% (higher bar than platform campaign — intent is sharper)
- CPC < $3
- At least 1 conversion tracked (even a page view secondary counts)
- Review search terms report: confirm migration-intent queries, not tutorial queries

### After 30 days
- Cost per purchase (primary conversions)
- Revenue per conversion action ($29 / $199 / $999 split)
- Geographic breakdown: which country converts at lowest CPA
- Impression share on top search themes
- Decision: scale, add dedicated Search campaign, or pause Display placements

---

## Risks and Mitigations

| Risk                                              | Mitigation                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| PMax serves Display ads to wrong audience         | Strong audience signals + aggressive negatives from day 1            |
| Tutorial searchers click and bounce               | 10 negative keywords block non-intent traffic immediately            |
| Low volume — niche offer                          | Broad geo (UK + US + EU) compensates for narrow audience             |
| $999 tier rarely converts via cold ads            | Secondary conversions (page view, interest) build remarketing pool   |
| No /migrate landing page at launch                | Block campaign launch until page is live; do not burn budget on 404  |
| Conversion tracking not firing                    | Test all five conversion actions in Tag Assistant before launching    |

---

## Landing Page Requirements

Before this campaign goes live, `/migrate` needs:

- Hero: "40-Minute Builds to 4 Seconds. We Migrated. You Can Too."
- Three-tier pricing table ($420 / £1k / $10k) above the fold
- The $75.40 Vercel bill screenshot as social proof
- A short before/after: Next.js build times vs Vite/TanStack build times
- CTA buttons that fire the correct conversion actions on click-through to checkout
- Scroll-depth listener at 60% to fire `migration_interest`

---

## Related Files

- `src/frontend/platform-frontend/core-logic/google-ads.ts` — gtag loader and event helpers
- `src/frontend/platform-frontend/ui/routes/__root.tsx` — Google Ads init on mount
- `docs/business/GOOGLE_ADS_PMAX_CAMPAIGN.md` — parent platform campaign for reference
