# AWS 1:1 Meeting Prep - Lennon Hobson

> **Date**: Thursday 20 February 2026, 12:00 noon (30 min) **With**: Lennon
> Hobson, AWS Account Manager **Format**: Video call (check calendar for link)
> **Goal**: Introduce what we're building, explore AWS support options

---

## Elevator Pitch (30 seconds)

**SPIKE LAND LTD** (UK Company #16906682, incorporated Dec 2025) is a managed
deployment platform where developers vibe-code full-stack apps and deploy
instantly, powered by an AI assistant with 455+ MCP tools accessible via CLI,
web chat, WhatsApp, and Telegram.

- **Next.js 16 web platform** with ~557 routes, 233 Prisma models, 19
  first-party apps
- **Cloudflare Workers** for real-time code editor + transpiler
- **Migrating production to AWS** -- ECS Fargate, Aurora PostgreSQL, ElastiCache
  Redis
- **Solo founder** (Zoltan Erdos), revenue-generating, Stripe payments live

---

## Current AWS Usage

We have significant Terraform IaC already built. Here's what's configured:

| Service                  | What We're Using It For                                   | Status                   |
| ------------------------ | --------------------------------------------------------- | ------------------------ |
| **ECS Fargate**          | 3 containerized services (Next.js, Workerd, Hono MCP API) | Configured, not yet live |
| **Aurora PostgreSQL 16** | Global Database (us-east-1 primary + eu-west-1 secondary) | Configured               |
| **ElastiCache Redis 7**  | Global Datastore, session cache, rate limiting            | Configured               |
| **CloudFront**           | CDN with S3 static assets + ALB origin                    | Configured               |
| **Global Accelerator**   | Anycast routing to multi-region NLBs (WebSocket traffic)  | Configured               |
| **ECR**                  | 3 container repos (nextjs, workerd, hono-api)             | Active                   |
| **S3**                   | Terraform state, static assets                            | Active                   |
| **IAM/OIDC**             | GitHub Actions authentication (no long-lived keys)        | Active                   |
| **Lambda + EventBridge** | 11 cron jobs (scheduled posts, metrics, cleanup)          | Configured               |
| **SSM Parameter Store**  | Secrets for ECS tasks                                     | Configured               |

### Terraform Structure (7 modules, 3 environments)

```
infra/terraform/
├── environments/
│   ├── production/       # Multi-region (us-east-1 + eu-west-1)
│   ├── production-v1/    # Single-region with ECR, SSM, Cron
│   └── staging/          # Cost-optimized us-east-1
└── modules/
    ├── ecs/              # Fargate services
    ├── aurora/           # PostgreSQL Global Database
    ├── elasticache/      # Redis Global Datastore
    ├── cloudfront/       # CDN + S3
    ├── global-accelerator/
    ├── vpc/              # VPC, NAT, endpoints
    └── github-oidc/      # CI/CD auth
```

---

## Migration Status

### Done (~80% of IaC)

- Docker multi-stage builds (Next.js, Workerd, Hono API)
- Terraform modules for all core services
- CI/CD pipelines (GitHub Actions + Depot remote builds)
- OIDC federation (no long-lived AWS keys)
- ECS cluster definitions with auto-scaling (FARGATE_SPOT 75%)
- Aurora Global Database config (2 regions)
- ElastiCache Global Datastore config
- Rollback mechanism (ECS task definition versioning)
- VPC with 3 AZ, NAT gateways, VPC endpoints (ECR, S3, DynamoDB, CloudWatch)

### Blocked / In Progress

- Deploy success rate needs validation (smoke tests defined but untested
  end-to-end)
- ECR cross-region replication not formally configured in Terraform
- WAF not yet enabled (placeholder in CloudFront module)
- DNS cutover from Vercel/Cloudflare to Route 53 not started

### Not Started

- Route 53 DNS management
- CloudWatch alarms and dashboards
- X-Ray distributed tracing
- Secrets Manager (currently using SSM Parameter Store)
- Container Insights
- Cost Explorer budgets/alerts

---

## Architecture: Current vs Target

### Current Production (Active)

```
Users --> Vercel (Next.js SSR)
      --> Cloudflare Workers (code editor, transpiler, backend)
      --> Neon PostgreSQL (serverless)
      --> Upstash Redis (HTTP-based)
      --> Stripe (payments)
      --> Google Gemini + Claude API (AI)
```

### Target Production (AWS)

```
Users --> CloudFront (CDN, static assets from S3)
      --> Global Accelerator (anycast, WebSocket traffic)
          ├── us-east-1
          │   ├── ALB --> ECS Fargate (Next.js, 1 vCPU / 2 GB)
          │   ├── NLB --> ECS Fargate (Workerd, 0.25 vCPU / 512 MB)
          │   ├── Aurora PostgreSQL (primary, 2x db.r6g.large)
          │   └── ElastiCache Redis (primary, cache.r6g.large)
          └── eu-west-1
              ├── ALB --> ECS Fargate (Next.js)
              ├── NLB --> ECS Fargate (Workerd)
              ├── Aurora PostgreSQL (read replica)
              └── ElastiCache Redis (read replica)
```

---

## Cost Analysis

### Current Monthly Spend

| Service                 | Cost/mo       | Notes                                       |
| ----------------------- | ------------- | ------------------------------------------- |
| Vercel Pro              | ~$20          | Next.js hosting                             |
| Cloudflare Workers      | ~$5-25        | Paid plan                                   |
| Neon PostgreSQL         | ~$19-69       | Pro plan                                    |
| Upstash Redis           | ~$10-30       | Pay-as-you-go                               |
| Claude Max subscription | ~$180         | AI (CEO decision: OAuth token, not API key) |
| Stripe fees             | 2.9% + 30p    | Per transaction                             |
| Depot                   | ~$20          | Remote Docker builds                        |
| **Total**               | **~$275-365** |                                             |

### Projected AWS Monthly Spend

| Service                          | Estimate/mo  | Notes                                    |
| -------------------------------- | ------------ | ---------------------------------------- |
| ECS Fargate (6 tasks, 75% Spot)  | $80-150      | 2 services x 2 regions, min 2 tasks each |
| Aurora PostgreSQL (2 regions)    | $150-300     | db.r6g.large x 3 instances + storage     |
| ElastiCache Redis (2 regions)    | $80-150      | cache.r6g.large x 3 nodes                |
| CloudFront                       | $10-30       | Price class 100 (US/Canada/Europe)       |
| Global Accelerator               | $18+         | Fixed hourly + data transfer             |
| NAT Gateways (6 AZs x 2 regions) | $60-120      | $0.045/hr each + data processing         |
| ALB + NLB (2 regions)            | $30-60       | Fixed hourly + LCU                       |
| S3 + ECR                         | $5-15        | Minimal storage                          |
| Lambda (cron)                    | <$1          | 11 lightweight crons                     |
| **Total**                        | **$430-830** | Before any credits                       |

### Key Insight for Discussion

AWS is more expensive than current serverless stack, but provides:

- Multi-region redundancy (us-east-1 + eu-west-1)
- No vendor lock-in (standard containers)
- Better observability (CloudWatch, X-Ray)
- Enterprise-grade database (Aurora Global)
- WebSocket-native architecture (NLB + Global Accelerator)

**Startup credits would significantly change the ROI equation.**

---

## What We Want From AWS

### 1. AWS Activate Program (Top Priority)

- UK startup, incorporated December 2025
- Solo founder, revenue-generating
- Significant AWS IaC already built (shows commitment)
- Looking for credits to offset migration cost differential
- Question: What tier are we eligible for? (Activate Founders vs Portfolio)

### 2. Solutions Architect Review

- Validate our multi-region architecture
- Global Accelerator vs CloudFront-only for WebSocket traffic
- Aurora Serverless v2 vs provisioned (our workload is bursty)
- NAT Gateway cost optimization (VPC endpoints already configured)
- Right-sizing Fargate tasks (currently conservative estimates)

### 3. Migration Assistance

- DNS cutover strategy (Vercel/Cloudflare --> Route 53)
- Zero-downtime database migration (Neon --> Aurora)
- Redis migration strategy (Upstash --> ElastiCache)
- Blue/green deployment patterns for ECS

### 4. Future Services of Interest

| Service          | Use Case                                                     |
| ---------------- | ------------------------------------------------------------ |
| **Bedrock**      | Unified AI provider (currently Claude API + Gemini directly) |
| **MediaConvert** | Video processing (we have Remotion workloads)                |
| **SES**          | Email delivery (currently using Resend)                      |
| **WAF**          | Already have placeholder in CloudFront config                |
| **Cognito**      | Potential auth consolidation (currently NextAuth v5)         |

---

## Questions to Ask Lennon

### Startup Support

1. Are we eligible for AWS Activate? (UK Ltd, Dec 2025, solo founder,
   revenue-generating)
2. What credits/support tiers are available for our stage?
3. Is there a Solutions Architect we can get assigned for architecture review?

### Technical Guidance

4. For bursty workloads, would you recommend Aurora Serverless v2 over
   provisioned db.r6g.large?
5. What's the recommended FARGATE vs FARGATE_SPOT ratio for production? (We have
   75% Spot)
6. Global Accelerator + NLB for WebSockets -- is this the right pattern, or is
   there a better approach?
7. NAT Gateways across 6 AZs (2 regions) are expensive -- any alternatives we
   should consider?

### Migration

8. Can AWS help with DNS cutover planning? (Vercel + Cloudflare --> Route 53 +
   CloudFront)
9. Is there a database migration service that works well for Neon PostgreSQL -->
   Aurora?
10. Any recommended approach for zero-downtime Redis migration?

### Cost

11. Any startup-specific pricing or reserved instance programs we should look
    at?
12. Are Savings Plans available for ECS Fargate at our scale?

---

## Technical Details (Reference)

### ECS Service Definitions

| Service  | CPU             | Memory  | Port | LB       | Auto-Scale                       |
| -------- | --------------- | ------- | ---- | -------- | -------------------------------- |
| Next.js  | 1024 (1 vCPU)   | 2048 MB | 3000 | ALB (L7) | 2-20 tasks, ALB request count    |
| Workerd  | 256 (0.25 vCPU) | 512 MB  | 8080 | NLB (L4) | 2-50 tasks, CPU 60% / Memory 70% |
| Hono API | -               | -       | 3000 | -        | -                                |

### Docker Images

| Image    | Base                          | Final Size        | Health Check      |
| -------- | ----------------------------- | ----------------- | ----------------- |
| Next.js  | node:24-bookworm-slim         | Standalone output | `GET /api/health` |
| Workerd  | node:22-slim + workerd binary | ~150 MB est.      | `GET /ping`       |
| Hono API | node:24-bookworm-slim         | Slim              | `curl /health`    |

### Aurora Config

- Engine: aurora-postgresql 16.4
- Production: 2x db.r6g.large (primary) + 1x (eu-west-1 replica)
- Staging: 1x db.t4g.medium
- Encryption at rest (KMS), 30-day backup retention
- Performance Insights enabled (production)

### ElastiCache Config

- Engine: Redis 7.1, allkeys-lru eviction
- Production: cache.r6g.large, Multi-AZ, automatic failover
- Transit + at-rest encryption
- 7-day snapshot retention

### CI/CD Pipeline

| Workflow              | Trigger        | Duration                              |
| --------------------- | -------------- | ------------------------------------- |
| `ci-cd.yml`           | Push/PR        | ~5-8 min (4 sharded test runs)        |
| `deploy.yml`          | Push to main   | ~20-25 min (build + deploy 2 regions) |
| `terraform-apply.yml` | Push (infra/)  | ~5 min                                |
| `db-migrate.yml`      | Push (prisma/) | ~2 min                                |

Build uses **Depot** for remote Docker builds (fast caching, arm64 support).

---

## About Zoltan (Background)

- Solo founder and director of SPIKE LAND LTD
- Full-stack developer, deep experience with TypeScript, React, cloud
  infrastructure
- Built the entire platform solo: ~557 routes, 233 DB models, 147 MCP tools, 19
  apps
- Migrating from serverless (Vercel + Cloudflare) to AWS for better control and
  multi-region capability
- Based in UK

---

_Document generated from codebase analysis. No credentials or secrets included._
