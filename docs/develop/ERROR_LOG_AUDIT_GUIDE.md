# Error Log Audit Guide

This guide provides instructions for auditing error logs, identifying common
error patterns, and monitoring application health using the `ErrorLog` table and
the `tryCatch` utility.

## Overview

The application uses a centralized error handling mechanism via the `tryCatch`
utility in `src/lib/try-catch.ts`. Errors caught by this utility are
automatically logged to the `ErrorLog` database table.

**Table Name**: `error_logs`

## Auditing Process

### 1. Accessing Logs

Errors can be accessed via:

1. **Database Access**: Querying the `error_logs` table directly via Prisma
   Studio or SQL.
2. **Admin Dashboard**: (If implemented) The Admin UI typically exposes an error
   log viewer at `/admin/errors`.

### 2. Key Columns to Monitor

- `timestamp`: When the error occurred.
- `environment`: `FRONTEND` or `BACKEND`.
- `errorType`: The class name of the error (e.g., `Error`,
  `PrismaClientKnownRequestError`).
- `errorCode`: Custom error code provided in `tryCatch` options (e.g.,
  `IMG_UPLOAD_FAILED`).
- `message`: The error message.
- `stack`: Stack trace (useful for debugging).
- `userId`: The user ID associated with the error (if available).
- `route`: The API route or page path where the error occurred.
- `metadata`: JSON field containing additional context (e.g., input parameters).

### 3. Common Query Patterns

#### Find High Frequency Errors

Identify which errors are happening most frequently.

```sql
SELECT message, COUNT(*) as count
FROM error_logs
GROUP BY message
ORDER BY count DESC
LIMIT 10;
```

#### Find Errors by User

Debug issues reported by a specific user.

```sql
SELECT *
FROM error_logs
WHERE "userId" = 'cuid_of_user'
ORDER BY timestamp DESC;
```

#### Find Recent Critical Errors

Look for errors in the last hour.

```sql
SELECT *
FROM error_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

#### Filter by Error Code

Find specific known error types.

```sql
SELECT *
FROM error_logs
WHERE "errorCode" = 'STRIPE_PAYMENT_FAILED';
```

## Common Error Patterns

### Database Connection Errors

- **Message**: `PrismaClientInitializationError` or "Can't reach database
  server".
- **Action**: Check database connection string, firewall rules, and database
  status.

### Validation Errors

- **Message**: `ZodError` or "Validation failed".
- **Action**: Review input validation schemas in API routes. Check `metadata`
  for invalid fields.

### Third-Party API Failures

- **Message**: 500 errors from Stripe, Gemini, or R2.
- **Action**: Check API keys, rate limits, and service status of the third-party
  provider.
- **Tip**: Look for `errorCode` like `GEMINI_API_ERROR` if manually
  instrumented.

### Permission Errors

- **Message**: "Forbidden" or "Unauthorized".
- **Action**: Verify user roles and ownership checks in the code. Ensure
  `requireAdmin` or `requireUser` middlewares are correctly used.

## Monitoring Recommendations

1. **Alerting**: Set up alerts for sudden spikes in error count.
2. **Cleanup**: Periodically clean up old logs to save storage. (e.g.,
   `DELETE FROM error_logs WHERE timestamp < NOW() - INTERVAL '30 days'`).
3. **Context**: Always provide `userId` and `route` context in `tryCatch` calls
   when possible.

## Using `tryCatch` for Better Logs

To ensure logs are useful, use the `tryCatch` utility with context:

```typescript
import { tryCatch } from "@/lib/try-catch";

const { data, error } = await tryCatch(
  someAsyncFunction(),
  {
    context: {
      userId: session.user.id,
      route: "/api/my-feature",
      metadata: { param: "value" },
    },
    errorCode: "MY_FEATURE_ERROR",
  },
);
```
