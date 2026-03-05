# Subscriptions & Costs

> **Company**: SPIKE LAND LTD (UK #16906682) **Last Updated**: February 2026
> **Currency**: GBP (£) unless stated otherwise

---

## Executive Summary

| Category                   | Monthly Est. |       Annual Est. |
| -------------------------- | -----------: | ----------------: |
| Core Infrastructure        |     £220-470 |      £2,640-5,640 |
| AI & Developer Tools       |     £200-350 |      £2,400-4,200 |
| Payments & Email           |     Variable |          Variable |
| Cache & Storage            |         £0-8 |             £0-96 |
| Annual Fixed Costs         |           -- |              £110 |
| **Total (excl. variable)** | **£420-828** | **£5,150-10,046** |

Variable costs (Stripe fees, AI API usage, ad spend) scale with revenue and are
excluded from the fixed total.

---

## Core Infrastructure

### 1. Cloudflare (Workers, R2, KV, Durable Objects)

| Field                    | Detail                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cost**                 | $5/mo (~£4/mo) Workers Paid plan                                                                                                                                                      |
| **What We Use**          | Workers (backend API, transpiler at `js.spike.land`), Durable Objects (real-time collaboration, WebSockets at `testing.spike.land`), R2 (image/file storage, zero egress), KV (cache) |
| **Why This Provider**    | Edge-first runtime, zero-egress R2, Durable Objects for stateful WebSocket sessions, generous free tier                                                                               |
| **Cheaper Alternatives** | AWS Lambda@Edge (more expensive, no Durable Objects equivalent), Fly.io (no built-in KV/R2)                                                                                           |

### 2. Cloudflare D1 (Serverless SQLite)

| Field                    | Detail                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Cost**                 | $0/mo (included in Workers plan, free tier generous)                                                            |
| **What We Use**          | Primary database (Drizzle ORM), serverless SQLite at the edge, automatic replication                            |
| **Why This Provider**    | Zero-latency D1 binding from Workers, no connection pooling needed, free tier, automatic read replicas          |
| **Cheaper Alternatives** | None cheaper — D1 is included in the Workers plan                                                               |

### 4. GitHub (Repository + Actions CI/CD)

| Field                    | Detail                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Cost**                 | $0/mo (free for public repos) or $4/user/mo for private                                                 |
| **What We Use**          | Source control, GitHub Actions CI/CD, Issues/Projects for task management, PR checks, branch protection |
| **Why This Provider**    | Industry standard, tight integration with Vercel/Depot/Sentry, free Actions minutes for public repos    |
| **Cheaper Alternatives** | GitLab (similar pricing, self-hostable), Gitea (free, self-hosted)                                      |

---

## AI & Developer Tools

### 5. Claude Max 20x (Anthropic)

| Field                    | Detail                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Cost**                 | ~~$200/mo (~~£160/mo)                                                                                                             |
| **What We Use**          | Claude Code CLI (development agent), Claude Agent SDK (user-facing AI features), OAuth token for API access                       |
| **Why This Provider**    | Best coding performance, Claude Code integration, OAuth token gives ~£3,000/mo equivalent API value at ~£160/mo cost              |
| **Cheaper Alternatives** | Claude Pro ($20/mo, much lower limits), direct API pay-as-you-go (more expensive at our volume), OpenAI API (different strengths) |

**Note**: Uses `CLAUDE_CODE_OAUTH_TOKEN` with Bearer auth +
`anthropic-beta: oauth-2025-04-20` header. DB-stored token (AIProvider table)
takes precedence via `resolveAIProviderConfig("anthropic")`. See MEMORY.md for
header format.

### 6. Google Gemini API (+ Imagen)

| Field                    | Detail                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **Cost**                 | Variable, pay-as-you-go (free tier available)                                                   |
| **What We Use**          | Gemini for image analysis, Imagen for image enhancement/generation (`GEMINI_API_KEY`)           |
| **Why This Provider**    | Strong multimodal capabilities, generous free tier, Imagen image generation                     |
| **Cheaper Alternatives** | Replicate (pay-per-run models), local Stable Diffusion (requires GPU), DALL-E (similar pricing) |

### 7. Sentry (Error Tracking)

| Field                    | Detail                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Cost**                 | ~~$29/mo (~~£23/mo) Team plan                                                                                        |
| **What We Use**          | Error tracking, performance monitoring, source map uploads, session replay, MCP integration for debugging            |
| **Why This Provider**    | Best-in-class error grouping, source map support, session replay, MCP server for agent debugging                     |
| **Cheaper Alternatives** | Highlight.io (open-source, free tier), LogRocket ($99/mo but more features), self-hosted Sentry (free, ops overhead) |

### 8. Depot (Remote Docker Builds)

| Field                    | Detail                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Cost**                 | $20-200/mo (~£16-160/mo) depending on usage                                                                  |
| **What We Use**          | Fast remote Docker builds with caching (`yarn depot:ci`), parallelism, preferred over local CI               |
| **Why This Provider**    | 10-20x faster than GitHub Actions native builds, persistent layer caching, simple GitHub Actions integration |
| **Cheaper Alternatives** | GitHub Actions cache (free but slower), BuildJet ($7/mo, less caching), local Docker builds (free, slow)     |

### 9. Codecov (Coverage Reporting)

| Field                    | Detail                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| **Cost**                 | $0/mo (free for open-source / small teams)                               |
| **What We Use**          | Coverage reporting in PRs, coverage trend tracking                       |
| **Why This Provider**    | Free tier sufficient, good GitHub integration                            |
| **Cheaper Alternatives** | Coveralls (also free tier), built-in Vitest coverage (no PR integration) |

---

## Payments & Email

### 10. Stripe (Payment Processing)

| Field                    | Detail                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Cost**                 | 1.5% + 20p per UK card transaction (2.5% + 20p for EU cards)                                                        |
| **What We Use**          | Token purchases (£2.99-£69.99 packages), subscription billing, webhooks, Stripe checkout                            |
| **Why This Provider**    | Best developer experience, comprehensive API, strong fraud protection, UK-optimised pricing                         |
| **Cheaper Alternatives** | Paddle (handles VAT but higher fees), LemonSqueezy (simpler, higher fees), GoCardless (BACS Direct Debit, 1% + 20p) |

### 11. Resend (Transactional Email)

| Field                    | Detail                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Cost**                 | $0/mo (free tier: 3,000 emails/mo)                                                                                      |
| **What We Use**          | Welcome emails, purchase confirmations, transactional notifications (`RESEND_API_KEY`, `EMAIL_FROM=noreply@spike.land`) |
| **Why This Provider**    | Excellent developer API, React email templates, generous free tier                                                      |
| **Cheaper Alternatives** | Loops (free tier), Postmark (similar pricing), AWS SES ($0.10/1000 emails)                                              |

---

## Cache & Storage

### 12. Upstash Redis (Serverless Redis)

| Field                    | Detail                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Cost**                 | $0-10/mo (~£0-8/mo)                                                                                                   |
| **What We Use**          | Rate limiting, session caching, agent job queue (`AGENT_USE_QUEUE`), general caching                                  |
| **Why This Provider**    | Serverless (pay-per-request), works at edge, simple REST API, generous free tier                                      |
| **Cheaper Alternatives** | Vercel KV (built on Upstash, similar pricing), self-hosted Redis on VPS (~£5/mo), Dragonfly (compatible, self-hosted) |

### 13. Cloudflare R2 (Object Storage)

| Field                    | Detail                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Cost**                 | Included in Cloudflare Workers plan (#1); $0.015/GB/mo for storage, zero egress                           |
| **What We Use**          | User-uploaded images, file storage (`spike-land-images` bucket), CDN delivery                             |
| **Why This Provider**    | Zero egress fees (major cost savings), S3-compatible API, integrated with Workers                         |
| **Cheaper Alternatives** | Backblaze B2 ($0.006/GB, but has egress fees), Wasabi ($0.0069/GB, no egress), S3 (more expensive egress) |

---

## Annual Fixed Costs

### 14. Apple Developer Program

| Field                    | Detail                                                                        |
| ------------------------ | ----------------------------------------------------------------------------- |
| **Cost**                 | $99/year (~£79/year)                                                          |
| **What We Use**          | Sign in with Apple OAuth provider (`AUTH_APPLE_ID`), required for Apple login |
| **Why This Provider**    | Required by Apple for Sign in with Apple; no alternative                      |
| **Cheaper Alternatives** | None (Apple mandate)                                                          |

### 15. spike.land Domain

| Field                    | Detail                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| **Cost**                 | ~~$40/year (~~£32/year) for `.land` TLD                           |
| **What We Use**          | Primary domain for the platform                                   |
| **Why This Provider**    | Brand identity; `.land` is a memorable TLD                        |
| **Cheaper Alternatives** | `.com` or `.io` (similar price), `.uk` (~£5/year, less brand fit) |

---

## Marketing & Social APIs (OAuth-Based, No Subscription Fee)

These integrations use OAuth and have no monthly subscription cost. Costs come
from ad spend, not API access.

| Platform               | Env Variables                                                             | Used For                                        |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| **Facebook/Instagram** | `FACEBOOK_SOCIAL_APP_ID`, `FACEBOOK_MARKETING_APP_ID`, `AUTH_FACEBOOK_ID` | Social posting, marketing analytics, user login |
| **Twitter/X**          | `TWITTER_CLIENT_ID`                                                       | Social posting                                  |
| **LinkedIn**           | `LINKEDIN_CLIENT_ID`                                                      | Social posting                                  |
| **YouTube**            | Shares `GOOGLE_ID` credentials                                            | Social posting                                  |
| **Discord**            | `DISCORD_BOT_TOKEN`                                                       | Announcement posting                            |
| **Google Ads**         | `GOOGLE_ADS_DEVELOPER_TOKEN`                                              | Ad budget management (Allocator)                |
| **Meta Pixel**         | `NEXT_PUBLIC_META_PIXEL_ID`                                               | Website conversion tracking                     |

---

## CLI Access (spike-cli)

All 455+ MCP tools available through the web dashboard are also accessible
programmatically via **spike-cli** (`@spike-land-ai/spike-cli`, bin: `spike`).
spike-cli is an MCP multiplexer that aggregates multiple MCP servers into one
unified CLI/REPL interface, giving developers and AI agents the same
capabilities as the web dashboard without a browser. No additional subscription
cost -- spike-cli uses the same API credentials and rate limits as the web
platform.

---

## Other Integrations (No Direct Cost)

| Service               | Detail                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **Vercel Sandbox**    | Agent execution in isolated VMs. Included in Vercel Pro plan.                                  |
| **Cloudflare Images** | Image transformation CDN (`CLOUDFLARE_IMAGES_API_KEY`). Usage-based, included in Workers plan. |

---

## Cost Summary Table

| #  | Service                       |      Monthly |      Annual | Type     |
| -- | ----------------------------- | -----------: | ----------: | -------- |
| 1  | Cloudflare (Workers/R2/KV/DO) |           £4 |         £48 | Fixed    |
| 2  | Vercel Pro                    |          £16 |        £192 | Fixed    |
| 3  | Cloudflare D1                 |           £0 |          £0 | Included |
| 4  | GitHub                        |           £0 |          £0 | Free     |
| 5  | Claude Max 20x                |         £160 |      £1,920 | Fixed    |
| 6  | Google Gemini API             |     Variable |    Variable | Usage    |
| 7  | Sentry Team                   |          £23 |        £276 | Fixed    |
| 8  | Depot                         |      £16-160 |  £192-1,920 | Usage    |
| 9  | Codecov                       |           £0 |          £0 | Free     |
| 10 | Stripe                        | ~1.5%+20p/tx |    Variable | Variable |
| 11 | Resend                        |           £0 |          £0 | Free     |
| 12 | Upstash Redis                 |         £0-8 |       £0-96 | Usage    |
| 13 | Cloudflare R2                 |  Incl. in #1 | Incl. in #1 | Included |
| 14 | Apple Developer               |           -- |         £79 | Annual   |
| 15 | spike.land domain             |           -- |         £32 | Annual   |
|    | **Fixed Total**               |     **£203** |  **£2,436** |          |
|    | **With usage (mid-range)**    |    **~£450** | **~£5,400** |          |

---

## Optimization Recommendations

1. **Claude Max is the best value** - At ~£160/mo it provides ~£3,000/mo of
   equivalent API usage. Do not switch to pay-as-you-go API keys.

2. **Depot usage** - Monitor build minutes. If consistently under 200 min/mo,
   the $20 tier suffices. Consider caching Docker layers aggressively to reduce
   build time.

3. **D1 free tier** - Database is included in the Cloudflare Workers plan at no
   additional cost.

4. **Sentry** - Evaluate whether the free tier (5K errors/mo) is sufficient
   before committing to Team plan. Session Replay is the main driver of the paid
   tier.

5. **Consolidate Google credentials** - YouTube, Google Ads, and Google Login
   all share the same OAuth client (`GOOGLE_ID`/`GOOGLE_SECRET`). No duplicate
   costs here.

6. **R2 over S3** - Already using Cloudflare R2 with zero egress fees. This
   saves significant cost compared to AWS S3 at scale.

7. **Free tiers to monitor** - Resend (3K emails/mo), Codecov, Upstash (10K
   requests/day). Set alerts before hitting paid thresholds.

---

## Related Documentation

| Document                                                           | Description                                  |
| ------------------------------------------------------------------ | -------------------------------------------- |
| [BUSINESS_STRUCTURE.md](./BUSINESS_STRUCTURE.md)                   | Company formation, tax structure, compliance |
| [../../.env.example](../../.env.example)                           | All environment variables and provider setup |
