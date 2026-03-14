# Spike Land API Integration Guide

Quick start guide for developers integrating with the Spike Land API.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Common Patterns](#common-patterns)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [TypeScript Examples](#typescript-examples)
7. [Testing](#testing)

## Getting Started

### Prerequisites

- NextAuth.js session or valid API token
- HTTPS connection (production only)
- Understanding of REST APIs

### Base Configuration

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000/api";

interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
  title?: string;
  suggestion?: string;
}
```

## Authentication

### Session-Based (Recommended for Web)

NextAuth.js automatically includes session cookies. No additional setup needed:

```typescript
// Automatic with fetch (same domain)
const response = await fetch(`${API_BASE_URL}/tokens/balance`);
const data = await response.json();
```

### Bearer Token (for APIs)

```typescript
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const session = await getSession(); // NextAuth hook

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.user?.id}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.json());
  }

  return response.json();
}
```

### Mobile/External Apps

```typescript
// Step 1: Get session token from login
const loginResponse = await fetch(`${API_BASE_URL}/auth/signin`, {
  method: "POST",
  body: JSON.stringify({ email, password }),
});
const { sessionToken } = await loginResponse.json();

// Step 2: Use token for API calls
const response = await fetch(`${API_BASE_URL}/tokens/balance`, {
  headers: {
    Authorization: `Bearer ${sessionToken}`,
  },
});
```

## Common Patterns

### Token Balance Check

```typescript
async function checkTokenBalance(): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/tokens/balance`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get balance: ${data.error}`);
  }

  return data.balance;
}
```

### Image Upload & Enhancement

```typescript
async function enhanceImage(
  imageId: string,
  tier: "TIER_1K" | "TIER_2K" | "TIER_4K",
): Promise<string> {
  // Step 1: Check balance
  const balance = await checkTokenBalance();
  const costs = { TIER_1K: 2, TIER_2K: 5, TIER_4K: 10 };

  if (balance < costs[tier]) {
    throw new Error(
      `Insufficient tokens. Need ${costs[tier]}, have ${balance}`,
    );
  }

  // Step 2: Start enhancement job
  const response = await fetch(`${API_BASE_URL}/images/enhance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageId, tier }),
  });

  const job = await response.json();

  if (!response.ok) {
    throw new Error(`Enhancement failed: ${job.error}`);
  }

  // Step 3: Poll for completion
  return await pollJobStatus(job.id);
}

async function pollJobStatus(jobId: string): Promise<string> {
  const maxAttempts = 120; // 2 minutes at 1 second intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
    const job = await response.json();

    switch (job.status) {
      case "COMPLETED":
        return job.enhancedImageId;
      case "FAILED":
        throw new Error(`Job failed: ${job.error}`);
      case "CANCELLED":
        throw new Error("Job was cancelled");
      case "PROCESSING":
      case "PENDING":
        // Continue polling
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
        break;
    }
  }

  throw new Error("Job polling timeout");
}
```

### Streaming Job Progress

```typescript
async function streamJobProgress(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/stream`);

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          console.log("Progress:", data.progress);
          // Update UI with progress
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

### Album Management

```typescript
async function createAlbum(
  name: string,
  description?: string,
  privacy: "PRIVATE" | "UNLISTED" | "PUBLIC" = "PRIVATE",
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/albums`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, privacy }),
  });

  const album = await response.json();
  if (!response.ok) throw new Error(album.error);
  return album.id;
}

async function addImagesToAlbum(
  albumId: string,
  imageIds: string[],
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/albums/${albumId}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
}
```

### Batch Enhancement

```typescript
async function batchEnhanceImages(
  imageIds: string[],
  tier: "TIER_1K" | "TIER_2K" | "TIER_4K",
): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/images/batch-enhance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageIds, tier }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);

  // Poll all jobs
  return Promise.all(result.jobIds.map((jobId) => pollJobStatus(jobId)));
}
```

### Referral Program

```typescript
async function getReferralLink(): Promise<{ code: string; url: string }> {
  const response = await fetch(`${API_BASE_URL}/referral/link`);
  const link = await response.json();
  if (!response.ok) throw new Error(link.error);
  return link;
}

async function getReferralStats(): Promise<{
  referralCode: string;
  successfulReferrals: number;
  tokensEarned: number;
}> {
  const response = await fetch(`${API_BASE_URL}/referral/stats`);
  const stats = await response.json();
  if (!response.ok) throw new Error(stats.error);
  return stats;
}
```

## Error Handling

### Standard Error Handler

```typescript
class ApiError extends Error {
  constructor(
    public status: number,
    public data: {
      error: string;
      code?: string;
      title?: string;
      suggestion?: string;
    },
  ) {
    super(data.error);
    this.name = "ApiError";
  }

  getDisplayMessage(): string {
    return this.data.title || this.data.error;
  }

  getSuggestion(): string | undefined {
    return this.data.suggestion;
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }
}

// Usage
try {
  await enhanceImage(imageId, "TIER_2K");
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.getDisplayMessage());
    console.log(error.getSuggestion());

    if (error.isRateLimited()) {
      // Show "Please wait" message
    } else if (error.isUnauthorized()) {
      // Redirect to login
    }
  }
}
```

## Rate Limiting

### Handling Rate Limits

```typescript
async function apiCallWithRetry<T>(
  endpoint: string,
  options: RequestInit = {},
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get("Retry-After") || "60",
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000)
          );
          continue;
        }
      }

      if (!response.ok) {
        const data = await response.json();
        throw new ApiError(response.status, data);
      }

      return response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }

  throw new Error("Max retries exceeded");
}
```

### Rate Limit Headers

Always check these headers in responses:

```typescript
const remaining = response.headers.get("X-RateLimit-Remaining");
const reset = response.headers.get("X-RateLimit-Reset");

if (remaining === "0") {
  const resetTime = new Date(parseInt(reset) * 1000);
  console.log(`Rate limited until ${resetTime}`);
}
```

## TypeScript Examples

### Type-Safe API Client

```typescript
import { Session } from "next-auth";

interface ApiClient {
  tokens: {
    getBalance(): Promise<UserTokenBalance>;
  };
  images: {
    enhance(imageId: string, tier: EnhancementTier): Promise<string>;
    upload(file: File): Promise<Image>;
  };
  albums: {
    create(name: string, privacy: AlbumPrivacy): Promise<Album>;
    addImages(albumId: string, imageIds: string[]): Promise<void>;
  };
  referral: {
    getLink(): Promise<ReferralLink>;
    getStats(): Promise<ReferralStats>;
  };
}

class SpikeClient implements ApiClient {
  private baseUrl: string;
  private session: Session | null;

  constructor(session: Session | null) {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3000/api";
    this.session = session;
  }

  tokens = {
    getBalance: () => this.get<UserTokenBalance>("/tokens/balance"),
  };

  images = {
    enhance: (imageId, tier) =>
      this.post<ImageEnhancementJob>("/images/enhance", { imageId, tier }).then(
        (job) => this.waitForCompletion(job.id),
      ),
    upload: (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return this.post<Image>("/images/upload", formData);
    },
  };

  albums = {
    create: (name, privacy) =>
      this.post<Album>("/albums", { name, privacy }).then((a) => a.id),
    addImages: (albumId, imageIds) =>
      this.post(`/albums/${albumId}/images`, { imageIds }),
  };

  referral = {
    getLink: () => this.get<ReferralLink>("/referral/link"),
    getStats: () => this.get<ReferralStats>("/referral/stats"),
  };

  private async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, "GET");
  }

  private async post<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>(endpoint, "POST", body);
  }

  private async request<T>(
    endpoint: string,
    method: string,
    body?: any,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(response.status, error);
    }

    return response.json();
  }

  private async waitForCompletion(jobId: string): Promise<string> {
    // Implementation here
  }
}

// Usage
const client = new SpikeClient(session);
const balance = await client.tokens.getBalance();
const enhancedId = await client.images.enhance(imageId, "TIER_2K");
```

## Testing

### Unit Test Examples

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("API Client", () => {
  let client: SpikeClient;
  const mockSession = { user: { id: "test-user" } };

  beforeEach(() => {
    client = new SpikeClient(mockSession as any);
    global.fetch = vi.fn();
  });

  it("should get token balance", async () => {
    const mockBalance = { balance: 50, timeUntilNextRegenMs: 900000 };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBalance),
    });

    const balance = await client.tokens.getBalance();
    expect(balance).toEqual(mockBalance);
  });

  it("should handle rate limit errors", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          error: "Rate limit exceeded",
          code: "RATE_LIMIT_EXCEEDED",
        }),
    });

    await expect(client.tokens.getBalance()).rejects.toThrow(
      "Rate limit exceeded",
    );
  });
});
```

### Integration Test Examples

```typescript
describe("Image Enhancement Flow", () => {
  it("should enhance image with token check", async () => {
    // 1. Check balance
    const balance = await client.tokens.getBalance();
    expect(balance).toBeGreaterThanOrEqual(5);

    // 2. Upload image
    const file = new File(["content"], "test.jpg");
    const image = await client.images.upload(file);
    expect(image.id).toBeDefined();

    // 3. Enhance image
    const enhancedId = await client.images.enhance(image.id, "TIER_2K");
    expect(enhancedId).toBeDefined();

    // 4. Verify balance decreased
    const newBalance = await client.tokens.getBalance();
    expect(newBalance).toBeLessThan(balance);
  });
});
```

## Next Steps

1. Review [API Reference](./API_REFERENCE.md) for detailed endpoint
   documentation
2. Check [OpenAPI Specification](./openapi.yaml) for all available schemas
3. Set up error handling and retry logic
4. Implement proper authentication flow
5. Test with development/staging environment first

For support, visit [spike.land](https://spike.land) or contact
hello@spike.land
