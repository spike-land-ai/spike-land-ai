# API Reference

> **Last Updated**: February 2026 | **Status**: Production | **Base URL**:
> `https://spike.land` (Production) or `http://localhost:3000` (Development)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Image Management](#image-management)
3. [Image Enhancement](#image-enhancement)
4. [Anonymous Image Operations](#anonymous-image-operations)
5. [Batch Operations](#batch-operations)
6. [Albums](#albums)
7. [Enhancement Jobs](#enhancement-jobs)
8. [Token Management](#token-management)
9. [Tier Management](#tier-management)
10. [Voucher Management](#voucher-management)
11. [Referral Program](#referral-program)
12. [MCP API (Model Context Protocol)](#mcp-api-model-context-protocol)
13. [API Key Management](#api-key-management)
14. [Payment Processing](#payment-processing)
15. [Admin Dashboard](#admin-dashboard)
16. [Marketing Dashboard](#marketing-dashboard)
17. [System Reports](#system-reports)
18. [Error Handling](#error-handling)
19. [Rate Limiting](#rate-limiting)
20. [Orbit API](#orbit-api)
21. [Chess API](#chess-api)
22. [Store API](#store-api)
23. [State Machine API](#state-machine-api)
24. [TikTok Social Integration](#tiktok-social-integration)
25. [Cron Authentication](#cron-authentication)

---

## Authentication

All protected endpoints require authentication via session cookie (NextAuth.js)
or Bearer token (API key for MCP endpoints).

### Authentication Methods

1. **Session Cookie** (NextAuth.js) - Web Application
   - Automatically set after login
   - Included in all requests to same domain
   - No manual token passing required

2. **API Key** (Bearer Token) - MCP API
   ```http
   Authorization: Bearer sk_live_...
   ```

### Login

**Endpoint**: `/api/auth/signin`

Uses NextAuth.js multi-provider authentication:

- GitHub OAuth
- Google OAuth
- Credentials (Email/Password)

---

## Image Management

### Upload Image

Upload and automatically enhance an image in one operation.

**Endpoint**: `POST /api/images/upload`

**Authentication**: Required (Session)

**Content-Type**: `multipart/form-data`

**Request**:

```http
POST /api/images/upload HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="photo.jpg"
Content-Type: image/jpeg

<binary image data>
------WebKitFormBoundary
Content-Disposition: form-data; name="albumId"

album_abc123
------WebKitFormBoundary--
```

**Request Fields**:

| Field   | Type   | Required | Description                      |
| ------- | ------ | -------- | -------------------------------- |
| file    | File   | Yes      | Image file (max 25 MB)           |
| albumId | string | No       | Album ID to associate image with |

**Supported Formats**: JPEG, PNG, WebP, GIF, BMP

**cURL Example**:

```bash
curl -X POST http://localhost:3000/api/images/upload \
  -H "Cookie: next-auth.session-token=..." \
  -F "file=@photo.jpg" \
  -F "albumId=album_abc123"
```

**JavaScript Example**:

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("albumId", "album_abc123"); // Optional

const response = await fetch("/api/images/upload", {
  method: "POST",
  body: formData,
});

const data = await response.json();
console.log(`Image uploaded: ${data.image.id}`);
console.log(`Enhancement job: ${data.enhancement.jobId}`);
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "image": {
    "id": "clya1b2c3d4e5f6g7h8i9j0k1",
    "name": "my-photo.jpg",
    "url": "https://r2-bucket.example.com/originals/user123/image-id.jpg",
    "width": 1920,
    "height": 1440,
    "size": 2456832,
    "format": "jpeg"
  },
  "enhancement": {
    "jobId": "job_abc123",
    "tier": "TIER_1K",
    "tokenCost": 2,
    "newBalance": 98
  }
}
```

**Error Responses**:

| Status | Error               | Description                            | Solution                  |
| ------ | ------------------- | -------------------------------------- | ------------------------- |
| 400    | No file provided    | Request missing file                   | Include file in form data |
| 400    | Invalid filename    | Filename contains invalid characters   | Use safe filename         |
| 401    | Unauthorized        | Not authenticated                      | Login first               |
| 402    | Insufficient tokens | Not enough tokens for auto-enhancement | Purchase tokens           |
| 413    | Payload too large   | File exceeds 25 MB                     | Compress image            |
| 429    | Too many requests   | Rate limit exceeded                    | Wait before retrying      |
| 500    | Upload failed       | S3/R2 or processing error              | Try again later           |

**Rate Limit**: 20 uploads per hour per user

---

### Get Image Details

Retrieve metadata and enhancement history for an image.

**Endpoint**: `GET /api/images/{imageId}`

**Authentication**: Required (Session)

**Path Parameters**:

| Parameter | Type   | Description                   |
| --------- | ------ | ----------------------------- |
| imageId   | string | Image ID from upload response |

**Request**:

```http
GET /api/images/clya1b2c3d4e5f6g7h8i9j0k1 HTTP/1.1
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "image": {
    "id": "clya1b2c3d4e5f6g7h8i9j0k1",
    "name": "my-photo.jpg",
    "description": null,
    "originalUrl": "https://r2-bucket.example.com/originals/user123/image-id.jpg",
    "originalWidth": 1920,
    "originalHeight": 1440,
    "originalSizeBytes": 2456832,
    "originalFormat": "jpeg",
    "isPublic": false,
    "viewCount": 0,
    "createdAt": "2025-12-02T10:15:00Z",
    "updatedAt": "2025-12-02T10:15:00Z",
    "jobs": [
      {
        "id": "job_001",
        "tier": "TIER_2K",
        "status": "COMPLETED",
        "tokensCost": 5,
        "enhancedUrl": "https://r2-bucket.example.com/enhanced/user123/image-id-2k.jpg",
        "enhancedWidth": 2048,
        "enhancedHeight": 1536,
        "enhancedSizeBytes": 3456789,
        "errorMessage": null,
        "createdAt": "2025-12-02T10:30:00Z",
        "processingStartedAt": "2025-12-02T10:30:05Z",
        "processingCompletedAt": "2025-12-02T10:35:00Z"
      }
    ]
  }
}
```

**Job Status Values**:

- `PROCESSING`: Enhancement in progress
- `COMPLETED`: Successfully enhanced
- `FAILED`: Enhancement failed (tokens refunded)
- `CANCELLED`: Job cancelled by user
- `REFUNDED`: Job refunded

**Error Responses**:

| Status | Error           | Description       | Solution                     |
| ------ | --------------- | ----------------- | ---------------------------- |
| 401    | Unauthorized    | Not authenticated | Login first                  |
| 403    | Forbidden       | Not image owner   | Cannot access others' images |
| 404    | Image not found | ID doesn't exist  | Check image ID               |
| 500    | Failed to fetch | Database error    | Try again later              |

---

### Delete Image

Permanently delete an image and all its enhancements.

**Endpoint**: `DELETE /api/images/{imageId}`

**Authentication**: Required (Session)

**Path Parameters**:

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| imageId   | string | Image ID to delete |

**Request**:

```http
DELETE /api/images/clya1b2c3d4e5f6g7h8i9j0k1 HTTP/1.1
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

**Error Responses**:

| Status | Error            | Description       | Solution                     |
| ------ | ---------------- | ----------------- | ---------------------------- |
| 401    | Unauthorized     | Not authenticated | Login first                  |
| 403    | Forbidden        | Not image owner   | Cannot delete others' images |
| 404    | Image not found  | ID doesn't exist  | Check image ID               |
| 500    | Failed to delete | R2/DB error       | Try again later              |

---

### Get All Images

List all images for the authenticated user.

**Endpoint**: `GET /api/images`

**Authentication**: Required (Session)

**Query Parameters**:

| Parameter | Type   | Required | Default | Description                          |
| --------- | ------ | -------- | ------- | ------------------------------------ |
| limit     | number | No       | 20      | Number of images to return (max 100) |
| offset    | number | No       | 0       | Pagination offset                    |

**Response (Success - 200)**:

```json
{
  "images": [
    {
      "id": "img_001",
      "name": "photo1.jpg",
      "originalUrl": "https://...",
      "originalWidth": 1920,
      "originalHeight": 1440,
      "createdAt": "2025-12-02T10:00:00Z"
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

---

## Image Enhancement

### Request Enhancement

Start an image enhancement job with optional blend source.

**Endpoint**: `POST /api/images/enhance`

**Authentication**: Required (Session)

**Rate Limit**: 10 requests per minute per user

**Content-Type**: `application/json`

**Request**:

```http
POST /api/images/enhance HTTP/1.1
Content-Type: application/json

{
  "imageId": "clya1b2c3d4e5f6g7h8i9j0k1",
  "tier": "TIER_2K",
  "blendSource": {
    "imageId": "source_image_id"
  }
}
```

**Request Body**:

| Field       | Type   | Required | Description                                         |
| ----------- | ------ | -------- | --------------------------------------------------- |
| imageId     | string | Yes      | Valid image ID to enhance                           |
| tier        | string | Yes      | Enhancement tier: FREE, TIER_1K, TIER_2K, TIER_4K   |
| blendSource | object | No       | Source image for blending (imageId, url, or base64) |

**Blend Source Options** (provide one of):

```json
{
  "blendSource": {
    "imageId": "img_123" // Reference existing image
  }
}
```

```json
{
  "blendSource": {
    "url": "https://example.com/image.jpg" // Fetch from URL
  }
}
```

```json
{
  "blendSource": {
    "base64": "iVBORw0KGgoAAAANS...", // Base64 encoded image
    "mimeType": "image/png"
  }
}
```

**Enhancement Tiers and Costs**:

| Tier    | Max Dimension | Token Cost | Model |
| ------- | ------------- | ---------- | ----- |
| FREE    | 1024px        | 0          | Nano  |
| TIER_1K | 1024px        | 2          | Flash |
| TIER_2K | 2048px        | 5          | Flash |
| TIER_4K | 4096px        | 10         | Flash |

**cURL Example**:

```bash
curl -X POST http://localhost:3000/api/images/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "imageId": "clya1b2c3d4e5f6g7h8i9j0k1",
    "tier": "TIER_2K"
  }'
```

**JavaScript Example**:

```javascript
const response = await fetch("/api/images/enhance", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageId: "clya1b2c3d4e5f6g7h8i9j0k1",
    tier: "TIER_2K",
  }),
});

const result = await response.json();
console.log(`Job ID: ${result.jobId}`);
console.log(`Tokens Cost: ${result.tokenCost}`);
console.log(`New Balance: ${result.newBalance}`);
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "jobId": "job_enhancement_abc123",
  "tokenCost": 5,
  "newBalance": 95
}
```

**Response Fields**:

| Field      | Type    | Description                            |
| ---------- | ------- | -------------------------------------- |
| success    | boolean | Always true on 200                     |
| jobId      | string  | Unique job identifier (track progress) |
| tokenCost  | number  | Tokens deducted for this job           |
| newBalance | number  | Token balance after deduction          |

**Error Responses**:

| Status | Error                   | Description               | Solution                               |
| ------ | ----------------------- | ------------------------- | -------------------------------------- |
| 400    | Missing imageId or tier | Required field missing    | Provide both fields                    |
| 400    | Invalid tier            | Tier not recognized       | Use FREE, TIER_1K, TIER_2K, or TIER_4K |
| 400    | Blend image too large   | Blend source exceeds 20MB | Use smaller image                      |
| 401    | Unauthorized            | Not authenticated         | Login first                            |
| 402    | Insufficient tokens     | Balance too low           | Purchase tokens or redeem voucher      |
| 404    | Image not found         | Image ID invalid          | Check image ID and ownership           |
| 429    | Too many requests       | Rate limit exceeded       | Wait before next request               |
| 500    | Enhancement failed      | Processing error          | Try again or contact support           |

**Rate Limit Headers**:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1701516600
Retry-After: 60
```

---

## Anonymous Image Operations

### Anonymous Upload

Upload an image without authentication (rate-limited by IP).

**Endpoint**: `POST /api/images/anonymous-upload`

**Authentication**: None (rate-limited by IP)

**Content-Type**: `multipart/form-data`

**Rate Limit**: 5 uploads per hour per IP

**Request**:

```http
POST /api/images/anonymous-upload HTTP/1.1
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="photo.jpg"

<binary image data>
------WebKitFormBoundary--
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "image": {
    "id": "img_anonymous_123",
    "name": "photo.jpg",
    "url": "https://r2-bucket.example.com/...",
    "width": 1920,
    "height": 1440
  }
}
```

**Note**: Anonymous images are automatically set to `isPublic: true` and do not
auto-enhance. Use anonymous enhance endpoint separately.

---

### Anonymous Enhance

Enhance an anonymously uploaded image (rate-limited by IP).

**Endpoint**: `POST /api/images/anonymous-enhance`

**Authentication**: None (rate-limited by IP)

**Content-Type**: `application/json`

**Rate Limit**: 3 enhancements per hour per IP

**Request**:

```json
{
  "imageId": "img_anonymous_123",
  "tier": "FREE"
}
```

**Note**: Anonymous enhancements are limited to the FREE tier only (no token
cost).

**Response (Success - 200)**:

```json
{
  "success": true,
  "jobId": "job_anon_123"
}
```

---

## Batch Operations

### Batch Upload Images

Upload multiple images in a single request.

**Endpoint**: `POST /api/images/batch-upload`

**Authentication**: Required (Session)

**Content-Type**: `multipart/form-data`

**Rate Limit**: 20 files per hour

**Request**:

```http
POST /api/images/batch-upload HTTP/1.1
Content-Type: multipart/form-data

files: [file1.jpg, file2.jpg, file3.jpg]
albumId: album_123 (optional)
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "uploaded": 3,
  "failed": 0,
  "images": [
    {
      "id": "img_001",
      "name": "photo1.jpg",
      "url": "https://r2-bucket.example.com/originals/user123/img_001.jpg",
      "width": 1920,
      "height": 1440
    }
  ]
}
```

---

### Batch Enhance Images

Enhance multiple images asynchronously.

**Endpoint**: `POST /api/images/batch-enhance`

**Authentication**: Required (Session)

**Content-Type**: `application/json`

**Request**:

```json
{
  "imageIds": ["img_001", "img_002", "img_003"],
  "tier": "TIER_2K"
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "batchId": "batch_enhance_abc123",
  "totalCost": 15,
  "imageCount": 3,
  "jobs": [
    {
      "imageId": "img_001",
      "jobId": "job_001",
      "status": "PROCESSING"
    }
  ]
}
```

---

## Albums

### Create Album

Create a new album for organizing images.

**Endpoint**: `POST /api/albums`

**Authentication**: Required (Session)

**Content-Type**: `application/json`

**Request**:

```http
POST /api/albums HTTP/1.1
Content-Type: application/json

{
  "name": "Family Photos 2025",
  "description": "Summer vacation photos",
  "privacy": "PRIVATE",
  "defaultTier": "TIER_1K"
}
```

**Request Body**:

| Field       | Type   | Required | Default | Description                                   |
| ----------- | ------ | -------- | ------- | --------------------------------------------- |
| name        | string | Yes      | -       | Album name (max 100 characters)               |
| description | string | No       | null    | Album description                             |
| privacy     | string | No       | PRIVATE | Privacy setting: PRIVATE, UNLISTED, or PUBLIC |
| defaultTier | string | No       | TIER_1K | Default enhancement tier for uploaded images  |

**Response (Success - 201)**:

```json
{
  "album": {
    "id": "album_abc123",
    "name": "Family Photos 2025",
    "description": "Summer vacation photos",
    "privacy": "PRIVATE",
    "shareToken": null,
    "createdAt": "2025-12-02T10:00:00Z"
  }
}
```

**Error Responses**:

| Status | Error                   | Description                   |
| ------ | ----------------------- | ----------------------------- |
| 400    | Album name is required  | Missing name field            |
| 400    | Album name too long     | Name exceeds 100 characters   |
| 400    | Invalid privacy setting | Privacy not in allowed values |
| 400    | Invalid default tier    | Tier not recognized           |
| 401    | Unauthorized            | Not authenticated             |

---

### List Albums

Get all albums for the authenticated user.

**Endpoint**: `GET /api/albums`

**Authentication**: Required (Session)

**Response (Success - 200)**:

```json
{
  "albums": [
    {
      "id": "album_abc123",
      "name": "Family Photos 2025",
      "description": "Summer vacation photos",
      "privacy": "PRIVATE",
      "coverImageId": null,
      "imageCount": 5,
      "previewImages": [
        {
          "id": "img_001",
          "url": "https://...",
          "name": "photo1.jpg"
        }
      ],
      "createdAt": "2025-12-02T10:00:00Z",
      "updatedAt": "2025-12-02T10:00:00Z"
    }
  ]
}
```

---

### Get Album Details

Retrieve album information and images.

**Endpoint**: `GET /api/albums/{albumId}`

**Authentication**: Required (Session)

**Response**: See Album structure above with full image list.

---

### Update Album

Update album name, description, or privacy settings.

**Endpoint**: `PATCH /api/albums/{albumId}`

**Authentication**: Required (Session)

**Content-Type**: `application/json`

**Request**:

```json
{
  "name": "Updated Album Name",
  "privacy": "PUBLIC"
}
```

---

### Delete Album

Permanently delete an album (images are not deleted).

**Endpoint**: `DELETE /api/albums/{albumId}`

**Authentication**: Required (Session)

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Album deleted"
}
```

---

## Enhancement Jobs

### Get Job Status

Check the status of an enhancement job.

**Endpoint**: `GET /api/jobs/{jobId}`

**Authentication**: Required (Session) or None (for anonymous jobs, rate-limited
by IP)

**Path Parameters**:

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| jobId     | string | Enhancement job ID |

**Request**:

```http
GET /api/jobs/job_enhancement_abc123 HTTP/1.1
```

**Response (Success - 200)**:

```json
{
  "id": "job_enhancement_abc123",
  "status": "COMPLETED",
  "tier": "TIER_2K",
  "tokensCost": 5,
  "enhancedUrl": "https://r2-bucket.example.com/enhanced/user123/image-id-2k.jpg",
  "enhancedWidth": 2048,
  "enhancedHeight": 1536,
  "errorMessage": null,
  "createdAt": "2025-12-02T10:30:00Z",
  "processingStartedAt": "2025-12-02T10:30:05Z",
  "processingCompletedAt": "2025-12-02T10:35:00Z",
  "isAnonymous": false,
  "image": {
    "id": "clya1b2c3d4e5f6g7h8i9j0k1",
    "name": "my-photo.jpg",
    "originalUrl": "https://...",
    "originalWidth": 1920,
    "originalHeight": 1440
  }
}
```

**Job Status Values**:

| Status     | Description             |
| ---------- | ----------------------- |
| PROCESSING | Enhancement in progress |
| COMPLETED  | Successfully enhanced   |
| FAILED     | Enhancement failed      |
| CANCELLED  | Job cancelled by user   |
| REFUNDED   | Tokens refunded         |

---

### Delete Job

Delete a completed or failed job.

**Endpoint**: `DELETE /api/jobs/{jobId}`

**Authentication**: Required (Session)

**Note**: Only jobs with status COMPLETED, FAILED, CANCELLED, or REFUNDED can be
deleted.

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Job deleted successfully"
}
```

---

### Get Batch Job Status

Check status of multiple jobs at once.

**Endpoint**: `POST /api/jobs/batch-status`

**Authentication**: Required (Session)

**Request**:

```json
{
  "jobIds": ["job_001", "job_002", "job_003"]
}
```

**Response**:

```json
{
  "jobs": [
    {
      "id": "job_001",
      "status": "COMPLETED",
      "enhancedUrl": "https://..."
    }
  ]
}
```

---

## Token Management

### Get Token Balance

Retrieve current token balance and statistics.

**Endpoint**: `GET /api/tokens/balance`

**Authentication**: Required (Session)

**Request**:

```http
GET /api/tokens/balance HTTP/1.1
```

**Response (Success - 200)**:

```json
{
  "balance": 95,
  "lastRegeneration": "2025-12-02T10:30:00Z",
  "timeUntilNextRegenMs": 854000,
  "tokensAddedThisRequest": 1,
  "tier": "FREE",
  "maxBalance": 100,
  "stats": {
    "totalSpent": 50,
    "totalEarned": 145,
    "totalRefunded": 5,
    "transactionCount": 12
  }
}
```

**Response Fields**:

| Field                  | Type   | Description                                     |
| ---------------------- | ------ | ----------------------------------------------- |
| balance                | number | Current token balance                           |
| lastRegeneration       | string | Timestamp of last regeneration (ISO 8601)       |
| timeUntilNextRegenMs   | number | Milliseconds until next +1 token                |
| tokensAddedThisRequest | number | Tokens added during this request (regeneration) |
| tier                   | string | User's current tier                             |
| maxBalance             | number | Maximum tokens for current tier                 |
| stats                  | object | Lifetime statistics                             |

**cURL Example**:

```bash
curl http://localhost:3000/api/tokens/balance \
  -H "Cookie: next-auth.session-token=..."
```

**JavaScript Example**:

```javascript
const response = await fetch("/api/tokens/balance");
const data = await response.json();

console.log(`Balance: ${data.balance} tokens`);
console.log(
  `Next regeneration in: ${Math.ceil(data.timeUntilNextRegenMs / 1000)}s`,
);
```

---

## Tier Management

### Get Tiers

Retrieve all available tiers and user's current tier.

**Endpoint**: `GET /api/tiers`

**Authentication**: Required (Session)

**Response (Success - 200)**:

```json
{
  "tiers": [
    {
      "tier": "FREE",
      "name": "Free",
      "maxBalance": 100,
      "regenRate": 3600000,
      "regenAmount": 1,
      "isCurrent": true
    },
    {
      "tier": "STARTER",
      "name": "Starter",
      "maxBalance": 500,
      "regenRate": 1800000,
      "regenAmount": 2,
      "isCurrent": false
    }
  ],
  "currentTier": "FREE",
  "canUpgrade": true,
  "nextTier": {
    "tier": "STARTER",
    "name": "Starter",
    "maxBalance": 500
  }
}
```

---

### Upgrade Tier

Upgrade to a higher tier (requires payment).

**Endpoint**: `POST /api/tiers/upgrade`

**Authentication**: Required (Session)

**Request**:

```json
{
  "targetTier": "STARTER"
}
```

---

### Downgrade Tier

Downgrade to a lower tier.

**Endpoint**: `POST /api/tiers/downgrade`

**Authentication**: Required (Session)

**Request**:

```json
{
  "targetTier": "FREE"
}
```

---

## Voucher Management

### Validate Voucher

Check if a voucher code is valid and available.

**Endpoint**: `POST /api/vouchers/validate`

**Authentication**: Optional

**Content-Type**: `application/json`

**Request**:

```http
POST /api/vouchers/validate HTTP/1.1
Content-Type: application/json

{
  "code": "LAUNCH100"
}
```

**Response (Success - 200)**:

```json
{
  "valid": true,
  "voucher": {
    "code": "LAUNCH100",
    "type": "FIXED_TOKENS",
    "value": 100,
    "status": "ACTIVE",
    "maxUses": 1000,
    "currentUses": 247,
    "available": true,
    "expiresAt": null
  }
}
```

**Response (Invalid - 400)**:

```json
{
  "valid": false,
  "error": "Voucher not found"
}
```

**Error Responses**:

| Status | Error                    | Description            |
| ------ | ------------------------ | ---------------------- |
| 400    | Voucher code is required | Missing code field     |
| 400    | Voucher not found        | Code doesn't exist     |
| 400    | Voucher is inactive      | Status is INACTIVE     |
| 400    | Voucher is expired       | Expiration date passed |
| 400    | Voucher is depleted      | Max uses reached       |

---

### Redeem Voucher

Redeem a voucher code to receive tokens.

**Endpoint**: `POST /api/vouchers/redeem`

**Authentication**: Required (Session)

**Content-Type**: `application/json`

**Rate Limit**: 5 redemption attempts per hour per user

**Request**:

```http
POST /api/vouchers/redeem HTTP/1.1
Content-Type: application/json

{
  "code": "LAUNCH100"
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "tokensGranted": 100,
  "newBalance": 245
}
```

**JavaScript Example**:

```javascript
const response = await fetch("/api/vouchers/redeem", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: "LAUNCH100" }),
});

const result = await response.json();
if (result.success) {
  console.log(`Redeemed! +${result.tokensGranted} tokens`);
  console.log(`New balance: ${result.newBalance}`);
}
```

**Error Responses**:

| Status | Error                        | Description                           |
| ------ | ---------------------------- | ------------------------------------- |
| 400    | Voucher code is required     | Missing code field                    |
| 400    | Invalid voucher code format  | Invalid format (must be alphanumeric) |
| 400    | You have already redeemed    | User already redeemed this code       |
| 401    | Authentication required      | Not logged in                         |
| 429    | Too many redemption attempts | Rate limit exceeded                   |

---

## Referral Program

### Get Referral Link

Generate a unique referral link for sharing.

**Endpoint**: `GET /api/referral/link`

**Authentication**: Required (Session)

**Response (Success - 200)**:

```json
{
  "success": true,
  "referralLink": "https://spike.land?ref=abc123xyz",
  "referralCode": "abc123xyz",
  "baseTokenReward": 50
}
```

---

### Get Referral Statistics

View referral performance and earnings.

**Endpoint**: `GET /api/referral/stats`

**Authentication**: Required (Session)

**Response (Success - 200)**:

```json
{
  "success": true,
  "stats": {
    "totalReferrals": 5,
    "completedReferrals": 4,
    "pendingReferrals": 1,
    "totalTokensEarned": 200,
    "referrals": [
      {
        "userId": "user_456",
        "email": "friend@example.com",
        "status": "COMPLETED",
        "tokensReward": 50,
        "referredAt": "2025-12-01T10:00:00Z"
      }
    ]
  }
}
```

---

## MCP API (Model Context Protocol)

The MCP API provides programmatic access to image generation and modification
via API keys.

### Authentication

All MCP endpoints require an API key in the Authorization header:

```http
Authorization: Bearer sk_live_xxxxxxxxxxxxx
```

### Generate Image

Generate a new image from a text prompt.

**Endpoint**: `POST /api/mcp/generate`

**Authentication**: API Key (Bearer token)

**Rate Limit**: 10 requests per minute

**Request**:

```json
{
  "prompt": "A serene mountain landscape at sunset",
  "tier": "TIER_2K",
  "negativePrompt": "blurry, low quality",
  "aspectRatio": "16:9"
}
```

**Request Body**:

| Field          | Type   | Required | Description                            |
| -------------- | ------ | -------- | -------------------------------------- |
| prompt         | string | Yes      | Text description (max 4000 characters) |
| tier           | string | Yes      | Output tier: TIER_1K, TIER_2K, TIER_4K |
| negativePrompt | string | No       | Things to avoid in the generation      |
| aspectRatio    | string | No       | Aspect ratio (default: "1:1")          |

**Supported Aspect Ratios**: 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9

**Token Costs**:

| Tier    | Cost | Resolution |
| ------- | ---- | ---------- |
| TIER_1K | 2    | 1024px     |
| TIER_2K | 5    | 2048px     |
| TIER_4K | 10   | 4096px     |

**Response (Success - 200)**:

```json
{
  "success": true,
  "jobId": "job_gen_abc123",
  "tokensCost": 5,
  "message": "Generation started. Poll /api/jobs/{jobId} for status."
}
```

**cURL Example**:

```bash
curl -X POST https://spike.land/api/mcp/generate \
  -H "Authorization: Bearer sk_live_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A serene mountain landscape at sunset",
    "tier": "TIER_2K",
    "aspectRatio": "16:9"
  }'
```

---

### Modify Image

Modify an existing image with a text prompt.

**Endpoint**: `POST /api/mcp/modify`

**Authentication**: API Key (Bearer token)

**Rate Limit**: 10 requests per minute

**Request**:

```json
{
  "prompt": "Make the sky more dramatic with storm clouds",
  "tier": "TIER_2K",
  "image": "base64_encoded_image_data",
  "mimeType": "image/jpeg"
}
```

**OR**

```json
{
  "prompt": "Make the sky more dramatic with storm clouds",
  "tier": "TIER_2K",
  "imageUrl": "https://example.com/image.jpg"
}
```

**Request Body**:

| Field    | Type   | Required               | Description                                             |
| -------- | ------ | ---------------------- | ------------------------------------------------------- |
| prompt   | string | Yes                    | Modification instructions (max 4000 chars)              |
| tier     | string | Yes                    | Output tier: TIER_1K, TIER_2K, TIER_4K                  |
| image    | string | Conditional (or url)   | Base64 encoded image data                               |
| imageUrl | string | Conditional (or image) | URL of image to fetch and modify                        |
| mimeType | string | If using `image`       | MIME type: image/jpeg, image/png, image/webp, image/gif |

**Image Size Limit**: 20 MB

**Response (Success - 200)**:

```json
{
  "success": true,
  "jobId": "job_mod_abc123",
  "tokensCost": 5,
  "message": "Modification started. Poll /api/jobs/{jobId} for status."
}
```

---

### Get Balance

Get the current token balance for the authenticated API key user.

**Endpoint**: `GET /api/mcp/balance`

**Authentication**: API Key (Bearer token)

**Rate Limit**: 60 requests per minute

**Response (Success - 200)**:

```json
{
  "balance": 485,
  "lastRegeneration": "2025-12-02T10:30:00Z"
}
```

---

### Get Job History

Get recent jobs for the authenticated user.

**Endpoint**: `GET /api/mcp/history`

**Authentication**: API Key (Bearer token)

**Query Parameters**:

| Parameter | Type   | Required | Default | Description              |
| --------- | ------ | -------- | ------- | ------------------------ |
| limit     | number | No       | 20      | Number of jobs to return |
| offset    | number | No       | 0       | Pagination offset        |

**Response**:

```json
{
  "jobs": [
    {
      "id": "job_123",
      "type": "generation",
      "status": "COMPLETED",
      "tier": "TIER_2K",
      "tokensCost": 5,
      "prompt": "A serene mountain landscape",
      "enhancedUrl": "https://...",
      "createdAt": "2025-12-02T10:00:00Z"
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

---

## API Key Management

### List API Keys

Get all API keys for the authenticated user.

**Endpoint**: `GET /api/settings/api-keys`

**Authentication**: Required (Session)

**Response (Success - 200)**:

```json
{
  "apiKeys": [
    {
      "id": "key_abc123",
      "name": "Production API Key",
      "keyPrefix": "sk_live_abcd",
      "lastUsedAt": "2025-12-02T10:30:00Z",
      "isActive": true,
      "createdAt": "2025-12-01T10:00:00Z"
    }
  ]
}
```

---

### Create API Key

Create a new API key.

**Endpoint**: `POST /api/settings/api-keys`

**Authentication**: Required (Session)

**Request**:

```json
{
  "name": "Production API Key"
}
```

**Response (Success - 200)**:

```json
{
  "apiKey": {
    "id": "key_abc123",
    "name": "Production API Key",
    "key": "sk_live_xxxxxxxxxxxxxxxxxxxxxx",
    "keyPrefix": "sk_live_abcd",
    "createdAt": "2025-12-02T10:00:00Z"
  },
  "message": "API key created successfully. Make sure to copy the key now - it will not be shown again."
}
```

**Limits**: Maximum 10 active API keys per user

---

### Revoke API Key

Revoke an API key.

**Endpoint**: `DELETE /api/settings/api-keys/{keyId}`

**Authentication**: Required (Session)

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

## Payment Processing

### Create Checkout Session (One-Time Purchase)

Create a Stripe checkout session to purchase tokens.

**Endpoint**: `POST /api/stripe/checkout`

**Authentication**: Required (Session)

**Content-Type**: `application/json`

**Request**:

```json
{
  "packageId": "professional_500",
  "mode": "payment"
}
```

**Valid Package IDs**:

| Package ID       | Tokens | Price  |
| ---------------- | ------ | ------ |
| starter_50       | 50     | £2.99  |
| essential_150    | 150    | £7.99  |
| professional_500 | 500    | £19.99 |
| enterprise_2000  | 2000   | £59.99 |

**Response (Success - 200)**:

```json
{
  "success": true,
  "sessionId": "cs_live_123abc...",
  "url": "https://checkout.stripe.com/pay/cs_live_123abc..."
}
```

**JavaScript Example**:

```javascript
const response = await fetch("/api/stripe/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    packageId: "professional_500",
    mode: "payment",
  }),
});

const data = await response.json();
window.location.href = data.url; // Redirect to Stripe checkout
```

---

### Create Checkout Session (Subscription)

Create a Stripe checkout session to subscribe to a token plan.

**Endpoint**: `POST /api/stripe/checkout`

**Authentication**: Required (Session)

**Request**:

```json
{
  "planId": "professional_100",
  "mode": "subscription"
}
```

**Valid Plan IDs**:

| Plan ID          | Tokens/Month | Price/Month |
| ---------------- | ------------ | ----------- |
| starter_20       | 20           | £2.99       |
| professional_100 | 100          | £9.99       |
| enterprise_500   | 500          | £29.99      |

**Response (Success - 200)**:

```json
{
  "success": true,
  "sessionId": "cs_live_sub_123abc...",
  "url": "https://checkout.stripe.com/pay/cs_live_sub_123abc..."
}
```

---

## Admin Dashboard

All admin endpoints require authentication with admin role.

### Get Admin Dashboard

Retrieve comprehensive admin dashboard metrics.

**Endpoint**: `GET /api/admin/dashboard`

**Authentication**: Required (Admin role)

**Response (Success - 200)**:

```json
{
  "users": {
    "total": 1250,
    "newToday": 15,
    "activeToday": 342
  },
  "jobs": {
    "total": 5000,
    "pending": 10,
    "processing": 5,
    "completedToday": 245
  },
  "tokens": {
    "inCirculation": 50000,
    "spentToday": 1250,
    "purchasedToday": 500
  },
  "revenue": {
    "today": 125.50,
    "month": 3847.25
  }
}
```

---

### Get User List

Search and manage user accounts.

**Endpoint**: `GET /api/admin/users`

**Authentication**: Required (Admin role)

**Query Parameters**:

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| search    | string | No       | Search by email or name        |
| role      | string | No       | Filter by user role            |
| limit     | number | No       | Results per page (default: 20) |
| offset    | number | No       | Pagination offset (default: 0) |

**Response (Success - 200)**:

```json
{
  "users": [
    {
      "id": "user_123",
      "email": "test@example.com",
      "name": "Test User",
      "role": "USER",
      "tokenBalance": 95,
      "createdAt": "2025-12-01T10:00:00Z",
      "lastActive": "2025-12-02T15:30:00Z"
    }
  ],
  "pagination": {
    "total": 1250,
    "limit": 20,
    "offset": 0
  }
}
```

---

### Create Voucher

Create a new promotional voucher.

**Endpoint**: `POST /api/admin/vouchers`

**Authentication**: Required (Admin role)

**Request**:

```json
{
  "code": "HOLIDAY50",
  "type": "FIXED_TOKENS",
  "value": 50,
  "maxUses": 1000,
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response (Success - 201)**:

```json
{
  "success": true,
  "voucher": {
    "id": "voucher_abc123",
    "code": "HOLIDAY50",
    "type": "FIXED_TOKENS",
    "value": 50,
    "maxUses": 1000,
    "currentUses": 0,
    "status": "ACTIVE",
    "expiresAt": "2025-12-31T23:59:59Z"
  }
}
```

---

### Get Error Logs

Retrieve error logs for debugging.

**Endpoint**: `GET /api/admin/errors`

**Authentication**: Required (Admin role)

**Query Parameters**:

| Parameter | Type   | Default | Description                |
| --------- | ------ | ------- | -------------------------- |
| limit     | number | 50      | Number of errors to return |
| offset    | number | 0       | Pagination offset          |

**Response**:

```json
{
  "errors": [
    {
      "id": "error_123",
      "type": "TypeError",
      "message": "Cannot read property 'x' of undefined",
      "file": "api/enhance.ts",
      "line": 42,
      "count": 15,
      "lastOccurrence": "2025-12-02T10:30:00Z"
    }
  ],
  "total": 250
}
```

---

## Marketing Dashboard

The Marketing Dashboard allows administrators to connect and manage Facebook Ads
and Google Ads accounts.

### List Connected Accounts

Retrieve all connected marketing accounts.

**Endpoint**: `GET /api/admin/marketing/accounts`

**Authentication**: Required (Admin role)

**Response (Success - 200)**:

```json
{
  "accounts": [
    {
      "id": "clm123abc",
      "platform": "FACEBOOK",
      "accountId": "act_123456789",
      "accountName": "My Business Ad Account",
      "isActive": true,
      "tokenStatus": "valid",
      "createdAt": "2025-12-01T10:00:00Z",
      "updatedAt": "2025-12-02T15:30:00Z",
      "expiresAt": "2026-02-01T10:00:00Z"
    }
  ]
}
```

---

### Disconnect Account

Remove a connected marketing account.

**Endpoint**: `DELETE /api/admin/marketing/accounts`

**Authentication**: Required (Admin role)

**Request**:

```json
{
  "accountId": "clm123abc"
}
```

**Response (Success - 200)**:

```json
{
  "success": true
}
```

---

### Get Marketing Campaigns

Retrieve campaigns from all connected accounts.

**Endpoint**: `GET /api/admin/marketing/campaigns`

**Authentication**: Required (Admin role)

**Query Parameters**:

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| platform  | string | No       | Filter: FACEBOOK or GOOGLE_ADS |
| accountId | string | No       | Filter by specific account ID  |

**Response (Success - 200)**:

```json
{
  "campaigns": [
    {
      "id": "campaign_123",
      "name": "Pixel Launch Campaign",
      "status": "ACTIVE",
      "platform": "FACEBOOK",
      "accountId": "act_123456789",
      "budget": 1000,
      "spent": 450.50,
      "impressions": 125000,
      "clicks": 3200,
      "conversions": 85
    }
  ],
  "errors": []
}
```

---

## System Reports

### Get System Report

Generate a comprehensive system report with analytics from all sources.

**Endpoint**: `GET /api/reports/system`

**Authentication**: Required (Admin role, via session or API key)

**Query Parameters**:

| Parameter | Type   | Required | Default | Options                                                                    |
| --------- | ------ | -------- | ------- | -------------------------------------------------------------------------- |
| period    | string | No       | 30d     | 7d, 30d, 90d                                                               |
| include   | string | No       | all     | Comma-separated: platform,users,tokens,health,marketing,errors,vercel,meta |
| format    | string | No       | json    | json, summary                                                              |

**Request**:

```http
GET /api/reports/system?period=7d&include=platform,users,errors HTTP/1.1
Authorization: Bearer sk_live_xxxxx
```

**Response (Success - 200)**:

```json
{
  "generatedAt": "2025-12-21T10:30:00.000Z",
  "period": {
    "start": "2025-12-14T10:30:00.000Z",
    "end": "2025-12-21T10:30:00.000Z"
  },
  "platform": {
    "totalUsers": 1000,
    "adminCount": 5,
    "totalEnhancements": 5000,
    "jobStatus": {
      "pending": 10,
      "processing": 5,
      "completed": 4900,
      "failed": 85,
      "active": 15
    },
    "tokensInCirculation": 50000,
    "tokensSpent": 25000,
    "activeVouchers": 3
  },
  "users": {
    "totalUsers": 1000,
    "newUsersLast7Days": 50,
    "newUsersLast30Days": 200,
    "activeUsersLast7Days": 300,
    "activeUsersLast30Days": 600,
    "authProviderBreakdown": [
      { "provider": "google", "count": 600 },
      { "provider": "github", "count": 300 }
    ]
  },
  "errors": {
    "last24Hours": 25,
    "topErrorTypes": { "TypeError": 10, "NetworkError": 8 },
    "topErrorFiles": { "api/enhance.ts": 15 }
  },
  "external": {
    "vercelAnalytics": {
      "pageViews": 10000,
      "uniqueVisitors": 5000,
      "topPages": [
        { "path": "/", "views": 5000 }
      ],
      "countries": [
        { "country": "US", "visitors": 2000 }
      ],
      "devices": { "desktop": 3000, "mobile": 1800, "tablet": 200 }
    },
    "metaAds": {
      "campaigns": [],
      "totalSpend": 1000,
      "totalImpressions": 50000,
      "totalClicks": 1000,
      "totalConversions": 50,
      "ctr": 2.0,
      "cpc": 1.0
    }
  }
}
```

**Cache**: Reports are cached for 5 minutes (Cache-Control: private,
max-age=300)

---

## Error Handling

### Standard Error Format

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "title": "Error Title",
  "suggestion": "How to fix the error"
}
```

### HTTP Status Codes

| Code | Meaning                | Common Cause                           |
| ---- | ---------------------- | -------------------------------------- |
| 200  | Success                | Request completed successfully         |
| 201  | Created                | Resource created successfully          |
| 400  | Bad Request            | Invalid parameters or validation error |
| 401  | Unauthorized           | Missing or invalid authentication      |
| 402  | Payment Required       | Insufficient tokens                    |
| 403  | Forbidden              | Not authorized for this resource       |
| 404  | Not Found              | Resource doesn't exist                 |
| 413  | Payload Too Large      | File or request too large              |
| 415  | Unsupported Media Type | Invalid content type                   |
| 429  | Too Many Requests      | Rate limit exceeded                    |
| 500  | Server Error           | Internal server error                  |

### Request ID Tracking

All responses include a unique request ID in the `X-Request-ID` header for
debugging:

```http
X-Request-ID: req_abc123xyz
```

### Retry Strategy

**Idempotent Requests** (safe to retry):

- GET requests
- DELETE requests (returns 404 if already deleted)

**Non-Idempotent Requests** (use idempotency keys):

- POST /api/images/enhance (can retry safely, tokens refunded on duplicate)
- POST /api/vouchers/redeem (safe, blocked by unique constraint)

**Exponential Backoff Pattern**:

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delayMs = 1000 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
```

---

## Rate Limiting

### Rate Limit Configuration

| Resource            | Limit        | Window   |
| ------------------- | ------------ | -------- |
| Image Upload        | 20 files     | 1 hour   |
| Anonymous Upload    | 5 files      | 1 hour   |
| Anonymous Enhance   | 3 requests   | 1 hour   |
| Image Enhancement   | 10 requests  | 1 minute |
| Token Balance Check | 100 requests | 1 hour   |
| Voucher Validation  | 50 requests  | 1 hour   |
| Voucher Redemption  | 5 attempts   | 1 hour   |
| MCP Generate        | 10 requests  | 1 minute |
| MCP Modify          | 10 requests  | 1 minute |
| MCP Balance Check   | 60 requests  | 1 minute |
| General API         | 100 requests | 1 minute |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1701516600
```

**Header Meanings**:

- `X-RateLimit-Limit`: Max requests in window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

### 429 Response

When limit exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1701516630
```

### Client Implementation

```javascript
async function fetchWithRateLimit(url, options = {}) {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = parseInt(
      response.headers.get("Retry-After") || "30",
    );
    console.log(`Rate limited. Retry after ${retryAfter}s`);

    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

    return fetchWithRateLimit(url, options); // Retry
  }

  return response;
}
```

---

## Platform API (Social & Analytics)

### Get Pulse Metrics

**Endpoint**: `GET /api/orbit/pulse`

**Authentication**: Required (Session)

**Query Parameters**:

| Parameter   | Type   | Required | Default | Description                  |
| ----------- | ------ | -------- | ------- | ---------------------------- |
| workspaceId | string | Yes      | -       | Workspace to get metrics for |
| period      | string | No       | 7d      | Time period: 7d, 30d, 90d    |

**Response (Success - 200)**:

```json
{
  "healthScore": 78,
  "metrics": {
    "followers": { "current": 12500, "change": 350, "changePercent": 2.8 },
    "engagement": { "rate": 4.2, "change": 0.3 },
    "reach": { "current": 45000, "change": 5000 },
    "responseTime": { "average": "2h 15m" }
  },
  "anomalies": []
}
```

---

### Get Unified Inbox

**Endpoint**: `GET /api/orbit/inbox`

**Authentication**: Required (Session)

**Query Parameters**:

| Parameter   | Type   | Required | Default | Description               |
| ----------- | ------ | -------- | ------- | ------------------------- |
| workspaceId | string | Yes      | -       | Workspace ID              |
| platform    | string | No       | all     | Filter by platform        |
| priority    | string | No       | all     | high, medium, low         |
| status      | string | No       | unread  | unread, replied, archived |
| limit       | number | No       | 20      | Results per page          |
| offset      | number | No       | 0       | Pagination offset         |

**Response (Success - 200)**:

```json
{
  "messages": [
    {
      "id": "msg_123",
      "platform": "instagram",
      "type": "comment",
      "content": "Love this product!",
      "priority": 25,
      "sentiment": "positive",
      "authorName": "user123",
      "createdAt": "2026-02-15T10:00:00Z"
    }
  ],
  "total": 150,
  "unreadCount": 42
}
```

---

### Get Allocator Recommendations

**Endpoint**: `GET /api/orbit/allocator`

**Authentication**: Required (Session)

**Query Parameters**:

| Parameter   | Type   | Required | Description  |
| ----------- | ------ | -------- | ------------ |
| workspaceId | string | Yes      | Workspace ID |

**Response (Success - 200)**:

```json
{
  "recommendations": [
    {
      "action": "increase",
      "platform": "instagram",
      "currentBudget": 500,
      "suggestedBudget": 575,
      "predictedRoas": 3.2,
      "confidence": 0.85,
      "reason": "Instagram engagement up 22% with 15% budget increase predicted"
    }
  ],
  "totalBudget": 2000
}
```

---

### Analyze Brand Voice

**Endpoint**: `POST /api/orbit/brand-brain/analyze`

**Authentication**: Required (Session)

**Request**:

```json
{
  "workspaceId": "ws_123",
  "content": "Check out our new summer collection! Fresh vibes only.",
  "type": "social_post"
}
```

**Response (Success - 200)**:

```json
{
  "brandScore": 82,
  "tone": { "casual": 0.7, "enthusiastic": 0.8, "professional": 0.3 },
  "suggestions": [
    {
      "original": "Fresh vibes only",
      "suggestion": "Summer essentials, curated for you",
      "reason": "More aligned with brand voice"
    }
  ]
}
```

---

### Generate AI Draft (Relay)

**Endpoint**: `POST /api/orbit/relay/generate`

**Authentication**: Required (Session)

**Request**:

```json
{
  "workspaceId": "ws_123",
  "topic": "Summer collection launch",
  "platform": "instagram",
  "tone": "enthusiastic",
  "variations": 3
}
```

**Response (Success - 200)**:

```json
{
  "drafts": [
    {
      "id": "draft_1",
      "content": "Summer is here and so is our new collection...",
      "brandScore": 88,
      "creditsCost": 2
    }
  ],
  "totalCredits": 10
}
```

---

### Get Scout Competitors

**Endpoint**: `GET /api/orbit/scout/competitors`

**Authentication**: Required (Session)

**Query Parameters**:

| Parameter   | Type   | Required | Description  |
| ----------- | ------ | -------- | ------------ |
| workspaceId | string | Yes      | Workspace ID |

**Response (Success - 200)**:

```json
{
  "competitors": [
    {
      "handle": "@competitor",
      "platform": "instagram",
      "followers": 50000,
      "engagementRate": 5.8,
      "postingFrequency": "3x/day",
      "topContentType": "video"
    }
  ]
}
```

---

## Chess API

### Create Game

**Endpoint**: `POST /api/tabletop/chess/games`

**Authentication**: Required (Session)

**Request**:

```json
{
  "playerId": "player_123",
  "timeControl": "blitz",
  "timeMinutes": 5,
  "incrementSeconds": 3
}
```

**Response (Success - 201)**:

```json
{
  "gameId": "game_abc",
  "status": "waiting",
  "whitePlayerId": "player_123",
  "timeControl": { "type": "blitz", "minutes": 5, "increment": 3 }
}
```

---

### Make Move

**Endpoint**: `POST /api/tabletop/chess/games/{gameId}/move`

**Authentication**: Required (Session)

**Request**:

```json
{
  "playerId": "player_123",
  "from": "e2",
  "to": "e4"
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "moveNumber": 1,
  "isCheck": false,
  "isCheckmate": false,
  "isStalemate": false
}
```

---

### Get Player Stats

**Endpoint**: `GET /api/tabletop/chess/players/{playerId}/stats`

**Authentication**: Required (Session)

**Response (Success - 200)**:

```json
{
  "playerId": "player_123",
  "name": "ChessMaster",
  "elo": 1450,
  "gamesPlayed": 42,
  "wins": 25,
  "losses": 12,
  "draws": 5,
  "winStreak": 3,
  "bestElo": 1520
}
```

---

### Get Leaderboard

**Endpoint**: `GET /api/tabletop/chess/leaderboard`

**Authentication**: Required (Session)

**Query Parameters**:

| Parameter | Type   | Required | Default | Description       |
| --------- | ------ | -------- | ------- | ----------------- |
| limit     | number | No       | 20      | Number of players |

**Response (Success - 200)**:

```json
{
  "players": [
    {
      "rank": 1,
      "name": "GrandMaster42",
      "elo": 1850,
      "gamesPlayed": 120,
      "winRate": 0.72
    }
  ]
}
```

---

## Store API

### List Store Apps

**Endpoint**: `GET /api/store`

**Authentication**: None (public)

**Query Parameters**:

| Parameter | Type    | Required | Default | Description        |
| --------- | ------- | -------- | ------- | ------------------ |
| category  | string  | No       | all     | Filter by category |
| featured  | boolean | No       | false   | Only featured apps |

**Response (Success - 200)**:

```json
{
  "apps": [
    {
      "id": "image-studio",
      "slug": "image-studio",
      "name": "Image Studio",
      "tagline": "AI-powered image creation & batch processing",
      "category": "creative",
      "toolCount": 15,
      "isFeatured": true
    }
  ],
  "total": 23,
  "categories": [
    "creative",
    "productivity",
    "developer",
    "communication",
    "lifestyle",
    "ai-agents"
  ]
}
```

---

### Get App Details

**Endpoint**: `GET /api/store/{slug}`

**Authentication**: None (public)

**Response (Success - 200)**:

```json
{
  "app": {
    "id": "chess-arena",
    "slug": "chess-arena",
    "name": "Chess Arena",
    "tagline": "Multiplayer chess with ELO ratings & game replay",
    "description": "...",
    "longDescription": "...",
    "category": "communication",
    "toolCount": 21,
    "mcpTools": [],
    "features": []
  }
}
```

---

### Get Store Stats

**Endpoint**: `GET /api/store/stats`

**Authentication**: None (public)

**Response (Success - 200)**:

```json
{
  "appCount": 23,
  "toolCount": 163,
  "categories": 6
}
```

---

## State Machine API

### Create State Machine

**Endpoint**: `POST /api/state-machine`

**Authentication**: Required (Session)

**Request**:

```json
{
  "name": "Order Processing",
  "initialState": "pending",
  "states": {
    "pending": { "on": { "APPROVE": "approved", "REJECT": "rejected" } },
    "approved": { "on": { "SHIP": "shipped" } },
    "shipped": { "on": { "DELIVER": "delivered" } },
    "rejected": { "type": "final" },
    "delivered": { "type": "final" }
  }
}
```

**Response (Success - 201)**:

```json
{
  "id": "sm_abc123",
  "name": "Order Processing",
  "currentState": "pending",
  "createdAt": "2026-02-16T10:00:00Z"
}
```

---

### Send Event

**Endpoint**: `POST /api/state-machine/{id}/event`

**Authentication**: Required (Session)

**Request**:

```json
{
  "event": "APPROVE",
  "context": { "approvedBy": "user_123" }
}
```

**Response (Success - 200)**:

```json
{
  "previousState": "pending",
  "currentState": "approved",
  "event": "APPROVE",
  "transitionedAt": "2026-02-16T10:05:00Z"
}
```

---

### Get State History

**Endpoint**: `GET /api/state-machine/{id}/history`

**Authentication**: Required (Session)

**Response (Success - 200)**:

```json
{
  "machineId": "sm_abc123",
  "currentState": "approved",
  "history": [
    {
      "from": "pending",
      "to": "approved",
      "event": "APPROVE",
      "timestamp": "2026-02-16T10:05:00Z"
    }
  ]
}
```

---

## Implementation Examples

### Complete Enhancement Workflow

```javascript
async function enhanceImage(imageId, tier = "TIER_2K") {
  try {
    // 1. Check token balance first
    const balanceRes = await fetch("/api/tokens/balance");
    const balance = await balanceRes.json();

    const tierCosts = { FREE: 0, TIER_1K: 2, TIER_2K: 5, TIER_4K: 10 };
    const cost = tierCosts[tier];

    if (balance.balance < cost) {
      console.error(
        `Insufficient tokens. Need ${cost}, have ${balance.balance}`,
      );
      return null;
    }

    // 2. Request enhancement
    const enhanceRes = await fetch("/api/images/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId, tier }),
    });

    if (!enhanceRes.ok) {
      const error = await enhanceRes.json();
      throw new Error(error.error);
    }

    const job = await enhanceRes.json();
    console.log(`Enhancement started: ${job.jobId}`);

    // 3. Poll for completion
    let completed = false;
    let attempts = 0;

    while (!completed && attempts < 60) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusRes = await fetch(`/api/jobs/${job.jobId}`);
      const status = await statusRes.json();

      if (status.status === "COMPLETED") {
        console.log(`Enhancement complete: ${status.enhancedUrl}`);
        completed = true;
        return status;
      }

      if (status.status === "FAILED") {
        throw new Error("Enhancement failed");
      }

      attempts++;
    }

    throw new Error("Enhancement timeout");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return null;
  }
}
```

### MCP API Example

```javascript
const apiKey = "sk_live_xxxxxxxxxxxxx";

async function generateImage(prompt) {
  const response = await fetch("https://spike.land/api/mcp/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      tier: "TIER_2K",
      aspectRatio: "16:9",
    }),
  });

  const result = await response.json();
  console.log(`Job ID: ${result.jobId}`);

  // Poll for completion
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusRes = await fetch(
      `https://spike.land/api/jobs/${result.jobId}`,
      {
        headers: { "Authorization": `Bearer ${apiKey}` },
      },
    );

    const job = await statusRes.json();

    if (job.status === "COMPLETED") {
      console.log(`Image URL: ${job.enhancedUrl}`);
      return job.enhancedUrl;
    }

    if (job.status === "FAILED") {
      throw new Error("Generation failed");
    }
  }
}
```

---

## TikTok Social Integration

> **Added**: February 2026

Four API routes for TikTok OAuth and data fetching, used by the Orbit social
media management platform.

### Connect TikTok Account

**Endpoint**: `GET /api/social/tiktok/connect`

**Authentication**: Required (Session + Workspace Permission)

**Query Parameters**:

| Parameter     | Type   | Required | Description                      |
| ------------- | ------ | -------- | -------------------------------- |
| workspaceId   | string | Yes      | Workspace to connect account to  |
| workspaceSlug | string | No       | Workspace slug for redirect URLs |

Initiates TikTok OAuth 2.0 flow. Redirects the user to TikTok's authorization
page. On completion, TikTok redirects back to the callback endpoint.

### TikTok OAuth Callback

**Endpoint**: `GET /api/social/tiktok/callback`

**Authentication**: Required (Session)

Handles the OAuth callback from TikTok. Exchanges the authorization code for
access and refresh tokens, encrypts them via `safeEncryptToken()`, and stores
the connected account in the database as a `SocialAccount` record.

### Get TikTok Metrics

**Endpoint**: `GET /api/social/tiktok/metrics`

**Authentication**: Required (Session)

**Query Parameters**:

| Parameter | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| accountId | string | Yes      | The SocialAccount ID |

Returns TikTok account metrics including follower count, engagement rates, and
post statistics.

### List TikTok Posts

**Endpoint**: `GET /api/social/tiktok/posts`

**Authentication**: Required (Session)

**Query Parameters**:

| Parameter | Type   | Required | Default | Description                         |
| --------- | ------ | -------- | ------- | ----------------------------------- |
| accountId | string | Yes      | -       | The SocialAccount ID                |
| limit     | number | No       | 20      | Number of videos to fetch (max 100) |

Returns a list of the user's recent TikTok videos.

---

## Cron Authentication

> **Added**: February 2026

Cron endpoints (e.g., `/api/cron/cleanup-jobs`, `/api/cron/sync-box-status`) are
protected by the `validateCronSecret()` function from `src/lib/cron-auth.ts`.

### Authentication Methods

The function accepts two header formats:

1. `Authorization: Bearer <CRON_SECRET>`
2. `x-cron-secret: <CRON_SECRET>`

### Security

- Uses `crypto.timingSafeEqual` to prevent timing-based side-channel attacks
  (OWASP A2 - Cryptographic Failures)
- In development mode, if `CRON_SECRET` is not set, access is allowed with a
  console warning
- In production, the `CRON_SECRET` environment variable must be set and match

### Environment Variables

| Variable      | Required   | Description                                    |
| ------------- | ---------- | ---------------------------------------------- |
| `CRON_SECRET` | Production | Shared secret for authenticating cron requests |

---

## Additional Notes

### Security Features

- **CSRF Protection**: All state-changing operations require valid session
- **Rate Limiting**: IP-based for anonymous, user-based for authenticated
- **Filename Validation**: Path traversal and hidden file protection
- **Input Sanitization**: All user inputs are validated and sanitized
- **CSS XSS Protection**: CSS content is sanitized to prevent injection attacks
- **API Key Encryption**: API keys are hashed before storage
- **Timing-Safe Cron Auth**: Cron endpoints use `crypto.timingSafeEqual` via
  `validateCronSecret()`

### Performance Characteristics

- **Image Processing**: 15-60 seconds depending on tier
- **Token Regeneration**: Every 15-60 minutes depending on tier
- **Job Retention**: 30 days for completed jobs
- **R2 Storage**: Multi-region replication for reliability

### Environment Variables

Required environment variables for full functionality:

```bash
# Database
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_URL=https://spike.land
NEXTAUTH_SECRET=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# R2 Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Facebook Ads (optional)
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...

# Google Ads (optional)
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_DEVELOPER_TOKEN=...

# Vercel Analytics (optional)
VERCEL_ACCESS_TOKEN=...
VERCEL_TEAM_ID=...
```
