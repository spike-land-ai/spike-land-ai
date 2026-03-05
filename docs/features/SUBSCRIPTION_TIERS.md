# Platform Subscription Tiers

This document describes the platform-level subscription system for Spike Land.

## Overview

Spike Land uses **account-level subscriptions** to manage deployment limits, AI
credit allocation, and team access. Subscriptions work across all platform
interfaces: spike-cli, web dashboard, WhatsApp, and Telegram.

| System                 | Scope         | Purpose                                |
| ---------------------- | ------------- | -------------------------------------- |
| Spike Credits          | Account-level | AI operations, deployments, tool usage |
| Platform Subscriptions | Account-level | Feature limits and pricing tiers       |

## Tier Comparison

| Feature               | FREE      | PRO         | BUSINESS    |
| --------------------- | --------- | ----------- | ----------- |
| **Price**             | $0/month  | $29/month   | $99/month   |
| **Deployments**       | 3         | 10          | Unlimited   |
| **AI Credits**        | 100/month | 1,000/month | 5,000/month |
| **Team Members**      | 1         | 3           | 10          |
| **spike-cli Access**  | Basic     | Full        | Full        |
| **WhatsApp/Telegram** | Read-only | Full        | Full        |
| **MCP API Access**    | No        | Read-only   | Full        |
| **Custom Domains**    | No        | Yes         | Yes         |

## Implementation Details

### Schema Fields

The `Workspace` model includes:

```prisma
enum WorkspaceSubscriptionTier {
  FREE
  PRO
  BUSINESS
}

model Workspace {
  // ... existing fields
  subscriptionTier     WorkspaceSubscriptionTier @default(FREE)
  maxDeployments       Int     @default(3)
  monthlyAiCredits     Int     @default(100)
  usedAiCredits        Int     @default(0)
  maxTeamMembers       Int     @default(1)
  billingCycleStart    DateTime?
  stripeSubscriptionId String? @unique
}
```

### Service API

The `WorkspaceSubscriptionService` provides:

```typescript
import { WorkspaceSubscriptionService } from "@/lib/subscription";

// Check limits before operations
const check = await WorkspaceSubscriptionService.canDeploy(workspaceId);
if (!check.allowed) {
  // Show upgrade prompt
}

// Consume AI credits
const result = await WorkspaceSubscriptionService.consumeAiCredits(
  workspaceId,
  amount,
);

// Upgrade tier
await WorkspaceSubscriptionService.upgradeTier(workspaceId, "PRO");
```

### Monthly Credit Reset

AI credits reset monthly on the billing cycle anniversary. The cron job runs
daily at midnight UTC:

- **Path**: `/api/cron/reset-workspace-credits`
- **Schedule**: `0 0 * * *` (daily at midnight UTC)
- **Logic**: Finds workspaces where `billingCycleStart` day matches current day

## Limit Enforcement Points

| Feature            | Enforcement Location                |
| ------------------ | ----------------------------------- |
| App deployment     | `POST /api/deployments`             |
| AI feature usage   | AI generation endpoints             |
| Team member invite | `POST /api/workspaces/[id]/members` |
| MCP API calls      | Rate limiter middleware             |

## Upgrade Flow

1. User clicks "Upgrade" from settings or limit prompt
2. Redirect to Stripe Checkout with workspace metadata
3. Stripe webhook triggers tier upgrade
4. `billingCycleStart` set to upgrade date
5. Limits updated to new tier defaults

## Downgrade Behavior

On downgrade:

- Existing resources (deployments, apps) remain accessible
- Cannot create new resources above new tier limits
- Current month AI credits preserved until reset
- Overage resources marked for manual cleanup

## Testing

The subscription service has 100% test coverage:

```bash
yarn vitest run src/lib/subscription/
```

## Visual Comparison

### Feature Availability Matrix

```
                          FREE         PRO          BUSINESS
-----------------------------------------------------------
Deployments               3            10           Unlimited
AI Credits/mo             100          1,000        5,000
Team Members              1            3            10
-----------------------------------------------------------
spike-cli                 Basic        Full         Full
WhatsApp/Telegram         Read-only    Full         Full
MCP API Access            No           Read-only    Full
Custom Domains            No           Yes          Yes
Priority Support          No           No           Yes
-----------------------------------------------------------
```

## Pricing Rationale

### Why These Tiers?

**FREE Tier ($0/month)**:

- **Purpose**: Onboarding funnel, product-qualified leads
- **Target**: Developers testing the platform
- **Conversion Goal**: Upgrade within 30 days when hitting deployment limits
- **Economics**: Loss leader (supported by PRO/BUSINESS margins)

**PRO Tier ($29/month)**:

- **Purpose**: Core revenue driver for individual developers and small teams
- **Target**: Solo developers, freelancers, indie hackers
- **Value Prop**: 10x FREE limits at affordable price point
- **Competitive Positioning**: Undercuts Vercel Pro ($20/mo) with AI
  capabilities included

**BUSINESS Tier ($99/month)**:

- **Purpose**: High-value customers with team and API needs
- **Target**: Small teams, agencies, businesses building with AI
- **Value Prop**: Unlimited deployments + full MCP API access
- **Competitive Positioning**: All-in-one platform vs. piecing together Vercel +
  OpenAI + custom tooling

### Price Anchoring Strategy

| Metric            | FREE | PRO    | BUSINESS |
| ----------------- | ---- | ------ | -------- |
| **$/Deployment**  | $0   | $2.90  | <$0.50   |
| **$/Team Member** | $0   | $9.67  | $9.90    |
| **$/AI Credit**   | $0   | $0.029 | $0.020   |

The BUSINESS tier becomes economically compelling at:

- **10+ deployments** (vs. PRO's 10 limit)
- **4+ team members** (vs. PRO's 3 limit)
- **5,000+ AI credits/mo** (vs. PRO's 1,000 limit)
- **Any MCP API usage** (not available on PRO)

## Frequently Asked Questions

### Billing & Payments

**Q: Can I pay annually for a discount?** A: Annual billing is coming soon with
a 20% discount (PRO: $278/year, BUSINESS: $950/year).

**Q: What payment methods do you accept?** A: Credit/debit cards (Visa,
Mastercard, Amex) via Stripe.

### Limits & Overages

**Q: What happens if I exceed my deployment limit?** A: You'll be prompted to
upgrade or remove deployments. Existing deployments remain active.

**Q: What if I run out of AI credits mid-month?** A: You can purchase one-time
credit packs ($10 for 500 credits) or upgrade to a higher tier.

**Q: Do unused AI credits roll over?** A: No, credits reset monthly on your
billing cycle anniversary.

### Upgrades & Downgrades

**Q: Can I upgrade/downgrade anytime?** A: Yes. Upgrades are immediate.
Downgrades take effect at the next billing cycle.

**Q: What happens to my data if I downgrade?** A: All data is preserved. You
simply can't create new resources beyond the new tier limits.

**Q: Do you offer refunds?** A: We offer a 14-day money-back guarantee for
first-time PRO/BUSINESS purchases.

### Features

**Q: What are "AI Credits" used for?** A: AI credits power image generation,
code assistance, tool operations, and any AI-powered feature on the platform.

**Q: Can FREE users access spike-cli?** A: Yes, with basic functionality. Full
spike-cli access requires PRO or BUSINESS tier.

### Team Management

**Q: Can I have different team member roles?** A: Yes. Roles include Owner,
Admin, Editor, and Viewer.

**Q: Do team members need separate accounts?** A: Yes. Each team member needs
their own spike.land account, then you invite them to your workspace.

## Related Documentation

- [Features](./FEATURES.md) - Platform features overview
- [D1 Quick Start](../develop/D1_QUICK_START.md) - Database setup guide
