# Error Tracking (formerly Sentry)

> **Status**: Sentry was removed in Feb 2026. All error tracking now uses the
> built-in ErrorLog pipeline.

## Current Architecture

Errors are captured through two parallel paths, both writing to the `ErrorLog`
PostgreSQL table:

### Client-Side

```
Browser Error → console-capture.client.ts → batched POST /api/errors/report → ErrorLog table
```

- Captures `console.error()`, uncaught exceptions, unhandled rejections
- Batching: 5s delay or 10 errors max
- Deduplication: 60s window, fingerprint-based
- Flush on page unload via `navigator.sendBeacon()`

### Server-Side

```
Server Error → console-capture.server.ts → batched POST /api/errors/report → ErrorLog table
```

- Captures `console.error()` calls during server runtime
- Batching: 2s delay or 10 errors max
- Skips structured logger output and workflow runtime

### Error Boundaries

```
React component throws → ErrorBoundary.componentDidCatch → reportErrorBoundary() → queue → ErrorLog
```

### Noise Filtering

19 noise patterns are filtered at the `/api/errors/report` handler before
database insertion. These include React hydration errors, AbortError,
ResizeObserver loops, and network issues.

## Querying Errors

### MCP Tools

- `error_issues` — List errors grouped by message, sorted by frequency
- `error_detail` — Get specific error by ID with full stack trace
- `error_stats` — Aggregate counts (24h, 7d, 30d) by environment

### Direct Prisma

```typescript
const prisma = (await import("@/lib/prisma")).default;
const errors = await prisma.errorLog.findMany({
  where: {
    environment: "FRONTEND",
    timestamp: { gte: new Date(Date.now() - 86400000) },
  },
  orderBy: { timestamp: "desc" },
  take: 50,
});
```

## Database Schema

```prisma
model ErrorLog {
  id           String           @id @default(cuid())
  timestamp    DateTime         @default(now())
  message      String
  stack        String?
  sourceFile   String?
  sourceLine   Int?
  sourceColumn Int?
  callerName   String?
  userId       String?
  route        String?
  environment  ErrorEnvironment  // FRONTEND | BACKEND
  errorType    String?
  errorCode    String?
  metadata     Json?

  @@index([environment, timestamp])
  @@index([errorType, timestamp])
  @@index([sourceFile])
}
```

## Why Sentry Was Removed

1. Every error sent to Sentry was also stored in ErrorLog — Sentry received a
   duplicate copy
2. The ErrorLog pipeline handles capture, batching, dedup, rate limiting, and
   storage
3. Saves ~50-80KB from client bundle, ~125MB from node_modules
4. Eliminates vendor dependency and subscription cost
5. Faster builds without `withSentryConfig` webpack wrapper
