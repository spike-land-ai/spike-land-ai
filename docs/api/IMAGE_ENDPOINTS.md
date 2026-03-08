# Image Enhancement API Endpoints

Complete REST API documentation for image management and AI-powered enhancement
operations in Spike Land.

Last Updated: December 2025 Status: Production Ready

---

## Table of Contents

1. [Authentication](#authentication)
2. [Token System](#token-system)
3. [Image Upload](#image-upload)
4. [Image Enhancement](#image-enhancement)
5. [Image Generation (MCP)](#image-generation-mcp)
6. [Album Management](#album-management)
7. [Image Retrieval](#image-retrieval)
8. [Anonymous Access](#anonymous-access)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)

---

## Authentication

Most endpoints require authentication via NextAuth.js session cookie or Bearer
token. Anonymous endpoints are available for public access.

### Session Cookie (Default)

```
Cookie: next-auth.session-token={token}
```

### Bearer Token (MCP API)

```
Authorization: Bearer {api_key}
```

### Anonymous Access

The following endpoints do NOT require authentication:

- `/api/images/anonymous-upload` - Upload images without account
- `/api/images/anonymous-enhance` - Enhance images without account (FREE tier
  only)

---

## Token System

Image enhancements consume tokens from the user's balance. Token costs are
consistent across all enhancement operations.

### Enhancement Tiers & Costs

| Tier    | Tokens | Resolution | Use Case                  |
| ------- | ------ | ---------- | ------------------------- |
| FREE    | 0      | 1024px     | Anonymous access, preview |
| TIER_1K | 2      | 1024px     | Quick enhancement         |
| TIER_2K | 5      | 2048px     | High quality enhancement  |
| TIER_4K | 10     | 4096px     | Ultra high quality        |

### Token Generation & Limits

- **Regeneration Rate**: 1 token per 15 minutes
- **Maximum Balance**: 100 tokens
- **Initial Balance**: New users start with tokens (see
  [TOKEN_SYSTEM.md](../TOKEN_SYSTEM.md))

### Token Operations

Operations fail with **402 Payment Required** if insufficient tokens.

**Auto-refund scenarios:**

- Upload processing failure
- Job creation failure
- Workflow start failure
- All images fail in batch upload

---

## Image Upload

### Upload Single Image

Upload and automatically enhance an image in one operation.

```http
POST /api/images/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

file=@photo.jpg
albumId=album_123abc (optional)
```

**Parameters:**

- `file` (required): Image file (max 10MB)
- `albumId` (optional): Album to add image to

**Upload Behavior:**

1. Tokens consumed upfront (prepay model)
2. Image uploaded to R2 storage
3. Database record created
4. Enhancement job automatically created at album's default tier
5. Enhancement workflow started in background
6. If any step fails, tokens are refunded

**Success Response (200)**

```json
{
  "success": true,
  "image": {
    "id": "img_123abc",
    "name": "photo.jpg",
    "url": "https://cdn.spike.land/images/img_123abc.jpg",
    "width": 1920,
    "height": 1080,
    "size": 524288,
    "format": "JPEG"
  },
  "enhancement": {
    "jobId": "job_123abc",
    "tier": "TIER_2K",
    "tokenCost": 5,
    "newBalance": 95
  }
}
```

**Error Response (400)**

```json
{
  "error": "File exceeds maximum size of 10MB",
  "title": "Invalid File",
  "suggestion": "Please upload a file smaller than 10MB"
}
```

**Error Response (402)**

```json
{
  "error": "You need 5 tokens to upload and enhance this image. You have 3 tokens.",
  "title": "Payment Required",
  "suggestion": "You need 5 tokens to upload and enhance this image. You have 3 tokens.",
  "required": 5,
  "balance": 3
}
```

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/images/upload \
  -H "Cookie: next-auth.session-token={token}" \
  -F "file=@photo.jpg"
```

**JavaScript Example**

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("albumId", "album_123abc"); // optional

const response = await fetch("/api/images/upload", {
  method: "POST",
  body: formData,
});

const result = await response.json();
console.log(`Image: ${result.image.id}, Job: ${result.enhancement.jobId}`);
```

### Upload Multiple Images (Batch)

Upload multiple images with transactional guarantees.

```http
POST /api/images/batch-upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

files=@photo1.jpg
files=@photo2.png
files=@photo3.jpg
albumId=album_123abc (optional)
```

**Constraints:**

- Maximum 20 files per batch
- Maximum 10MB per file
- Maximum 50MB total batch size

**Batch Processing Workflow:**

**Phase 1: R2 Upload**

- All files uploaded to R2 storage
- Failed uploads recorded but don't block others
- Tokens refunded for failed uploads

**Phase 2: Database Transaction**

- All successful uploads inserted in single transaction
- If transaction fails, ALL R2 files are cleaned up
- Transaction ensures atomicity: all-or-nothing for database

**Success Response (200)**

```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "filename": "photo1.jpg",
      "imageId": "img_123abc",
      "url": "https://cdn.spike.land/images/img_123abc.jpg",
      "width": 1920,
      "height": 1080,
      "size": 524288,
      "format": "JPEG"
    },
    {
      "success": false,
      "filename": "toolarge.jpg",
      "error": "File exceeds maximum size of 10MB",
      "errorType": "validation"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 1,
    "failed": 1
  }
}
```

**Features:**

- Partial success allowed (some files may fail)
- Automatic R2 cleanup on database transaction failure
- Results returned in same order as uploaded files
- Detailed error messages per file
- Token refunds for failed uploads

**Error Types:**

- `validation`: File size/format validation failed
- `upload`: R2 upload failed
- `database`: Database transaction failed
- `unknown`: Unexpected error

**JavaScript Example**

```javascript
const formData = new FormData();
for (let file of fileInputElement.files) {
  formData.append("files", file);
}

const response = await fetch("/api/images/batch-upload", {
  method: "POST",
  body: formData,
});

const result = await response.json();
result.results.forEach((r, idx) => {
  if (r.success) {
    console.log(`File ${idx + 1}: ${r.imageId}`);
  } else {
    console.error(`File ${idx + 1}: ${r.error}`);
  }
});
```

---

## Image Enhancement

### Enhance Single Image

Enhance a previously uploaded image at a specific quality tier.

```http
POST /api/images/enhance
Content-Type: application/json
Authorization: Bearer {token}

{
  "imageId": "img_123abc",
  "tier": "TIER_2K",
  "blendSource": {
    "imageId": "img_456def"
  }
}
```

**Parameters:**

- `imageId` (required): ID of image to enhance
- `tier` (required): Enhancement tier (FREE, TIER_1K, TIER_2K, TIER_4K)
- `blendSource` (optional): Image blending configuration
  - `imageId`: ID of image to blend with
  - `base64`: Base64-encoded image data
  - `mimeType`: MIME type (required with base64)

**Blend Source Options:**

**Option 1: Blend with existing image**

```json
{
  "blendSource": {
    "imageId": "img_existing"
  }
}
```

**Option 2: Blend with uploaded image**

```json
{
  "blendSource": {
    "base64": "data:image/jpeg;base64,...",
    "mimeType": "image/jpeg"
  }
}
```

**Blend Features:**

- Source image validation (ownership, access)
- Base64 size validation (max 20MB)
- Automatic source image upload for base64
- Both images tracked in job metadata

**Success Response (200)**

```json
{
  "success": true,
  "jobId": "job_789xyz",
  "tokenCost": 5,
  "newBalance": 95
}
```

**Insufficient Tokens Response (402)**

```json
{
  "error": "Insufficient tokens",
  "title": "Payment required",
  "suggestion": "Please add more tokens to continue.",
  "required": 10
}
```

**JavaScript Example**

```javascript
const response = await fetch("/api/images/enhance", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageId: "img_123abc",
    tier: "TIER_2K",
  }),
});

if (response.status === 402) {
  const error = await response.json();
  console.log(`Need ${error.required} tokens`);
  return;
}

const result = await response.json();
console.log(`Job started: ${result.jobId}`);
```

### Enhance with Multiple Tiers (Parallel)

Process the same image with multiple enhancement tiers simultaneously.

```http
POST /api/images/parallel-enhance
Content-Type: application/json
Authorization: Bearer {token}

{
  "imageId": "img_123abc",
  "tiers": ["TIER_1K", "TIER_2K", "TIER_4K"]
}
```

**Parameters:**

- `imageId` (required): ID of image to enhance
- `tiers` (required): Array of 1-3 unique tiers

**Atomic Transaction:** All operations happen in a single database transaction:

1. Token balance checked
2. Tokens consumed for all tiers
3. All jobs created
4. All workflows started

If any step fails, entire operation rolls back.

**Success Response (200)**

```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "job_123abc",
      "tier": "TIER_1K",
      "tokenCost": 2,
      "status": "PROCESSING"
    },
    {
      "jobId": "job_456def",
      "tier": "TIER_2K",
      "tokenCost": 5,
      "status": "PROCESSING"
    },
    {
      "jobId": "job_789xyz",
      "tier": "TIER_4K",
      "tokenCost": 10,
      "status": "PROCESSING"
    }
  ],
  "totalCost": 17,
  "newBalance": 83
}
```

**Constraints:**

- 1-3 unique tiers per request
- No duplicate tiers allowed
- All tokens consumed atomically (all-or-nothing)

**JavaScript Example**

```javascript
const response = await fetch("/api/images/parallel-enhance", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageId: "img_123abc",
    tiers: ["TIER_2K", "TIER_4K"],
  }),
});

const result = await response.json();
console.log(`${result.jobs.length} jobs started`);
console.log(`Total cost: ${result.totalCost} tokens`);
```

### Batch Enhance Multiple Images

Enhance multiple images at the same tier in one operation.

```http
POST /api/images/batch-enhance
Content-Type: application/json
Authorization: Bearer {token}

{
  "imageIds": ["img_123abc", "img_456def", "img_789xyz"],
  "tier": "TIER_2K"
}
```

**Parameters:**

- `imageIds` (required): Array of image IDs (max 20)
- `tier` (required): Enhancement tier for all images

**Features:**

- All images verified for ownership
- Tokens consumed upfront for entire batch
- Single workflow manages all enhancements
- Batch ID for tracking all jobs

**Success Response (200)**

```json
{
  "success": true,
  "batchId": "batch-1234567890",
  "summary": {
    "total": 3,
    "totalCost": 15,
    "newBalance": 85
  }
}
```

**JavaScript Example**

```javascript
const response = await fetch("/api/images/batch-enhance", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageIds: ["img_123abc", "img_456def"],
    tier: "TIER_4K",
  }),
});

const result = await response.json();
console.log(
  `Batch ${result.batchId} started with ${result.summary.total} images`,
);
```

### Polling Enhancement Status

Use GET /api/images/{id} to check job status.

```http
GET /api/images/img_123abc
Authorization: Bearer {token}
```

**Response with Jobs**

```json
{
  "success": true,
  "image": {
    "id": "img_123abc",
    "name": "photo.jpg",
    "originalUrl": "https://cdn.spike.land/images/img_123abc.jpg",
    "originalWidth": 1920,
    "originalHeight": 1080,
    "originalSizeBytes": 524288,
    "originalFormat": "JPEG",
    "isPublic": false,
    "viewCount": 0,
    "createdAt": "2025-12-12T10:30:00Z",
    "updatedAt": "2025-12-12T10:30:00Z",
    "jobs": [
      {
        "id": "job_123abc",
        "tier": "TIER_1K",
        "status": "COMPLETED",
        "tokensCost": 2,
        "enhancedUrl": "https://cdn.spike.land/enhanced/job_123abc.jpg",
        "enhancedWidth": 1920,
        "enhancedHeight": 1080,
        "enhancedSizeBytes": 612352,
        "errorMessage": null,
        "createdAt": "2025-12-12T10:31:00Z",
        "processingStartedAt": "2025-12-12T10:31:05Z",
        "processingCompletedAt": "2025-12-12T10:32:00Z"
      },
      {
        "id": "job_456def",
        "tier": "TIER_4K",
        "status": "PROCESSING",
        "tokensCost": 10,
        "enhancedUrl": null,
        "enhancedWidth": null,
        "enhancedHeight": null,
        "enhancedSizeBytes": null,
        "errorMessage": null,
        "createdAt": "2025-12-12T10:31:30Z",
        "processingStartedAt": "2025-12-12T10:31:35Z",
        "processingCompletedAt": null
      }
    ]
  }
}
```

**Job Status Values:**

- `PENDING`: Job queued, not yet started
- `PROCESSING`: Enhancement in progress
- `COMPLETED`: Enhancement finished successfully
- `FAILED`: Enhancement failed with error
- `REFUNDED`: Job failed, tokens refunded
- `CANCELLED`: Job was cancelled

---

## Image Generation (MCP)

Generate and modify images using text prompts via the MCP API.

### Generate Image from Text

Create a new image from a text prompt.

```http
POST /api/mcp/generate
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "prompt": "A serene mountain landscape at sunset",
  "tier": "TIER_2K",
  "negativePrompt": "people, buildings, cars",
  "aspectRatio": "16:9"
}
```

**Parameters:**

- `prompt` (required): Text description (max 4000 chars)
- `tier` (required): Output resolution (TIER_1K, TIER_2K, TIER_4K)
- `negativePrompt` (optional): Things to avoid
- `aspectRatio` (optional): Output aspect ratio (default: "1:1")

**Supported Aspect Ratios:** `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`,
`9:16`, `16:9`, `21:9`

**Success Response (200)**

```json
{
  "success": true,
  "jobId": "job_gen_123abc",
  "tokensCost": 5,
  "message": "Generation started. Poll /api/mcp/jobs/{jobId} for status."
}
```

**cURL Example**

```bash
curl -X POST https://spike.land/api/mcp/generate \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cyberpunk city at night",
    "tier": "TIER_2K",
    "aspectRatio": "16:9"
  }'
```

### Modify Existing Image

Modify an image using text instructions.

```http
POST /api/mcp/modify
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "prompt": "Add a sunset in the background",
  "tier": "TIER_2K",
  "imageUrl": "https://example.com/image.jpg"
}
```

**Parameters:**

- `prompt` (required): Modification instructions (max 4000 chars)
- `tier` (required): Output resolution (TIER_1K, TIER_2K, TIER_4K)
- `image` (optional): Base64-encoded image data
- `imageUrl` (optional): URL of image to fetch
- `mimeType` (optional): MIME type (required with base64)

**Note:** Either `image` or `imageUrl` must be provided.

**Supported MIME Types:**

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

**Maximum Image Size:** 20MB

**Success Response (200)**

```json
{
  "success": true,
  "jobId": "job_mod_456def",
  "tokensCost": 5,
  "message": "Modification started. Poll /api/mcp/jobs/{jobId} for status."
}
```

**Using Base64 Image**

```javascript
const response = await fetch("/api/mcp/modify", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "Make it look like a watercolor painting",
    tier: "TIER_2K",
    image: base64ImageData,
    mimeType: "image/jpeg",
  }),
});
```

**Using Image URL**

```javascript
const response = await fetch("/api/mcp/modify", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "Add snow to the scene",
    tier: "TIER_2K",
    imageUrl: "https://example.com/photo.jpg",
  }),
});
```

---

## Album Management

### Move Images to Album

Move images between albums with optional source removal.

```http
POST /api/images/move-to-album
Content-Type: application/json
Authorization: Bearer {token}

{
  "imageIds": ["img_123abc", "img_456def", "img_789xyz"],
  "targetAlbumId": "album_abc123",
  "removeFromSourceAlbum": "album_old"
}
```

**Parameters:**

- `imageIds` (required): Array of image IDs (max 100)
- `targetAlbumId` (required): Target album ID
- `removeFromSourceAlbum` (optional): Source album to remove from

**Constraints:**

- Maximum 100 images per request
- Target album must be owned by user
- All images must be owned by user
- Duplicate image IDs are deduplicated
- Image IDs must be valid CUID format

**Behavior:**

- Uses `upsert` to handle duplicates gracefully
- If image already in target album, updates sort order
- Sort orders calculated upfront to avoid race conditions
- Parallel processing of all images
- Source removal happens after target addition

**Success Response (200)**

```json
{
  "success": true,
  "moved": 3,
  "failed": 0,
  "alreadyInAlbum": 0,
  "results": [
    {
      "imageId": "img_123abc",
      "success": true,
      "albumImageId": "alb_img_123",
      "alreadyInAlbum": false
    },
    {
      "imageId": "img_456def",
      "success": true,
      "albumImageId": "alb_img_456",
      "alreadyInAlbum": false
    },
    {
      "imageId": "img_789xyz",
      "success": true,
      "albumImageId": "alb_img_789",
      "alreadyInAlbum": true
    }
  ]
}
```

**JavaScript Example**

```javascript
const response = await fetch("/api/images/move-to-album", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageIds: ["img_123abc", "img_456def"],
    targetAlbumId: "album_xyz789",
    removeFromSourceAlbum: "album_old123",
  }),
});

const result = await response.json();
console.log(`Moved ${result.moved} images`);
console.log(`${result.alreadyInAlbum} were already in the album`);
if (result.failed > 0) {
  console.log(`Failed: ${result.failed}`);
}
```

---

## Image Retrieval

### Get Image with Jobs

Retrieve image details and all enhancement jobs.

```http
GET /api/images/{id}
Authorization: Bearer {token}
```

**Access Control:**

- Image owner can always access
- Public images can be accessed by anyone
- Private images require ownership

**Response (200)**

```json
{
  "success": true,
  "image": {
    "id": "img_123abc",
    "name": "photo.jpg",
    "description": "My favorite photo",
    "originalUrl": "https://cdn.spike.land/images/img_123abc.jpg",
    "originalWidth": 1920,
    "originalHeight": 1080,
    "originalSizeBytes": 524288,
    "originalFormat": "JPEG",
    "isPublic": false,
    "viewCount": 5,
    "createdAt": "2025-12-12T10:30:00Z",
    "updatedAt": "2025-12-12T10:30:00Z",
    "jobs": [
      {
        "id": "job_123abc",
        "tier": "TIER_2K",
        "status": "COMPLETED",
        "tokensCost": 5,
        "enhancedUrl": "https://cdn.spike.land/enhanced/job_123abc.jpg",
        "enhancedWidth": 2048,
        "enhancedHeight": 1536,
        "enhancedSizeBytes": 1048576,
        "errorMessage": null,
        "createdAt": "2025-12-12T10:31:00Z",
        "processingStartedAt": "2025-12-12T10:31:05Z",
        "processingCompletedAt": "2025-12-12T10:32:15Z"
      }
    ]
  }
}
```

### Delete Image

Delete an image and all associated enhancement jobs.

```http
DELETE /api/images/{id}
Authorization: Bearer {token}
```

**Deletion Process:**

1. Verify image ownership
2. Collect all R2 keys (original + all enhanced versions)
3. Delete all R2 files first
4. Delete database records (cascading to jobs)

**Success Response (200)**

```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

**Features:**

- Transactional deletion (R2 first, then database)
- Prevents orphaned database records
- Only image owner can delete
- Cascades to all enhancement jobs
- Removes all files from R2 storage

---

## Anonymous Access

Anonymous endpoints allow image processing without authentication. All anonymous
operations use the FREE tier (0 tokens).

### Anonymous Upload

Upload an image without authentication.

```http
POST /api/images/anonymous-upload
Content-Type: multipart/form-data

file=@photo.jpg
```

**Features:**

- No authentication required
- Rate limited by client IP
- Images are public by default
- Associated with system anonymous user
- Maximum 10MB file size

**Rate Limit:** 10 uploads per 15 minutes per IP

**Success Response (200)**

```json
{
  "success": true,
  "image": {
    "id": "img_anon_123abc",
    "name": "photo.jpg",
    "url": "https://cdn.spike.land/images/img_anon_123abc.jpg",
    "width": 1920,
    "height": 1080
  }
}
```

### Anonymous Enhance (Mix)

Enhance and blend images without authentication.

```http
POST /api/images/anonymous-enhance
Content-Type: application/json

{
  "imageId": "img_anon_123abc",
  "blendSource": {
    "base64": "data:image/jpeg;base64,...",
    "mimeType": "image/jpeg"
  }
}
```

**Parameters:**

- `imageId` (required): ID of anonymous image
- `blendSource` (required): Image to blend with
  - `base64`: Base64-encoded image data
  - `mimeType`: MIME type
  - `imageId`: ID of existing anonymous image

**Constraints:**

- Only FREE tier available
- Image must belong to anonymous user
- Blend source is required
- Rate limited by client IP

**Rate Limit:** 5 mixes per 15 minutes per IP

**Success Response (200)**

```json
{
  "success": true,
  "jobId": "job_anon_789xyz",
  "tier": "FREE"
}
```

**Features:**

- Jobs marked with `isAnonymous: true`
- Results are publicly accessible
- Blend source automatically uploaded
- Both images stored as anonymous

---

## Error Handling

### Common Error Responses

**Unauthorized (401)**

```json
{
  "error": "You must be logged in to access this resource",
  "title": "Authentication Required",
  "suggestion": "Please log in and try again"
}
```

**Forbidden (403)**

```json
{
  "error": "You do not have permission to access this resource",
  "title": "Access Denied",
  "suggestion": "Please check that you own this resource"
}
```

**Not Found (404)**

```json
{
  "error": "Resource not found",
  "title": "Not Found",
  "suggestion": "Please verify the resource ID"
}
```

**Rate Limited (429)**

```json
{
  "error": "Too many requests",
  "title": "Rate limit exceeded",
  "suggestion": "Please wait before trying again.",
  "retryAfter": 60
}
```

**Validation Error (400)**

```json
{
  "error": "Invalid input",
  "title": "Bad Request",
  "suggestion": "Please provide both imageId and tier"
}
```

**Insufficient Tokens (402)**

```json
{
  "error": "Insufficient tokens",
  "title": "Payment Required",
  "suggestion": "Please add more tokens to continue.",
  "required": 10,
  "balance": 5
}
```

**Internal Error (500)**

```json
{
  "error": "Upload processing failed",
  "title": "Server Error",
  "suggestion": "Please try again later"
}
```

### Error Codes

| Code                | Status | Meaning                    |
| ------------------- | ------ | -------------------------- |
| UNAUTHORIZED        | 401    | Authentication required    |
| FORBIDDEN           | 403    | Permission denied          |
| NOT_FOUND           | 404    | Resource not found         |
| INVALID_INPUT       | 400    | Invalid request parameters |
| FILE_TOO_LARGE      | 400    | File exceeds size limit    |
| RATE_LIMIT          | 429    | Rate limit exceeded        |
| INSUFFICIENT_TOKENS | 402    | Not enough tokens          |
| INTERNAL_ERROR      | 500    | Server error               |

### Request ID Header

All responses include an `X-Request-ID` header for debugging:

```
X-Request-ID: req_abc123xyz
```

Include this ID when reporting issues.

---

## Rate Limiting

Endpoints are rate limited per user (authenticated) or IP address (anonymous).

### Rate Limits

| Endpoint             | Limit        | Window     | Identifier |
| -------------------- | ------------ | ---------- | ---------- |
| Upload               | 30 requests  | 15 minutes | User ID    |
| Batch Upload         | 30 requests  | 15 minutes | User ID    |
| Enhancement          | 50 requests  | 15 minutes | User ID    |
| Parallel Enhancement | 50 requests  | 15 minutes | User ID    |
| Batch Enhancement    | Not limited  | -          | -          |
| Move to Album        | 50 requests  | 15 minutes | User ID    |
| Get Image            | 100 requests | 15 minutes | User ID    |
| Anonymous Upload     | 10 requests  | 15 minutes | Client IP  |
| Anonymous Mix        | 5 requests   | 15 minutes | Client IP  |
| MCP Generate         | 50 requests  | 15 minutes | User ID    |
| MCP Modify           | 50 requests  | 15 minutes | User ID    |

### Rate Limit Headers

```
Retry-After: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1734516000
X-Request-ID: req_abc123
```

### Handling Rate Limits

**Exponential Backoff Example**

```javascript
async function enhanceWithRetry(imageId, tier, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch("/api/images/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId, tier }),
    });

    if (response.status !== 429) {
      return response.json();
    }

    const retryAfter = parseInt(response.headers.get("Retry-After"));
    const delay = retryAfter * 1000 * Math.pow(2, attempt);

    console.log(`Rate limited. Retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error("Max retries exceeded");
}
```

---

## Request/Response Examples

### Complete Enhancement Workflow

```javascript
async function enhanceImage() {
  // 1. Upload image
  const uploadForm = new FormData();
  uploadForm.append("file", imageFile);

  const uploadRes = await fetch("/api/images/upload", {
    method: "POST",
    body: uploadForm,
  });

  const { image, enhancement } = await uploadRes.json();
  console.log(`Uploaded: ${image.id}`);
  console.log(`Auto-enhancement started: ${enhancement.jobId}`);

  // 2. Poll for completion
  let completed = false;
  while (!completed) {
    const statusRes = await fetch(`/api/images/${image.id}`);
    const { image: imageData } = await statusRes.json();

    const job = imageData.jobs.find((j) => j.id === enhancement.jobId);
    console.log(`Job status: ${job.status}`);

    if (job.status === "COMPLETED") {
      console.log(`Enhanced URL: ${job.enhancedUrl}`);
      completed = true;
    } else if (job.status === "FAILED") {
      console.error(`Job failed: ${job.errorMessage}`);
      completed = true;
    } else {
      await new Promise((r) => setTimeout(r, 2000)); // Wait 2 seconds
    }
  }
}
```

### Manual Enhancement After Upload

```javascript
// Upload without auto-enhancement (requires special album config)
// Then manually enhance at different tiers

const { image } = await uploadImage();

// Enhance at multiple tiers in parallel
const parallelRes = await fetch("/api/images/parallel-enhance", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageId: image.id,
    tiers: ["TIER_1K", "TIER_2K", "TIER_4K"],
  }),
});

const { jobs, totalCost } = await parallelRes.json();
console.log(`Started ${jobs.length} jobs, cost: ${totalCost} tokens`);
```

### Blend Two Images

```javascript
// Upload first image
const image1 = await uploadImage(file1);

// Upload second image
const image2 = await uploadImage(file2);

// Blend them together
const blendRes = await fetch("/api/images/enhance", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageId: image1.id,
    tier: "TIER_2K",
    blendSource: {
      imageId: image2.id,
    },
  }),
});

const { jobId } = await blendRes.json();
console.log(`Blend job started: ${jobId}`);
```

---

## API Client Library

### Using with Fetch

```javascript
class SpikeImageAPI {
  constructor(baseUrl = "http://localhost:3000") {
    this.baseUrl = baseUrl;
  }

  async uploadImage(file, albumId) {
    const formData = new FormData();
    formData.append("file", file);
    if (albumId) formData.append("albumId", albumId);

    const res = await fetch(`${this.baseUrl}/api/images/upload`, {
      method: "POST",
      body: formData,
    });

    return res.json();
  }

  async enhanceImage(imageId, tier, blendSource = null) {
    const res = await fetch(`${this.baseUrl}/api/images/enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId, tier, blendSource }),
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async parallelEnhance(imageId, tiers) {
    const res = await fetch(`${this.baseUrl}/api/images/parallel-enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId, tiers }),
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getImage(imageId) {
    const res = await fetch(`${this.baseUrl}/api/images/${imageId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async moveToAlbum(imageIds, targetAlbumId, removeFromSourceAlbum = null) {
    const res = await fetch(`${this.baseUrl}/api/images/move-to-album`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds, targetAlbumId, removeFromSourceAlbum }),
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async deleteImage(imageId) {
    const res = await fetch(`${this.baseUrl}/api/images/${imageId}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}
```

### Using MCP API

```javascript
class SpikeMcpAPI {
  constructor(apiKey, baseUrl = "https://spike.land") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateImage(prompt, tier, options = {}) {
    const res = await fetch(`${this.baseUrl}/api/mcp/generate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        tier,
        negativePrompt: options.negativePrompt,
        aspectRatio: options.aspectRatio || "1:1",
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Generation failed");
    }

    return res.json();
  }

  async modifyImage(prompt, tier, imageSource, mimeType = null) {
    const body = { prompt, tier };

    if (typeof imageSource === "string" && imageSource.startsWith("http")) {
      body.imageUrl = imageSource;
    } else {
      body.image = imageSource;
      body.mimeType = mimeType || "image/jpeg";
    }

    const res = await fetch(`${this.baseUrl}/api/mcp/modify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Modification failed");
    }

    return res.json();
  }
}
```

---

## Best Practices

### Upload Operations

1. **Batch Uploads**: Use batch-upload for multiple images to reduce latency and
   ensure transactional consistency
2. **File Validation**: Validate file size and format client-side before
   uploading
3. **Error Handling**: Handle partial failures in batch uploads gracefully
4. **Token Management**: Check token balance before batch operations

### Enhancement Operations

1. **Parallel Enhancement**: Use parallel-enhance to process multiple tiers
   simultaneously
2. **Poll for Status**: Implement exponential backoff when polling job status
3. **Tier Selection**: Choose appropriate tier based on use case (preview vs
   production)
4. **Blend Operations**: Validate blend source images before enhancement

### Performance Optimization

1. **Rate Limit Management**: Implement retry logic with exponential backoff
2. **Concurrent Requests**: Limit concurrent enhancement requests to avoid rate
   limits
3. **Job Monitoring**: Use batch status endpoints for efficient polling
4. **Caching**: Cache image metadata to reduce API calls

### User Experience

1. **Progress Feedback**: Show upload/enhancement progress to users
2. **Error Messages**: Display user-friendly error messages with suggestions
3. **Token Warnings**: Warn users before token depletion
4. **Cleanup**: Delete failed images to save storage space

### Security

1. **Filename Validation**: Ensure filenames are secure (no path traversal)
2. **Size Limits**: Enforce client-side size validation
3. **Access Control**: Verify image ownership before operations
4. **API Keys**: Store MCP API keys securely (environment variables)

---

## Troubleshooting

### Upload Issues

**Q: I'm getting "File exceeds maximum size" errors** A: Ensure files are under
10MB. For batch uploads, total batch size must be under 50MB. Compress or resize
images before uploading.

**Q: Batch upload shows partial failures** A: This is expected behavior. Check
the `results` array for individual file status. Failed files include detailed
error messages.

**Q: Upload succeeded but tokens weren't refunded on failure** A: Tokens are
automatically refunded when upload processing fails, job creation fails, or
workflow start fails. Check transaction history.

### Enhancement Issues

**Q: I'm getting "Insufficient tokens" errors** A: Check user's token balance
and offer to purchase more tokens. Tokens regenerate automatically (1 per 15
min, max 100).

**Q: Rate limit errors** A: Implement exponential backoff retry logic. Check
`Retry-After` header for wait time.

**Q: Enhancement job stuck in PROCESSING** A: Jobs should complete within 1-5
minutes depending on tier. Check logs for timeout errors. Workflow may have
failed silently.

**Q: Parallel enhancement only started some jobs** A: Parallel enhancement is
atomic - if any job fails to create, all jobs are rolled back and tokens are
refunded. Check for validation errors.

### Blend Issues

**Q: Blend source image not found** A: Verify the source image ID is correct and
owned by the user. For anonymous blends, both images must belong to the
anonymous user.

**Q: Base64 blend source too large** A: Maximum base64 size is 20MB. Compress or
resize the blend source image before encoding.

### MCP API Issues

**Q: MCP API returns 401 Unauthorized** A: Verify API key is valid and included
in Authorization header. Check API key hasn't been revoked.

**Q: Image generation fails with unclear error** A: Check prompt length (max
4000 chars), tier validity, and aspect ratio format. Verify token balance.

**Q: Image URL fetch fails in modify endpoint** A: Ensure image URL is publicly
accessible and returns valid image MIME type. Check for CORS restrictions.

### Database Issues

**Q: Transaction failed in batch upload** A: All R2 files are automatically
cleaned up on transaction failure. No manual cleanup needed. Check database logs
for specific error.

**Q: Image deleted but files still in R2** A: Deletion follows R2-first
strategy. If database deletion fails, R2 files are already gone. Manual cleanup
not needed.

---

## Version History

### v1.0.0 (December 2025)

- Initial API release
- Single and batch image upload
- Single and parallel enhancement
- Batch enhancement for multiple images
- Image blending support
- Album management
- Anonymous upload and mix
- MCP API for generation and modification
- Complete error handling
- Rate limiting
- Transactional batch operations
- Automatic token refunds

---

## Support

For API issues or questions:

- Email: zoltan.erdos@spike.land
- GitHub Issues: https://github.com/spike-land-ai/spike.land/issues
- Documentation: https://spike.land/docs
- API Reference: [API_REFERENCE.md](./API_REFERENCE.md)
- Token System: [TOKEN_SYSTEM.md](../TOKEN_SYSTEM.md)
