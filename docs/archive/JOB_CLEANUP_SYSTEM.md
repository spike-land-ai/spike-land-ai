# Job Cleanup System

This document describes the automatic job timeout and cleanup mechanism for
stuck enhancement jobs.

## Overview

The job cleanup system automatically detects and cleans up enhancement jobs that
have been stuck in the `PROCESSING` state for too long. When a job is cleaned
up:

1. The job status is changed from `PROCESSING` to `FAILED`
2. An error message is added explaining the timeout
3. Tokens are automatically refunded to the user
4. Transaction history is updated with the refund

## Components

### Core Cleanup Logic

**Location**: `/src/lib/jobs/cleanup.ts`

Main functions:

- `findStuckJobs()` - Finds jobs stuck in PROCESSING state
- `cleanupStuckJobs()` - Main cleanup function that processes stuck jobs
- Configurable via `CleanupOptions`:
  - `timeoutMs` - Timeout threshold (default: 5 minutes)
  - `dryRun` - Preview mode without making changes
  - `batchSize` - Max jobs to process per run (default: 100)

### Admin API Endpoint

**Endpoint**: `POST /api/admin/jobs/cleanup`

> **Note** (2026-02-26): This admin endpoint is documented but the route file
> does not currently exist. The cleanup can be triggered programmatically via
> the `cleanupStuckJobs()` function or automatically via the cron endpoint
> below.

Allows admins to manually trigger cleanup.

**Authentication**: Requires admin role

**Request Body** (all optional):

```json
{
  "timeoutMs": 600000, // 10 minutes
  "dryRun": true, // Preview mode
  "batchSize": 50 // Process up to 50 jobs
}
```

**Response**:

```json
{
  "success": true,
  "result": {
    "totalFound": 3,
    "cleanedUp": 3,
    "failed": 0,
    "tokensRefunded": 27,
    "jobs": [...],
    "errors": []
  },
  "message": "Successfully cleaned up 3 stuck jobs and refunded 27 tokens"
}
```

### Automated Cron Job

**Endpoint**: `GET /api/cron/cleanup-jobs`

**Schedule**: Runs every 15 minutes (configured via GitHub Actions cron or AWS
scheduled tasks)

**Authentication**: Protected by `validateCronSecret()` from
`src/lib/cron-auth.ts` (accepts `Authorization: Bearer <secret>` or
`x-cron-secret` headers, uses timing-safe comparison)

**Configuration** (GitHub Actions or AWS EventBridge):

Schedule: `*/15 * * * *` (every 15 minutes)

````
## Usage

### Manual Cleanup via API

```bash
# Dry run to see what would be cleaned up
curl -X POST https://spike.land/api/admin/jobs/cleanup \
  -H "Content-Type: application/json" \
  -H "Cookie: your-admin-session-cookie" \
  -d '{"dryRun": true}'

# Actually clean up stuck jobs (default 5min timeout)
curl -X POST https://spike.land/api/admin/jobs/cleanup \
  -H "Cookie: your-admin-session-cookie"

# Clean up with custom timeout (10 minutes)
curl -X POST https://spike.land/api/admin/jobs/cleanup \
  -H "Content-Type: application/json" \
  -H "Cookie: your-admin-session-cookie" \
  -d '{"timeoutMs": 600000}'
````

### Programmatic Usage

```typescript
import { cleanupStuckJobs } from "@/lib/jobs/cleanup";

// Use defaults (5 minute timeout)
const result = await cleanupStuckJobs();

// Custom configuration
const result = await cleanupStuckJobs({
  timeoutMs: 10 * 60 * 1000, // 10 minutes
  batchSize: 50,
  dryRun: false,
});

console.log(`Cleaned up ${result.cleanedUp} jobs`);
console.log(`Refunded ${result.tokensRefunded} tokens`);
```

## Configuration

### Environment Variables

**Required for production**:

- `CRON_SECRET` - Secret token for authenticating cron requests

**Set in AWS ECS environment** or GitHub Actions secrets.

### Timeout Threshold

Default: 5 minutes (300,000 ms)

To change the default, modify `DEFAULT_TIMEOUT_MS` in `/src/lib/jobs/cleanup.ts`

### Cron Schedule

Default: Every 15 minutes

To change the schedule, modify the cron configuration:

- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour at minute 0
- `0 */6 * * *` - Every 6 hours

[Cron syntax reference](https://crontab.guru/)

## How It Works

### Detection

Jobs are considered "stuck" if:

1. Status is `PROCESSING`, AND
2. Either:
   - `processingStartedAt` is older than the timeout threshold, OR
   - `processingStartedAt` is null and `updatedAt` is older than the timeout
     threshold

### Cleanup Process

For each stuck job:

1. **Update job status**: Mark as `FAILED` with timeout error message
2. **Refund tokens**: Use `TokenBalanceManager.refundTokens()`
3. **Record transaction**: Create `REFUND` transaction with reason
4. **Log results**: Structured logging for monitoring

### Error Handling

- Individual job failures don't stop the batch
- Partial refund failures are tracked separately
- All errors are logged with context for debugging
- Results include both successful and failed jobs

## Monitoring

### Logs

Check application logs for cleanup activity:

```
[INFO] Starting stuck jobs cleanup
[INFO] Found stuck jobs count=3
[INFO] Cleaning up stuck job jobId=abc123 tokensCost=10
[INFO] Job cleaned up successfully tokensRefunded=10 processingDuration=600s
[INFO] Cleanup completed totalFound=3 cleanedUp=3 tokensRefunded=27
```

### Metrics

Monitor these metrics via admin dashboard:

- Jobs stuck in PROCESSING state
- Cleanup frequency and success rate
- Token refund volume
- Job timeout rate by tier

### Alerts

Consider setting up alerts for:

- High number of stuck jobs (> 10)
- Frequent cleanup failures
- Large refund volumes
- Cleanup not running (cron failure)

## Testing

### Unit Tests

```bash
# Test cleanup logic
yarn test src/lib/jobs/cleanup.test.ts

# Test admin endpoint
yarn test src/app/api/admin/jobs/cleanup/route.test.ts

# Test cron endpoint
yarn test src/app/api/cron/cleanup-jobs/route.test.ts

# All cleanup tests
yarn test cleanup
```

### Manual Testing

1. **Create a stuck job** (in development):
   ```sql
   UPDATE image_enhancement_jobs
   SET status = 'PROCESSING',
       "processingStartedAt" = NOW() - INTERVAL '10 minutes'
   WHERE id = 'some-job-id';
   ```

2. **Run cleanup**:
   ```bash
   curl -X POST http://localhost:3000/api/admin/jobs/cleanup
   ```

3. **Verify**:
   - Job status changed to `FAILED`
   - Tokens refunded to user
   - Transaction created

## Troubleshooting

### Cleanup not running automatically

1. Check that `CRON_SECRET` environment variable is set in AWS ECS task
   definition
2. Verify the scheduled task or GitHub Actions cron workflow is active
3. Review application logs for errors

### Jobs not being cleaned up

1. Check timeout threshold - jobs might not be old enough
2. Verify job status is `PROCESSING`
3. Check database connection
4. Review cleanup logs for errors

### Token refunds failing

1. Verify user exists
2. Check `TokenBalanceManager` logs
3. Ensure database transaction isn't failing
4. Review token transaction history

## Future Improvements

Potential enhancements:

- [ ] Configurable timeout per tier (TIER_4K might need longer)
- [ ] Webhook notifications for stuck jobs
- [ ] Automatic retry before cleanup
- [ ] Dashboard view of cleanup history
- [ ] Metrics export to monitoring service
- [ ] Custom cleanup rules per job type

## Related Cron Jobs

- **`/api/cron/sync-box-status`**: Synchronizes Box records with actual EC2
  instance state. Also protected by `validateCronSecret()`.

## Related Documentation

- [Token System](./architecture/TOKEN_SYSTEM.md)
- [Cron Authentication](./architecture/API_REFERENCE.md#cron-authentication)
- [AWS Migration](./architecture/AWS_MIGRATION.md)
