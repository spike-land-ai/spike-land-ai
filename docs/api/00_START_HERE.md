# Spike Land API Documentation - Start Here

Welcome to the Spike Land API documentation. This file will guide you to the
right resources for your needs.

## What is Spike Land API?

Spike Land is an AI-powered platform for creating, managing, and monetizing
applications. The Pixel app demonstrates image enhancement capabilities using
tokens and a referral system.

**Key Features**:

- Multi-provider authentication (GitHub, Google, Facebook, Email/Password)
- Token-based economy for API operations
- Image enhancement with AI (multiple resolution tiers: 1K, 2K, 4K)
- Album and gallery management
- Referral program for user acquisition
- Payment processing via Stripe
- Admin dashboard and analytics
- Marketing automation (Google Ads, Facebook)
- MCP (Model Context Protocol) integration for AI image generation/modification

## Quick Start (5 minutes)

### Getting Started with the API

**Base URLs:**

- Production: `https://spike.land/api`
- Development: `http://localhost:3000/api`

**Authentication:**

```bash
# 1. Session-based (web apps) - cookies are set automatically after login
curl https://spike.land/api/tokens/balance \
  --cookie "authjs.session-token=YOUR_SESSION_TOKEN"

# 2. Test the health endpoint (no auth required)
curl https://spike.land/api/health
```

**Quick Test:**

```javascript
// Check if API is accessible
const response = await fetch("https://spike.land/api/health");
const health = await response.json();
console.log(health); // { status: 'ok' }
```

### Learning Path

1. **First time here?** Read [README.md](./README.md) - API overview (10 min)
2. **Want to integrate?** Follow [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
   (30 min)
3. **Need to test?** Use [CURL_EXAMPLES.md](./CURL_EXAMPLES.md) (15 min)
4. **Looking for details?** Check [openapi.yaml](./openapi.yaml) (reference)

## Authentication Setup

The Spike Land API supports multiple authentication methods:

### 1. Session-Based Authentication (Recommended for Web)

NextAuth.js automatically manages session cookies. After login, all API requests
include the session automatically:

```typescript
// No manual token management needed - cookies are automatic
const response = await fetch("/api/tokens/balance");
const data = await response.json();
```

**Providers:**

- GitHub OAuth
- Google OAuth
- Facebook OAuth
- Email/Password credentials

### 2. API Keys (For Server-to-Server)

Generate API keys from the settings page:

```typescript
const response = await fetch("https://spike.land/api/images/upload", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
  },
  body: formData,
});
```

### 3. Development Setup

1. Set environment variables in `.env.local`:

```bash
# Required
AUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# OAuth providers (optional)
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
GOOGLE_ID=your-google-client-id
GOOGLE_SECRET=your-google-client-secret
```

2. Start the development server:

```bash
yarn dev
```

3. Access the API at `http://localhost:3000/api`

For complete setup instructions, see the main
[README.md](../../README.md#authentication-setup).

## Choose Your Path

### I'm a Frontend Developer

Building a web app that uses the Spike Land API:

1. Read: [README.md](./README.md) - Understand the API (5 min)
2. Read: [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Implementation
   patterns (25 min)
3. Check: [ALBUM_ENDPOINTS.md](./ALBUM_ENDPOINTS.md) &
   [IMAGE_ENDPOINTS.md](./IMAGE_ENDPOINTS.md) - Specific endpoints
4. Copy code examples and start building!

**Total time to start**: 35 minutes

### I'm a Backend/API Developer

Building an SDK or integrating server-to-server:

1. Read: [README.md](./README.md) - API overview (5 min)
2. Read: [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Implementation details
   (30 min)
3. Reference: [ALBUM_ENDPOINTS.md](./ALBUM_ENDPOINTS.md) &
   [IMAGE_ENDPOINTS.md](./IMAGE_ENDPOINTS.md) (20 min)
4. Validate: [openapi.yaml](./openapi.yaml) - Complete OpenAPI specification
5. Generate: SDKs using OpenAPI Generator or similar tools
6. Review: [./API_REFERENCE.md](./API_REFERENCE.md) - Full endpoint reference

**Total time to understand**: 60 minutes

### I'm a QA / Test Engineer

Testing the API endpoints:

1. Read: [CURL_EXAMPLES.md](./CURL_EXAMPLES.md) - Testing with cURL (25 min)
2. Reference: [ALBUM_ENDPOINTS.md](./ALBUM_ENDPOINTS.md) &
   [IMAGE_ENDPOINTS.md](./IMAGE_ENDPOINTS.md) - Endpoint details (20 min)
3. Check: [./API_REFERENCE.md](./API_REFERENCE.md) - Expected responses
4. Copy cURL commands and start testing!

**Total time to start testing**: 45 minutes

### I'm a DevOps / Infrastructure

Deploying or monitoring the API:

1. Read: [README.md](./README.md) - Architecture overview (5 min)
2. Check: [../../README.md](../../README.md) - Deployment setup (15 min)
3. Review:
   [../develop/SECRETS_SETUP.md](../develop/SECRETS_SETUP.md) -
   Environment variables
4. Reference: [openapi.yaml](./openapi.yaml) - Complete API specification
5. Configure: Vercel deployment with cron jobs (see `vercel.json`)
6. Monitor: `/api/health` endpoint and error tracking

**Infrastructure:**

- Vercel Edge Functions + Workflows
- PostgreSQL (Neon) with connection pooling
- Cloudflare R2 for storage
- Stripe webhooks for payments

### I'm a Project Manager / Architect

Understanding the API design:

1. Read: [README.md](./README.md) - Architecture overview (10 min)
2. Review: [./API_REFERENCE.md](./API_REFERENCE.md) - Complete API catalog (30
   min)
3. Check: [../features/FEATURES.md](../features/FEATURES.md) - Platform capabilities
4. Reference: [openapi.yaml](./openapi.yaml) - Technical specification

## File Guide

| File                                               | Purpose                     | Read Time | When to Use                               |
| -------------------------------------------------- | --------------------------- | --------- | ----------------------------------------- |
| **[openapi.yaml](./openapi.yaml)**                 | Complete API specification  | 20 min    | Reference, SDK generation, Postman import |
| **[README.md](./README.md)**                       | Getting started guide       | 10 min    | First introduction to the API             |
| **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** | Implementation patterns     | 30 min    | Building API integration                  |
| **[CURL_EXAMPLES.md](./CURL_EXAMPLES.md)**         | Testing with cURL           | 20 min    | Testing endpoints, automation             |
| **[ALBUM_ENDPOINTS.md](./ALBUM_ENDPOINTS.md)**     | Album API details           | 15 min    | Understanding album operations            |
| **[IMAGE_ENDPOINTS.md](./IMAGE_ENDPOINTS.md)**     | Image API details           | 15 min    | Understanding image operations            |
| **[INDEX.md](./INDEX.md)**                         | Documentation navigation    | 10 min    | Finding what you need                     |
| **[./API_REFERENCE.md](./API_REFERENCE.md)**     | Complete endpoint reference | 30 min    | Detailed endpoint documentation           |
| **[../develop/TOKEN_SYSTEM.md](../develop/TOKEN_SYSTEM.md)**       | Token economy guide         | 15 min    | Understanding tokens and costs            |
| **[../develop/JSON_SCHEMAS.md](../develop/JSON_SCHEMAS.md)** | Database structure          | 20 min    | Data model and relationships              |

## Common Questions

### How do I authenticate?

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md#authentication) -
Session-based or Bearer tokens

### What are tokens?

See [../develop/TOKEN_SYSTEM.md](../develop/TOKEN_SYSTEM.md) - Complete token economy
documentation

### How do I enhance an image?

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md#image-upload--enhancement) -
Includes working code

### What's the rate limit?

See [README.md](./README.md#rate-limiting) - Rate limits vary by endpoint type

### How do I test with cURL?

See [CURL_EXAMPLES.md](./CURL_EXAMPLES.md) - 40+ working examples

### How do I handle errors?

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md#error-handling) - Error
handler class included

### How do I generate an SDK?

See [README.md](./README.md#generate-api-client-sdks) - Step-by-step
instructions

### Where's my API reference?

See [openapi.yaml](./openapi.yaml) - Complete specification

## API Features at a Glance

### Authentication

- Session cookies (NextAuth.js v5 / Auth.js)
- Bearer tokens for API access
- Multi-provider OAuth (GitHub, Google, Facebook)
- Email/Password credentials (with bcrypt hashing)
- E2E test bypass support (non-production only)

### Token Economy

- 1 token per 15 minutes (regeneration)
- Max 100 tokens
- Image enhancement: 2-10 tokens
- Referral bonuses: 50 tokens
- Voucher redemption available

### Image Operations

- Upload (multipart/form-data)
- Enhance (3 resolution tiers)
- Batch enhancement
- Streaming progress
- Export (JPEG, PNG, WebP)
- Version history

### Album Management

- Create/edit albums
- Privacy levels (private, unlisted, public)
- Batch image uploads
- Image organization
- Album sharing

### Additional Features

- Referral program (50 token reward)
- Voucher system for token redemption
- Payment processing via Stripe webhooks
- Admin dashboard with analytics
- Public gallery with privacy controls
- Feedback collection system
- Blog posts management
- Marketing automation (Google Ads, Facebook)
- Error tracking and reporting
- Health monitoring endpoint
- Cron jobs for cleanup and sync
- MCP integration for AI operations
- Subscription tiers (FREE, PRO, ENTERPRISE)

## Getting Help

### Documentation Links

- **API Reference**: [API_REFERENCE.md](./API_REFERENCE.md)
- **Token System**: [TOKEN_SYSTEM.md](../develop/TOKEN_SYSTEM.md)
- **Image Enhancement**: [IMAGE_ENHANCEMENT.md](./IMAGE_ENDPOINTS.md)
- **Database Schema**: [DATABASE_SCHEMA.md](../develop/JSON_SCHEMAS.md)
- **Security**: [SECURITY_AUDIT_REPORT.md](../security/SECURITY_AUDIT_REPORT.md)

### External Tools

- **Swagger UI**: https://swagger.io/tools/swagger-ui/ (paste openapi.yaml)
- **Postman**: https://www.postman.com/ (import openapi.yaml)
- **ReDoc**: https://redoc.ly/ (build docs from openapi.yaml)

### Contact

- Email: hello@spike.land
- Website: https://spike.land
- GitHub: https://github.com/spike-land-ai/spike.land

## API Status

- **Version**: 1.0.0
- **Status**: Production Ready
- **Base URLs**:
  - Production: `https://spike.land/api`
  - Development: `http://localhost:3000/api`
- **Deployment**: Vercel with Edge Functions and Workflows
- **Database**: PostgreSQL (Neon with connection pooling)
- **Storage**: Cloudflare R2
- **Last Updated**: December 30, 2025

## What's Documented

- **100+ API routes** organized by domain
- **25+ data schemas** with TypeScript types
- **5 enumerations** (JobStatus, UserRole, Privacy, etc.)
- **6 error response types** with user-friendly messages
- **2 security schemes** (Session cookies, Bearer tokens)
- **40+ code examples** in TypeScript and cURL
- **Full token economy** with regeneration and consumption
- **Complete error handling** with structured logging
- **Rate limiting rules** per endpoint type
- **Authentication methods** with OAuth and credentials
- **Admin operations API** with role-based access
- **Marketing automation** with Google Ads and Facebook
- **MCP integration** for AI operations

## What's NOT Documented (Yet)

- Some newer experimental endpoints (v1 agent APIs)
- Internal workflow implementation details
- Advanced admin operations for resource management
- Custom domain hosting (future feature)
- WebSocket/real-time features (future)

## Next Steps

Choose your role above and start reading the appropriate guide. Most developers
can get started in 30-45 minutes.

If you get stuck, check [INDEX.md](./INDEX.md) for detailed navigation or
contact hello@spike.land.

---

## API Endpoint Categories

The Spike Land API is organized into the following categories:

### Core APIs

- **`/api/auth/*`** - Authentication (NextAuth.js, OAuth, credentials)
- **`/api/images/*`** - Image upload, enhancement, and management
- **`/api/albums/*`** - Album creation and organization
- **`/api/tokens/*`** - Token balance and management
- **`/api/jobs/*`** - Enhancement job status tracking

### User Features

- **`/api/referral/*`** - Referral program and rewards
- **`/api/vouchers/*`** - Voucher validation and redemption
- **`/api/gallery/*`** - Public gallery and discovery
- **`/api/feedback/*`** - User feedback collection
- **`/api/settings/*`** - User settings and API keys

### Payment & Subscriptions

- **`/api/stripe/*`** - Stripe checkout and webhooks
- **`/api/tiers/*`** - Subscription tier management
- **`/api/merch/*`** - Merchandise and products

### Admin & Analytics

- **`/api/admin/*`** - Admin dashboard and management
- **`/api/reports/*`** - System reports and analytics
- **`/api/tracking/*`** - Analytics tracking (pageviews, events)
- **`/api/marketing/*`** - Marketing automation (Google Ads, Facebook)

### Advanced Features

- **`/api/mcp/*`** - Model Context Protocol (AI generation/modification)
- **`/api/pipelines/*`** - Custom enhancement pipelines
- **`/api/v1/agent/*`** - AI agent tasks and heartbeat
- **`/api/blog/*`** - Blog post management

### System

- **`/api/health`** - Health check endpoint
- **`/api/cron/*`** - Scheduled cleanup and sync jobs
- **`/api/errors/*`** - Error reporting and tracking
- **`/api/logs/*`** - System logging

---

**Happy building!**

This API documentation is designed for developer experience. If something is
unclear, it's a documentation bug. Please report it.

---

_Last Updated: December 30, 2025_ _Part of Spike Land - AI-Powered App Platform_
