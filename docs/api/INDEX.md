# Spike Land API Documentation Index

Complete reference guide for all API documentation files and endpoints.

## Quick Navigation

| Document                                               | Purpose                    | Audience           | Length      |
| ------------------------------------------------------ | -------------------------- | ------------------ | ----------- |
| [openapi.yaml](#openapiyaml)                           | Complete API specification | Developers, tools  | 1,598 lines |
| [README.md](#readmemd)                                 | Getting started with API   | All developers     | 349 lines   |
| [INTEGRATION_GUIDE.md](#integration_guidemd)           | Implementation patterns    | Backend developers | 571 lines   |
| [CURL_EXAMPLES.md](#curl_examplesmd)                   | Quick testing reference    | QA, API testers    | 680 lines   |
| [IMPLEMENTATION_SUMMARY.md](#implementation_summarymd) | Project summary            | Project managers   | 389 lines   |
| [QUICK_REFERENCE.md](#quick_referencemd)               | Essential info cheat sheet | All developers     | 284 lines   |
| [ALBUM_ENDPOINTS.md](#album_endpointsmd)               | Album API details          | Backend developers | 666 lines   |
| [IMAGE_ENDPOINTS.md](#image_endpointsmd)               | Image API details          | Backend developers | 776 lines   |

**Total Documentation**: 5,313 lines + existing API_REFERENCE.md

---

## API Endpoints Overview

**Base URL**: `https://spike.land/api` **Total Endpoints**: 130+

### Endpoint Categories

- [Health & System](#health--system-endpoints) - 2 endpoints
- [Authentication](#authentication-endpoints) - 5 endpoints
- [Images](#image-endpoints) - 15 endpoints
- [Albums](#album-endpoints) - 6 endpoints
- [Jobs](#job-endpoints) - 7 endpoints
- [MCP (AI Generation)](#mcp-ai-generation-endpoints) - 5 endpoints
- [Tokens & Billing](#tokens--billing-endpoints) - 8 endpoints
- [Gallery](#gallery-endpoints) - 2 endpoints
- [Referrals](#referral-endpoints) - 2 endpoints
- [Pipelines](#pipeline-endpoints) - 5 endpoints
- [Admin](#admin-endpoints) - 40+ endpoints
- [Marketing](#marketing-endpoints) - 14 endpoints
- [Merchandise](#merchandise-endpoints) - 8 endpoints
- [Tracking & Analytics](#tracking--analytics-endpoints) - 3 endpoints
- [Miscellaneous](#miscellaneous-endpoints) - 10+ endpoints

---

## Endpoint Details by Category

### Health & System Endpoints

| Endpoint               | Methods | Auth  | Description                        |
| ---------------------- | ------- | ----- | ---------------------------------- |
| `/health`              | GET     | No    | Health check for deployment        |
| `/admin/system/health` | GET     | Admin | System health metrics (admin only) |

### Authentication Endpoints

| Endpoint              | Methods | Auth | Description                        |
| --------------------- | ------- | ---- | ---------------------------------- |
| `/auth/[...nextauth]` | ALL     | No   | NextAuth.js authentication handler |
| `/auth/signup`        | POST    | No   | User registration                  |
| `/auth/check-email`   | POST    | No   | Check if email is available        |
| `/auth/mobile/signin` | POST    | No   | Mobile app sign in                 |

### Image Endpoints

| Endpoint                    | Methods     | Auth | Description                          |
| --------------------------- | ----------- | ---- | ------------------------------------ |
| `/images`                   | GET         | Yes  | List user's images with pagination   |
| `/images/upload`            | POST        | Yes  | Upload new image                     |
| `/images/batch-upload`      | POST        | Yes  | Upload multiple images               |
| `/images/anonymous-upload`  | POST        | No   | Upload image without authentication  |
| `/images/enhance`           | POST        | Yes  | Enhance a single image               |
| `/images/batch-enhance`     | POST        | No   | Enhance multiple images              |
| `/images/parallel-enhance`  | POST        | Yes  | Parallel enhancement of images       |
| `/images/anonymous-enhance` | POST        | No   | Enhance image without authentication |
| `/images/export`            | POST        | No   | Export image in specific format      |
| `/images/fetch-base64`      | POST        | No   | Fetch image as base64                |
| `/images/move-to-album`     | POST        | Yes  | Move image to album                  |
| `/images/[id]`              | GET, DELETE | No   | Get or delete specific image         |
| `/images/[id]/share`        | GET, POST   | No   | Share image publicly                 |
| `/images/[id]/versions`     | GET         | No   | Get all versions of an image         |

### Album Endpoints

| Endpoint               | Methods             | Auth | Description                       |
| ---------------------- | ------------------- | ---- | --------------------------------- |
| `/albums`              | GET, POST           | Yes  | List or create albums             |
| `/albums/[id]`         | GET, PATCH, DELETE  | Yes  | Get, update, or delete album      |
| `/albums/[id]/images`  | POST, DELETE, PATCH | Yes  | Manage images in album            |
| `/albums/[id]/enhance` | POST                | Yes  | Batch enhance all images in album |

### Job Endpoints

| Endpoint                 | Methods     | Auth | Description                 |
| ------------------------ | ----------- | ---- | --------------------------- |
| `/jobs/[jobId]`          | GET, DELETE | Yes  | Get or delete job status    |
| `/jobs/[jobId]/cancel`   | POST        | Yes  | Cancel a running job        |
| `/jobs/[jobId]/download` | GET         | Yes  | Download job result         |
| `/jobs/[jobId]/stream`   | GET         | Yes  | Stream job progress (SSE)   |
| `/jobs/batch-status`     | POST        | Yes  | Get status of multiple jobs |
| `/jobs/mix-history`      | GET         | Yes  | Get mix job history         |

### MCP (AI Generation) Endpoints

| Endpoint            | Methods | Auth    | Description                       |
| ------------------- | ------- | ------- | --------------------------------- |
| `/mcp/generate`     | POST    | API Key | Generate image from text prompt   |
| `/mcp/modify`       | POST    | API Key | Modify existing image with prompt |
| `/mcp/balance`      | GET     | API Key | Get token balance                 |
| `/mcp/history`      | GET     | API Key | Get generation history            |
| `/mcp/jobs/[jobId]` | GET     | API Key | Get MCP job status                |

### Tokens & Billing Endpoints

| Endpoint                      | Methods      | Auth | Description                         |
| ----------------------------- | ------------ | ---- | ----------------------------------- |
| `/tokens/balance`             | GET          | No   | Get current token balance           |
| `/stripe/checkout`            | POST         | Yes  | Create Stripe checkout session      |
| `/stripe/webhook`             | POST         | No   | Stripe webhook handler              |
| `/tiers`                      | GET          | No   | Get available subscription tiers    |
| `/tiers/upgrade`              | POST         | Yes  | Upgrade subscription tier           |
| `/tiers/downgrade`            | POST, DELETE | No   | Downgrade subscription tier         |
| `/tiers/check-upgrade-prompt` | GET          | No   | Check if should show upgrade prompt |
| `/vouchers/validate`          | POST         | No   | Validate voucher code               |
| `/vouchers/redeem`            | POST         | No   | Redeem voucher code                 |

### Gallery Endpoints

| Endpoint                 | Methods | Auth | Description        |
| ------------------------ | ------- | ---- | ------------------ |
| `/gallery`               | GET     | No   | Get public gallery |
| `/gallery/public-albums` | GET     | No   | Get public albums  |

### Referral Endpoints

| Endpoint          | Methods | Auth | Description                   |
| ----------------- | ------- | ---- | ----------------------------- |
| `/referral/link`  | GET     | No   | Get or generate referral link |
| `/referral/stats` | GET     | No   | Get referral statistics       |

### Pipeline Endpoints

| Endpoint                      | Methods            | Auth | Description                      |
| ----------------------------- | ------------------ | ---- | -------------------------------- |
| `/pipelines`                  | GET, POST          | Yes  | List or create pipelines         |
| `/pipelines/[id]`             | GET, PATCH, DELETE | Yes  | Get, update, or delete pipeline  |
| `/pipelines/[id]/fork`        | POST               | Yes  | Fork a pipeline                  |
| `/pipelines/reference-images` | POST, DELETE       | No   | Manage pipeline reference images |

### Admin Endpoints

#### Admin - Dashboard & Analytics

| Endpoint                  | Methods | Auth  | Description                 |
| ------------------------- | ------- | ----- | --------------------------- |
| `/admin/dashboard`        | GET     | Admin | Real-time dashboard metrics |
| `/admin/analytics/tokens` | GET     | Admin | Token usage analytics       |
| `/admin/analytics/users`  | GET     | Admin | User analytics              |

#### Admin - User Management

| Endpoint                             | Methods            | Auth  | Description                  |
| ------------------------------------ | ------------------ | ----- | ---------------------------- |
| `/admin/users`                       | GET, PATCH, DELETE | Admin | Manage users                 |
| `/admin/users/password`              | POST               | Admin | Reset user password          |
| `/admin/users/[userId]/enhancements` | GET                | Admin | Get user enhancement history |

#### Admin - Job Management

| Endpoint                    | Methods     | Auth  | Description       |
| --------------------------- | ----------- | ----- | ----------------- |
| `/admin/jobs`               | GET         | Admin | List all jobs     |
| `/admin/jobs/[jobId]`       | GET, DELETE | Admin | Get or delete job |
| `/admin/jobs/[jobId]/rerun` | POST        | Admin | Rerun failed job  |
| `/admin/jobs/cleanup`       | POST        | Admin | Clean up old jobs |

#### Admin - Gallery Management

| Endpoint                 | Methods                  | Auth  | Description              |
| ------------------------ | ------------------------ | ----- | ------------------------ |
| `/admin/gallery`         | GET, POST, PATCH, DELETE | Admin | Manage gallery items     |
| `/admin/gallery/browse`  | GET                      | Admin | Browse all gallery items |
| `/admin/gallery/reorder` | POST, PATCH              | Admin | Reorder gallery items    |
| `/admin/photos`          | GET                      | Admin | List all photos          |

#### Admin - Marketing

| Endpoint                               | Methods           | Auth  | Description                  |
| -------------------------------------- | ----------------- | ----- | ---------------------------- |
| `/admin/marketing/accounts`            | GET, DELETE       | Admin | Manage marketing accounts    |
| `/admin/marketing/campaigns`           | GET               | Admin | List marketing campaigns     |
| `/admin/marketing/link`                | GET, POST, DELETE | Admin | Manage tracking links        |
| `/admin/marketing/analytics/overview`  | GET               | Admin | Marketing analytics overview |
| `/admin/marketing/analytics/campaigns` | GET               | Admin | Campaign analytics           |
| `/admin/marketing/analytics/daily`     | GET               | Admin | Daily marketing analytics    |
| `/admin/marketing/analytics/funnel`    | GET               | Admin | Conversion funnel analytics  |
| `/admin/marketing/analytics/export`    | GET               | Admin | Export marketing analytics   |

#### Admin - Error Management

| Endpoint              | Methods     | Auth  | Description               |
| --------------------- | ----------- | ----- | ------------------------- |
| `/admin/errors`       | GET, DELETE | Admin | List or delete error logs |
| `/admin/errors/stats` | GET         | Admin | Get error statistics      |
| `/admin/errors/test`  | POST        | Admin | Test error reporting      |

#### Admin - Agent Management (Jules)

| Endpoint                                 | Methods   | Auth  | Description                   |
| ---------------------------------------- | --------- | ----- | ----------------------------- |
| `/admin/agents`                          | GET, POST | Admin | List or create agent sessions |
| `/admin/agents/[sessionId]`              | GET       | Admin | Get agent session details     |
| `/admin/agents/[sessionId]/activities`   | GET       | Admin | Get agent session activities  |
| `/admin/agents/[sessionId]/approve-plan` | POST      | Admin | Approve agent plan            |
| `/admin/agents/[sessionId]/message`      | POST      | Admin | Send message to agent         |
| `/admin/agents/resources`                | GET       | Admin | Get agent resource usage      |
| `/admin/agents/git`                      | GET       | Admin | Get git repository info       |
| `/admin/agents/github/issues`            | GET       | Admin | Get GitHub issues             |

#### Admin - Other

| Endpoint              | Methods                  | Auth  | Description            |
| --------------------- | ------------------------ | ----- | ---------------------- |
| `/admin/vouchers`     | GET, POST, DELETE, PATCH | Admin | Manage vouchers        |
| `/admin/feedback`     | GET, PATCH               | Admin | Manage user feedback   |
| `/admin/emails`       | GET, POST                | Admin | Send admin emails      |
| `/admin/storage`      | GET                      | Admin | Get storage statistics |
| `/admin/tracked-urls` | GET, POST, PATCH, DELETE | Admin | Manage tracked URLs    |

### Marketing Endpoints

| Endpoint                       | Methods | Auth | Description                  |
| ------------------------------ | ------- | ---- | ---------------------------- |
| `/marketing/google/connect`    | GET     | No   | Connect Google Ads account   |
| `/marketing/google/callback`   | GET     | No   | Google OAuth callback        |
| `/marketing/facebook/connect`  | GET     | No   | Connect Facebook Ads account |
| `/marketing/facebook/callback` | GET     | No   | Facebook OAuth callback      |

### Merchandise Endpoints

| Endpoint                  | Methods       | Auth | Description                |
| ------------------------- | ------------- | ---- | -------------------------- |
| `/merch/products`         | GET, POST     | No   | List or create products    |
| `/merch/cart`             | GET, POST     | No   | View or add to cart        |
| `/merch/cart/[itemId]`    | PATCH, DELETE | No   | Update or remove cart item |
| `/merch/checkout`         | POST          | No   | Create checkout session    |
| `/merch/orders`           | GET           | No   | List user orders           |
| `/merch/orders/[id]`      | GET           | No   | Get order details          |
| `/merch/webhooks/prodigi` | POST          | No   | Prodigi webhook handler    |

### Tracking & Analytics Endpoints

| Endpoint             | Methods     | Auth | Description             |
| -------------------- | ----------- | ---- | ----------------------- |
| `/tracking/pageview` | POST        | No   | Track page view         |
| `/tracking/event`    | POST        | No   | Track custom event      |
| `/tracking/session`  | POST, PATCH | No   | Manage tracking session |

### Miscellaneous Endpoints

| Endpoint                  | Methods            | Auth | Description                 |
| ------------------------- | ------------------ | ---- | --------------------------- |
| `/feedback`               | POST               | No   | Submit user feedback        |
| `/errors/report`          | POST               | No   | Report client-side error    |
| `/logs/image-error`       | POST               | No   | Log image processing error  |
| `/reports/system`         | GET                | Yes  | Get system reports          |
| `/settings/api-keys`      | GET, POST          | Yes  | Manage API keys             |
| `/settings/api-keys/[id]` | GET, DELETE        | No   | Get or delete API key       |
| `/share/[token]/download` | GET                | No   | Download shared content     |
| `/turn-credentials`       | GET                | No   | Get TURN server credentials |
| `/test-gemini`            | POST               | No   | Test Gemini AI integration  |
| `/apps`                   | GET, POST          | No   | List or create apps         |
| `/apps/[id]`              | GET, PATCH, DELETE | No   | Manage app                  |
| `/audio/upload`           | POST               | No   | Upload audio file           |
| `/audio/[trackId]`        | GET, DELETE        | No   | Get or delete audio track   |
| `/blog/posts`             | GET                | No   | List blog posts             |
| `/blog/posts/[slug]`      | GET                | No   | Get blog post by slug       |
| `/boxes`                  | GET, POST          | No   | List or create boxes        |
| `/boxes/[id]`             | GET, DELETE        | No   | Get or delete box           |
| `/boxes/[id]/action`      | POST               | No   | Execute box action          |
| `/boxes/[id]/clone`       | POST               | No   | Clone a box                 |
| `/boxes/[id]/messages`    | POST               | No   | Add message to box          |

### Cron Job Endpoints (Internal)

| Endpoint                 | Methods | Auth | Description                         |
| ------------------------ | ------- | ---- | ----------------------------------- |
| `/cron/cleanup-jobs`     | GET     | No   | Clean up old jobs (scheduled)       |
| `/cron/cleanup-errors`   | GET     | No   | Clean up old error logs (scheduled) |
| `/cron/cleanup-tracking` | GET     | No   | Clean up tracking data (scheduled)  |
| `/cron/marketing-sync`   | GET     | No   | Sync marketing data (scheduled)     |

### Agent Endpoints (External)

| Endpoint              | Methods   | Auth | Description               |
| --------------------- | --------- | ---- | ------------------------- |
| `/v1/agent/heartbeat` | POST      | No   | Agent heartbeat           |
| `/v1/agent/tasks`     | GET, POST | Yes  | Get or create agent tasks |

---

## Document Descriptions

### openapi.yaml

**Type**: OpenAPI 3.0 Specification **Format**: YAML **Size**: 1,598 lines, 46
KB

Complete machine-readable API specification including:

- Base configuration and metadata
- Authentication schemes (session cookie & bearer token)
- 25+ reusable schema definitions
- Error response standards
- Common parameters
- Rate limiting documentation
- Full server configuration

**Use Cases**:

- Import into Swagger UI for interactive documentation
- Generate SDKs for multiple languages
- Import into Postman for API testing
- Validate with OpenAPI tools
- Generate mock servers

**How to Use**:

1. View with Swagger UI: Paste content at https://swagger.io/tools/swagger-ui/
2. Generate SDK:
   `npx openapi-generator-cli generate -i docs/api/openapi.yaml -g typescript-fetch`
3. Import to Postman: File > Import > Select openapi.yaml
4. Deploy documentation: `npx @redocly/cli build-docs docs/api/openapi.yaml`

---

### README.md

**Type**: Getting Started Guide **Format**: Markdown **Size**: 349 lines, 8.7 KB

Overview of API documentation and how to use it:

- File structure and navigation
- Instructions for using OpenAPI spec
- SDK generation in multiple languages (TypeScript, Python, Go)
- Postman collection setup
- OpenAPI validation
- API architecture overview
- Authentication methods explained
- Token economy system
- Rate limiting explanation
- Error handling standards
- Component documentation
- Example API calls with responses
- Security considerations
- Monitoring and debugging

**Audience**: All developers starting with the API **Read Time**: 10-15 minutes
**Next Steps**: Choose between INTEGRATION_GUIDE.md or CURL_EXAMPLES.md

---

### INTEGRATION_GUIDE.md

**Type**: Developer Integration Guide **Format**: Markdown **Size**: 571 lines,
14 KB

Code-first guide for implementing API integration:

- Authentication setup (session-based, bearer tokens, mobile)
- Common API patterns with working code:
  - Token balance checking
  - Image enhancement with polling
  - Job streaming
  - Album management
  - Batch operations
  - Referral program
- Error handling with TypeScript example class
- Rate limiting with retry logic
- Type-safe API client implementation
- Testing examples (unit & integration)
- Error handling strategies

**Audience**: Backend developers, API SDK creators **Read Time**: 30-45 minutes
**Language**: TypeScript/JavaScript **Includes**: 30+ working code examples

---

### CURL_EXAMPLES.md

**Type**: Testing Reference **Format**: Markdown **Size**: 680 lines, 13 KB

Quick reference for testing API with cURL:

- Environment setup
- 40+ working cURL examples:
  - Health checks
  - Authentication
  - Token management
  - Image operations
  - Enhancement jobs
  - Album management
  - Gallery operations
  - Referral program
  - Payment processing
- Error response examples
- Useful cURL tips and tricks
- Automation shell scripts
- Performance measurement
- Troubleshooting guide

**Audience**: QA engineers, API testers, developers **Read Time**: 20-30 minutes
**Use**: Copy-paste ready commands

---

### IMPLEMENTATION_SUMMARY.md

**Type**: Project Summary **Format**: Markdown **Size**: 389 lines, 11 KB

Comprehensive summary of the API documentation project:

- Deliverables overview
- Architecture decisions and rationale
- Tools and technologies
- Integration points with existing API
- Best practices implemented
- Next steps (phased roadmap)
- File locations and organization
- Key metrics and statistics
- Testing and validation approach
- Support and maintenance guidelines

**Audience**: Project managers, architects **Read Time**: 15-20 minutes **Key
Sections**:

- Phase 1: Validation (Complete)
- Phase 2: Endpoint Documentation (Pending)
- Phase 3: SDK Generation (Pending)
- Phase 4: Documentation Deployment (Pending)
- Phase 5: Maintenance (Ongoing)

---

### QUICK_REFERENCE.md

**Type**: Cheat Sheet **Format**: Markdown **Size**: 284 lines, 7 KB

Essential information at a glance:

- API base URLs
- Authentication quick setup
- Token costs and regeneration
- Rate limits summary
- Common HTTP status codes
- Error response format
- Key endpoints list
- Query parameter reference
- Response header guide
- Useful tools and links

**Audience**: All developers (bookmark this!) **Read Time**: 5-10 minutes
**Use**: Quick lookup during development

---

### ALBUM_ENDPOINTS.md

**Type**: Endpoint Documentation **Format**: Markdown **Size**: 666 lines, 16 KB

Detailed documentation for album operations:

- List albums
- Create album
- Update album
- Delete album
- Add images to album
- Remove images from album
- Share album
- Batch enhance album images
- Get album metadata

**Includes for each endpoint**:

- HTTP method and path
- Authentication requirement
- Query/path parameters
- Request body schema
- Response schema
- Status codes and examples
- Rate limit info
- Error cases

**Audience**: Backend developers **Related Endpoints**: /api/albums/*

---

### IMAGE_ENDPOINTS.md

**Type**: Endpoint Documentation **Format**: Markdown **Size**: 776 lines, 17 KB

Detailed documentation for image operations:

- Upload image
- Get image details
- Delete image
- List images
- Get image versions
- Get enhanced images
- Share image
- Export image
- Move to album

**Includes for each endpoint**:

- HTTP method and path
- Authentication requirement
- Request/response examples
- All possible status codes
- Error scenarios
- Rate limiting
- Token cost information
- File format requirements

**Audience**: Backend developers **Related Endpoints**: /api/images/_,
/api/images/[id]/_

---

## Reading Path by Role

### Frontend Developer

1. Start: **README.md** (5 min)
2. Quick ref: **QUICK_REFERENCE.md** (5 min)
3. Examples: **CURL_EXAMPLES.md** (15 min)
4. Implementation: **INTEGRATION_GUIDE.md** (20 min)
5. Reference: **openapi.yaml** (as needed)

**Total Time**: ~45 minutes to get started

### Backend Developer

1. Start: **README.md** (5 min)
2. Guide: **INTEGRATION_GUIDE.md** (30 min)
3. Endpoints: **ALBUM_ENDPOINTS.md** & **IMAGE_ENDPOINTS.md** (20 min)
4. Reference: **openapi.yaml** (as needed)
5. Testing: **CURL_EXAMPLES.md** (as needed)

**Total Time**: ~55 minutes to understand all details

### QA / Test Engineer

1. Quick ref: **QUICK_REFERENCE.md** (5 min)
2. Examples: **CURL_EXAMPLES.md** (25 min)
3. Endpoints: **ALBUM_ENDPOINTS.md** & **IMAGE_ENDPOINTS.md** (15 min)
4. Reference: **openapi.yaml** (as needed)

**Total Time**: ~45 minutes to start testing

### DevOps / API Consumer

1. Overview: **README.md** (5 min)
2. Reference: **QUICK_REFERENCE.md** (5 min)
3. Spec: **openapi.yaml** (15 min)
4. Integration: **INTEGRATION_GUIDE.md** (20 min)

**Total Time**: ~45 minutes for integration

### Project Manager / Architect

1. Overview: **IMPLEMENTATION_SUMMARY.md** (15 min)
2. Architecture: **README.md** (10 min)
3. Details: **openapi.yaml** (20 min)

**Total Time**: ~45 minutes for big picture

---

## Common Tasks

### "I need to understand the API quickly"

- Read: QUICK_REFERENCE.md (5 min)
- Then: INTEGRATION_GUIDE.md (20 min)
- Location: README.md → INTEGRATION_GUIDE.md

### "I want to test an endpoint"

- Read: CURL_EXAMPLES.md (find your endpoint)
- Copy command and run
- Location: docs/api/CURL_EXAMPLES.md

### "I'm implementing a feature"

- Reference: INTEGRATION_GUIDE.md (patterns)
- Check: ALBUM_ENDPOINTS.md or IMAGE_ENDPOINTS.md (details)
- Validate: openapi.yaml (complete schema)
- Location: docs/api/INTEGRATION_GUIDE.md

### "I need to generate an SDK"

- Read: README.md (SDK generation section)
- Run: OpenAPI Generator command
- Validate: openapi.yaml
- Location: docs/api/README.md

### "I want to set up Swagger UI"

- Read: README.md (deployment section)
- Use: openapi.yaml file
- Command: `npx swagger-ui docs/api/openapi.yaml -p 8080`
- Location: docs/api/README.md

### "I need error handling details"

- Reference: QUICK_REFERENCE.md (error codes)
- Details: INTEGRATION_GUIDE.md (error handler class)
- Examples: CURL_EXAMPLES.md (error responses)
- Location: Multiple files

### "I'm documenting API changes"

- Update: openapi.yaml (spec)
- Update: INTEGRATION_GUIDE.md (if patterns change)
- Update: CURL_EXAMPLES.md (if endpoints change)
- Location: docs/api/openapi.yaml

---

## API Statistics

### Endpoints by Category

- **Health**: 2 endpoints
- **Authentication**: 5 endpoints
- **Images**: 15 endpoints
- **Albums**: 6 endpoints
- **Jobs**: 7 endpoints
- **MCP (AI Generation)**: 5 endpoints
- **Tokens & Billing**: 8 endpoints
- **Gallery**: 2 endpoints
- **Referrals**: 2 endpoints
- **Pipelines**: 5 endpoints
- **Admin**: 40+ endpoints
- **Marketing**: 14 endpoints
- **Merchandise**: 8 endpoints
- **Tracking**: 3 endpoints
- **Miscellaneous**: 10+ endpoints
- **Cron Jobs**: 4 endpoints
- **Agent API**: 2 endpoints

**Total Endpoints**: 130+

### Schemas (25+)

- User Models: 3
- Image Models: 3
- Album Models: 2
- Referral Models: 2
- Voucher Models: 1
- App Models: 2
- Admin Models: 2
- Error Models: 2
- Other: 3+

### Enumerations (5)

- EnhancementTier
- JobStatus
- AlbumPrivacy
- ExportFormat
- UserRole

---

## Tools for These Docs

### Viewing

- GitHub: Native markdown rendering
- VS Code: Markdown preview
- Markdown viewers: Any online viewer

### OpenAPI Spec Usage

- Swagger UI: `https://swagger.io/tools/swagger-ui/`
- ReDoc: `npx @redocly/cli build-docs docs/api/openapi.yaml`
- Postman: Import openapi.yaml directly
- OpenAPI Generator: Generate SDKs
- Swagger CLI: Validate specification

### Creating Requests

- cURL: Command line tool (all examples provided)
- Postman: GUI for building requests
- Insomnia: Similar to Postman
- REST Client VS Code: Extension for testing
- Thunder Client: VS Code extension

---

## Maintenance & Updates

### When API Endpoint Changes

1. Update openapi.yaml (source of truth)
2. Update relevant endpoint document (ALBUM_ENDPOINTS.md, etc.)
3. Update CURL_EXAMPLES.md if examples change
4. Update INTEGRATION_GUIDE.md if patterns change
5. Update QUICK_REFERENCE.md if relevant
6. Validate with: `npx swagger-cli validate docs/api/openapi.yaml`

### When Adding New Endpoint

1. Add schema to openapi.yaml (components section)
2. Add endpoint definition to openapi.yaml (paths section)
3. Add cURL example to CURL_EXAMPLES.md
4. Add integration example to INTEGRATION_GUIDE.md (if new pattern)
5. Update QUICK_REFERENCE.md if important
6. Consider new endpoint documentation file if complex
7. Update this INDEX.md with new endpoint

### Release Checklist

- [ ] openapi.yaml validated
- [ ] All endpoints documented
- [ ] CURL examples tested
- [ ] Integration guide examples tested
- [ ] No 404 links in documentation
- [ ] Version numbers updated
- [ ] Changelog updated
- [ ] INDEX.md reflects current API state

---

## Version History

| Version | Date         | Status   | Notes                                                                                       |
| ------- | ------------ | -------- | ------------------------------------------------------------------------------------------- |
| 1.1.0   | Dec 30, 2025 | Current  | Comprehensive endpoint index added, 130+ endpoints documented                               |
| 1.0.0   | Dec 12, 2025 | Complete | Initial base specification with 25+ schemas, all components, ready for endpoint definitions |

---

## Support & Questions

### For API Users

- Start: docs/api/README.md
- Questions: contact zoltan.erdos@spike.land
- Issues: GitHub Issues

### For Maintainers

- Guidelines: See IMPLEMENTATION_SUMMARY.md
- Changes: Update openapi.yaml first, then derived docs
- Validation: `npx swagger-cli validate docs/api/openapi.yaml`

### For Contributors

- Follow patterns in existing documentation
- Update openapi.yaml as source of truth
- Test cURL examples before committing
- Validate all YAML/JSON before pushing

---

## Related Documentation

For additional context, see:

- [API_REFERENCE.md](../API_REFERENCE.md) - Detailed endpoint reference
- [TOKEN_SYSTEM.md](../TOKEN_SYSTEM.md) - Token economy details
- [IMAGE_ENHANCEMENT.md](../IMAGE_ENHANCEMENT.md) - Enhancement pipeline
- [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) - Data models
- [SECURITY_AUDIT_REPORT.md](../SECURITY_AUDIT_REPORT.md) - Security details

---

**Last Updated**: December 30, 2025 **Current Version**: 1.1.0 **Status**:
Complete - Comprehensive endpoint index with 130+ documented endpoints **Next
Review**: January 6, 2026 or when major changes occur
