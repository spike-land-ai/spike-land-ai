# Spike Land API Versioning Strategy

> **Last Updated**: December 30, 2025 **Status**: Hybrid Versioning - v1 for
> Agent API, unversioned for public endpoints **Document Version**: 2.0

## Table of Contents

1. [Current Status](#current-status)
2. [Versioning Approach](#versioning-approach)
3. [What Constitutes Breaking Changes](#what-constitutes-breaking-changes)
4. [Deprecation Policy](#deprecation-policy)
5. [Migration Guidelines](#migration-guidelines)
6. [Version Management](#version-management)
7. [Current API Endpoints](#current-api-endpoints)

---

## Current Status

**The Spike Land API uses a hybrid versioning approach:**

- **Unversioned endpoints** (`/api/*`) - Core platform APIs for images, albums,
  tokens, etc.
- **Versioned endpoints** (`/api/v1/*`) - Agent/MCP API for async coding tasks

### Current API Structure

#### Unversioned Endpoints (Platform APIs)

Most platform endpoints operate without explicit version prefixes:

```
GET    /api/images
POST   /api/images/upload
POST   /api/images/enhance
GET    /api/albums
POST   /api/albums
GET    /api/tokens/balance
POST   /api/vouchers/validate
GET    /api/referral/stats
POST   /api/mcp/generate
GET    /api/health
```

**Total unversioned routes**: ~126 endpoints across the platform

#### Versioned Endpoints (Agent API v1)

Agent/MCP integration uses explicit versioning:

```
GET    /api/v1/agent/tasks
POST   /api/v1/agent/tasks
POST   /api/v1/agent/heartbeat
```

**Purpose**: These endpoints serve the Jules async coding agent feature and
external MCP clients that require stable API contracts.

### Why Hybrid Versioning?

1. **Platform Evolution** - Core Spike Land APIs evolve rapidly during
   development
2. **Internal-First** - Platform endpoints serve the web/mobile apps we control
3. **External Stability** - Agent API consumed by external MCP clients (npm
   package `@spike-land-ai/spike-cli`)
4. **Flexibility** - Unversioned endpoints can improve without migration
   overhead
5. **Contracts Matter** - Versioned endpoints signal stability commitments to
   external integrators

---

## Versioning Approach

### Current Implementation (Hybrid Strategy)

Spike Land uses **selective URL-based versioning** based on API consumer type:

```
/api/*          → Unversioned (platform APIs, internal use)
/api/v1/*       → Version 1 (external agent APIs with stability guarantees)
/api/v2/*       → Not yet implemented (future external APIs)
```

#### Decision Matrix: When to Version an Endpoint

| Factor                 | Unversioned                  | Versioned (v1, v2...)        |
| ---------------------- | ---------------------------- | ---------------------------- |
| **Consumer**           | Internal (web/mobile app)    | External (MCP clients, SDKs) |
| **Deployment Control** | We control all clients       | Third-party integrations     |
| **Change Frequency**   | Frequent improvements        | Stability required           |
| **Breaking Changes**   | Can coordinate updates       | Need migration period        |
| **Documentation**      | Internal reference           | Public API contract          |
| **Examples**           | `/api/images`, `/api/albums` | `/api/v1/agent/tasks`        |

### When to Add Versioning to New Endpoints

Implement explicit versioning when ANY of these conditions are met:

1. **External SDK/Package** - Endpoint consumed by published npm packages (e.g.,
   `@spike-land-ai/spike-cli`)
2. **Third-Party Integrations** - External developers build against the API
3. **Stability Guarantees** - Contractual commitments to API stability
4. **Public Documentation** - API advertised for external consumption
5. **B2B Customers** - Enterprise clients require predictable changes

**Current example**: `/api/v1/agent/*` endpoints serve external MCP clients
through the published npm package

### URL-Based Versioning Details

We use URL-based versioning (e.g., `/api/v1/agent/tasks`) rather than
header-based or query parameter versioning.

#### Why URL-Based Versioning?

| Aspect        | URL-Based                       | Header-Based               | Query Param        |
| ------------- | ------------------------------- | -------------------------- | ------------------ |
| Clarity       | Clear API version in URL        | Not obvious to users       | Easy to miss       |
| CDN Caching   | Excellent (different URLs)      | Requires Vary headers      | Complex            |
| Documentation | Straightforward (separate docs) | Mixed documentation        | Confusing          |
| Debugging     | Easy to see in logs             | Requires header inspection | Not visible in URL |
| Adoption      | Common in REST APIs             | Less common                | Rare               |

**Decision**: URL-based versioning is the industry standard and easiest for
developers to understand and adopt.

### Version Numbering

- **Major versions**: `/api/v1`, `/api/v2` (breaking changes)
- **Minor versions**: No minor versioning in URL (shipped as improvements to
  major version)
- **Patch updates**: No patch versioning in URL (transparent fixes)

### Backward Compatibility Strategy

```
Release Timeline for Version Change:

Month 0: v1 stable, all new features target v1
         (No v2 yet)

Month 1: Breaking change identified → design v2
         Planning phase, no code changes to v1

Month 2: Pre-announcement
         Public notice: "v2 coming in 3 months"

Month 3: v2 release
         /api/v2/* endpoints available
         /api/v1/* continues to work (deprecated)

Month 4-8: Migration period (6 months)
         Both v1 and v2 available
         Deprecation headers on v1 responses
         Support for migration questions

Month 9: v1 sunset
         Endpoints removed
         Consumers must have migrated
```

---

## What Constitutes Breaking Changes

### Breaking Changes (Require Version Bump)

Changes that break client integrations:

#### 1. Removing Endpoints

```
BREAKING: DELETE /api/v1/images/{id} endpoint removed
SOLUTION: Migrate to /api/v2/images/{id} (returns 204 No Content)
```

#### 2. Removing Required Response Fields

```
// v1 response
{
  "id": "123",
  "url": "https://...",
  "status": "processing"  // Required field clients depend on
}

// v2 removes status field
{
  "id": "123",
  "url": "https://..."
}

BREAKING: Clients checking response.status will fail
```

#### 3. Changing Response Structure

```
// v1
POST /api/images/enhance
{
  "result": { "url": "..." }
}

// v2 flattens structure
{
  "url": "..."
}

BREAKING: Clients using response.result.url will fail
```

#### 4. Changing Required Parameters

```
// v1 - optional photo_type parameter
POST /api/images/enhance
{
  "imageId": "123",
  "tier": "TIER_1K",
  "photo_type": "landscape"  // optional
}

// v2 - photo_type becomes required
POST /api/images/enhance
{
  "imageId": "123",
  "tier": "TIER_1K",
  "photo_type": "landscape"  // REQUIRED
}

BREAKING: Existing requests without photo_type will fail
```

#### 5. Changing Authentication Requirements

```
// v1 - optional authentication
GET /api/albums/shared/abc123
(Works with or without Authorization header)

// v2 - authentication required
GET /api/albums/shared/abc123
(Returns 401 Unauthorized without Authorization header)

BREAKING: Public consumers need authentication
```

#### 6. Significant Rate Limit Changes

```
// v1
Rate limit: 10 requests/minute per user

// v2
Rate limit: 1 request/minute per user

BREAKING: Existing batch operations fail due to stricter limits
```

### Non-Breaking Changes (No Version Bump)

Changes that don't break existing integrations:

#### 1. Adding New Endpoints

```
// v1 - no batch endpoint
// v2 adds batch endpoint (v1 unaffected)
POST /api/v1/images/batch-enhance (NEW)
```

#### 2. Adding Optional Response Fields

```
// v1 response
{
  "id": "123",
  "url": "https://..."
}

// v2 adds new field (v1 still works)
{
  "id": "123",
  "url": "https://...",
  "processing_time_ms": 1234  // NEW FIELD
}

NOT BREAKING: Existing clients ignore new field
```

#### 3. Adding Optional Parameters

```
// v1 endpoint
POST /api/images/enhance

// Enhanced with optional parameter (v1 still works)
POST /api/images/enhance?include_metadata=true
POST /api/images/enhance?prefer_format=webp
```

#### 4. Improving Error Messages

```
// v1
{
  "error": "Invalid request"
}

// v2 provides more detail
{
  "error": "Invalid request",
  "details": "imageId is required",
  "error_code": "MISSING_IMAGE_ID"
}

NOT BREAKING: Error structure unchanged, just more detail
```

#### 5. Performance Improvements

```
// v1 - takes 2 seconds to enhance image
// v2 - takes 0.5 seconds (optimized)

NOT BREAKING: Response format identical, just faster
```

#### 6. Adding New Optional Error Fields

```
// v1 error
{
  "error": "Token limit exceeded"
}

// v2 adds helpful info
{
  "error": "Token limit exceeded",
  "current_balance": 0,
  "required_tokens": 5,
  "can_purchase": true
}

NOT BREAKING: Clients can ignore new fields
```

---

## Deprecation Policy

### Deprecation Timeline

When a breaking change is necessary, follow this timeline:

| Phase                | Duration   | Action                                  |
| -------------------- | ---------- | --------------------------------------- |
| **Announcement**     | 0-4 weeks  | Public notice of breaking change        |
| **Development**      | 4-12 weeks | Build v2, test thoroughly               |
| **Release**          | Day 1      | v2 endpoints available alongside v1     |
| **Migration Window** | 6 months   | Both versions active, support migration |
| **Sunset**           | Month 6-7  | v1 removed from production              |
| **Archive**          | Ongoing    | Legacy documentation in archive         |

### Deprecation Headers

Deprecated endpoints include these HTTP headers:

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Jun 2026 00:00:00 GMT
Link: </api/v2/images>; rel="successor-version"
Warning: 299 - "API v1 is deprecated, use v2 instead"
Content-Type: application/json

{
  "id": "123",
  "url": "https://...",
  ...
}
```

### Email Notification

Developers with active integrations receive emails:

```
Subject: Spike Land API v1 Deprecation Notice

Dear Developer,

Spike Land API v1 will be sunset on June 1, 2026.

What's changing:
- [List breaking changes]

What to do:
1. Review migration guide: docs/migrations/v1-to-v2.md
2. Test integration against v2
3. Deploy updated code by May 31, 2026

Questions? Support: api-support@spike.land
```

### Support During Migration

- **Documentation**: Migration guides for each breaking change
- **Support Channel**: `api-support@spike.land` for questions
- **Example Code**: SDKs and code samples for v2
- **Discussion Forum**: GitHub Discussions for peer support

---

## Migration Guidelines

### For API Consumers

#### Step 1: Monitor Deprecation Headers

```bash
# Check response headers for deprecation notice
curl -i https://spike.land/api/v1/images

# Look for:
# Deprecation: true
# Sunset: <date>
# Link: <v2 endpoint>
```

#### Step 2: Review Migration Guide

When deprecation is announced:

```bash
# Read the migration guide for your use case
cat docs/migrations/v1-to-v2.md

# Check for breaking changes affecting your integration
grep "my_endpoint" docs/migrations/v1-to-v2.md
```

#### Step 3: Test Against v2

```bash
# Update base URL in non-production environment
BASE_URL="https://spike.land/api/v2"

# Run integration tests
npm test -- --integration

# Verify all endpoints return expected responses
```

#### Step 4: Deploy Updated Code

```bash
# Commit migration changes
git commit -m "chore: migrate API from v1 to v2"

# Deploy to staging first
npm run deploy:staging

# Monitor for issues
npm run logs:staging | grep "api.*error"

# Deploy to production
npm run deploy:production
```

#### Step 5: Verify Migration Complete

```bash
# Confirm all v1 calls replaced with v2
grep -r "api/v1" src/

# Update monitoring/alerts to v2 endpoints
# Verify no errors in production logs
```

### Migration Examples

#### Example 1: Image Enhancement Response Change

**v1 Response Structure**:

```json
{
  "data": {
    "imageId": "123",
    "enhanced": { "url": "https://..." },
    "status": "completed"
  }
}
```

**v2 Response Structure** (flattened):

```json
{
  "id": "123",
  "url": "https://...",
  "status": "completed"
}
```

**Migration Code**:

```javascript
// Before (v1)
const enhancedUrl = response.data.enhanced.url;

// After (v2)
const enhancedUrl = response.url;
```

#### Example 2: Token API Parameter Change

**v1 Request**:

```bash
POST /api/tokens/consume
{
  "amount": 5
}
```

**v2 Request** (requires context):

```bash
POST /api/tokens/consume
{
  "amount": 5,
  "context": "pixel_image_enhancement"  # Required in v2
}
```

**Migration Code**:

```javascript
// Before (v1)
await fetch("/api/tokens/consume", {
  method: "POST",
  body: JSON.stringify({ amount: 5 }),
});

// After (v2)
await fetch("/api/tokens/consume", {
  method: "POST",
  body: JSON.stringify({
    amount: 5,
    context: "pixel_image_enhancement",
  }),
});
```

---

## Version Management

### Changelog Locations

API changes are documented in multiple places for discoverability:

| Location                      | Purpose                       | Audience          |
| ----------------------------- | ----------------------------- | ----------------- |
| `docs/API_CHANGELOG.md`       | Detailed technical changes    | Developers        |
| `docs/migrations/v*-to-v*.md` | Step-by-step migration guides | Integrators       |
| GitHub Releases               | High-level summaries          | All users         |
| Email notifications           | Deprecation announcements     | Active developers |
| In-app notifications          | UI warnings for web consumers | Platform users    |

### API_CHANGELOG.md Format

```markdown
# API Changelog

## [2.0.0] - 2026-06-01

### Breaking Changes

- **Image Enhancement Response**: Response structure flattened
  - Old: `{ data: { enhanced: { url } } }`
  - New: `{ url, ... }`
  - Migration: See `docs/migrations/v1-to-v2.md`

### New Features

- Album batch enhancement: `POST /api/v2/albums/{id}/enhance`
- Image metadata: New `metadata` field in image responses

### Fixed

- Rate limiting now applies consistently across endpoints
```

### Versioning Principles

1. **One Major Version Active** - Only one major version receives new features
2. **Deprecation Clear** - Minimum 6 months notice before removal
3. **Migration Guided** - Detailed guides for each breaking change
4. **Support Available** - Help for developers migrating
5. **Documentation Complete** - Both old and new versions documented
6. **Example Code** - SDK updates and code samples provided

---

## Current API Endpoints

### Endpoint Categories Overview

| Category      | Versioning  | Count | Purpose                               | Consumer        |
| ------------- | ----------- | ----- | ------------------------------------- | --------------- |
| **Images**    | Unversioned | ~15   | Image upload, enhancement, management | Web/Mobile apps |
| **Albums**    | Unversioned | ~5    | Album CRUD, batch operations          | Web/Mobile apps |
| **Gallery**   | Unversioned | ~2    | Public gallery browsing               | Web app         |
| **Tokens**    | Unversioned | ~3    | Balance, consumption tracking         | Platform core   |
| **Vouchers**  | Unversioned | ~2    | Voucher validation, redemption        | Platform core   |
| **Referral**  | Unversioned | ~2    | Referral links and stats              | Web/Mobile apps |
| **MCP**       | Unversioned | ~4    | AI image generation/modification      | Web app, CLI    |
| **Jobs**      | Unversioned | ~5    | Async job tracking                    | Web/Mobile apps |
| **Audio**     | Unversioned | ~2    | Audio upload/streaming                | Web app         |
| **Boxes**     | Unversioned | ~5    | Container management                  | Web app         |
| **Apps**      | Unversioned | ~2    | App management                        | Platform core   |
| **Pipelines** | Unversioned | ~3    | Image processing pipelines            | Web app         |
| **Blog**      | Unversioned | ~2    | Blog content                          | Web app         |
| **Merch**     | Unversioned | ~7    | E-commerce functionality              | Web app         |
| **Tiers**     | Unversioned | ~3    | Subscription tier management          | Web/Mobile apps |
| **Tracking**  | Unversioned | ~3    | Analytics events                      | Web/Mobile apps |
| **Settings**  | Unversioned | ~2    | User settings, API keys               | Web app         |
| **Marketing** | Unversioned | ~4    | Google/Facebook integrations          | Admin           |
| **Stripe**    | Unversioned | ~2    | Payment processing                    | Platform core   |
| **Auth**      | Unversioned | ~4    | Authentication flows                  | Web/Mobile apps |
| **Health**    | Unversioned | ~1    | System health checks                  | Monitoring      |
| **Errors**    | Unversioned | ~2    | Error reporting                       | Web/Mobile apps |
| **Reports**   | Unversioned | ~1    | System reports                        | Admin           |
| **Cron**      | Unversioned | ~4    | Background jobs                       | System          |
| **Admin**     | Unversioned | ~25   | Admin dashboard, analytics            | Admin panel     |
| **Agent API** | **v1**      | ~2    | Jules async coding tasks              | External MCP    |

**Total**: ~128 API endpoints

### Versioned Endpoints (External APIs)

#### Agent API v1

Explicitly versioned for external consumption via MCP protocol:

| Endpoint                  | Method | Purpose                       | Authentication | Stability                               |
| ------------------------- | ------ | ----------------------------- | -------------- | --------------------------------------- |
| `/api/v1/agent/tasks`     | GET    | Fetch pending tasks for agent | MCP API key    | Stable - No breaking changes without v2 |
| `/api/v1/agent/tasks`     | POST   | Update task status/result     | MCP API key    | Stable - No breaking changes without v2 |
| `/api/v1/agent/heartbeat` | POST   | Agent health check            | MCP API key    | Stable - No breaking changes without v2 |

**External consumers**:

- MCP clients via `@spike-land-ai/spike-cli` npm package
- Jules async coding agent
- Custom MCP integrations

### Unversioned Endpoints (Platform APIs)

Platform endpoints evolve without versioning as we control all consumers (our
web/mobile apps).

#### Key Examples

| Resource   | Endpoint                       | Method   | Status   | Notes                                 |
| ---------- | ------------------------------ | -------- | -------- | ------------------------------------- |
| **Images** | `/api/images`                  | GET      | Active   | List user images with pagination      |
|            | `/api/images/upload`           | POST     | Active   | Upload new image                      |
|            | `/api/images/enhance`          | POST     | Active   | Single image enhancement              |
|            | `/api/images/batch-enhance`    | POST     | Active   | Multiple image enhancement            |
|            | `/api/images/parallel-enhance` | POST     | Active   | Parallel enhancement processing       |
| **Albums** | `/api/albums`                  | GET/POST | Active   | Album CRUD operations                 |
|            | `/api/albums/{id}/enhance`     | POST     | Active   | Batch enhance album images            |
|            | `/api/albums/{id}/images`      | GET      | Active   | List album images                     |
| **MCP**    | `/api/mcp/generate`            | POST     | Active   | AI image generation                   |
|            | `/api/mcp/modify`              | POST     | Active   | AI image modification                 |
|            | `/api/mcp/balance`             | GET      | Active   | Token balance check                   |
|            | `/api/mcp/jobs/{jobId}`        | GET      | Active   | Job status polling                    |
| **Admin**  | `/api/admin/*`                 | *        | Internal | Admin-only, may change without notice |

### Stability Guarantees

#### Versioned APIs (v1, v2...)

**Strict Stability Contract** - Breaking changes require new version:

- ✅ Can add optional parameters/fields
- ✅ Can add new endpoints
- ✅ Can improve performance
- ❌ Cannot remove fields without v2
- ❌ Cannot change response structure without v2
- ❌ Cannot make optional fields required without v2

**Deprecation timeline**: Minimum 6 months notice before sunset

#### Unversioned APIs

**Flexible Evolution** - Can change as needed:

- ✅ Adding/removing fields (we control all clients)
- ✅ Changing response structures (coordinated with app updates)
- ✅ Improving APIs based on usage
- ⚠️ Breaking changes coordinated with web/mobile app deployments
- ⚠️ No external consumers to notify

**Best practice**: Still avoid gratuitous breaking changes

#### Internal APIs

**Admin endpoints** (`/api/admin/*`):

- No stability guarantees
- May change without notice
- No deprecation period required
- Used only by internal admin dashboard

---

## Future Considerations

### When to Version Additional Endpoints

Consider adding explicit versioning when:

1. **Publishing SDKs** - Creating client libraries for external developers
2. **B2B Features** - Enterprise customers requiring API stability
3. **Marketplace Integrations** - Third-party apps connecting to Spike Land
4. **Public API Launch** - Opening platform to external developers

### Potential Future Versioned APIs

| API Category                           | Timeline | Reason for Versioning                       |
| -------------------------------------- | -------- | ------------------------------------------- |
| **Image API** (`/api/v1/images/*`)     | TBD      | If external apps use image enhancement      |
| **Token API** (`/api/v1/tokens/*`)     | TBD      | If third-party apps manage tokens           |
| **Album API** (`/api/v1/albums/*`)     | TBD      | If external gallery integrations            |
| **Webhook API** (`/api/v1/webhooks/*`) | TBD      | For event notifications to external systems |

### Current Status: Agent API Only

Currently, **only the Agent API** (`/api/v1/agent/*`) requires versioning
because:

- ✅ Published as npm package `@spike-land-ai/spike-cli`
- ✅ External MCP clients depend on it
- ✅ Breaking changes would affect unknown number of integrations
- ✅ Follows MCP protocol standards

All other APIs remain unversioned as we control all consumers (our web/mobile
apps).

---

## Implementation Details

### How Versioning Works in the Codebase

Spike Land uses Next.js App Router file-based routing. API versioning is
implemented through directory structure:

```
src/app/api/
├── images/                    # Unversioned platform endpoints
│   ├── route.ts              # GET /api/images
│   ├── upload/route.ts       # POST /api/images/upload
│   ├── enhance/route.ts      # POST /api/images/enhance
│   └── [id]/
│       ├── route.ts          # GET/DELETE /api/images/{id}
│       └── versions/route.ts # GET /api/images/{id}/versions
│
├── v1/                        # Versioned external APIs
│   └── agent/
│       ├── tasks/route.ts     # GET/POST /api/v1/agent/tasks
│       └── heartbeat/route.ts # POST /api/v1/agent/heartbeat
│
├── albums/route.ts            # Unversioned
├── tokens/balance/route.ts    # Unversioned
└── health/route.ts            # Unversioned
```

### No Middleware-Based Versioning

Unlike some frameworks, Spike Land does **not** use middleware for version
routing:

- ❌ No `Accept-Version` header parsing
- ❌ No version query parameters
- ❌ No central version routing middleware

Instead, versioning is explicit in the URL path via Next.js file structure.

### Adding a New Versioned Endpoint

To create a new versioned endpoint:

```bash
# 1. Create directory structure
mkdir -p src/app/api/v1/new-feature

# 2. Create route handler
cat > src/app/api/v1/new-feature/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    version: "v1",
    feature: "new-feature"
  });
}
EOF

# 3. Endpoint is now available at /api/v1/new-feature
```

### Authentication for Versioned APIs

Agent API v1 uses MCP-specific authentication:

```typescript
// src/lib/mcp/auth.ts
import { authenticateMcpRequest } from "@/lib/mcp/auth";

export async function GET(req: NextRequest) {
  const authResult = await authenticateMcpRequest(req);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  // authResult.userId available for authorization
}
```

Platform APIs use NextAuth session authentication:

```typescript
// Unversioned platform endpoints
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // session.user.id available
}
```

### Version Discovery

Clients can discover API capabilities:

```bash
# Health check (unversioned)
curl https://spike.land/api/health
# {"status":"ok"}

# Agent API v1 (versioned)
curl https://spike.land/api/v1/agent/tasks?boxId=abc123 \
  -H "Authorization: Bearer mcp_key_..."
```

Currently no version discovery endpoint, but could add:

```
GET /api/versions → { "current": "v1", "available": ["v1"], "deprecated": [] }
```

---

## Document History

| Version | Date         | Author          | Changes                                                                                                                                                                                             |
| ------- | ------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.0     | Dec 30, 2025 | Spike Land Team | Updated to reflect hybrid versioning approach: v1 for Agent API, unversioned for platform APIs. Added comprehensive endpoint inventory (~128 endpoints). Documented actual implementation patterns. |
| 1.0     | Dec 2025     | Spike Land Team | Initial versioning strategy (pre-implementation)                                                                                                                                                    |

---

## Related Documents

- [API Reference](./API_REFERENCE.md) - Complete endpoint documentation
- [API Changelog](./API_CHANGELOG.md) - Historical changes (when created)
- [Authentication Guide](./API_REFERENCE.md#authentication) - Auth mechanisms
- [Error Handling](./API_REFERENCE.md#error-handling) - Error codes and
  responses
