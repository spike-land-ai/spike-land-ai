# Album Batch Enhancement API

## Overview

This document describes the API endpoint for batch enhancing all photos in an
album. The endpoint processes multiple images in a single batch operation,
automatically handling token consumption, rate limiting, and error recovery with
refunds.

## Endpoint

```
POST /api/albums/[id]/enhance
```

## Authentication

Requires authenticated user session. Returns 401 if not authenticated.

## Authorization

The user must own the album. Returns 403 if unauthorized.

## Rate Limiting

To prevent abuse and manage system load, batch enhancement requests are rate
limited:

- **Limit**: 5 requests per minute per user
- **Storage**: Vercel KV (production) or in-memory (development)
- **Identifier**: `album-batch-enhance:{userId}`

When rate limited, the API returns 429 with retry information.

## Request Body

```typescript
{
  tier: "TIER_1K" | "TIER_2K" | "TIER_4K";  // Required
  skipAlreadyEnhanced?: boolean;             // Optional, default: true
}
```

### Parameters

- **tier** (required): The enhancement tier to use
  - `TIER_1K`: 1024px max dimension, costs 2 tokens per image
  - `TIER_2K`: 2048px max dimension, costs 5 tokens per image
  - `TIER_4K`: 4096px max dimension, costs 10 tokens per image
  - Note: `FREE` tier (0 tokens) is not supported for batch operations

- **skipAlreadyEnhanced** (optional, default: true): If true, skips images
  already enhanced at the selected tier. The API performs optimized database
  queries to count images needing enhancement before fetching data.

## Response

### Success (200 OK)

```typescript
{
  success: true;
  totalImages: number; // Total number of images in album
  skipped: number; // Number of images skipped (already enhanced)
  queued: number; // Number of images queued for enhancement
  totalCost: number; // Total tokens consumed
  newBalance: number; // User's token balance after consumption
  jobs: Array<{
    imageId: string;
    jobId: string; // Batch ID (individual job IDs created by workflow)
  }>;
}
```

### Error Responses

#### 400 Bad Request

- Invalid tier
- Too many images (max 20 per batch)

```typescript
{
  error: string;
  totalImages?: number; // Total images in album
  toEnhance?: number; // Number of images to enhance
  maxBatchSize?: number; // Maximum allowed (20)
}
```

#### 401 Unauthorized

- Not authenticated

#### 402 Payment Required

- Insufficient tokens

```typescript
{
  error: "Insufficient tokens";
  required: number; // Tokens required
  toEnhance: number; // Number of images to enhance
}
```

#### 403 Forbidden

- User does not own the album

#### 404 Not Found

- Album not found
- No images in album

#### 429 Too Many Requests

- Rate limit exceeded (more than 5 requests per minute)

```typescript
{
  error: "Rate limit exceeded for batch enhancement";
  retryAfter: number; // Milliseconds until rate limit resets
}
```

**Response Headers:**

- `X-RateLimit-Remaining`: Number of requests remaining (0 when limited)
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets
- `Retry-After`: Seconds until the rate limit resets

#### 500 Internal Server Error

- Token consumption failed
- Workflow failed to start (tokens automatically refunded)
- Unexpected error

## Implementation Details

### Workflow

1. **Authentication**: Verify user session exists
2. **Rate Limit Check**: Ensure user hasn't exceeded 5 requests/minute
3. **Validate Input**: Check tier is valid (TIER_1K, TIER_2K, or TIER_4K)
4. **Verify Ownership**: Ensure the user owns the album
5. **Count Total Images**: Lightweight query to get total album image count
6. **Count Images to Enhance**: Optimized query based on `skipAlreadyEnhanced`:
   - If true: Count images without completed jobs at selected tier
   - If false: Use total image count
7. **Early Return**: If no images need enhancement (skipped = total)
8. **Validate Batch Size**: Reject if more than 20 images to enhance
9. **Fetch Image Data**: Only fetch required fields (id, originalR2Key) for
   images to enhance
10. **Calculate Cost**: Total tokens = images to enhance × tier cost
11. **Check Balance**: Verify user has enough tokens
12. **Consume Tokens**: Charge tokens upfront for entire batch with metadata
13. **Start Workflow**:
    - **Production** (Vercel): Uses durable workflow infrastructure via
      `workflow/api`
    - **Development**: Direct execution with fire-and-forget pattern
14. **Handle Startup Failure**: Refund tokens if workflow fails to start
15. **Return Summary**: Response includes job tracking information

### Performance Optimizations

- **Query Optimization**: Counts images before fetching data to avoid loading
  large datasets unnecessarily
- **Minimal Field Selection**: Only fetches `id` and `originalR2Key` fields,
  reducing database load
- **Early Rejection**: Validates batch size using count queries before fetching
  full image data
- **Batch ID Generation**: Uses timestamp-based IDs
  (`album-{albumId}-{timestamp}`) for tracking

### Token Costs

| Tier    | Cost per Image |
| ------- | -------------- |
| TIER_1K | 2 tokens       |
| TIER_2K | 5 tokens       |
| TIER_4K | 10 tokens      |

### Batch Processing

- **Maximum batch size**: 20 images per request
- **Sequential Processing**: Images are processed one at a time to avoid rate
  limits on external services
- **Job Creation**: Each image gets its own `ImageEnhancementJob` record in the
  database
- **Status Tracking**: Jobs start with `PROCESSING` status
- **Atomic Refunds**: Failed jobs trigger automatic per-job token refunds
  - Production: Refunds happen after batch completes
  - Development: Refunds happen immediately per failed job

### Environment-Specific Behavior

#### Production (Vercel)

- Uses Vercel's durable workflow infrastructure
- Workflows survive serverless function terminations
- Automatic retry capabilities for transient failures
- Workflow started via `start(batchEnhanceImages, [input])`
- Refunds processed after entire batch completes

#### Development (Local)

- Direct execution without workflow infrastructure
- Fire-and-forget pattern (async, no blocking)
- No automatic retries on failures
- Jobs may be abandoned if process terminates
- Refunds processed immediately per failed job
- Limited to small batches due to memory constraints

### Skip Already Enhanced

When `skipAlreadyEnhanced` is true (default):

- Uses optimized Prisma query with `enhancementJobs.none` filter
- Checks for completed enhancement jobs at the selected tier
- Images with existing enhancements at that tier are counted and skipped
- Allows re-enhancing at a different tier without duplicating work
- Query filters on `status: "COMPLETED"` and matching `tier`

When `skipAlreadyEnhanced` is false:

- All images in album are included in count and fetched
- Creates new enhancement jobs even if the tier was previously used
- Useful for re-processing images with updated AI models
- No filtering on existing enhancement job history

### Token Consumption and Refund Policy

#### Upfront Token Consumption

Tokens are consumed upfront for the entire batch before any processing begins:

```typescript
TokenBalanceManager.consumeTokens({
  userId: string,
  amount: totalCost,
  source: "album_batch_enhancement",
  sourceId: batchId, // e.g., "album-abc123-1234567890"
  metadata: { tier, albumId, imageCount },
});
```

#### Refund Scenarios

1. **Workflow Fails to Start**: Full refund immediately
   - Happens before any jobs are created
   - All tokens returned to user
   - Error message: "Failed to start enhancement workflow. Tokens have been
     refunded."

2. **Individual Jobs Fail**:
   - Production: Refunded after batch completes (via workflow step)
   - Development: Refunded immediately per failed job (via direct execution)
   - Refund amount: `failedCount × ENHANCEMENT_COSTS[tier]`
   - Refund reason includes failure count

3. **Successful Jobs**: No refund (tokens consumed as expected)

#### Preventing Double Refunds

- Development mode handles refunds in `enhanceImageDirect` per job
- Batch-level refund only processes failed job count in production
- Batch workflow tracks which jobs succeeded vs failed
- Each refund includes batch ID for audit trail

## Examples

### Enhance all unenhanced images at TIER_2K

```bash
curl -X POST https://spike.land/api/albums/abc123/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "TIER_2K"
  }'
```

Response:

```json
{
  "success": true,
  "totalImages": 10,
  "skipped": 3,
  "queued": 7,
  "totalCost": 35,
  "newBalance": 65,
  "jobs": [
    { "imageId": "img-1", "jobId": "album-abc123-1234567890" },
    { "imageId": "img-2", "jobId": "album-abc123-1234567890" },
    ...
  ]
}
```

### Re-enhance all images (including already enhanced)

```bash
curl -X POST https://spike.land/api/albums/abc123/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "TIER_4K",
    "skipAlreadyEnhanced": false
  }'
```

Response:

```json
{
  "success": true,
  "totalImages": 10,
  "skipped": 0,
  "queued": 10,
  "totalCost": 100,
  "newBalance": 50,
  "jobs": [...]
}
```

### All images already enhanced

```bash
curl -X POST https://spike.land/api/albums/abc123/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "TIER_1K"
  }'
```

Response:

```json
{
  "success": true,
  "totalImages": 10,
  "skipped": 10,
  "queued": 0,
  "totalCost": 0,
  "newBalance": 100,
  "jobs": []
}
```

### Rate limit exceeded

```bash
# After 6th request within 1 minute
curl -X POST https://spike.land/api/albums/abc123/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "TIER_2K"
  }'
```

Response (429):

```json
{
  "error": "Rate limit exceeded for batch enhancement",
  "retryAfter": 45000
}
```

Headers:

```
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704123456789
Retry-After: 45
```

### Insufficient tokens

```bash
curl -X POST https://spike.land/api/albums/abc123/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "TIER_4K"
  }'
```

Response (402):

```json
{
  "error": "Insufficient tokens",
  "required": 100,
  "toEnhance": 10
}
```

### Batch too large

```bash
curl -X POST https://spike.land/api/albums/abc123/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "TIER_1K"
  }'
```

Response (400):

```json
{
  "error": "Maximum 20 images allowed per batch enhancement. This album has 25 images to enhance. Please enhance in smaller batches.",
  "totalImages": 25,
  "toEnhance": 25,
  "maxBatchSize": 20
}
```

## Testing

Comprehensive test coverage includes:

### Unit Tests

**Authentication & Authorization**

- Returns 401 if not authenticated
- Returns 401 if user ID is missing
- Returns 403 if user does not own album

**Input Validation**

- Returns 400 if tier is missing
- Returns 400 if tier is invalid
- Returns 400 if too many images (over 20)

**Album & Image Validation**

- Returns 404 if album not found
- Returns 404 if album has no images
- Handles single image album
- Handles maximum batch (20 images)
- Optimizes queries for large albums (doesn't fetch if count exceeds limit)

**Already Enhanced Filtering**

- Skips already enhanced images by default
- Enhances all images when `skipAlreadyEnhanced` is false
- Returns success with no jobs if all images already enhanced

**Token Management**

- Returns 402 if insufficient tokens
- Returns 500 if token consumption fails
- Consumes correct amount of tokens
- Returns new balance after consumption
- Refunds tokens if workflow fails to start (production)
- Refunds tokens if direct enhancement throws (development)
- Does not refund if workflow starts successfully

**Rate Limiting**

- Returns 429 when rate limit exceeded
- Includes correct rate limit headers
- Checks rate limit with correct identifier
- Does not consume tokens when rate limited

**Workflow Execution**

- Starts batch enhancement workflow in production mode
- Runs direct enhancement in development mode
- Calculates costs correctly for all tiers (1K, 2K, 4K)

**Error Handling**

- Handles unexpected database errors
- Handles workflow startup failures

Run tests:

```bash
# Run all batch enhancement tests
yarn test src/app/api/albums/[id]/enhance/route.test.ts

# Run with coverage
yarn test:coverage src/app/api/albums/[id]/enhance/route.test.ts

# Run workflow tests
yarn test src/workflows/batch-enhance.workflow.ts
yarn test src/workflows/batch-enhance.direct.test.ts
```

## Files

### API Endpoint

- **Route Handler**: `/src/app/api/albums/[id]/enhance/route.ts`
- **Route Tests**: `/src/app/api/albums/[id]/enhance/route.test.ts`

### Workflow Implementation

- **Production Workflow**: `/src/workflows/batch-enhance.workflow.ts`
- **Development Direct**: `/src/workflows/batch-enhance.direct.ts`
- **Workflow Tests**: `/src/workflows/batch-enhance.direct.test.ts`

### Supporting Modules

- **Token Manager**: `/src/lib/tokens/balance-manager.ts`
- **Workflow Token Manager**: `/src/lib/tokens/balance-manager--workflow.ts`
- **Enhancement Costs**: `/src/lib/tokens/costs.ts`
- **Rate Limiter**: `/src/lib/rate-limiter.ts`
- **Error Handling**: `/src/lib/try-catch.ts`
- **Workflow Error Handling**: `/src/lib/try-catch--no-track.ts`

## Related Documentation

- [Token System](./TOKEN_SYSTEM.md) - Complete token economy documentation
- [Database Schema](./DATABASE_SCHEMA.md) - Schema for albums, images, and jobs
- [API Reference](./API_REFERENCE.md) - All API endpoints
- [Rate Limiting](../src/lib/rate-limiter.ts) - Rate limiting implementation

## Architecture Decisions

### Why Sequential Processing?

Images are processed sequentially (not in parallel) to:

1. Avoid hitting rate limits on external AI services
2. Provide predictable resource consumption
3. Simplify error tracking and recovery
4. Enable graceful degradation under load

### Why Upfront Token Consumption?

Tokens are charged before processing to:

1. Prevent race conditions where balance changes during batch
2. Guarantee users can't overdraft their token balance
3. Simplify refund logic (full refund on startup failure)
4. Provide clear cost visibility before processing begins

### Why 20 Image Limit?

The batch size is limited to 20 images to:

1. Keep request processing time reasonable (~5-10 minutes max)
2. Prevent overwhelming the workflow system
3. Reduce blast radius of failures
4. Encourage incremental processing for large albums
5. Match typical user workflow patterns

### Why Different Refund Logic Dev vs Prod?

Development and production use different refund strategies because:

- **Production**: Durable workflows track all job states, refund in batch
- **Development**: Direct execution must handle refunds immediately per job to
  prevent loss if process terminates
- Both approaches prevent double-refunds through careful state tracking

## Security Considerations

1. **Authentication Required**: All requests must be authenticated
2. **Authorization Enforced**: Users can only enhance their own albums
3. **Rate Limiting**: Prevents abuse through per-user rate limits
4. **Input Validation**: Tier, batch size, and album ownership validated
5. **Token Balance Protection**: Upfront consumption prevents overdrafts
6. **Automatic Refunds**: Failed jobs refund tokens to prevent user loss

## Performance Characteristics

### Database Queries

- **Album ownership check**: Single query with `select: { userId: true }`
- **Total image count**: Lightweight `count()` query
- **Enhanced image count**: Optimized `count()` with job status filter
- **Image fetch**: Minimal fields (`id`, `originalR2Key`) with `take: 20` limit
- **Total queries**: 4-5 queries per request (optimized for minimal data
  transfer)

### Token Operations

- **Balance check**: 1 query to verify sufficient tokens
- **Consumption**: 1 transaction to deduct tokens with metadata
- **Refund**: 1 transaction per refund event (startup failure or batch
  completion)

### Processing Time

- **API Response**: <1 second (returns before processing completes)
- **Per Image**: 5-15 seconds (depends on tier and image size)
- **20 Image Batch**: 2-5 minutes total processing time
- **Rate Limit**: Adds sequential delays between images

## Monitoring and Observability

### Logging

The API and workflows emit structured logs:

```typescript
// Startup
console.log("Album batch enhancement workflow started (production)", {
  batchId,
  albumId,
  imageCount,
});

// Development mode
console.log("[Dev Batch Enhancement] Starting batch...", {
  batchId,
  images: images.length,
});

// Per-image progress
console.log("[Dev Batch Enhancement] Processing image...", {
  imageId,
  jobId,
});

// Completion
console.log("[Dev Batch Enhancement] Batch completed", {
  batchId,
  successful,
  failed,
  refunded,
});
```

### Error Tracking

Errors are logged with context:

```typescript
console.error("[Album Enhance] Workflow failed to start:", workflowError);
console.error("[Dev Batch Enhancement] Failed to process image:", error);
```

### Metrics to Monitor

- **Request rate**: Track 429 responses to identify abuse patterns
- **Success rate**: Monitor batch completion vs failure rates
- **Processing time**: Alert on batches exceeding 10 minutes
- **Refund rate**: High refund rates indicate service issues
- **Token consumption**: Track spend patterns per user
