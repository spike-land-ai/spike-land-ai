# Token System Documentation

> **Last Updated**: February 2026 | **Status**: Production

---

## Table of Contents

1. [Token Overview](#token-overview)
2. [Token Tiers](#token-tiers)
3. [Token Acquisition](#token-acquisition)
4. [Token Consumption](#token-consumption)
5. [Automatic Regeneration](#automatic-regeneration)
6. [Token Packages](#token-packages)
7. [Tier Subscriptions](#tier-subscriptions)
8. [Token Balance & Tracking](#token-balance--tracking)
9. [API Reference](#api-reference)
10. [Transaction Types](#transaction-types)
11. [Implementation Architecture](#implementation-architecture)

---

## Token Overview

**Tokens** are the primary currency on the Spike Land platform. Every Spike Land
user has a single token balance that can be spent across any app on the
platform.

### Key Characteristics

- **Platform Currency**: Tokens belong to your Spike Land account, not to
  individual apps
- **Cross-App Usage**: One token balance works across all apps on the platform
- **Non-transferable**: Cannot be gifted between users
- **Tiered System**: Token well capacity and regeneration rates vary by
  subscription tier
- **Automatic Regeneration**: Free tokens regenerate over time (1 token per 15
  minutes)
- **Account-Specific**: Each user maintains a single platform-wide token balance

### Token Use Cases

Currently supported applications:

- **Image Generation**: AI-powered text-to-image generation via MCP API
- **Image Modification**: Image-to-image transformations via MCP API
- **AI Operations**: AI-powered platform features (code assistance, deployments,
  tool usage)

---

## Token Tiers

The platform uses a **Token Well** tier system where your subscription tier
determines both your token regeneration capacity and the tokens granted on
upgrade.

### Tier Configuration

| Tier     | Well Capacity | Monthly Price (GBP) | Regeneration Cap |
| -------- | ------------- | ------------------- | ---------------- |
| FREE     | 10 tokens     | £0.00               | 10               |
| BASIC    | 20 tokens     | £5.00               | 20               |
| STANDARD | 50 tokens     | £10.00              | 50               |
| PREMIUM  | 100 tokens    | £20.00              | 100              |

### How Tiers Work

1. **Well Capacity**: Maximum tokens your account can hold through regeneration
2. **Tier Upgrade**: When you upgrade, you receive tokens equal to your new
   tier's capacity
3. **Monthly Billing**: Maintains your tier status but does NOT auto-refill
   tokens
4. **Regeneration**: Tokens regenerate automatically up to your tier's capacity
5. **Purchased Tokens**: Have no cap and accumulate on top of your tier capacity

### Tier Upgrade Example

- User on FREE tier (10 capacity) upgrades to STANDARD
- Immediately receives 50 tokens (STANDARD capacity)
- Can now regenerate up to 50 tokens automatically
- Continues to pay £10/month to maintain STANDARD tier
- Tokens earned through regeneration are capped at 50
- Purchased tokens are unlimited and added on top

### Tier Downgrade

- User can schedule a downgrade to a lower tier
- Downgrade takes effect at the end of current billing cycle
- Existing token balance is preserved (not reduced)
- New regeneration cap applies after downgrade

---

## Token Acquisition

Users can acquire tokens through five primary mechanisms:

### 1. Automatic Regeneration

**Free tokens generated automatically based on your tier**

- **Rate**: 1 token per 15 minutes
- **Maximum**: Varies by tier (10 for FREE, 20 for BASIC, 50 for STANDARD, 100
  for PREMIUM)
- **Cost**: Free (included with tier subscription)
- **Automatic**: No user action required

**Example Timeline (FREE Tier)**:

- Hour 0:00: Balance = 0
- Hour 0:15: Balance = 1
- Hour 0:30: Balance = 2
- Hour 2:30: Balance = 10 (capped at FREE tier limit)

**Example Timeline (PREMIUM Tier)**:

- Hour 0:00: Balance = 0
- Hour 25:00: Balance = 100 (capped at PREMIUM tier limit)

**Use Case**: Casual users who want to use features without purchasing

### 2. Tier Subscriptions

**Monthly recurring subscriptions that upgrade your token well capacity**

**Available Tiers**:

| Tier     | Capacity | Price/Month (GBP) | Upgrade Grant | Features                        |
| -------- | -------- | ----------------- | ------------- | ------------------------------- |
| BASIC    | 20       | £5.00             | 20 tokens     | 2x capacity vs FREE             |
| STANDARD | 50       | £10.00            | 50 tokens     | 5x capacity vs FREE             |
| PREMIUM  | 100      | £20.00            | 100 tokens    | 10x capacity vs FREE, Max regen |

**Tier Features**:

- **Instant Grant**: Receive full tier capacity immediately on upgrade
- **Auto-Renewal**: Monthly billing until cancelled
- **Regeneration Cap**: Your regeneration maximum equals tier capacity
- **Upgrade Anytime**: Immediate tier upgrade with token grant
- **Schedule Downgrade**: Downgrade takes effect next billing cycle
- **Cancel Anytime**: Cancel subscription without penalty

**Tier Lifecycle**:

1. **Subscribe**: Choose tier on pricing page
2. **Payment**: Stripe checkout processes payment
3. **Tier Activated**: UserTokenBalance.tier updated
4. **Tokens Granted**: Receive full tier capacity immediately
5. **Monthly Billing**: Continues to maintain tier status
6. **Regeneration**: Tokens auto-regenerate up to tier capacity

### 3. One-Time Token Purchases

**Direct token purchases with credit/debit card (unlimited balance)**

**Available Packages**:

| Package | Tokens | Price (GBP) | Price/Token | Best For       |
| ------- | ------ | ----------- | ----------- | -------------- |
| Starter | 10     | £2.99       | £0.30       | Quick top-up   |
| Basic   | 50     | £9.99       | £0.20       | Occasional use |
| Pro     | 150    | £24.99      | £0.17       | Regular use    |
| Power   | 500    | £69.99      | £0.14       | Heavy use      |

**Payment Details**:

- **Currency**: British Pounds (GBP)
- **Payment Method**: Credit/Debit card via Stripe
- **Processing**: Instant (tokens credited immediately)
- **Balance Cap**: No cap on purchased tokens (accumulate unlimited)
- **Expiration**: Purchased tokens never expire
- **Refund**: 30-day refund window via Stripe

**Use Case**: Users who need tokens immediately or want to stockpile

### 4. Voucher Redemption

**Promotional codes providing bonus tokens**

**Voucher Types**:

- **FIXED_TOKENS**: Grant specific number of tokens (e.g., "WELCOME50")
- **PERCENTAGE_BONUS**: Add percentage bonus to purchase
- **SUBSCRIPTION_TRIAL**: Free trial of tier subscription

**Redemption Rules**:

- One voucher per user per code (cannot redeem same code twice)
- Multiple different vouchers can be combined
- Tokens added immediately upon redemption
- Rate limited to 5 attempts per hour
- Voucher codes are case-insensitive alphanumeric

**Use Case**: New users, promotional campaigns, partnerships

### 5. Admin Adjustments

**Manual token grants by platform administrators**

- Used for customer support
- Compensation for service issues
- Special promotions
- Creates `EARN_ADMIN_ADJUSTMENT` transaction

---

## Token Consumption

Tokens are consumed when using platform features. All apps share the same token
costs.

### Enhancement Costs

**Image Enhancement Tiers**:

| Enhancement Tier | Output Resolution | Token Cost | Use Case                     |
| ---------------- | ----------------- | ---------- | ---------------------------- |
| FREE             | 1024px max        | 0 tokens   | Testing with nano model      |
| TIER_1K          | 1024px max        | 2 tokens   | Social media, web thumbnails |
| TIER_2K          | 2048px max        | 5 tokens   | High-quality prints          |
| TIER_4K          | 4096px max        | 10 tokens  | Professional, large prints   |

### MCP Generation Costs

**Text-to-Image and Image Modification**:

| Generation Tier | Output Resolution | Token Cost |
| --------------- | ----------------- | ---------- |
| FREE            | 1024px max        | 0 tokens   |
| TIER_1K         | 1024px max        | 2 tokens   |
| TIER_2K         | 2048px max        | 5 tokens   |
| TIER_4K         | 4096px max        | 10 tokens  |

### Other Platform Costs

- **Box Creation**: Variable cost based on BoxTier (EC2 provisioning now active)
- **Custom Enhancements**: Defined per feature

### Consumption Rules

- **Pre-Check**: Balance verified before deduction
- **Atomic**: Token consumption is transactional (all-or-nothing)
- **Refundable**: Automatically refunded on service failure
- **Tracked**: Every consumption creates a transaction record

---

## Automatic Regeneration

### Regeneration Mechanics

**Core Parameters**:

- **Interval**: 15 minutes (900 seconds)
- **Amount**: 1 token per interval
- **Cap**: Based on user's tier (FREE: 10, BASIC: 20, STANDARD: 50,
  PREMIUM: 100)

**Calculation Logic**:

```typescript
const timeSinceLastRegen = now - lastRegeneration;
const intervalsElapsed = Math.floor(timeSinceLastRegen / 15 minutes);
const tokensToAdd = Math.min(
  intervalsElapsed * 1,
  tierCapacity - currentBalance
);
```

**Example (STANDARD Tier)**:

- Current balance: 45
- Last regeneration: 1 hour ago (4 intervals)
- Available to regenerate: 4 tokens
- New balance: 45 + 4 = 49 (respects tier cap of 50)

### Processing

**On-Demand Regeneration**:

- Triggered on every `/api/tokens/balance` request
- Calculated based on time elapsed since `lastRegeneration`
- Updates `UserTokenBalance.balance` and `lastRegeneration`
- Creates `EARN_REGENERATION` transaction

**Cron-Based Regeneration** (future):

- Batch processing for all users
- Runs every 15 minutes
- Reduces API load

### Regeneration Priority

Regeneration only applies to free tokens. Purchased tokens and tier grants are
not subject to regeneration caps.

**Token Priority Order**:

1. **Tier Capacity Tokens**: Tokens from tier upgrades
2. **Purchased Tokens**: One-time purchases (never expire)
3. **Regenerated Tokens**: Free auto-generated tokens (capped by tier)

---

## Token Packages

### Package Definitions

Packages defined in `/src/lib/stripe/client.ts`:

```typescript
export const TOKEN_PACKAGES = {
  starter: { tokens: 10, price: 2.99, name: "Starter Pack" },
  basic: { tokens: 50, price: 9.99, name: "Basic Pack" },
  pro: { tokens: 150, price: 24.99, name: "Pro Pack" },
  power: { tokens: 500, price: 69.99, name: "Power Pack" },
} as const;
```

### Value Analysis

**For TIER_1K Enhancement (2 tokens per image)**:

| Package | Images | Cost Per Image |
| ------- | ------ | -------------- |
| Starter | 5      | £0.60          |
| Basic   | 25     | £0.40          |
| Pro     | 75     | £0.33          |
| Power   | 250    | £0.28          |

**For TIER_4K Enhancement (10 tokens per image)**:

| Package | Images | Cost Per Image |
| ------- | ------ | -------------- |
| Starter | 1      | £2.99          |
| Basic   | 5      | £2.00          |
| Pro     | 15     | £1.67          |
| Power   | 50     | £1.40          |

### Purchase Flow

1. User selects package on pricing page
2. Redirected to Stripe checkout
3. Payment processed via Stripe
4. Webhook receives `checkout.session.completed` event
5. Tokens credited to UserTokenBalance.balance
6. Transaction record created with type `EARN_PURCHASE`
7. StripePayment record created

---

## Tier Subscriptions

### Tier Definitions

Tiers defined in `/src/lib/tokens/tier-manager.ts`:

```typescript
export const TIER_CAPACITIES: Record<SubscriptionTier, number> = {
  FREE: 10,
  BASIC: 20,
  STANDARD: 50,
  PREMIUM: 100,
} as const;

export const TIER_PRICES_GBP: Record<SubscriptionTier, number> = {
  FREE: 0,
  BASIC: 5,
  STANDARD: 10,
  PREMIUM: 20,
} as const;
```

### Subscription Lifecycle

**1. Tier Upgrade**:

- User selects tier on pricing page
- Stripe processes payment
- Webhook updates `UserTokenBalance.tier`
- User receives tokens equal to tier capacity
- Transaction created with type `EARN_PURCHASE`

**2. Active Subscription**:

- Monthly billing maintains tier status
- Tokens regenerate up to tier capacity
- No auto-refill on billing (only maintains tier)
- Can purchase additional tokens anytime

**3. Schedule Downgrade**:

- User schedules downgrade to lower tier
- Stored in `Subscription.downgradeTo`
- Takes effect at `currentPeriodEnd`
- Existing token balance preserved

**4. Process Downgrade**:

- Webhook triggers on billing cycle end
- Updates `UserTokenBalance.tier` to `downgradeTo`
- Clears `Subscription.downgradeTo`
- No tokens deducted (balance preserved)
- New regeneration cap applies

**5. Cancel Subscription**:

- User cancels subscription
- Tier reverts to FREE at period end
- Token balance preserved
- Regeneration cap becomes 10

---

## Token Balance & Tracking

### Balance Query

**Endpoint**: `GET /api/tokens/balance`

**Response Schema**:

```typescript
{
  balance: number; // Current token balance
  lastRegeneration: string; // ISO timestamp of last regen
  timeUntilNextRegenMs: number; // Milliseconds until next regen
  tokensAddedThisRequest: number; // Tokens regenerated during this request
  tier: SubscriptionTier; // Current subscription tier
  maxBalance: number; // Tier capacity (regen cap)
  stats: {
    totalSpent: number; // Lifetime token consumption
    totalEarned: number; // Lifetime token earnings
    totalRefunded: number; // Lifetime refunds
    transactionCount: number; // Total transactions
  }
}
```

**Example Response**:

```json
{
  "balance": 45,
  "lastRegeneration": "2025-12-30T10:30:00Z",
  "timeUntilNextRegenMs": 540000,
  "tokensAddedThisRequest": 2,
  "tier": "STANDARD",
  "maxBalance": 50,
  "stats": {
    "totalSpent": 105,
    "totalEarned": 150,
    "totalRefunded": 10,
    "transactionCount": 42
  }
}
```

### Token Transaction Model

**Schema** (`TokenTransaction`):

| Field        | Type                 | Description                           |
| ------------ | -------------------- | ------------------------------------- |
| id           | String               | Primary key (CUID)                    |
| userId       | String               | Owner of transaction                  |
| amount       | Int                  | Token amount (positive or negative)   |
| type         | TokenTransactionType | Transaction type (see below)          |
| source       | String?              | Source system (e.g., "stripe", "api") |
| sourceId     | String?              | External reference ID                 |
| balanceAfter | Int                  | Balance after transaction             |
| metadata     | Json?                | Additional context                    |
| createdAt    | DateTime             | Transaction timestamp                 |

### User Token Balance Model

**Schema** (`UserTokenBalance`):

| Field            | Type             | Description                 |
| ---------------- | ---------------- | --------------------------- |
| id               | String           | Primary key (CUID)          |
| userId           | String           | User ID (unique)            |
| balance          | Int              | Current token balance       |
| lastRegeneration | DateTime         | Last regeneration timestamp |
| tier             | SubscriptionTier | Current subscription tier   |
| createdAt        | DateTime         | Record creation timestamp   |
| updatedAt        | DateTime         | Last update timestamp       |

---

## API Reference

### Get Token Balance

**Endpoint**: `GET /api/tokens/balance`

**Authentication**: Required (session cookie)

**Request**:

```http
GET /api/tokens/balance HTTP/1.1
Cookie: authjs.session-token=...
```

**Response (Success - 200)**:

```json
{
  "balance": 45,
  "lastRegeneration": "2025-12-30T10:30:00Z",
  "timeUntilNextRegenMs": 540000,
  "tokensAddedThisRequest": 2,
  "tier": "STANDARD",
  "maxBalance": 50,
  "stats": {
    "totalSpent": 105,
    "totalEarned": 150,
    "totalRefunded": 10,
    "transactionCount": 42
  }
}
```

**Error Responses**:

| Status | Error           | Description             |
| ------ | --------------- | ----------------------- |
| 401    | Unauthorized    | User session invalid    |
| 500    | Failed to fetch | Database or system erro |

### Create Checkout Session (Token Purchase)

**Endpoint**: `POST /api/stripe/checkout`

**Authentication**: Required

**Request**:

```http
POST /api/stripe/checkout HTTP/1.1
Content-Type: application/json

{
  "packageId": "pro",
  "mode": "payment"
}
```

**Valid Package IDs**: `starter`, `basic`, `pro`, `power`

**Response (Success - 200)**:

```json
{
  "success": true,
  "sessionId": "cs_live_123abc...",
  "url": "https://checkout.stripe.com/pay/cs_live_123abc..."
}
```

**Error Responses**:

| Status | Error               | Description              |
| ------ | ------------------- | ------------------------ |
| 400    | Package ID required | packageId missing        |
| 400    | Invalid package ID  | packageId not recognized |
| 401    | Unauthorized        | User session invalid     |
| 500    | Failed to create    | Stripe API error         |

### Upgrade Tier

**Endpoint**: `POST /api/tiers/upgrade`

**Authentication**: Required

**Request**:

```http
POST /api/tiers/upgrade HTTP/1.1
Content-Type: application/json

{
  "tier": "STANDARD"
}
```

**Valid Tiers**: `BASIC`, `STANDARD`, `PREMIUM`

**Response (Success - 200)**:

```json
{
  "success": true,
  "sessionId": "cs_live_sub_123abc...",
  "url": "https://checkout.stripe.com/pay/cs_live_sub_123abc..."
}
```

### Schedule Downgrade

**Endpoint**: `POST /api/tiers/downgrade`

**Authentication**: Required

**Request**:

```http
POST /api/tiers/downgrade HTTP/1.1
Content-Type: application/json

{
  "tier": "BASIC"
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "effectiveDate": "2025-01-30T00:00:00Z"
}
```

### Redeem Voucher

**Endpoint**: `POST /api/vouchers/redeem`

**Authentication**: Required

**Rate Limit**: 5 attempts per hour per user

**Request**:

```http
POST /api/vouchers/redeem HTTP/1.1
Content-Type: application/json

{
  "code": "WELCOME50"
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "tokensGranted": 50,
  "newBalance": 95
}
```

**Error Responses**:

| Status | Error                                    | Description                  |
| ------ | ---------------------------------------- | ---------------------------- |
| 400    | Voucher code not found                   | Invalid code                 |
| 400    | This voucher is no longer active         | Voucher deactivated          |
| 400    | This voucher has expired                 | Past expiration date         |
| 400    | This voucher has reached its usage limit | Max redemptions reached      |
| 400    | You have already redeemed this voucher   | User already used this code  |
| 401    | Authentication required                  | User not logged in           |
| 429    | Too many redemption attempts             | Rate limit exceeded (5/hour) |

---

## Transaction Types

### Token Transaction Types

Defined in `/prisma/schema.prisma`:

```prisma
enum TokenTransactionType {
  EARN_REGENERATION      // Auto-regeneration (1 token per 15 min)
  EARN_PURCHASE          // Token package purchase or tier upgrade
  EARN_BONUS             // Voucher redemption
  EARN_ADMIN_ADJUSTMENT  // Manual admin grant
  SPEND_ENHANCEMENT      // Image enhancement consumption
  SPEND_MCP_GENERATION   // MCP generation consumption
  SPEND_BOX_CREATION     // Box creation (future)
  REFUND                 // Refund for failed service
}
```

### Transaction Examples

**Regeneration**:

```json
{
  "id": "txn_001",
  "userId": "user_123",
  "amount": 4,
  "type": "EARN_REGENERATION",
  "source": "auto_regeneration",
  "sourceId": null,
  "balanceAfter": 49,
  "metadata": {
    "intervalsElapsed": 4,
    "timeSinceLastRegenMs": 3600000,
    "tier": "STANDARD"
  },
  "createdAt": "2025-12-30T11:30:00Z"
}
```

**Token Purchase**:

```json
{
  "id": "txn_002",
  "userId": "user_123",
  "amount": 150,
  "type": "EARN_PURCHASE",
  "source": "stripe",
  "sourceId": "cs_live_abc123",
  "balanceAfter": 199,
  "metadata": {
    "packageId": "pro",
    "sessionId": "cs_live_abc123",
    "amountPaid": 2499
  },
  "createdAt": "2025-12-30T12:00:00Z"
}
```

**Enhancement Consumption**:

```json
{
  "id": "txn_003",
  "userId": "user_123",
  "amount": -5,
  "type": "SPEND_ENHANCEMENT",
  "source": "image_enhancement",
  "sourceId": "job_abc123",
  "balanceAfter": 194,
  "metadata": {
    "tier": "TIER_2K",
    "imageId": "img_xyz789"
  },
  "createdAt": "2025-12-30T12:15:00Z"
}
```

**Refund**:

```json
{
  "id": "txn_004",
  "userId": "user_123",
  "amount": 5,
  "type": "REFUND",
  "source": "enhancement_failed",
  "sourceId": "job_abc123",
  "balanceAfter": 199,
  "metadata": {
    "reason": "Gemini API timeout",
    "originalJobId": "job_abc123"
  },
  "createdAt": "2025-12-30T12:16:00Z"
}
```

---

## Implementation Architecture

### Core Modules

**Token Balance Manager** (`/src/lib/tokens/balance-manager.ts`):

- `getBalance(userId)`: Get current balance and tier info
- `hasEnoughTokens(userId, amount)`: Check if user can afford cost
- `consumeTokens(params)`: Deduct tokens for service usage
- `addTokens(params)`: Credit tokens (purchase, bonus, regen)
- `refundTokens(userId, amount, sourceId, reason)`: Refund failed transactions
- `processRegeneration(userId)`: Calculate and apply regeneration
- `getTransactionHistory(userId, limit, offset)`: Query transaction log
- `getConsumptionStats(userId)`: Aggregate spending/earning stats

**Tier Manager** (`/src/lib/tokens/tier-manager.ts`):

- `getTierInfo(tier)`: Get tier configuration
- `getUserTier(userId)`: Get user's current tier
- `getTierCapacity(tier)`: Get well capacity for tier
- `getNextTier(currentTier)`: Get upgrade target
- `canUpgradeTo(current, target)`: Validate upgrade path
- `upgradeTier(userId, newTier)`: Process tier upgrade
- `scheduleDowngrade(userId, targetTier)`: Schedule future downgrade
- `processScheduledDowngrade(userId)`: Apply downgrade at period end
- `shouldPromptUpgrade(userId)`: Check if upgrade prompt should show

**Voucher Manager** (`/src/lib/vouchers/voucher-manager.ts`):

- `validate(code, userId)`: Validate voucher without redeeming
- `redeem(code, userId)`: Redeem voucher and credit tokens

**Regeneration Service** (`/src/lib/tokens/regeneration.ts`):

- `processUserRegeneration(userId)`: Process single user regeneration
- `processAllUserRegenerations()`: Batch process all users (cron)
- `getNextRegenerationTime(userId)`: Calculate next regen time
- `getTimeUntilNextRegeneration(userId)`: Get milliseconds until next regen

### Database Schema

**UserTokenBalance**:

```sql
CREATE TABLE user_token_balances (
  id               TEXT PRIMARY KEY,
  userId           TEXT UNIQUE NOT NULL REFERENCES users(id),
  balance          INTEGER NOT NULL DEFAULT 0,
  lastRegeneration TIMESTAMP NOT NULL DEFAULT NOW(),
  tier             TEXT NOT NULL DEFAULT 'FREE',
  createdAt        TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt        TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**TokenTransaction**:

```sql
CREATE TABLE token_transactions (
  id           TEXT PRIMARY KEY,
  userId       TEXT NOT NULL REFERENCES users(id),
  amount       INTEGER NOT NULL,
  type         TEXT NOT NULL, -- TokenTransactionType enum
  source       TEXT,
  sourceId     TEXT,
  balanceAfter INTEGER NOT NULL,
  metadata     JSONB,
  createdAt    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_transactions_userId ON token_transactions(userId);
CREATE INDEX idx_token_transactions_type ON token_transactions(type);
CREATE INDEX idx_token_transactions_createdAt ON token_transactions(createdAt);
```

**Subscription**:

```sql
CREATE TABLE subscriptions (
  id                   TEXT PRIMARY KEY,
  userId               TEXT UNIQUE NOT NULL REFERENCES users(id),
  stripeSubscriptionId TEXT UNIQUE NOT NULL,
  stripePriceId        TEXT NOT NULL,
  status               TEXT NOT NULL,
  tier                 TEXT NOT NULL, -- SubscriptionTier enum
  currentPeriodStart   TIMESTAMP NOT NULL,
  currentPeriodEnd     TIMESTAMP NOT NULL,
  cancelAtPeriodEnd    BOOLEAN NOT NULL DEFAULT FALSE,
  downgradeTo          TEXT, -- SubscriptionTier enum (nullable)
  createdAt            TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt            TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### API Endpoints

| Endpoint                 | Method | Purpose                        |
| ------------------------ | ------ | ------------------------------ |
| `/api/tokens/balance`    | GET    | Get current token balance      |
| `/api/stripe/checkout`   | POST   | Create Stripe checkout session |
| `/api/stripe/webhook`    | POST   | Handle Stripe webhook events   |
| `/api/tiers/upgrade`     | POST   | Create tier upgrade checkout   |
| `/api/tiers/downgrade`   | POST   | Schedule tier downgrade        |
| `/api/vouchers/redeem`   | POST   | Redeem voucher code            |
| `/api/vouchers/validate` | POST   | Validate voucher without using |

### Stripe Webhook Events

**Handled Events**:

- `checkout.session.completed`: Credit tokens on purchase or activate tier
- `invoice.paid`: Process subscription renewal (maintains tier)
- `customer.subscription.updated`: Handle tier changes
- `customer.subscription.deleted`: Revert tier to FREE

### Transaction Flow

**Token Purchase Flow**:

1. User clicks "Buy Tokens" on pricing page
2. Frontend calls `POST /api/stripe/checkout` with `packageId`
3. Backend creates Stripe checkout session with metadata
4. User completes payment on Stripe
5. Stripe sends `checkout.session.completed` webhook
6. Webhook handler:
   - Validates signature
   - Extracts userId and tokens from metadata
   - Credits tokens via `TokenBalanceManager.addTokens()`
   - Creates `EARN_PURCHASE` transaction
   - Creates `StripePayment` record
7. User sees updated balance on return to site

**Tier Upgrade Flow**:

1. User clicks "Upgrade to STANDARD" on tier page
2. Frontend calls `POST /api/tiers/upgrade` with `tier: "STANDARD"`
3. Backend creates Stripe subscription checkout
4. User completes payment on Stripe
5. Stripe sends `checkout.session.completed` webhook
6. Webhook handler:
   - Updates `UserTokenBalance.tier` to STANDARD
   - Sets `UserTokenBalance.balance` to 50 (tier capacity)
   - Creates `EARN_PURCHASE` transaction for 50 tokens
   - Creates `Subscription` record
7. User immediately has 50 tokens and STANDARD tier

**Enhancement Flow**:

1. User uploads image and selects TIER_2K (5 tokens)
2. Frontend calls enhancement API
3. Backend:
   - Calls `TokenBalanceManager.hasEnoughTokens(userId, 5)`
   - If insufficient: Returns 402 error with tier upgrade prompt
   - If sufficient: Calls `TokenBalanceManager.consumeTokens()`
   - Creates `ImageEnhancementJob` with `tokensCost: 5`
   - Starts enhancement workflow
4. On success: Job marked COMPLETED
5. On failure: `TokenBalanceManager.refundTokens(userId, 5, jobId)`

---

## Best Practices

### For Users

1. **Check Balance First**: Always verify sufficient balance before starting
   enhancements
2. **Choose Right Tier**: Estimate monthly usage and select appropriate tier
3. **Leverage Regeneration**: For casual use, free regeneration may be
   sufficient
4. **Buy in Bulk**: Larger token packages offer better value per token
5. **Upgrade for Capacity**: Tier upgrades grant immediate tokens plus higher
   regen cap
6. **Monitor Transactions**: Review transaction history to track spending
   patterns

### For Developers

1. **Always Use TokenBalanceManager**: Never manipulate UserTokenBalance
   directly
2. **Atomic Operations**: All token operations use database transactions
3. **Refund on Failure**: Always refund tokens if service fails after
   consumption
4. **Validate Before Consume**: Check balance before deducting tokens
5. **Log Metadata**: Include relevant context in transaction metadata
6. **Handle Edge Cases**: Account for race conditions, network failures, webhook
   retries
7. **Test with Stripe Test Mode**: Use test mode for development and staging

### Security Considerations

1. **Webhook Signature Verification**: Always verify Stripe webhook signatures
2. **Rate Limiting**: Enforce rate limits on voucher redemption (5/hour)
3. **Input Validation**: Validate all user inputs (voucher codes, package IDs)
4. **Idempotency**: Handle duplicate webhook events (Stripe retries)
5. **User Isolation**: Ensure users can only access their own token data
6. **Audit Trail**: Maintain complete transaction history for auditing

---

## Migration Notes

### Historical Context

The token system has evolved through several iterations:

1. **v1 (Initial)**: Simple balance with fixed regeneration cap of 100
2. **v2 (Subscriptions)**: Added monthly subscription plans with token
   allocations
3. **v3 (Current - Token Well Tiers)**: Replaced subscriptions with tier system
   where:
   - Tier upgrades grant immediate tokens (not monthly)
   - Monthly billing maintains tier status only
   - Regeneration caps vary by tier
   - Purchased tokens are unlimited

### Breaking Changes from Previous Documentation

- **Subscription Tokens**: No longer allocated monthly; tiers grant one-time
  capacity
- **Rollover**: Removed (no monthly allocation to roll over)
- **Max Balance**: Now per-tier instead of global 100 cap
- **Token Packages**: Updated pricing and amounts
- **Vouchers**: New types added (PERCENTAGE_BONUS, SUBSCRIPTION_TRIAL)

---

## Troubleshooting

### Common Issues

**Issue**: "Insufficient tokens" error despite recent purchase

- **Cause**: Webhook delay or failure
- **Solution**: Check `/api/tokens/balance` for updated balance
- **Admin Fix**: Manually verify Stripe payment and credit tokens

**Issue**: Regeneration not working

- **Cause**: Tier capacity already reached
- **Solution**: Upgrade tier or purchase token package
- **Check**: `/api/tokens/balance` shows `timeUntilNextRegenMs`

**Issue**: Tier upgrade didn't grant tokens

- **Cause**: Webhook processing failure
- **Solution**: Check Stripe dashboard for webhook delivery status
- **Admin Fix**: Manually process upgrade via `TierManager.upgradeTier()`

**Issue**: Voucher redemption fails with "already redeemed"

- **Cause**: User previously redeemed this voucher
- **Solution**: Try different voucher code
- **Check**: Database `voucher_redemptions` table

### Debugging Tools

**Check User Balance**:

```typescript
const balance = await TokenBalanceManager.getBalance(userId);
console.log(balance);
```

**Check Transaction History**:

```typescript
const transactions = await TokenBalanceManager.getTransactionHistory(
  userId,
  50,
);
console.log(transactions);
```

**Check Tier Info**:

```typescript
const tier = await TierManager.getUserTier(userId);
const info = TierManager.getTierInfo(tier);
console.log(info);
```

**Manual Token Grant** (admin only):

```typescript
await TokenBalanceManager.addTokens({
  userId,
  amount: 100,
  type: TokenTransactionType.EARN_ADMIN_ADJUSTMENT,
  source: "admin_console",
  metadata: { reason: "Compensation for service outage" },
});
```

---

## Appendix

### Environment Variables

Required for token system:

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_TIER_BASIC=price_...
STRIPE_PRICE_TIER_STANDARD=price_...
STRIPE_PRICE_TIER_PREMIUM=price_...
```

### Related Documentation

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Database Schema](./DATABASE_SCHEMA.md) - Full schema reference
- [Business Structure](./BUSINESS_STRUCTURE.md) - Company information

### Future Enhancements

- [ ] Scheduled token grants (e.g., daily login bonus)
- [ ] Token gifting between users
- [ ] Team/organization token pools
- [ ] Token expiration for promotional tokens
- [ ] Tiered pricing based on usage volume
- [ ] Token marketplace for unused tokens
- [ ] Integration with additional payment providers

---

**Document Version**: 3.1 **Last Reviewed**: 2026-02-26 **Next Review**:
2026-03-26
