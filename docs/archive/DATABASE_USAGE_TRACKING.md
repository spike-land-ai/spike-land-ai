# Database Table Usage Tracking

This document tracks where each database table is used in the codebase.

## User

**Used in 49 files:**

- `src/app/admin/page.test.tsx`
- `src/app/admin/page.tsx`
- `src/app/api/admin/analytics/tokens/route.test.ts`
- `src/app/api/admin/analytics/tokens/route.ts`
- `src/app/api/admin/analytics/users/route.test.ts`
- `src/app/api/admin/analytics/users/route.ts`
- `src/app/api/admin/dashboard/route.test.ts`
- `src/app/api/admin/dashboard/route.ts`
- `src/app/api/admin/users/[userId]/enhancements/route.test.ts`
- `src/app/api/admin/users/[userId]/enhancements/route.ts`
- `src/app/api/admin/users/password/route.test.ts`
- `src/app/api/admin/users/password/route.ts`
- `src/app/api/admin/users/route.test.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/auth/check-email/route.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/gallery/public-albums/route.test.ts`
- `src/app/api/gallery/public-albums/route.ts`
- `src/app/api/images/batch-upload/route.ts`
- `src/app/api/images/upload/route.ts`
- `src/app/api/merch/checkout/route.test.ts`
- `src/app/api/merch/checkout/route.ts`
- `src/app/api/merch/orders/[id]/route.test.ts`
- `src/app/api/merch/orders/[id]/route.ts`
- `src/app/api/merch/products/route.test.ts`
- `src/app/api/merch/products/route.ts`
- `src/app/api/stripe/checkout/route.test.ts`
- `src/app/api/stripe/checkout/route.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/app/api/tiers/upgrade/route.ts`
- `src/auth.ts`
- `src/lib/auth/admin-middleware.test.ts`
- `src/lib/auth/admin-middleware.ts`
- `src/lib/auth/bootstrap-admin.test.ts`
- `src/lib/auth/bootstrap-admin.ts`
- `src/lib/referral/code-generator.test.ts`
- `src/lib/referral/code-generator.ts`
- `src/lib/referral/fraud-detection.test.ts`
- `src/lib/referral/fraud-detection.ts`
- `src/lib/referral/tracker.test.ts`
- `src/lib/referral/tracker.ts`
- `src/lib/reports/system-report.test.ts`
- `src/lib/reports/system-report.ts`
- `src/lib/tokens/regeneration.test.ts`
- `src/lib/tokens/regeneration.ts`
- `src/lib/tokens/tier-manager.ts`
- `src/lib/tracking/attribution.test.ts`
- `src/lib/tracking/attribution.ts`
- `src/scripts/run-album-migration.ts`

## Account

**Used in 4 files:**

- `src/app/api/admin/analytics/users/route.test.ts`
- `src/app/api/admin/analytics/users/route.ts`
- `src/lib/reports/system-report.test.ts`
- `src/lib/reports/system-report.ts`

## MarketingAccount

**Used in 8 files:**

- `src/app/admin/marketing/layout.tsx`
- `src/app/api/admin/marketing/accounts/route.ts`
- `src/app/api/admin/marketing/campaigns/route.ts`
- `src/app/api/marketing/facebook/callback/route.ts`
- `src/app/api/marketing/google/callback/route.ts`
- `src/lib/marketing/campaign-sync.ts`
- `src/lib/reports/meta-marketing-client.test.ts`
- `src/lib/reports/meta-marketing-client.ts`

## Session

**Used in 2 files:**

- `src/app/api/admin/analytics/users/route.test.ts`
- `src/app/api/admin/analytics/users/route.ts`

## VerificationToken

_No explicit usages found in `src/` via `prisma.modelName`._

## App

**Used in 5 files:**

- `src/app/api/apps/[id]/route.test.ts`
- `src/app/api/apps/[id]/route.ts`
- `src/app/api/apps/route.test.ts`
- `src/app/api/apps/route.ts`
- `src/app/my-apps/page.tsx`

## Requirement

_No explicit usages found in `src/` via `prisma.modelName`._

## MonetizationModel

_No explicit usages found in `src/` via `prisma.modelName`._

## UserTokenBalance

**Used in 9 files:**

- `src/app/api/admin/analytics/tokens/route.test.ts`
- `src/app/api/admin/analytics/tokens/route.ts`
- `src/app/api/admin/users/route.test.ts`
- `src/app/api/admin/users/route.ts`
- `src/lib/reports/system-report.test.ts`
- `src/lib/reports/system-report.ts`
- `src/lib/tokens/regeneration.test.ts`
- `src/lib/tokens/regeneration.ts`
- `src/lib/tokens/tier-manager.ts`

## TokenTransaction

**Used in 11 files:**

- `src/app/admin/page.test.tsx`
- `src/app/admin/page.tsx`
- `src/app/api/admin/analytics/tokens/route.test.ts`
- `src/app/api/admin/analytics/tokens/route.ts`
- `src/app/api/admin/dashboard/route.test.ts`
- `src/app/api/admin/dashboard/route.ts`
- `src/app/api/admin/users/route.test.ts`
- `src/app/api/admin/users/route.ts`
- `src/lib/reports/system-report.test.ts`
- `src/lib/reports/system-report.ts`
- `src/lib/tokens/balance-manager.ts`

## TokensPackage

**Used in 2 files:**

- `src/app/api/admin/analytics/tokens/route.test.ts`
- `src/app/api/admin/analytics/tokens/route.ts`

## StripePayment

**Used in 2 files:**

- `src/app/api/admin/analytics/tokens/route.test.ts`
- `src/app/api/admin/analytics/tokens/route.ts`

## EnhancedImage

**Used in 29 files:**

- `src/app/api/admin/gallery/browse/route.test.ts`
- `src/app/api/admin/gallery/browse/route.ts`
- `src/app/api/admin/gallery/route.test.ts`
- `src/app/api/admin/gallery/route.ts`
- `src/app/api/admin/photos/route.test.ts`
- `src/app/api/admin/photos/route.ts`
- `src/app/api/albums/[id]/images/route.test.ts`
- `src/app/api/albums/[id]/images/route.ts`
- `src/app/api/images/[id]/route.test.ts`
- `src/app/api/images/[id]/route.ts`
- `src/app/api/images/[id]/share/route.test.ts`
- `src/app/api/images/[id]/share/route.ts`
- `src/app/api/images/[id]/versions/route.test.ts`
- `src/app/api/images/[id]/versions/route.ts`
- `src/app/api/images/batch-enhance/route.ts`
- `src/app/api/images/enhance/route.ts`
- `src/app/api/images/move-to-album/route.test.ts`
- `src/app/api/images/move-to-album/route.ts`
- `src/app/api/images/parallel-enhance/route.ts`
- `src/app/api/images/route.ts`
- `src/app/api/images/upload/route.ts`
- `src/app/api/merch/cart/route.test.ts`
- `src/app/api/merch/cart/route.ts`
- `src/app/api/share/[token]/download/route.ts`
- `src/app/apps/pixel/[imageId]/page.tsx`
- `src/app/apps/pixel/page.tsx`
- `src/app/share/[token]/opengraph-image.tsx`
- `src/app/share/[token]/page.tsx`
- `src/scripts/run-album-migration.ts`

## ImageEnhancementJob

**Used in 34 files:**

- `src/app/admin/page.test.tsx`
- `src/app/admin/page.tsx`
- `src/app/api/admin/dashboard/route.test.ts`
- `src/app/api/admin/dashboard/route.ts`
- `src/app/api/admin/gallery/route.test.ts`
- `src/app/api/admin/gallery/route.ts`
- `src/app/api/admin/jobs/route.test.ts`
- `src/app/api/admin/jobs/route.ts`
- `src/app/api/admin/system/health/route.test.ts`
- `src/app/api/admin/system/health/route.ts`
- `src/app/api/admin/users/[userId]/enhancements/route.test.ts`
- `src/app/api/admin/users/[userId]/enhancements/route.ts`
- `src/app/api/images/enhance/route.ts`
- `src/app/api/images/export/route.ts`
- `src/app/api/images/parallel-enhance/route.ts`
- `src/app/api/images/upload/route.ts`
- `src/app/api/jobs/[jobId]/cancel/route.test.ts`
- `src/app/api/jobs/[jobId]/cancel/route.ts`
- `src/app/api/jobs/[jobId]/route.test.ts`
- `src/app/api/jobs/[jobId]/route.ts`
- `src/app/api/jobs/[jobId]/stream/route.test.ts`
- `src/app/api/jobs/[jobId]/stream/route.ts`
- `src/app/api/jobs/batch-status/route.test.ts`
- `src/app/api/jobs/batch-status/route.ts`
- `src/app/api/jobs/mix-history/route.ts`
- `src/app/apps/pixel/mix/[jobId]/page.tsx`
- `src/lib/jobs/cleanup.test.ts`
- `src/lib/jobs/cleanup.ts`
- `src/lib/reports/system-report.test.ts`
- `src/lib/reports/system-report.ts`
- `src/workflows/batch-enhance.direct.ts`
- `src/workflows/batch-enhance.workflow.ts`
- `src/workflows/enhance-image.direct.ts`
- `src/workflows/enhance-image.workflow.ts`

## Subscription

**Used in 5 files:**

- `src/app/api/stripe/checkout/route.test.ts`
- `src/app/api/stripe/checkout/route.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/app/api/tiers/upgrade/route.ts`
- `src/lib/tokens/tier-manager.ts`

## SubscriptionPlan

_No explicit usages found in `src/` via `prisma.modelName`._

## Album

**Used in 21 files:**

- `src/app/api/albums/[id]/enhance/route.ts`
- `src/app/api/albums/[id]/images/route.test.ts`
- `src/app/api/albums/[id]/images/route.ts`
- `src/app/api/albums/[id]/route.test.ts`
- `src/app/api/albums/[id]/route.ts`
- `src/app/api/albums/route.test.ts`
- `src/app/api/albums/route.ts`
- `src/app/api/gallery/public-albums/route.test.ts`
- `src/app/api/gallery/public-albums/route.ts`
- `src/app/api/images/batch-upload/route.ts`
- `src/app/api/images/move-to-album/route.test.ts`
- `src/app/api/images/move-to-album/route.ts`
- `src/app/api/images/upload/route.ts`
- `src/app/canvas/[albumId]/page.tsx`
- `src/lib/albums/ensure-user-albums.test.ts`
- `src/lib/albums/ensure-user-albums.ts`
- `src/lib/gallery/super-admin-photos.test.ts`
- `src/lib/gallery/super-admin-photos.ts`
- `src/scripts/run-album-migration.ts`
- `src/workflows/enhance-image.shared.test.ts`
- `src/workflows/pipeline-resolver.ts`

## AlbumImage

**Used in 8 files:**

- `src/app/api/albums/[id]/enhance/route.ts`
- `src/app/api/albums/[id]/images/route.test.ts`
- `src/app/api/albums/[id]/images/route.ts`
- `src/app/api/albums/[id]/route.ts`
- `src/app/api/images/move-to-album/route.test.ts`
- `src/app/api/images/move-to-album/route.ts`
- `src/app/api/images/upload/route.ts`
- `src/scripts/run-album-migration.ts`

## Voucher

**Used in 9 files:**

- `src/app/admin/page.test.tsx`
- `src/app/admin/page.tsx`
- `src/app/api/admin/dashboard/route.test.ts`
- `src/app/api/admin/dashboard/route.ts`
- `src/app/api/admin/vouchers/route.test.ts`
- `src/app/api/admin/vouchers/route.ts`
- `src/lib/reports/system-report.test.ts`
- `src/lib/reports/system-report.ts`
- `src/lib/vouchers/voucher-manager.ts`

## VoucherRedemption

_No explicit usages found in `src/` via `prisma.modelName`._

## Referral

**Used in 6 files:**

- `src/lib/referral/fraud-detection.test.ts`
- `src/lib/referral/fraud-detection.ts`
- `src/lib/referral/rewards.test.ts`
- `src/lib/referral/rewards.ts`
- `src/lib/referral/tracker.test.ts`
- `src/lib/referral/tracker.ts`

## AuditLog

**Used in 1 files:**

- `src/lib/audit/logger.ts`

## ErrorLog

**Used in 9 files:**

- `src/app/admin/errors/page.tsx`
- `src/app/api/admin/errors/route.test.ts`
- `src/app/api/admin/errors/route.ts`
- `src/app/api/admin/errors/stats/route.ts`
- `src/app/api/cron/cleanup-errors/route.test.ts`
- `src/app/api/cron/cleanup-errors/route.ts`
- `src/lib/errors/error-reporter.server.ts`
- `src/lib/reports/system-report.test.ts`
- `src/lib/reports/system-report.ts`

## Feedback

**Used in 6 files:**

- `src/app/admin/feedback/page.test.tsx`
- `src/app/admin/feedback/page.tsx`
- `src/app/api/admin/feedback/route.test.ts`
- `src/app/api/admin/feedback/route.ts`
- `src/app/api/feedback/route.test.ts`
- `src/app/api/feedback/route.ts`

## FeaturedGalleryItem

**Used in 5 files:**

- `src/app/api/admin/gallery/reorder/route.ts`
- `src/app/api/admin/gallery/route.test.ts`
- `src/app/api/admin/gallery/route.ts`
- `src/app/api/gallery/route.test.ts`
- `src/app/api/gallery/route.ts`

## BoxTier

**Used in 2 files:**

- `src/app/api/boxes/route.ts`
- `src/app/boxes/new/page.tsx`

## Box

**Used in 12 files:**

- `src/app/api/boxes/[id]/action/route.ts`
- `src/app/api/boxes/[id]/clone/route.ts`
- `src/app/api/boxes/[id]/messages/route.ts`
- `src/app/api/boxes/[id]/route.ts`
- `src/app/api/boxes/route.ts`
- `src/app/api/v1/agent/heartbeat/route.test.ts`
- `src/app/api/v1/agent/heartbeat/route.ts`
- `src/app/api/v1/agent/tasks/route.test.ts`
- `src/app/api/v1/agent/tasks/route.ts`
- `src/app/boxes/[id]/page.tsx`
- `src/app/boxes/new/page.tsx`
- `src/app/boxes/page.tsx`

## BoxAction

**Used in 3 files:**

- `src/app/api/boxes/[id]/action/route.ts`
- `src/app/api/boxes/[id]/clone/route.ts`
- `src/app/api/boxes/route.ts`

## AgentTask

**Used in 2 files:**

- `src/app/api/v1/agent/tasks/route.test.ts`
- `src/app/api/v1/agent/tasks/route.ts`

## EmailLog

**Used in 2 files:**

- `src/app/api/admin/emails/route.test.ts`
- `src/app/api/admin/emails/route.ts`

## TrackedUrl

**Used in 4 files:**

- `src/app/admin/sitemap/page.test.tsx`
- `src/app/admin/sitemap/page.tsx`
- `src/app/api/admin/tracked-urls/route.test.ts`
- `src/app/api/admin/tracked-urls/route.ts`

## ApiKey

**Used in 1 files:**

- `src/lib/mcp/api-key-manager.ts`

## McpGenerationJob

**Used in 1 files:**

- `src/lib/mcp/generation-service.ts`

## BoxMessage

**Used in 1 files:**

- `src/app/api/boxes/[id]/messages/route.ts`

## EnhancementPipeline

**Used in 11 files:**

- `src/app/api/albums/[id]/route.ts`
- `src/app/api/pipelines/[id]/fork/route.test.ts`
- `src/app/api/pipelines/[id]/fork/route.ts`
- `src/app/api/pipelines/[id]/route.test.ts`
- `src/app/api/pipelines/[id]/route.ts`
- `src/app/api/pipelines/reference-images/route.ts`
- `src/app/api/pipelines/route.test.ts`
- `src/app/api/pipelines/route.ts`
- `src/app/apps/pixel/pipelines/page.tsx`
- `src/workflows/enhance-image.shared.test.ts`
- `src/workflows/pipeline-resolver.ts`

## VisitorSession

**Used in 18 files:**

- `src/app/api/admin/marketing/analytics/campaigns/route.test.ts`
- `src/app/api/admin/marketing/analytics/campaigns/route.ts`
- `src/app/api/admin/marketing/analytics/export/route.ts`
- `src/app/api/admin/marketing/analytics/funnel/route.test.ts`
- `src/app/api/admin/marketing/analytics/funnel/route.ts`
- `src/app/api/admin/marketing/analytics/overview/route.test.ts`
- `src/app/api/admin/marketing/analytics/overview/route.ts`
- `src/app/api/cron/cleanup-tracking/route.ts`
- `src/app/api/tracking/event/route.test.ts`
- `src/app/api/tracking/event/route.ts`
- `src/app/api/tracking/pageview/route.test.ts`
- `src/app/api/tracking/pageview/route.ts`
- `src/app/api/tracking/session/route.test.ts`
- `src/app/api/tracking/session/route.ts`
- `src/lib/reports/system-report.test.ts`
- `src/lib/reports/system-report.ts`
- `src/lib/tracking/attribution.test.ts`
- `src/lib/tracking/attribution.ts`

## PageView

**Used in 1 files:**

- `src/app/api/cron/cleanup-tracking/route.ts`

## AnalyticsEvent

**Used in 3 files:**

- `src/app/api/cron/cleanup-tracking/route.ts`
- `src/app/api/tracking/event/route.test.ts`
- `src/app/api/tracking/event/route.ts`

## CampaignAttribution

**Used in 9 files:**

- `src/app/api/admin/marketing/analytics/campaigns/route.test.ts`
- `src/app/api/admin/marketing/analytics/campaigns/route.ts`
- `src/app/api/admin/marketing/analytics/export/route.ts`
- `src/app/api/admin/marketing/analytics/funnel/route.test.ts`
- `src/app/api/admin/marketing/analytics/funnel/route.ts`
- `src/app/api/admin/marketing/analytics/overview/route.test.ts`
- `src/app/api/admin/marketing/analytics/overview/route.ts`
- `src/lib/tracking/attribution.test.ts`
- `src/lib/tracking/attribution.ts`

## CampaignMetricsCache

**Used in 5 files:**

- `src/app/api/admin/marketing/analytics/campaigns/route.test.ts`
- `src/app/api/admin/marketing/analytics/overview/route.test.ts`
- `src/app/api/cron/cleanup-tracking/route.ts`
- `src/lib/marketing/campaign-sync.ts`
- `src/lib/tracking/metrics-cache.ts`

## CampaignLink

**Used in 2 files:**

- `src/app/api/admin/marketing/link/route.ts`
- `src/lib/marketing/campaign-sync.ts`

## AudioMixerProject

**Used in 2 files:**

- `src/app/api/audio/[trackId]/route.ts`
- `src/app/api/audio/upload/route.ts`

## AudioTrack

_No explicit usages found in `src/` via `prisma.modelName`._

## MerchCategory

**Used in 2 files:**

- `src/app/admin/merch/products/page.tsx`
- `src/app/merch/page.tsx`

## MerchProduct

**Used in 10 files:**

- `src/app/admin/merch/page.tsx`
- `src/app/admin/merch/products/page.tsx`
- `src/app/api/merch/cart/route.test.ts`
- `src/app/api/merch/cart/route.ts`
- `src/app/api/merch/products/route.test.ts`
- `src/app/api/merch/products/route.ts`
- `src/app/merch/[productId]/page.tsx`
- `src/app/merch/page.tsx`
- `src/lib/pod/order-service.test.ts`
- `src/lib/pod/order-service.ts`

## MerchVariant

_No explicit usages found in `src/` via `prisma.modelName`._

## MerchCart

**Used in 6 files:**

- `src/app/api/merch/cart/[itemId]/route.test.ts`
- `src/app/api/merch/cart/[itemId]/route.ts`
- `src/app/api/merch/cart/route.test.ts`
- `src/app/api/merch/cart/route.ts`
- `src/app/api/merch/checkout/route.test.ts`
- `src/app/api/merch/checkout/route.ts`

## MerchCartItem

**Used in 4 files:**

- `src/app/api/merch/cart/[itemId]/route.test.ts`
- `src/app/api/merch/cart/[itemId]/route.ts`
- `src/app/api/merch/cart/route.test.ts`
- `src/app/api/merch/cart/route.ts`

## MerchOrder

**Used in 14 files:**

- `src/app/admin/merch/orders/[orderId]/page.tsx`
- `src/app/admin/merch/orders/page.tsx`
- `src/app/admin/merch/page.tsx`
- `src/app/api/merch/checkout/route.test.ts`
- `src/app/api/merch/checkout/route.ts`
- `src/app/api/merch/orders/[id]/route.test.ts`
- `src/app/api/merch/orders/[id]/route.ts`
- `src/app/api/merch/orders/route.test.ts`
- `src/app/api/merch/orders/route.ts`
- `src/app/orders/[orderId]/confirmation/page.tsx`
- `src/app/orders/[orderId]/page.tsx`
- `src/app/orders/page.tsx`
- `src/lib/pod/order-service.test.ts`
- `src/lib/pod/order-service.ts`

## MerchOrderItem

**Used in 2 files:**

- `src/lib/pod/order-service.test.ts`
- `src/lib/pod/order-service.ts`

## MerchShipment

_No explicit usages found in `src/` via `prisma.modelName`._

## MerchOrderEvent

**Used in 2 files:**

- `src/lib/pod/order-service.test.ts`
- `src/lib/pod/order-service.ts`

## MerchWebhookEvent

**Used in 2 files:**

- `src/app/api/merch/webhooks/prodigi/route.test.ts`
- `src/app/api/merch/webhooks/prodigi/route.ts`

## ExternalAgentSession

**Used in 6 files:**

- `src/app/admin/agents/page.tsx`
- `src/app/api/admin/agents/[sessionId]/activities/route.ts`
- `src/app/api/admin/agents/[sessionId]/approve-plan/route.ts`
- `src/app/api/admin/agents/[sessionId]/message/route.ts`
- `src/app/api/admin/agents/[sessionId]/route.ts`
- `src/app/api/admin/agents/route.ts`

## AgentSessionActivity

**Used in 3 files:**

- `src/app/api/admin/agents/[sessionId]/activities/route.ts`
- `src/app/api/admin/agents/[sessionId]/approve-plan/route.ts`
- `src/app/api/admin/agents/[sessionId]/message/route.ts`
