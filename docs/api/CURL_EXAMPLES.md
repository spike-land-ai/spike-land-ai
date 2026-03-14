# Spike Land API - cURL Examples

Quick reference for testing API endpoints using cURL.

## Quick Reference

**Base URLs**:

- Production: `https://spike.land/api`
- Development: `http://localhost:3000/api`

**Authentication Methods**:

- **MCP Endpoints**: API Key (`Authorization: Bearer sk_live_...`)
- **Web Endpoints**: Session Cookie (from browser)

**Key MCP Endpoints**:

- `POST /api/mcp/generate` - Generate image from text
- `POST /api/mcp/modify` - Modify existing image
- `GET /api/mcp/balance` - Check token balance
- `GET /api/jobs/{jobId}` - Check job status

**Token Costs**:

- TIER_1K (1024px): 2 tokens
- TIER_2K (2048px): 5 tokens
- TIER_4K (4096px): 10 tokens

## Environment Setup

```bash
# Set base URL for easier commands
export API_BASE="https://spike.land/api"        # Production
export API_BASE="http://localhost:3000/api"     # Development

# Set your API key for MCP endpoints (get from /settings/api-keys)
export API_KEY="sk_live_your_api_key_here"
```

## Authentication

Spike Land supports two authentication methods:

1. **Session-based authentication** - For web browser requests (cookies handled
   automatically)
2. **API Key authentication** - For MCP endpoints and external integrations

### Using API Key (Recommended for MCP)

```bash
# All MCP endpoints use Bearer token authentication
curl -X GET $API_BASE/mcp/balance \
  -H "Authorization: Bearer $API_KEY"
```

### Using Session (Browser/Web UI)

```bash
# Session cookies are sent automatically by the browser
# For cURL testing, you can extract session cookies from browser dev tools
curl -X GET $API_BASE/tokens/balance \
  --cookie "next-auth.session-token=your_session_cookie"
```

## Health & Status

### Health Check

```bash
curl -X GET $API_BASE/health
```

Response:

```json
{
  "status": "ok"
}
```

### Admin Dashboard (Requires Admin Role & Session Auth)

```bash
curl -X GET $API_BASE/admin/dashboard \
  --cookie "next-auth.session-token=your_session_cookie"
```

## Token Management

### Get Token Balance (Session Auth)

```bash
curl -X GET $API_BASE/tokens/balance \
  --cookie "next-auth.session-token=your_session_cookie"
```

Response:

```json
{
  "balance": 45,
  "lastRegeneration": "2025-12-30T15:00:00Z",
  "timeUntilNextRegenMs": 900000,
  "tokensAddedThisRequest": 1,
  "tier": "FREE",
  "maxBalance": 50,
  "stats": {
    "totalSpent": 150,
    "totalEarned": 500,
    "totalRefunded": 10,
    "transactionCount": 42
  }
}
```

### Get Token Balance (API Key - MCP)

```bash
curl -X GET $API_BASE/mcp/balance \
  -H "Authorization: Bearer $API_KEY"
```

Response:

```json
{
  "balance": 45,
  "lastRegeneration": "2025-12-30T15:00:00Z"
}
```

### Validate Voucher

```bash
curl -X POST $API_BASE/vouchers/validate \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME50"
  }'
```

### Redeem Voucher

```bash
curl -X POST $API_BASE/vouchers/redeem \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME50"
  }'
```

## API Key Management

### List API Keys

```bash
curl -X GET $API_BASE/settings/api-keys \
  --cookie "next-auth.session-token=your_session_cookie"
```

Response:

```json
{
  "apiKeys": [
    {
      "id": "cuid123",
      "name": "Production Key",
      "keyPrefix": "sk_live",
      "lastUsedAt": "2025-12-30T14:30:00Z",
      "isActive": true,
      "createdAt": "2025-12-20T10:00:00Z"
    }
  ]
}
```

### Create API Key

```bash
curl -X POST $API_BASE/settings/api-keys \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key"
  }'
```

Response:

```json
{
  "apiKey": {
    "id": "cuid123",
    "name": "My API Key",
    "key": "sk_live_abc123xyz789...",
    "keyPrefix": "sk_live",
    "createdAt": "2025-12-30T15:00:00Z"
  },
  "message": "API key created successfully. Make sure to copy the key now - it will not be shown again."
}
```

**IMPORTANT**: Save the `key` value immediately - it will only be shown once!

### Revoke API Key

```bash
curl -X DELETE $API_BASE/settings/api-keys/{keyId} \
  --cookie "next-auth.session-token=your_session_cookie"
```

## Image Management

### Upload Image (Automatically Enhances with TIER_1K)

```bash
curl -X POST $API_BASE/images/upload \
  --cookie "next-auth.session-token=your_session_cookie" \
  -F "file=@/path/to/image.jpg"
```

Response:

```json
{
  "success": true,
  "image": {
    "id": "cuid123456789",
    "name": "image.jpg",
    "url": "https://pub-xxx.r2.dev/original.jpg",
    "width": 1920,
    "height": 1080,
    "size": 524288,
    "format": "jpeg"
  },
  "enhancement": {
    "jobId": "job_abc123",
    "tier": "TIER_1K",
    "tokenCost": 2,
    "newBalance": 48
  }
}
```

**Note**: Upload automatically creates an enhancement job. Poll
`/api/jobs/{jobId}` to check enhancement progress.

### Upload to Album (Uses Album's Default Tier)

```bash
curl -X POST $API_BASE/images/upload \
  --cookie "next-auth.session-token=your_session_cookie" \
  -F "file=@/path/to/image.jpg" \
  -F "albumId=cuid_album_123"
```

### Get Image Details

```bash
curl -X GET $API_BASE/images/{imageId} \
  --cookie "next-auth.session-token=your_session_cookie"
```

### Delete Image

```bash
curl -X DELETE $API_BASE/images/{imageId} \
  --cookie "next-auth.session-token=your_session_cookie"
```

### Get Image Versions

```bash
curl -X GET $API_BASE/images/{imageId}/versions \
  --cookie "next-auth.session-token=your_session_cookie"
```

## Image Enhancement

### Enhance Single Image

```bash
curl -X POST $API_BASE/images/enhance \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "imageId": "cuid123456789",
    "tier": "TIER_2K"
  }'
```

Response:

```json
{
  "success": true,
  "jobId": "job_abc123",
  "tokenCost": 5,
  "newBalance": 45
}
```

**Token Costs**:

- `TIER_1K` (1024px): 2 tokens
- `TIER_2K` (2048px): 5 tokens
- `TIER_4K` (4096px): 10 tokens

### Enhance with Blend Source

```bash
curl -X POST $API_BASE/images/enhance \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "imageId": "cuid123456789",
    "tier": "TIER_2K",
    "blendSource": {
      "imageId": "cuid_source_image"
    }
  }'
```

Or with base64 image:

```bash
curl -X POST $API_BASE/images/enhance \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "imageId": "cuid123456789",
    "tier": "TIER_2K",
    "blendSource": {
      "base64": "iVBORw0KGgoAAAANSUhEUg...",
      "mimeType": "image/png"
    }
  }'
```

### Batch Enhancement

```bash
curl -X POST $API_BASE/images/batch-enhance \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageIds": ["cuid123", "cuid456", "cuid789"],
    "tier": "TIER_2K"
  }'
```

Response:

```json
{
  "jobIds": ["job_1", "job_2", "job_3"],
  "totalTokensCost": 15
}
```

### Batch Upload and Enhance

```bash
curl -X POST $API_BASE/images/batch-upload \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg" \
  -F "tier=TIER_2K"
```

### Export Enhanced Image

```bash
curl -X POST $API_BASE/images/export \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageId": "cuid123456789",
    "format": "PNG"
  }'
```

## Jobs

### Get Job Status

```bash
curl -X GET $API_BASE/jobs/{jobId} \
  --cookie "next-auth.session-token=your_session_cookie"
```

Response:

```json
{
  "id": "job_abc123",
  "status": "COMPLETED",
  "tier": "TIER_2K",
  "tokensCost": 5,
  "enhancedUrl": "https://pub-xxx.r2.dev/enhanced.jpg",
  "enhancedWidth": 2048,
  "enhancedHeight": 1536,
  "errorMessage": null,
  "createdAt": "2025-12-30T14:30:00Z",
  "processingStartedAt": "2025-12-30T14:30:01Z",
  "processingCompletedAt": "2025-12-30T14:30:45Z",
  "isAnonymous": false,
  "image": {
    "id": "cuid123",
    "name": "photo.jpg",
    "originalUrl": "https://pub-xxx.r2.dev/original.jpg",
    "originalWidth": 1920,
    "originalHeight": 1080
  }
}
```

**Job Status Values**:

- `PROCESSING` - Enhancement in progress
- `COMPLETED` - Successfully enhanced
- `FAILED` - Enhancement failed (check `errorMessage`)
- `CANCELLED` - Job was cancelled
- `REFUNDED` - Job failed and tokens were refunded

### Get Batch Job Status

```bash
curl -X POST $API_BASE/jobs/batch-status \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "jobIds": ["job_1", "job_2", "job_3"]
  }'
```

### Delete Job

```bash
curl -X DELETE $API_BASE/jobs/{jobId} \
  --cookie "next-auth.session-token=your_session_cookie"
```

**Note**: Only completed, failed, cancelled, or refunded jobs can be deleted.

## Albums

### List User Albums

```bash
curl -X GET $API_BASE/albums \
  --cookie "next-auth.session-token=your_session_cookie"
```

Response:

```json
{
  "albums": [
    {
      "id": "cuid123456789",
      "name": "Summer Photos 2025",
      "description": "Vacation photos",
      "privacy": "UNLISTED",
      "coverImageId": null,
      "imageCount": 42,
      "previewImages": [
        {
          "id": "cuid_img1",
          "url": "https://pub-xxx.r2.dev/img1.jpg",
          "name": "beach.jpg"
        }
      ],
      "createdAt": "2025-12-10T10:30:00Z",
      "updatedAt": "2025-12-20T15:00:00Z"
    }
  ]
}
```

### Create Album

```bash
curl -X POST $API_BASE/albums \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Vacation",
    "description": "Greece trip 2025",
    "privacy": "UNLISTED",
    "defaultTier": "TIER_2K"
  }'
```

**Privacy Options**:

- `PRIVATE` - Only you can see it
- `UNLISTED` - Anyone with the link can see it
- `PUBLIC` - Visible in public gallery

Response:

```json
{
  "album": {
    "id": "cuid_new_album",
    "name": "Summer Vacation",
    "description": "Greece trip 2025",
    "privacy": "UNLISTED",
    "shareToken": "abc123xyz",
    "createdAt": "2025-12-30T15:00:00Z"
  }
}
```

### Update Album

```bash
curl -X PUT $API_BASE/albums/{albumId} \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Vacation 2025",
    "description": "Greece and Italy",
    "privacy": "PUBLIC"
  }'
```

### Delete Album

```bash
curl -X DELETE $API_BASE/albums/{albumId} \
  --cookie "next-auth.session-token=your_session_cookie"
```

## Gallery

### Get Public Gallery

```bash
curl -X GET "$API_BASE/gallery/public-albums?page=1&limit=20"
```

### Get Featured Gallery

```bash
curl -X GET "$API_BASE/gallery?page=1&limit=12"
```

### Browse Admin Gallery (Admin Only)

```bash
curl -X GET $API_BASE/admin/gallery/browse \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

## Referral Program

### Get Referral Link

```bash
curl -X GET $API_BASE/referral/link \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

Response:

```json
{
  "code": "JOHN123",
  "url": "https://spike.land?ref=JOHN123"
}
```

### Get Referral Stats

```bash
curl -X GET $API_BASE/referral/stats \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

Response:

```json
{
  "referralCode": "JOHN123",
  "successfulReferrals": 5,
  "tokensEarned": 250,
  "referrals": [
    {
      "userId": "cuid...",
      "userName": "Jane Smith",
      "email": "jane@example.com",
      "tokensEarned": 50,
      "referredAt": "2025-12-05T10:00:00Z"
    }
  ]
}
```

## Apps (Future Feature)

### List User Apps

```bash
curl -X GET $API_BASE/apps \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

### Create New App

```bash
curl -X POST $API_BASE/apps \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Image Tool",
    "description": "Custom image enhancement app"
  }'
```

### Fork Existing App

```bash
curl -X POST $API_BASE/apps \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Image Tool (Fork)",
    "forkedFrom": "cuid_original_app_123"
  }'
```

### Get App Details

```bash
curl -X GET $API_BASE/apps/{appId} \
  -H "Authorization: Bearer $SESSION_TOKEN"
```

## MCP (Model Context Protocol) Endpoints

The MCP endpoints provide programmatic access to AI image generation and
modification. All MCP endpoints require API key authentication.

### Generate Image from Text Prompt

```bash
curl -X POST $API_BASE/mcp/generate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A serene mountain landscape at sunset with golden light",
    "tier": "TIER_2K",
    "negativePrompt": "blurry, low quality, distorted",
    "aspectRatio": "16:9"
  }'
```

**Parameters**:

- `prompt` (required): Text description of image to generate (max 4000 chars)
- `tier` (required): `TIER_1K`, `TIER_2K`, or `TIER_4K`
- `negativePrompt` (optional): Things to avoid
- `aspectRatio` (optional): Default `1:1`. Supported: `1:1`, `3:2`, `2:3`,
  `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`

**Token Costs**:

- `TIER_1K`: 2 tokens
- `TIER_2K`: 5 tokens
- `TIER_4K`: 10 tokens

Response:

```json
{
  "success": true,
  "jobId": "job_gen_abc123",
  "tokensCost": 5,
  "message": "Generation started. Poll /api/mcp/jobs/{jobId} for status."
}
```

### Modify Existing Image

```bash
curl -X POST $API_BASE/mcp/modify \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add vibrant colors and enhance lighting",
    "tier": "TIER_2K",
    "imageUrl": "https://example.com/image.jpg"
  }'
```

**Parameters**:

- `prompt` (required): Modification instructions (max 4000 chars)
- `tier` (required): `TIER_1K`, `TIER_2K`, or `TIER_4K`
- `imageUrl` (optional): URL of image to fetch and modify
- `image` (optional): Base64-encoded image data
- `mimeType` (required if using `image`): `image/jpeg`, `image/png`,
  `image/webp`, or `image/gif`

**Note**: Either `imageUrl` or `image` must be provided. Maximum image size:
20MB.

Using base64 image:

```bash
curl -X POST $API_BASE/mcp/modify \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Convert to black and white with high contrast",
    "tier": "TIER_2K",
    "image": "iVBORw0KGgoAAAANSUhEUg...",
    "mimeType": "image/png"
  }'
```

Response:

```json
{
  "success": true,
  "jobId": "job_mod_xyz789",
  "tokensCost": 5,
  "message": "Modification started. Poll /api/mcp/jobs/{jobId} for status."
}
```

### Check Job Status (MCP)

```bash
curl -X GET $API_BASE/jobs/{jobId} \
  -H "Authorization: Bearer $API_KEY"
```

**Note**: For MCP-generated jobs, you can use either the API key or anonymous
access (no auth required for jobs created via MCP).

### Get Token History (MCP)

```bash
curl -X GET $API_BASE/mcp/history \
  -H "Authorization: Bearer $API_KEY"
```

Get transaction history for API key usage.

## Stripe Payments

### Create Checkout Session (Token Purchase)

```bash
curl -X POST $API_BASE/stripe/checkout \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "payment",
    "packageId": "starter"
  }'
```

**Available Packages** (see `/docs/architecture/TOKEN_SYSTEM.md` for current
pricing):

- `starter`: 100 tokens
- `pro`: 500 tokens
- `business`: 2000 tokens

Response:

```json
{
  "success": true,
  "sessionId": "cs_live_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Create Checkout Session (Subscription)

```bash
curl -X POST $API_BASE/stripe/checkout \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "subscription",
    "planId": "pro"
  }'
```

**Available Plans**:

- `hobby`: Monthly token allowance with regeneration
- `pro`: Higher monthly allowance
- `business`: Maximum monthly allowance

Response:

```json
{
  "sessionId": "cs_live_...",
  "url": "https://checkout.stripe.com/..."
}
```

## Error Examples

### Unauthorized (401)

```bash
curl -X GET $API_BASE/tokens/balance
```

Response:

```json
{
  "error": "Unauthorized"
}
```

### Missing API Key (401)

```bash
curl -X POST $API_BASE/mcp/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "tier": "TIER_1K"}'
```

Response:

```json
{
  "error": "Missing Authorization header"
}
```

### Invalid API Key (401)

```bash
curl -X GET $API_BASE/mcp/balance \
  -H "Authorization: Bearer invalid_key"
```

Response:

```json
{
  "error": "Invalid API key"
}
```

### Rate Limited (429)

```bash
curl -X POST $API_BASE/mcp/generate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "tier": "TIER_1K"}'
```

Response (with retry header):

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

Headers include: `Retry-After: 60`

### Validation Error (400)

```bash
curl -X POST $API_BASE/albums \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "privacy": "INVALID"
  }'
```

Response:

```json
{
  "error": "Invalid privacy setting"
}
```

### Insufficient Tokens (402)

```bash
curl -X POST $API_BASE/images/enhance \
  --cookie "next-auth.session-token=your_session_cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "imageId": "cuid123",
    "tier": "TIER_4K"
  }'
```

Response:

```json
{
  "error": "Insufficient tokens",
  "title": "Payment required",
  "suggestion": "Please add more tokens to continue.",
  "required": 10
}
```

### Image Too Large (400)

```bash
curl -X POST $API_BASE/mcp/modify \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test",
    "tier": "TIER_1K",
    "image": "very_large_base64_string...",
    "mimeType": "image/jpeg"
  }'
```

Response:

```json
{
  "error": "Image too large. Maximum size is 20MB"
}
```

## Useful Tips

### Check Response Headers

```bash
# Show all headers
curl -i -X GET $API_BASE/mcp/balance \
  -H "Authorization: Bearer $API_KEY"

# Show specific header (rate limit info)
curl -I -X GET $API_BASE/mcp/balance \
  -H "Authorization: Bearer $API_KEY" | grep "X-RateLimit"
```

### Pretty Print JSON Responses

```bash
# Using jq (recommended)
curl -s -X GET $API_BASE/mcp/balance \
  -H "Authorization: Bearer $API_KEY" | jq

# Using python
curl -s -X GET $API_BASE/mcp/balance \
  -H "Authorization: Bearer $API_KEY" | python -m json.tool
```

### Follow Redirects

```bash
curl -L -X GET $API_BASE/some-endpoint
```

### Download Enhanced Image

```bash
# Get job status and extract URL
JOB_ID="job_abc123"
ENHANCED_URL=$(curl -s -X GET $API_BASE/jobs/$JOB_ID \
  -H "Authorization: Bearer $API_KEY" | jq -r '.enhancedUrl')

# Download the enhanced image
curl -o enhanced_image.jpg "$ENHANCED_URL"
```

### Measure Performance

```bash
curl -w "Total time: %{time_total}s\n" \
  -X GET $API_BASE/mcp/balance \
  -H "Authorization: Bearer $API_KEY"
```

### Save Request/Response for Debugging

```bash
# Save full request and response to file
curl -v -X POST $API_BASE/mcp/generate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "tier": "TIER_1K"}' \
  2>&1 | tee debug.log
```

## Automation Examples

### Monitor Job Until Completion

```bash
#!/bin/bash

JOB_ID=$1
API_BASE="http://localhost:3000/api"

while true; do
  STATUS=$(curl -s -X GET "$API_BASE/jobs/$JOB_ID" \
    -H "Authorization: Bearer $API_KEY" | jq -r '.status')

  echo "Job status: $STATUS"

  case $STATUS in
    COMPLETED)
      echo "Job completed!"
      # Get the enhanced image URL
      URL=$(curl -s -X GET "$API_BASE/jobs/$JOB_ID" \
        -H "Authorization: Bearer $API_KEY" | jq -r '.enhancedUrl')
      echo "Enhanced image: $URL"
      break
      ;;
    FAILED)
      echo "Job failed!"
      ERROR=$(curl -s -X GET "$API_BASE/jobs/$JOB_ID" \
        -H "Authorization: Bearer $API_KEY" | jq -r '.errorMessage')
      echo "Error: $ERROR"
      exit 1
      ;;
    REFUNDED)
      echo "Job failed and tokens were refunded"
      exit 1
      ;;
    *)
      echo "Waiting... (status: $STATUS)"
      sleep 2
      ;;
  esac
done
```

### Generate and Download Image

```bash
#!/bin/bash

API_BASE="http://localhost:3000/api"

# Step 1: Generate image
echo "Generating image..."
RESPONSE=$(curl -s -X POST "$API_BASE/mcp/generate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A serene mountain landscape at sunset",
    "tier": "TIER_2K",
    "aspectRatio": "16:9"
  }')

JOB_ID=$(echo $RESPONSE | jq -r '.jobId')
echo "Job ID: $JOB_ID"

# Step 2: Wait for completion
while true; do
  STATUS=$(curl -s -X GET "$API_BASE/jobs/$JOB_ID" \
    -H "Authorization: Bearer $API_KEY" | jq -r '.status')

  if [ "$STATUS" = "COMPLETED" ]; then
    break
  elif [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "REFUNDED" ]; then
    echo "Generation failed"
    exit 1
  fi

  echo "Status: $STATUS"
  sleep 3
done

# Step 3: Download the image
ENHANCED_URL=$(curl -s -X GET "$API_BASE/jobs/$JOB_ID" \
  -H "Authorization: Bearer $API_KEY" | jq -r '.enhancedUrl')

echo "Downloading from: $ENHANCED_URL"
curl -o generated_image.jpg "$ENHANCED_URL"
echo "Image saved as generated_image.jpg"
```

### Modify Image with Polling

```bash
#!/bin/bash

API_BASE="http://localhost:3000/api"
IMAGE_PATH=$1

# Convert image to base64
IMAGE_BASE64=$(base64 -i "$IMAGE_PATH")

# Start modification
echo "Starting modification..."
RESPONSE=$(curl -s -X POST "$API_BASE/mcp/modify" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"Enhance colors and add dramatic lighting\",
    \"tier\": \"TIER_2K\",
    \"image\": \"$IMAGE_BASE64\",
    \"mimeType\": \"image/jpeg\"
  }")

JOB_ID=$(echo $RESPONSE | jq -r '.jobId')
echo "Job ID: $JOB_ID"

# Poll until complete
while true; do
  STATUS=$(curl -s -X GET "$API_BASE/jobs/$JOB_ID" | jq -r '.status')

  if [ "$STATUS" = "COMPLETED" ]; then
    URL=$(curl -s -X GET "$API_BASE/jobs/$JOB_ID" | jq -r '.enhancedUrl')
    echo "Modified image: $URL"
    curl -o modified.jpg "$URL"
    echo "Downloaded to modified.jpg"
    break
  fi

  echo "Status: $STATUS"
  sleep 2
done
```

## Troubleshooting

### Connection Refused

```bash
# Check if API is running
curl http://localhost:3000/api/health

# Should return: {"status":"ok"}
```

### Invalid API Key

```bash
# Check API key format
echo $API_KEY  # Should start with "sk_live_" or "sk_test_"

# Test with verbose output
curl -v -X GET http://localhost:3000/api/mcp/balance \
  -H "Authorization: Bearer $API_KEY"

# Check for common mistakes:
# - Missing "Bearer " prefix
# - Extra spaces in the key
# - Using session cookie instead of API key
```

### Rate Limited Responses

```bash
# Check rate limit headers
curl -i -X GET $API_BASE/mcp/balance \
  -H "Authorization: Bearer $API_KEY" | grep "Retry-After"

# Extract retry time and wait
RESPONSE=$(curl -i -X GET $API_BASE/mcp/generate \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "tier": "TIER_1K"}' 2>&1)

RETRY_AFTER=$(echo "$RESPONSE" | grep -i "retry-after" | cut -d' ' -f2 | tr -d '\r')

if [ ! -z "$RETRY_AFTER" ]; then
  echo "Rate limited. Waiting $RETRY_AFTER seconds..."
  sleep $RETRY_AFTER
fi
```

### Job Stuck in PROCESSING

```bash
# Check job status with full details
curl -s -X GET $API_BASE/jobs/{jobId} \
  -H "Authorization: Bearer $API_KEY" | jq

# Jobs typically complete in:
# - TIER_1K: 10-30 seconds
# - TIER_2K: 20-45 seconds
# - TIER_4K: 30-60 seconds

# If job is stuck for >5 minutes, contact support
```

### Base64 Encoding Issues

```bash
# Ensure proper base64 encoding (remove newlines)
IMAGE_BASE64=$(base64 -w 0 image.jpg)  # Linux
IMAGE_BASE64=$(base64 -i image.jpg)    # macOS

# Test with small image first
curl -X POST $API_BASE/mcp/modify \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"test\",
    \"tier\": \"TIER_1K\",
    \"image\": \"$IMAGE_BASE64\",
    \"mimeType\": \"image/jpeg\"
  }"
```

---

## Related Documentation

- [API Reference](./API_REFERENCE.md) - Complete API endpoint documentation
- [Token System](../develop/TOKEN_SYSTEM.md) - Token pricing and regeneration details
- [Database Schema](../develop/JSON_SCHEMAS.md) - Database structure and
  relationships

## Rate Limits

Current rate limits (per user/API key):

- **Image Upload**: 10 requests/minute
- **Image Enhancement**: 20 requests/minute
- **MCP Generate**: 10 requests/minute
- **MCP Modify**: 10 requests/minute
- **Job Status**: 60 requests/minute
- **General**: 30 requests/minute

See `/src/lib/rate-limiter.ts` for complete rate limit configuration.

## Support

- Documentation: [https://spike.land/docs](https://spike.land/docs)
- Issues: [GitHub Issues](https://github.com/spike-land-ai/spike.land/issues)
- Email: hello@spike.land

**Last Updated**: 2025-12-30
