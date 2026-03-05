# API Changelog

> **Last Updated**: 2025-12-30 **Current API Version**: Unversioned (v1
> implicit) **Status**: Active Development

All notable changes to the Spike Land API are documented in this file.

---

## Format

This changelog follows [Keep a Changelog](https://keepachangelog.com/) format
with sections:

- **Breaking** - Changes requiring code updates
- **Added** - New functionality
- **Changed** - Modified behavior
- **Deprecated** - Soon-to-be-removed features
- **Removed** - Deleted functionality
- **Fixed** - Bug fixes
- **Security** - Security-related changes

---

## [Unreleased] - 2025-12-30

### Added

- **AI Image Generation (MCP)** - POST `/api/mcp/generate`
  - Generate images from text prompts using Google Gemini
  - Support for three quality tiers (TIER_1K, TIER_2K, TIER_4K)
  - Configurable aspect ratios: 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9,
    21:9
  - Negative prompt support for better control
  - Token-based pricing (2, 5, 10 tokens respectively)
  - Rate limiting: dedicated limits for generation endpoints
  - Returns job ID for async status tracking

- **AI Image Modification (MCP)** - POST `/api/mcp/modify`
  - Modify existing images with text prompts
  - Accepts base64 image data or image URLs
  - Supports JPEG, PNG, WebP, GIF formats
  - Maximum image size: 20MB
  - Same tier pricing as generation
  - Automatic MIME type detection from URLs

- **MCP Token Balance** - GET `/api/mcp/balance`
  - Check current token balance for API key or session
  - Returns available tokens and usage statistics

- **MCP Transaction History** - GET `/api/mcp/history`
  - View token consumption history
  - Filter by date range and operation type

- **Enhancement Pipelines** - `/api/pipelines`
  - GET - List user's pipelines and public pipelines
  - POST - Create custom enhancement pipelines
  - Configurable analysis, cropping, prompting, and generation stages
  - Support for PRIVATE, PUBLIC, and LINK (shareable) visibility
  - Maximum 50 pipelines per user
  - Pagination support (up to 100 items per page)

- **Pipeline Detail Management** - `/api/pipelines/{id}`
  - GET - Retrieve pipeline configuration
  - PATCH - Update pipeline settings
  - DELETE - Remove pipeline

- **Reference Images for Pipelines** - POST `/api/pipelines/reference-images`
  - Upload reference images for pipeline guidance
  - Store in R2 storage with metadata

- **Photo-to-Merch Platform**
  - POST `/api/merch/checkout` - Create merch orders with Stripe
  - GET/POST `/api/merch/cart` - Manage shopping cart
  - GET/POST `/api/merch/orders` - Order management
  - GET/POST `/api/merch/products` - Product catalog
  - POST `/api/merch/webhooks/prodigi` - Prodigi fulfillment webhooks
  - Delayed capture payment flow for print-on-demand
  - UK and EU shipping support with free shipping thresholds
  - Stripe Tax integration for automatic tax calculation

- **Audio Mixer Platform** - POST `/api/audio/upload`
  - Upload audio tracks (up to 500MB)
  - Support for WAV, MP3, WebM, OGG, FLAC, AAC, M4A formats
  - R2 storage integration for audio files
  - Project-based organization

- **Blog API (Mobile)**
  - GET `/api/blog/posts` - List blog posts with filtering
  - GET `/api/blog/posts/{slug}` - Get post by slug
  - Support for category, tag, and featured filtering
  - Pagination support
  - Reading time estimation
  - Designed for mobile app consumption

- **Token Well Tier System** - GET `/api/tiers`
  - Retrieve all available subscription tiers
  - User's current tier information
  - Upgrade/downgrade eligibility
  - POST `/api/tiers/upgrade` - Upgrade to higher tier
  - POST `/api/tiers/downgrade` - Downgrade tier
  - GET `/api/tiers/check-upgrade-prompt` - Check if upgrade prompt should show

- **Batch Enhancement** - POST `/api/images/batch-enhance`
  - Process up to 20 images simultaneously
  - Upfront token consumption for entire batch
  - Vercel workflow integration for production
  - Direct execution fallback for development
  - Returns batch ID for tracking

- **Parallel Enhancement** - POST `/api/images/parallel-enhance`
  - Concurrent processing of multiple images
  - Optimized for speed over batch operations

- **Anonymous Operations**
  - POST `/api/images/anonymous-upload` - Upload without authentication
  - POST `/api/images/anonymous-enhance` - Enhance without account

- **Admin Dashboard Enhancements**
  - GET `/api/admin/jobs` - Unified jobs API (enhancement + MCP)
  - Supports filtering by status, type, user
  - Search by job ID or user email
  - Job statistics and status counts
  - POST `/api/admin/jobs/cleanup` - Clean up old jobs
  - GET `/api/admin/errors` - Error tracking system
  - GET `/api/admin/errors/stats` - Error analytics
  - GET `/api/admin/agents` - Jules AI agent session management
  - GET `/api/admin/agents/{sessionId}` - Agent session details
  - GET `/api/admin/storage` - R2 storage analytics

- **Marketing Integrations**
  - POST `/api/marketing/facebook/connect` - Connect Facebook Ads account
  - POST `/api/marketing/google/connect` - Connect Google Ads account
  - GET `/api/admin/marketing/accounts` - List connected accounts
  - GET `/api/admin/marketing/campaigns` - Campaign analytics
  - POST `/api/admin/marketing/analytics/export` - Export analytics data
  - GET `/api/cron/marketing-sync` - Scheduled campaign sync

- **API Key Management**
  - GET/POST `/api/settings/api-keys` - Manage user API keys
  - DELETE `/api/settings/api-keys/{id}` - Revoke API key
  - Support for API key authentication on MCP endpoints

- **PhotoMix AI** - POST `/api/images/blend`
  - Blend two images together
  - GET `/api/jobs/mix-history` - View blend history

- **Box Management** - `/api/boxes`
  - GET - List user's boxes
  - POST - Create new box
  - GET/PATCH/DELETE `/api/boxes/{id}` - Box operations

- **Mobile Authentication** - POST `/api/auth/mobile/signin`
  - Dedicated sign-in endpoint for mobile apps
  - Email-based authentication

- **Email Validation** - POST `/api/auth/check-email`
  - Check if email exists before signup

- **Error Reporting** - POST `/api/errors/report`
  - Client-side error reporting
  - Structured error tracking

- **Analytics & Tracking**
  - POST `/api/tracking/pageview` - Track page views
  - POST `/api/tracking/event` - Track custom events
  - POST `/api/tracking/session` - Track user sessions

### Changed

- **Batch Enhancement Limit** - Reduced from 50 to 20 images per request
  - Optimized for reliability and resource management
  - Better error handling for smaller batches

- **Enhancement Job Queue** - Enhanced job management
  - Added kill and rerun functionality for stuck jobs
  - Improved retry logic with configurable max retries
  - Better workflow run tracking

- **Admin Dashboard** - Unified job listing
  - Combined EnhancementJob and McpGenerationJob into single view
  - Consistent response format across job types
  - Enhanced filtering and pagination

- **Image Upload** - Album-first workflow
  - Images can now be uploaded without album (optional)
  - Improved masonry layout for galleries
  - Better view controls and sorting

- **Rate Limiting** - Specialized configs per endpoint
  - Dedicated rate limits for MCP generation vs modification
  - More granular control over API usage

### Fixed

- **Checkout Flow** - E2E test expectations
  - Updated protected route redirect logic
  - Fixed mock data for Stripe integration

- **Database Queries** - Analytics column names
  - Corrected SQL queries for user registration metrics
  - Fixed overview API response format

- **Image Error Logging** - POST `/api/logs/image-error`
  - Better structured error capture
  - Improved debugging capabilities

- **Drag & Drop** - Auto-enhance on upload
  - Fixed drag-drop file upload triggers
  - Improved user experience

### Security

- **API Key Authentication** - MCP endpoints support
  - Bearer token authentication for headless clients
  - Proper API key scope validation
  - Usage tracking per API key

- **R2 Storage** - Secure audio file uploads
  - Validated file size limits (500MB max)
  - Format validation for security
  - Project ownership verification

- **Admin Endpoints** - Enhanced authorization
  - Consistent admin middleware usage
  - Better error handling for unauthorized access

---

## [1.0.0] - 2025-12-10

### Release Summary

Initial public release of Spike Land API for Pixel image enhancement app.

### Added

- **Authentication**
  - Session-based authentication via NextAuth.js
  - Support for GitHub, Google OAuth providers
  - Phone verification via Twilio
  - Bearer token support for API clients

- **Image Management**
  - POST `/api/images/upload` - Upload image
  - GET `/api/images` - List user images
  - GET `/api/images/{id}` - Get image details
  - DELETE `/api/images/{id}` - Delete image
  - POST `/api/images/{id}/enhance` - Enhance single image

- **Enhancement Tiers**
  - TIER_1K - Basic enhancement (2 tokens)
  - TIER_2K - Standard enhancement (5 tokens)
  - TIER_4K - Premium enhancement (10 tokens)

- **Albums**
  - POST `/api/albums` - Create album
  - GET `/api/albums` - List user albums
  - GET `/api/albums/{id}` - Get album details
  - PATCH `/api/albums/{id}` - Update album
  - DELETE `/api/albums/{id}` - Delete album

- **Token Economy**
  - GET `/api/tokens/balance` - Check token balance
  - POST `/api/tokens/consume` - Consume tokens
  - GET `/api/tokens/history` - Transaction history
  - Auto-regeneration: 1 token per 15 minutes (max 100)

- **Token Purchases**
  - Integration with Stripe for payments
  - Support for USD, EUR, GBP currencies
  - Receipt generation and emailing

- **Vouchers**
  - POST `/api/vouchers/apply` - Apply voucher code
  - POST `/api/vouchers/validate` - Check voucher validity
  - Admin creation via `/api/admin/vouchers`

- **Referral Program**
  - GET `/api/referral/link` - Generate referral link
  - GET `/api/referral/stats` - Referral statistics
  - Token rewards: 50 tokens to referrer + referee on signup

- **Admin Dashboard**
  - User analytics and search
  - Token economy monitoring
  - Job queue visualization
  - System health checks
  - Voucher management
  - Feedback collection

- **Error Handling**
  - Standardized error response format
  - Error codes: `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
    `INTERNAL_ERROR`
  - Detailed error messages with guidance

- **Rate Limiting**
  - 10 requests/minute per user per endpoint
  - Burst capacity: 20 requests per 10 seconds
  - Returns `429 Too Many Requests` when exceeded
  - Includes `Retry-After` header

### Documentation

- Comprehensive API Reference documentation
- Authentication guide
- Error handling guide
- Rate limiting policy
- cURL and JavaScript code examples
- Postman collection

---

## Deprecated Features

### NextAuth.js Email Provider

> **Deprecated**: December 2025 **Removed**: Expected June 2026

The email-based authentication provider will be removed in favor of passwordless
authentication via magic links.

**Timeline**:

- Dec 2025: Deprecated, still functional
- Mar 2026: New magic link auth available alongside email
- Jun 2026: Email auth removed

**Migration**:

```javascript
// Before (email provider)
import EmailProvider from "next-auth/providers/email";

// After (magic link provider)
import MagicLink from "next-auth/providers/magic-link";
```

---

## Version Comparison Table

| Feature                     | v1.0.0 | Unreleased | Notes                           |
| --------------------------- | ------ | ---------- | ------------------------------- |
| Single Image Enhancement    | Yes    | Yes        | Core feature                    |
| Batch Enhancement           | No     | Yes        | New - up to 20 images           |
| Parallel Enhancement        | No     | Yes        | New - concurrent processing     |
| AI Image Generation (MCP)   | No     | Yes        | New - text-to-image             |
| AI Image Modification (MCP) | No     | Yes        | New - prompt-based edits        |
| Enhancement Pipelines       | No     | Yes        | New - customizable workflows    |
| Album Support               | Yes    | Yes        | Stable                          |
| Token Auto-Regeneration     | Yes    | Yes        | Stable                          |
| Token Well Tiers            | No     | Yes        | New - subscription tiers        |
| Stripe Integration          | Yes    | Yes        | Enhanced - merch support        |
| Referral Program            | Yes    | Yes        | Stable                          |
| Admin Dashboard             | Yes    | Yes        | Enhanced - unified jobs, errors |
| API Key Authentication      | No     | Yes        | New - programmatic access       |
| Photo-to-Merch Platform     | No     | Yes        | New - print-on-demand           |
| Audio Mixer                 | No     | Yes        | New - audio file management     |
| Blog API (Mobile)           | No     | Yes        | New - mobile app content        |
| Anonymous Operations        | No     | Yes        | New - no-auth upload/enhance    |
| Marketing Integrations      | No     | Yes        | New - Facebook/Google Ads       |
| Analytics & Tracking        | No     | Yes        | New - pageview/event tracking   |

---

## Breaking Changes History

### When v2 is Released

This section will document breaking changes from v1 to v2.

#### Response Structure Changes

**Expected Change** (not yet implemented):

```
v1 Response:
{
  "data": {
    "imageId": "123",
    "enhanced": {
      "url": "https://...",
      "size": 1024000
    }
  }
}

v2 Response (hypothetical flattening):
{
  "id": "123",
  "url": "https://...",
  "size": 1024000
}
```

---

## Upgrade Guide

### From v1.0.0 to Unreleased

**No breaking changes** - All changes are backward compatible.

**Recommended Updates**:

1. Monitor `X-RateLimit-*` headers for better rate limit handling
2. Include `context` field in token consumption requests for better tracking
3. Implement webhook handlers for batch operation notifications

---

## Planned Releases

### Q1 2026 Roadmap

- [x] API key authentication (alternative to OAuth) - **Completed Dec 2025**
- [x] Batch operations - **Completed Dec 2025**
- [x] MCP image generation/modification - **Completed Dec 2025**
- [x] Enhancement pipelines - **Completed Dec 2025**
- [ ] Image versioning system
- [ ] Webhook support for async operations
- [ ] Album export as ZIP
- [ ] GraphQL API (alongside REST)

### Q2 2026 Roadmap

- [ ] v2.0.0 - API redesign (if breaking changes needed)
- [ ] SDK releases (Python, JavaScript/TypeScript, Go)
- [ ] OpenAPI 3.1 specification
- [ ] Sandbox environment with test data
- [ ] WebSocket support for real-time updates
- [ ] Enhanced rate limiting with quota management

---

## How to Report Issues

Found a bug or inconsistency in the API?

1. **Check existing issues** -
   https://github.com/spike-land-ai/spike.land/issues
2. **Report new issues** - Create issue with:
   - API endpoint affected
   - Request and response examples
   - Steps to reproduce
   - Expected vs. actual behavior
3. **Email support** - api-support@spike.land (for sensitive issues)

---

## Related Documents

- [API Versioning Strategy](./API_VERSIONING.md) - Long-term versioning approach
- [API Reference](./API_REFERENCE.md) - Complete endpoint documentation
- [Authentication Guide](./API_REFERENCE.md#authentication) - Auth setup
- [Error Handling](./API_REFERENCE.md#error-handling) - Error codes

---

## Document History

| Version | Date       | Changes                                                               |
| ------- | ---------- | --------------------------------------------------------------------- |
| 1.1     | 2025-12-30 | Comprehensive update with MCP APIs, pipelines, merch, audio, and more |
| 1.0     | 2025-12-10 | Initial changelog for v1.0.0 release                                  |
