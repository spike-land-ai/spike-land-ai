# Google Ads Performance Max Campaign — spike.land

Reference document for the first paid acquisition campaign. Created 2026-03-07.

## Campaign Settings

| Setting          | Value                                       |
| ---------------- | ------------------------------------------- |
| Campaign type    | Performance Max                             |
| Goal             | Website traffic (page views)                |
| Account          | hello@spike.land                     |
| Daily budget     | $50 (GBP equivalent ~£40)                  |
| Location         | United Kingdom                              |
| Language         | English                                     |
| Landing page     | https://spike.land                          |
| Bid strategy     | Maximize clicks (switch to Target CPA @30d) |
| Business name    | spike.land                                  |
| Phone            | 478-352-4878                                |
| Business category| Software / Developer Tools                  |
| Google Ads ID    | `AW-17978085462`                            |

---

## Search Themes (25)

### Core Product
1. AI development platform
2. AI tools for developers
3. AI agent builder
4. AI powered development tools
5. build AI apps

### MCP Protocol
6. MCP tools
7. model context protocol
8. MCP server
9. Claude MCP tools
10. AI tool registry

### Pain Points
11. AI API integration
12. connect AI tools
13. AI tool management
14. simplify AI development
15. no code AI tools

### Competitor/Alternative
16. LangChain alternative
17. AI middleware platform
18. AI orchestration tools
19. AI tool marketplace
20. developer AI assistant

### Use Cases
21. AI code generation tools
22. AI image generation API
23. browser automation AI
24. AI chess engine
25. AI workflow automation

---

## Ad Assets

### Headlines (15, max 30 chars)

```
80+ AI Tools. One Platform.
Build AI Apps Faster
MCP-First Dev Platform
AI Tools Without Plumbing
Free Tier. No Card Needed.
One Protocol. Zero Hassle.
From Idea to AI App Fast
AI Agent Tools Registry
Start Free. Scale to Pro.
Developer-First AI Tools
Connect AI in One Command
spike.land - Ship AI Fast
80+ Tools. One MCP Call.
AI Dev Platform. Free Tier.
Stop Writing Glue Code
```

### Long Headlines (5, max 90 chars)

```
80+ AI Tools Through One Protocol. Build AI Apps Without the Plumbing.
Stop Writing Custom Integrations. One MCP Connection, All the Tools.
Free AI Development Platform with 80+ Tools. No Credit Card Required.
From Image Generation to Code Execution. Everything Your Agent Needs.
AI-Native Dev Platform Running at the Edge. Sub-50ms Latency Worldwide.
```

### Descriptions (5, max 90 chars)

```
80+ production-ready AI tools via Model Context Protocol. Free tier included.
Image studio, code sandbox, QA automation, chess engine and more. One API.
Connect in one command. Claude, OpenAI, or any MCP client. Start free.
Edge-native platform on Cloudflare Workers. 300+ PoPs. Sub-50ms latency.
Free: 50 credits/day. Pro: $29/mo. Business: $99/mo with unlimited credits.
```

---

## Audience Signals

### Custom Segments (search-based)
- API integration tools
- AI developer tools
- LangChain
- Claude API
- OpenAI API
- MCP protocol
- AI agent framework

### Interest Categories
- Technology > Software > Developer Tools
- Technology > Software > Cloud Computing
- Technology > Software > Programming

### Demographics
- Ages 25-54
- No gender restriction
- Household income: top 50%

---

## Negative Keywords (add day 1)

```
free AI
AI course
AI tutorial
learn AI
ChatGPT
AI jobs
AI career
AI art generator free
```

---

## Conversion Tracking

### Implementation Status

| Event             | Priority | Status      | Implementation                           |
| ----------------- | -------- | ----------- | ---------------------------------------- |
| Page view         | Auto     | Done        | PMax auto-tracks; GA4 server-side active |
| Sign-up           | HIGH     | Code ready  | `trackSignUpConversion()` in callback    |
| CLI install page  | MEDIUM   | Pending     | Track /docs CLI page via `trackGoogleAdsEvent()` |
| Docs engagement   | LOW      | Pending     | Track /docs views via `trackGoogleAdsEvent()`    |

### Environment Variables Required

Google Ads ID `AW-17978085462` is hardcoded in `google-ads.ts`.

For sign-up conversion tracking, set the conversion label in your build env:

```
VITE_GOOGLE_ADS_CONVERSION_LABEL=XXXXXXXXXXX
```

Get this from: Google Ads > Tools > Conversions > New conversion action > Website.

### How It Works

1. `google-ads.ts` loads `gtag.js` dynamically — only when cookie consent is
   accepted
2. `__root.tsx` calls `initGoogleAds()` on mount
3. `callback.tsx` calls `trackSignUpConversion()` on successful sign-up
4. All tracking respects the existing cookie consent system (GDPR compliant)

### Files Modified

- `src/frontend/platform-frontend/core-logic/google-ads.ts` — new, gtag loader
- `src/frontend/platform-frontend/ui/routes/__root.tsx` — init on mount
- `src/frontend/platform-frontend/ui/routes/callback.tsx` — conversion on signup
- `src/frontend/platform-frontend/core-logic/privacy.tsx` — Google Ads disclosure
- `src/frontend/platform-frontend/ui/components/CookieConsent.tsx` — updated text
- `packages/spike-app/index.html` — dns-prefetch for googletagmanager.com

---

## Step-by-Step Setup in Google Ads

1. Sign in at ads.google.com with hello@spike.land
2. New Campaign > Performance Max
3. Goal: Website traffic
4. Business info: spike.land, 478-352-4878, Software / Developer Tools
5. Budget: $50/day
6. Bid strategy: Maximize clicks
7. Location: United Kingdom
8. Language: English
9. Asset group: "Developer AI Tools"
10. Final URL: https://spike.land
11. Paste all 15 headlines above
12. Paste all 5 long headlines above
13. Paste all 5 descriptions above
14. Upload images: logo, product screenshots, tool marketplace screenshots
15. Add all 25 search themes above
16. Add audience signals (custom segments + interests listed above)
17. **Before launching**: Go to Tools > Conversions > create a "Sign-up" conversion
    - Copy the Conversion ID → set as `VITE_GOOGLE_ADS_ID`
    - Copy the Conversion Label → set as `VITE_GOOGLE_ADS_CONVERSION_LABEL`
    - Rebuild and deploy spike-app
18. Review and Launch

---

## Success Metrics

### After 7 days
- CTR > 2%
- CPC < $2
- Check impression split across Search / Display / YouTube
- Review search terms report for relevance
- Check landing page bounce rate in Google Analytics

### After 30 days
- Cost per sign-up (if conversion tracking live)
- Which search themes drive the most traffic
- Geographic performance within UK
- Decision: scale, pivot, or add dedicated Search campaign

---

## Risks & Mitigations

| Risk                                        | Mitigation                                                |
| ------------------------------------------- | --------------------------------------------------------- |
| PMax wastes budget on Display/YouTube       | Monitor placement reports weekly; exclude low-quality      |
| No conversion tracking = no signal          | Sign-up tracking implemented; set env vars before launch   |
| UK-only limits volume                       | Expand to US/EU after proving UK ROI                       |
| Technical audience hard to reach via Display | Search themes heavily weighted; audience signals guide PMax |
| $50/day burns fast with broad targeting     | Aggressive negative keywords from day 1                    |

---

## Timeline

| Phase         | Days  | Budget  | Strategy                                              |
| ------------- | ----- | ------- | ----------------------------------------------------- |
| Learning      | 1-14  | $50/day | Maximize clicks, let Google AI optimize across surfaces |
| Optimize      | 15-30 | $50/day | Review search terms, add negatives, refine audiences   |
| Scale or pivot| 30+   | Adjust  | Switch to Target CPA if conversions tracked            |
