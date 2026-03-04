# Deployment Pipeline Timing & Cost Analysis

> **Last updated:** 2026-02-19 **Data source:** GitHub Actions runs Feb 16-19,
> 2026 (1000+ runs analyzed)

---

## 1. Pipeline Timing: Commit to Production

### Workflows triggered on every push to main

| Workflow                | Avg Duration   | Range         | Success Rate              |
| ----------------------- | -------------- | ------------- | ------------------------- |
| **CI/CD Pipeline**      | 3.1 min        | 2.1 - 5.4 min | 20% (4/20)                |
| **Deploy to AWS ECS**   | 1.7 min        | 0.7 - 10 min  | 0% (0/18)                 |
| **Deploy Hono MCP API** | 2.9 min        | 2.6 - 4.2 min | 0% (0/8)                  |
| **Claude Code Review**  | skipped        | -             | Triggers after CI success |
| **CodeQL**              | scheduled only | -             | Fridays 5:28 AM UTC       |

### CI/CD Pipeline Breakdown (successful run #22174827154)

| Job                              | Duration         | Notes                      |
| -------------------------------- | ---------------- | -------------------------- |
| Detect changed paths             | 7 sec            | Path filtering             |
| Quality Checks (Lint + Security) | 2 min 2 sec      | ESLint + tsc + audit       |
| unit-tests-1 (shard 1/4)         | 2 min 8 sec      | `--changed HEAD^1` on main |
| unit-tests-2 (shard 2/4)         | **5 min 21 sec** | Slowest shard (bottleneck) |
| unit-tests-3 (shard 3/4)         | 2 min 10 sec     |                            |
| unit-tests-4 (shard 4/4)         | 4 min 26 sec     |                            |
| Package Tests                    | skipped          | Only when src/ changed     |

**CI total: ~5.5 min** (wall clock, parallel jobs)

### Full Production Deploy Pipeline (when working)

| Stage                            | Optimistic  | Pessimistic | Notes                              |
| -------------------------------- | ----------- | ----------- | ---------------------------------- |
| CI/CD Pipeline                   | 3 min       | 5.5 min     | Parallel: lint + 4 test shards     |
| Claude Code Review               | 2 min       | 5 min       | Auto-approve or request changes    |
| Docker Build (workerd + Next.js) | 5 min       | 25 min      | Parallel; cached vs cold           |
| Deploy us-east-1 (canary)        | 5 min       | 16 min      | ECS rolling + 8 min stability wait |
| Smoke tests us-east-1            | 1 min       | 5 min       | Health checks + API tests          |
| ECR cross-region replication     | 2 min       | 5 min       | us-east-1 -> eu-west-1             |
| Deploy eu-west-1                 | 5 min       | 16 min      | Same as us-east-1                  |
| Smoke tests eu-west-1            | 1 min       | 5 min       | Health checks                      |
| **TOTAL**                        | **~24 min** | **~82 min** | Commit to fully deployed globally  |

**Warning:** Both ECS deploy workflows and Hono API deploy are ALL FAILING (0%
success rate). Production deploys are not completing.

---

## 2. CI/CD Costs

### GitHub Actions (FREE)

- **Repo is public** - all Actions minutes are **free and unlimited**
- Current volume: **~396 workflow runs/day**, projected **~11,000 runs/month**
- Cache usage: 10.2 GB (14 active caches)
- **Cost: $0/month**

### Compute Time Consumed (free due to public repo)

| Workflow                 | Runs/month (est.) | Avg min/run (total jobs) | Total minutes         |
| ------------------------ | ----------------- | ------------------------ | --------------------- |
| CI/CD Pipeline           | ~1,400            | 15.5                     | 21,700                |
| Deploy to AWS ECS        | ~1,400            | 3.4                      | 4,760                 |
| Claude Code Review       | ~1,400            | ~3                       | ~1,200                |
| Deploy Hono MCP API      | ~500              | 8.7                      | 4,350                 |
| CodeQL + Security        | ~100              | ~5                       | 500                   |
| Other (Dependabot, etc.) | ~200              | ~5                       | 1,000                 |
| **TOTAL**                | **~5,000**        |                          | **~33,500 min/month** |

If this were a **private repo** at $0.008/min (Linux): **$160-320/month**. Since
public: **$0/month**.

### Depot (Remote Builds)

- Configured (`depot.json`, project ID: `tccng0cpjr`) but NOT used in GitHub
  Actions
- Used for local dev fast builds only via `yarn depot:ci`
- **Cost: $0/month** (Depot starts at $20/month for 20 build-minutes)

---

## 3. Hosting & Infrastructure Costs

### AWS ECS (Primary Production)

Two regions: us-east-1 + eu-west-1, each running workerd + Next.js containers.

| Component                        | Optimistic  | Pessimistic | Basis                              |
| -------------------------------- | ----------- | ----------- | ---------------------------------- |
| ECS Fargate (4 tasks, 2 regions) | $80/mo      | $200/mo     | 0.5-1 vCPU, 1-2GB each             |
| ECR (container registry)         | $5/mo       | $15/mo      | Storage + cross-region replication |
| ALB (2 regions)                  | $36/mo      | $72/mo      | $18/ALB/month + LCU charges        |
| NAT Gateway (if VPC)             | $0/mo       | $90/mo      | $0.045/hr + data charges           |
| CloudWatch Logs                  | $5/mo       | $20/mo      | Log ingestion + storage            |
| **AWS Subtotal**                 | **$126/mo** | **$397/mo** |                                    |

### Vercel

| Component            | Optimistic | Pessimistic | Basis                                     |
| -------------------- | ---------- | ----------- | ----------------------------------------- |
| Plan (Pro)           | $20/mo     | $20/mo      | Required for 11 cron jobs + team features |
| Serverless Functions | $0         | $50/mo      | Included in Pro, overage at scale         |
| Edge Functions       | $0         | $20/mo      | Included, overage possible                |
| Bandwidth            | $0         | $40/mo      | 1TB included in Pro                       |
| **Vercel Subtotal**  | **$20/mo** | **$130/mo** |                                           |

### Cloudflare

| Component               | Optimistic | Pessimistic | Basis                         |
| ----------------------- | ---------- | ----------- | ----------------------------- |
| Workers (2 workers)     | $5/mo      | $5/mo       | Workers Paid plan             |
| KV operations           | $0         | $5/mo       | First 10M reads free          |
| R2 storage (2 buckets)  | $0         | $15/mo      | First 10GB free, $0.015/GB    |
| Durable Objects         | $0         | $10/mo      | Based on active code sessions |
| **Cloudflare Subtotal** | **$5/mo**  | **$35/mo**  |                               |

### Database (PostgreSQL)

| Component                  | Optimistic | Pessimistic | Basis                    |
| -------------------------- | ---------- | ----------- | ------------------------ |
| Neon/Supabase (233 models) | $25/mo     | $100/mo     | Pro plan + compute hours |
| Connection pooling         | included   | included    | PgBouncer/PgAdapter      |
| **Database Subtotal**      | **$25/mo** | **$100/mo** |                          |

### Redis (Upstash)

| Component     | Optimistic | Pessimistic | Basis                                |
| ------------- | ---------- | ----------- | ------------------------------------ |
| Upstash Redis | $10/mo     | $50/mo      | Pay-as-you-go, rate limiting + cache |

### Monitoring & Services

| Component               | Optimistic | Pessimistic | Basis               |
| ----------------------- | ---------- | ----------- | ------------------- |
| Sentry (error tracking) | $0/mo      | $29/mo      | Free tier vs Team   |
| Resend (email)          | $0/mo      | $20/mo      | Free 100/day vs Pro |
| **Services Subtotal**   | **$0/mo**  | **$49/mo**  |                     |

---

## 4. Cost Summary

| Category               | Optimistic     | Pessimistic    |
| ---------------------- | -------------- | -------------- |
| CI/CD (GitHub Actions) | $0             | $0             |
| AWS ECS (production)   | $126           | $397           |
| Vercel                 | $20            | $130           |
| Cloudflare             | $5             | $35            |
| Database               | $25            | $100           |
| Redis                  | $10            | $50            |
| Monitoring/Services    | $0             | $49            |
|                        |                |                |
| **TOTAL MONTHLY**      | **~$186/mo**   | **~$761/mo**   |
| **TOTAL ANNUAL**       | **~$2,232/yr** | **~$9,132/yr** |

**Not included:** Domain registration
(~$12/yr), Claude Max subscription (~$180/mo), Stripe transaction fees (2.9% +
$0.30), Gemini API usage (variable).

---

## 5. Key Observations

### Pipeline Health Warning

- **CI success rate: only 20%** (4/20 recent runs on main)
- **ECS deploy: 0% success** (all 18 recent runs failed)
- **Hono API deploy: 0% success** (all 8 recent runs failed)
- ~40 commits/day to main but only ~8 pass CI

### Cost Efficiency Wins

- **Public repo = free CI** (saves ~$160-320/month)
- **Trunk-based development** avoids branch/PR overhead
- **Smart test sharding** (4x parallel) keeps CI under 6 min
- **`--changed HEAD^1`** on main runs only affected tests

### Cost Risks

- AWS ECS is the biggest cost driver (~68% of optimistic total)
- Two-region deployment doubles compute costs
- 11 Vercel cron jobs (4 running every 15 min) may push past included limits
- ~11,000 workflow runs/month is very high (could hit cache/storage limits)

---

## Verification

This analysis is based on:

- `gh run list` data from Feb 16-19, 2026 (1000 runs)
- `gh run view` job-level timing for successful run #22174827154
- Workflow YAML files in `.github/workflows/`
- Infrastructure config files (`vercel.json`, `wrangler.toml`, Prisma schema)
- Repo is **public** (confirmed via API) = free Actions
