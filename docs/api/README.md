# Spike Land API Documentation

This directory contains comprehensive API documentation for the Spike Land
platform.

## Overview

Spike Land is an AI-powered app platform where users can:

- Create and manage applications
- Use the Pixel app for AI-powered image enhancement
- Participate in referral programs
- Manage token economy and payments

## Quick Start

**New to the API?** Start with [00_START_HERE.md](./00_START_HERE.md) - it will
guide you to the right documentation based on your role.

**Already know what you need?** See the
[Documentation Files](#documentation-files) section below or jump to
[INDEX.md](./INDEX.md) for detailed navigation.

## What's in This Directory

This directory contains **9 documentation files** covering:

- **OpenAPI 3.0 Specification** (`openapi.yaml`) - Machine-readable API spec for
  SDK generation
- **API Endpoint Documentation** - Detailed references for Albums and Images
- **Integration Guides** - Code examples in TypeScript/JavaScript and cURL
- **Getting Started Guides** - Role-based navigation and quick references
- **Policies** - Token refund policy

## Documentation Files

### Core Documentation

| File                                   | Description                                 | Audience          |
| -------------------------------------- | ------------------------------------------- | ----------------- |
| [00_START_HERE.md](./00_START_HERE.md) | Entry point with role-based navigation      | Everyone          |
| [INDEX.md](./INDEX.md)                 | Complete documentation index and navigation | Everyone          |
| [openapi.yaml](./openapi.yaml)         | OpenAPI 3.0 specification                   | Developers, Tools |

### API Reference

| File                                       | Description                                | Read Time |
| ------------------------------------------ | ------------------------------------------ | --------- |
| [ALBUM_ENDPOINTS.md](./ALBUM_ENDPOINTS.md) | Album management API reference             | 15 min    |
| [IMAGE_ENDPOINTS.md](./IMAGE_ENDPOINTS.md) | Image upload and enhancement API reference | 15 min    |

### Integration Guides

| File                                           | Description                            | Read Time |
| ---------------------------------------------- | -------------------------------------- | --------- |
| [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) | Code examples and integration patterns | 30 min    |
| [CURL_EXAMPLES.md](./CURL_EXAMPLES.md)         | cURL command examples for testing      | 20 min    |

### Policies

| File                                   | Description                                 |
| -------------------------------------- | ------------------------------------------- |
| [REFUND_POLICY.md](./REFUND_POLICY.md) | Token refund policy for failed enhancements |

## Files Explained

### 00_START_HERE.md

Your entry point to the API documentation. This file:

- Explains what the Spike Land API is
- Provides role-based navigation (Frontend, Backend, QA, DevOps, PM)
- Lists common questions with direct links to answers
- Shows API features at a glance
- Takes 5 minutes to read

### INDEX.md

Complete documentation index with:

- All files listed with descriptions and line counts
- Reading paths by role
- Common task guidance
- API statistics
- Maintenance guidelines

### openapi.yaml

Complete OpenAPI 3.0 specification including:

- Base structure and metadata
- Security schemes (session auth & bearer tokens)
- 25+ reusable schema definitions
- Error response standards
- Common parameters
- Rate limiting documentation
- Full server configuration

This specification can be used for SDK generation, Swagger UI, and API testing
tools.

## Using the OpenAPI Specification

### 1. View in Swagger UI

The OpenAPI specification can be visualized using Swagger UI:

```bash
# Using Swagger UI online
https://swagger.io/tools/swagger-ui/

# Upload or paste the openapi.yaml content
```

### 2. Generate API Client SDKs

Use OpenAPI generators to create client libraries in multiple languages:

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
npx openapi-generator-cli generate -i docs/api/openapi.yaml -g typescript-fetch -o sdk/typescript

# Generate Python client
npx openapi-generator-cli generate -i docs/api/openapi.yaml -g python -o sdk/python

# Generate Go client
npx openapi-generator-cli generate -i docs/api/openapi.yaml -g go -o sdk/go
```

### 3. Create Postman Collection

Import into Postman for interactive testing:

```bash
# Use Postman's import feature
File > Import > Select openapi.yaml
```

This creates a Postman collection with all endpoints ready for testing.

### 4. Validate Specification

Ensure the OpenAPI spec is valid:

```bash
# Install swagger-cli
npm install -g @apidevtools/swagger-cli

# Validate
swagger-cli validate docs/api/openapi.yaml
```

### 5. Publish Documentation

Generate beautiful API documentation:

```bash
# Using ReDoc
npx @redocly/cli build-docs docs/api/openapi.yaml -o dist/api-docs.html

# Using Swagger UI
npx swagger-ui -c docs/api/openapi.yaml -p 8080
```

## API Structure

### Base URLs

- **Production**: https://spike.land/api
- **Development**: http://localhost:3000/api

### Authentication

All protected endpoints require one of:

1. **Session Cookie** (NextAuth.js)
   - Automatically set after login
   - Included in all requests to same domain
   - Recommended for web clients

2. **Bearer Token**
   ```
   Authorization: Bearer {session_token}
   ```
   - For API requests and mobile clients
   - Obtain from NextAuth.js session

### Token Economy

Users have a platform-wide token balance for:

- Image enhancements (Pixel app)
- Premium app features

**Enhancement Costs**:

- TIER_1K: 2 tokens
- TIER_2K: 5 tokens
- TIER_4K: 10 tokens

**Token Regeneration**:

- Automatically regenerates 1 token every 15 minutes
- Maximum balance: 100 tokens
- No degradation if max balance is reached

### Rate Limiting

Rate limits are applied per user. Response headers indicate:

- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait before retry (on 429)

Example limits:

- Image enhancement: 3 requests/minute
- Image upload: 10 requests/minute
- Album operations: 10 requests/minute

### Error Handling

All errors follow a consistent format:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "title": "Short error title",
  "suggestion": "Recommended action",
  "details": {}
}
```

**Common Status Codes**:

- `200` OK: Successful request
- `201` Created: Resource created
- `400` Bad Request: Invalid input
- `401` Unauthorized: Authentication required
- `403` Forbidden: Insufficient permissions
- `404` Not Found: Resource not found
- `429` Too Many Requests: Rate limit exceeded
- `500` Internal Server Error: Server error

## Components

### Schemas

Pre-defined data models for:

- **User Models**: User, UserTokenBalance, TokenTransaction
- **Image Models**: Image, EnhancedImage, ImageEnhancementJob
- **Album Models**: Album, FeaturedGalleryItem
- **Referral Models**: ReferralLink, ReferralStats
- **Voucher Models**: Voucher
- **App Models**: App, Requirement
- **Admin Models**: HealthCheck, AdminDashboard

### Enumerations

- `EnhancementTier`: TIER_1K, TIER_2K, TIER_4K
- `JobStatus`: PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED, CANCELLED
- `AlbumPrivacy`: PRIVATE, UNLISTED, PUBLIC
- `ExportFormat`: JPEG, PNG, WebP
- `UserRole`: USER, ADMIN, SUPER_ADMIN

### Reusable Responses

- `Unauthorized`: Authentication failed (401)
- `Forbidden`: Permission denied (403)
- `NotFound`: Resource not found (404)
- `BadRequest`: Invalid input (400)
- `RateLimited`: Rate limit exceeded (429)
- `InternalServerError`: Server error (500)

### Common Parameters

- `PageParam`: Pagination page number
- `LimitParam`: Items per page (1-100)
- `SortParam`: Sort field and direction
- `IdParam`: Resource ID (CUID format)
- `UserIdParam`: User ID
- `JobIdParam`: Job ID

## Extending the Specification

To add endpoint definitions:

1. Add path under `paths:` section
2. Define operations (GET, POST, PUT, DELETE)
3. Reference components from `components:` section
4. Include request/response examples

Example endpoint:

```yaml
paths:
  /tokens/balance:
    get:
      operationId: getTokenBalance
      tags:
        - Tokens
      summary: Get current token balance
      description: Retrieve user's current token balance and stats
      security:
        - sessionAuth: []
        - bearerAuth: []
      responses:
        "200":
          description: Token balance retrieved
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserTokenBalance"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "500":
          $ref: "#/components/responses/InternalServerError"
```

## Example API Calls

### Get Token Balance

```bash
curl -X GET https://spike.land/api/tokens/balance \
  -H "Authorization: Bearer session_token"
```

Response:

```json
{
  "balance": 45,
  "lastRegeneration": "2025-12-12T15:00:00Z",
  "timeUntilNextRegenMs": 900000,
  "tokensAddedThisRequest": 1,
  "stats": {
    "totalSpent": 150,
    "totalEarned": 500,
    "totalRefunded": 10,
    "transactionCount": 42
  }
}
```

### Enhance Image

```bash
curl -X POST https://spike.land/api/images/enhance \
  -H "Authorization: Bearer session_token" \
  -H "Content-Type: application/json" \
  -d '{
    "imageId": "cuid123456789",
    "tier": "TIER_2K"
  }'
```

Response:

```json
{
  "id": "job_abc123",
  "userId": "cuid987654321",
  "imageId": "cuid123456789",
  "tier": "TIER_2K",
  "status": "PENDING",
  "tokensCost": 5,
  "createdAt": "2025-12-12T14:30:00Z"
}
```

### Get Referral Link

```bash
curl -X GET https://spike.land/api/referral/link \
  -H "Authorization: Bearer session_token"
```

Response:

```json
{
  "code": "JOHN123",
  "url": "https://spike.land?ref=JOHN123"
}
```

## Security Considerations

1. **Never expose session tokens** in client-side code
2. **Use HTTPS** for all API calls in production
3. **Validate input** on both client and server
4. **Rate limiting** prevents abuse and DOS attacks
5. **CORS policies** restrict cross-origin requests
6. **Sensitive data** is excluded from logs

## Monitoring & Debugging

### Health Check

```bash
curl https://spike.land/api/health
```

### View Admin Dashboard

```bash
curl -X GET https://spike.land/api/admin/dashboard \
  -H "Authorization: Bearer admin_token"
```

### Check Job Status

```bash
curl https://spike.land/api/jobs/{jobId} \
  -H "Authorization: Bearer session_token"
```

### Stream Job Progress

```bash
curl https://spike.land/api/jobs/{jobId}/stream \
  -H "Authorization: Bearer session_token"
```

### ALBUM_ENDPOINTS.md

Detailed documentation for album operations:

- List, create, update, delete albums
- Album privacy levels (private, unlisted, public)
- Batch enhancement of album images
- Album sharing with share tokens
- Complete request/response examples
- Error handling and rate limiting

### IMAGE_ENDPOINTS.md

Complete REST API documentation for image management:

- Single and batch image upload
- Image enhancement (single tier and parallel)
- Image retrieval with job status
- Moving images between albums
- Complete error handling
- Rate limiting details
- Code examples in JavaScript and cURL

### INTEGRATION_GUIDE.md

Developer-focused implementation guide with:

- Authentication setup (session-based, bearer tokens, mobile)
- Working TypeScript/JavaScript code examples
- Common API patterns (token balance, enhancement, polling)
- Error handling strategies
- Rate limiting with retry logic
- Type-safe API client implementation
- Testing examples

### CURL_EXAMPLES.md

Quick reference for API testing:

- Environment setup instructions
- 40+ ready-to-use cURL commands
- Examples for all major endpoints
- Error response examples
- Automation scripts
- Performance measurement techniques
- Troubleshooting guide

### REFUND_POLICY.md

Token refund policy documentation:

- When automatic refunds occur
- What qualifies for refunds
- Technical implementation details
- Monitoring and logging
- Contact information for support

## Related Documentation

For additional context, see documentation in the parent directory:

- [API_REFERENCE.md](./API_REFERENCE.md) - Detailed endpoint documentation
- [TOKEN_SYSTEM.md](../develop/TOKEN_SYSTEM.md) - Token economy details
- [DATABASE_SCHEMA.md](../archive/DATABASE_SCHEMA.md) - Data models
- [SECURITY_AUDIT_REPORT.md](../security/SECURITY_AUDIT_REPORT.md) - Security practices

## Support

For questions or issues:

- Email: support@spike.land
- GitHub Issues:
  [Report bug](https://github.com/spike-land-ai/spike.land/issues)
- Documentation: [spike.land/docs](https://spike.land/docs)

## Specification Compliance

- **OpenAPI Version**: 3.0.3
- **Status**: Base specification (ready for endpoint definitions)
- **Last Updated**: December 12, 2025
- **Maintainer**: Spike Land Development Team

---

**Note**: This is the base OpenAPI specification. Individual endpoint
definitions should be added to the `paths:` section as endpoints are documented.
See "Extending the Specification" section for guidance.
