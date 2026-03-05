# Public Albums Gallery API

## Table of Contents

- [Overview](#overview)
  - [Use Cases](#use-cases)
  - [Key Characteristics](#key-characteristics)
- [Endpoint](#endpoint)
- [Authentication](#authentication)
- [Features](#features)
- [Response Format](#response-format)
- [Example Response](#example-response)
- [Best Practices](#best-practices)
  - [Frontend Integration](#frontend-integration)
  - [Performance Optimization](#performance-optimization)
  - [Content Strategy](#content-strategy)
  - [Monitoring and Analytics](#monitoring-and-analytics)
- [Usage Examples](#usage-examples)
  - [Client Component (React/Next.js)](#client-component-reactnextjs)
  - [Server Component (React Server Component)](#server-component-react-server-component)
  - [Direct Fetch (JavaScript)](#direct-fetch-javascript)
  - [React Query Integration](#react-query-integration)
  - [SWR Integration](#swr-integration)
  - [Mobile App Integration (React Native)](#mobile-app-integration-react-native)
- [Caching](#caching)
- [Implementation Details](#implementation-details)
  - [Database Query Strategy](#database-query-strategy)
  - [Data Validation](#data-validation)
  - [Database Models](#database-models)
- [Error Responses](#error-responses)
- [Performance Considerations](#performance-considerations)
  - [Query Optimization](#query-optimization)
  - [Response Optimization](#response-optimization)
  - [Caching Strategy](#caching-strategy)
  - [Database Indexes](#database-indexes)
  - [Scalability](#scalability)
- [Security Considerations](#security-considerations)
  - [Public Access](#public-access)
  - [Data Privacy](#data-privacy)
  - [Content Control](#content-control)
  - [CORS Considerations](#cors-considerations)
- [Related Endpoints](#related-endpoints)
- [Testing](#testing)
  - [Test Coverage](#test-coverage)
  - [Test Scenarios](#test-scenarios)
  - [Manual Testing](#manual-testing)
  - [Integration Testing](#integration-testing)
- [Troubleshooting](#troubleshooting)
  - [Empty Response](#empty-response)
  - [404 Error](#404-error)
  - [500 Error](#500-error)
  - [Stale Data](#stale-data)
  - [Performance Issues](#performance-issues)
- [File Locations](#file-locations)
- [Changelog](#changelog)

## Overview

The Public Albums Gallery API endpoint provides access to before/after image
pairs from PUBLIC albums owned by the super admin. This is designed for showcase
galleries on public-facing pages, allowing visitors to see curated examples of
image enhancements without requiring authentication.

### Use Cases

- **Landing Page Gallery**: Showcase best enhancement examples on homepage
- **Marketing Materials**: Display before/after comparisons for promotional use
- **Public Portfolio**: Demonstrate platform capabilities to potential users
- **Social Media Integration**: Fetch images for automated social posts
- **Third-Party Widgets**: Embed gallery in external websites or applications

### Key Characteristics

- Public access (no authentication)
- Curated content (admin-controlled)
- Performance-optimized (CDN cached)
- Limited scope (12 items maximum)
- Quality-assured (only completed enhancements)

## Endpoint

```
GET /api/gallery/public-albums
```

## Authentication

**No authentication required** - This is a public endpoint designed for
anonymous access.

## Features

- Fetches images from PUBLIC albums only (owned by super admin:
  `zolika84@gmail.com`)
- Returns only images with COMPLETED enhancement jobs
- Includes both original and enhanced URLs for before/after comparisons
- Limited to 12 images by default
- Cached for 5 minutes with stale-while-revalidate

## Response Format

```typescript
{
  items: Array<{
    id: string; // Image ID
    title: string; // Image name/title
    originalUrl: string; // URL to original image
    enhancedUrl: string; // URL to enhanced image
    width: number; // Enhanced image width (px)
    height: number; // Enhanced image height (px)
    albumName: string; // Name of the album
    tier: "TIER_1K" | "TIER_2K" | "TIER_4K"; // Enhancement tier used
  }>;
}
```

## Example Response

```json
{
  "items": [
    {
      "id": "clx1234567",
      "title": "Mountain Landscape",
      "originalUrl": "https://pub-xxx.r2.dev/original-image.jpg",
      "enhancedUrl": "https://pub-xxx.r2.dev/enhanced-image.jpg",
      "width": 2000,
      "height": 1600,
      "albumName": "Nature Photography",
      "tier": "TIER_2K"
    }
  ]
}
```

## Best Practices

### Frontend Integration

1. **Respect Cache Headers**: Don't bypass caching mechanisms - they improve
   performance
2. **Handle Empty States**: Always check for empty `items` array and display
   appropriate fallback
3. **Progressive Loading**: Show loading states while fetching data
4. **Error Handling**: Implement proper error handling for network failures
5. **Responsive Images**: Use `srcset` or Next.js Image for optimal image
   loading

### Performance Optimization

1. **Use Server-Side Rendering**: Fetch on server when possible for better SEO
   and initial load
2. **Implement Pagination**: If displaying more than 12 items, fetch from
   multiple sources
3. **Image Optimization**: Lazy load images below the fold
4. **Prefetch on Hover**: Consider prefetching enhanced images on thumbnail
   hover
5. **Monitor Bundle Size**: Avoid importing heavy libraries for simple gallery
   needs

### Content Strategy

1. **Curate Quality**: Only make albums PUBLIC that showcase best results
2. **Regular Updates**: Refresh public albums periodically to keep content fresh
3. **Diverse Examples**: Include various image types and enhancement tiers
4. **Descriptive Names**: Use clear album and image names for better UX
5. **Consistent Aspect Ratios**: Consider aspect ratio consistency for grid
   layouts

### Monitoring and Analytics

1. **Track Usage**: Monitor API calls to understand traffic patterns
2. **Cache Hit Rates**: Review CDN analytics for cache effectiveness
3. **Error Rates**: Set up alerts for elevated 500 error rates
4. **Response Times**: Monitor P95/P99 latencies
5. **User Engagement**: Track which images get the most views/interactions

## Usage Examples

### Client Component (React/Next.js)

```typescript
"use client";

import { useEffect, useState } from "react";

interface GalleryPhoto {
  id: string;
  title: string;
  originalUrl: string;
  enhancedUrl: string;
  width: number;
  height: number;
  albumName: string;
  tier: "TIER_1K" | "TIER_2K" | "TIER_4K";
}

export function PublicGallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGallery() {
      try {
        const response = await fetch("/api/gallery/public-albums");
        const data = await response.json();
        setPhotos(data.items);
      } catch (error) {
        console.error("Failed to fetch gallery:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchGallery();
  }, []);

  if (loading) {
    return <div>Loading gallery...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {photos.map((photo) => (
        <div key={photo.id} className="space-y-2">
          <h3 className="font-semibold">{photo.title}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Before</p>
              <img src={photo.originalUrl} alt={`${photo.title} - Original`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                After ({photo.tier})
              </p>
              <img src={photo.enhancedUrl} alt={`${photo.title} - Enhanced`} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            From album: {photo.albumName}
          </p>
        </div>
      ))}
    </div>
  );
}
```

### Server Component (React Server Component)

```typescript
import Image from "next/image";

async function getPublicGallery() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/gallery/public-albums`, {
    next: { revalidate: 300 }, // Revalidate every 5 minutes
  });

  if (!response.ok) {
    throw new Error("Failed to fetch gallery");
  }

  return response.json();
}

export default async function GalleryPage() {
  const data = await getPublicGallery();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Featured Enhancements</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.items.map((photo) => (
          <div key={photo.id} className="border rounded-lg overflow-hidden">
            <div className="aspect-video relative">
              <Image
                src={photo.enhancedUrl}
                alt={photo.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold">{photo.title}</h3>
              <p className="text-sm text-muted-foreground">
                {photo.albumName} • {photo.tier}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Direct Fetch (JavaScript)

```javascript
fetch("/api/gallery/public-albums")
  .then((response) => response.json())
  .then((data) => {
    console.log(`Loaded ${data.items.length} photos`);
    data.items.forEach((photo) => {
      console.log(
        `${photo.title}: ${photo.originalUrl} → ${photo.enhancedUrl}`,
      );
    });
  })
  .catch((error) => console.error("Error:", error));
```

### React Query Integration

```typescript
import { useQuery } from "@tanstack/react-query";

interface GalleryPhoto {
  id: string;
  title: string;
  originalUrl: string;
  enhancedUrl: string;
  width: number;
  height: number;
  albumName: string;
  tier: "TIER_1K" | "TIER_2K" | "TIER_4K";
}

function usePublicGallery() {
  return useQuery({
    queryKey: ["public-albums-gallery"],
    queryFn: async () => {
      const response = await fetch("/api/gallery/public-albums");
      if (!response.ok) {
        throw new Error("Failed to fetch gallery");
      }
      return response.json() as Promise<{ items: GalleryPhoto[] }>;
    },
    staleTime: 5 * 60 * 1000, // Match server cache (5 minutes)
    gcTime: 10 * 60 * 1000, // Match stale-while-revalidate (10 minutes)
  });
}

// Usage in component
export function GalleryWithQuery() {
  const { data, isLoading, error } = usePublicGallery();

  if (isLoading) return <div>Loading gallery...</div>;
  if (error) return <div>Error loading gallery</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {data?.items.map((photo) => (
        <div key={photo.id}>
          <img src={photo.enhancedUrl} alt={photo.title} />
        </div>
      ))}
    </div>
  );
}
```

### SWR Integration

```typescript
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function GalleryWithSWR() {
  const { data, error, isLoading } = useSWR(
    "/api/gallery/public-albums",
    fetcher,
    {
      refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
      revalidateOnFocus: false, // Don't refetch on window focus
      dedupingInterval: 5 * 60 * 1000, // Dedupe requests within 5 minutes
    },
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Failed to load</div>;

  return (
    <div>
      {data?.items.map((photo) => <div key={photo.id}>{photo.title}</div>)}
    </div>
  );
}
```

### Mobile App Integration (React Native)

```typescript
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, View } from "react-native";

export function PublicGalleryMobile() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://spike.land/api/gallery/public-albums")
      .then((res) => res.json())
      .then((data) => {
        setPhotos(data.items);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch gallery:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <ScrollView>
      {photos.map((photo) => (
        <View key={photo.id}>
          <Image
            source={{ uri: photo.enhancedUrl }}
            style={{ width: photo.width, height: photo.height }}
            resizeMode="contain"
          />
        </View>
      ))}
    </ScrollView>
  );
}
```

## Caching

- **Server-side cache**: 5 minutes (`s-maxage=300`)
- **Stale-while-revalidate**: 10 minutes (`stale-while-revalidate=600` - serves
  stale content while fetching fresh data)
- **Client-side**: Browsers can cache according to Cache-Control headers
- **Next.js revalidation**: 300 seconds (5 minutes) via
  `export const
  revalidate = 300`

## Implementation Details

### Database Query Strategy

The endpoint executes the following query logic:

1. **Find Super Admin**: Queries the `User` table for email `zolika84@gmail.com`
   - Selects only the `id` field for efficiency
   - Returns 404 if not found

2. **Fetch PUBLIC Albums**: Queries `Album` table with:
   - Filter: `userId = superAdmin.id AND privacy = 'PUBLIC'`
   - Includes: Nested `albumImages` with `image` and `enhancementJobs`
   - Order: Albums by `createdAt DESC` (newest first)
   - Order: Images within albums by `sortOrder ASC`

3. **Filter Enhancement Jobs**: For each album image:
   - Only includes jobs with `status = 'COMPLETED'`
   - Orders by `createdAt DESC` to get the most recent
   - Takes only the first (latest) job via `take: 1`

4. **Limit Results**: Stops processing when 12 items are collected

### Data Validation

Images are included in the response only if ALL of the following are true:

- The image has at least one COMPLETED enhancement job
- The latest enhancement job has a valid `enhancedUrl` (not null)
- The latest enhancement job has valid `enhancedWidth` (not null)
- The latest enhancement job has valid `enhancedHeight` (not null)

Images failing any validation check are silently skipped.

### Database Models

The endpoint relies on these Prisma models:

**Album**

```typescript
{
  id: string;           // CUID
  userId: string;       // Owner reference
  name: string;         // Album name
  privacy: AlbumPrivacy; // PRIVATE | UNLISTED | PUBLIC
  albumImages: AlbumImage[]; // Related images
  // ... other fields
}
```

**AlbumImage** (join table)

```typescript
{
  id: string;
  albumId: string;
  imageId: string;
  sortOrder: number; // Display order within album
  addedAt: DateTime;
  album: Album;
  image: EnhancedImage;
}
```

**EnhancedImage**

```typescript
{
  id: string;
  name: string;         // Image title
  originalUrl: string;  // Original image URL
  enhancementJobs: ImageEnhancementJob[];
  // ... other fields
}
```

**ImageEnhancementJob**

```typescript
{
  id: string;
  status: JobStatus; // QUEUED | PROCESSING | COMPLETED | FAILED
  tier: EnhancementTier; // TIER_1K | TIER_2K | TIER_4K
  enhancedUrl: string | null;
  enhancedWidth: number | null;
  enhancedHeight: number | null;
  // ... other fields
}
```

## Error Responses

### Super Admin Not Found (404)

```json
{
  "error": "Super admin user not found"
}
```

### Server Error (500)

```json
{
  "error": "Internal server error"
}
```

## Performance Considerations

### Query Optimization

- **Eager Loading**: Uses Prisma `include` to fetch all related data in a single
  database round-trip, avoiding N+1 query problems
- **Selective Fields**: Super admin query selects only `id` field to minimize
  data transfer
- **Ordered Fetching**: Albums ordered by `createdAt DESC` ensures newest
  content appears first
- **Early Termination**: Stops processing albums once 12 items are collected

### Response Optimization

- **Limited Payload**: Maximum 12 items prevents excessive response sizes
  (typically < 50KB)
- **Efficient Filtering**: Validation happens in application layer after
  database fetch
- **Minimal Transformations**: Direct mapping from database fields to response
  format

### Caching Strategy

- **CDN Edge Caching**: Response cached at Vercel Edge Network for 5 minutes
- **Stale-While-Revalidate**: Serves stale content for up to 10 minutes while
  fetching fresh data
- **Next.js ISR**: Incremental Static Regeneration with 300s revalidation period
- **Client Caching**: Browsers can cache based on `Cache-Control` headers

### Database Indexes

The following indexes ensure fast query performance:

- **Albums**: `(userId, privacy)` - Fast filtering for public albums by owner
- **AlbumImages**: `(albumId, sortOrder)` - Efficient ordering within albums
- **EnhancementJobs**: `(imageId, status, createdAt)` - Quick lookup of
  completed jobs
- **Users**: `email` - Fast super admin lookup

### Scalability

- **Constant Memory**: Fixed 12-item limit prevents memory issues regardless of
  album size
- **Predictable Performance**: Query complexity remains O(n) where n ≤ 12
- **CDN Distribution**: Cached responses served from edge locations closest to
  users

## Security Considerations

### Public Access

- **No Authentication Required**: This endpoint is intentionally public and does
  not require any authentication tokens
- **Read-Only**: GET-only endpoint, cannot modify data
- **Rate Limiting**: Consider implementing rate limiting at CDN/proxy level to
  prevent abuse

### Data Privacy

- **Privacy Filter**: Only returns albums with `privacy = 'PUBLIC'`
- **Owner Restriction**: Only shows albums owned by the super admin account
- **No User Data Exposure**: Response contains only image and album information,
  no user details

### Content Control

- **Admin-Curated**: Content is controlled by making albums PUBLIC (super admin
  only)
- **Quality Assurance**: Only includes images with completed enhancements
  (prevents showing failed/processing images)
- **Manual Curation**: Super admin manually sets album privacy to control what
  appears

### CORS Considerations

- **Cross-Origin Access**: If used from external domains, configure CORS headers
  appropriately
- **CDN Integration**: Response headers allow CDN caching across different
  domains

## Related Endpoints

### Public Endpoints

- `GET /api/gallery` - Featured gallery items (curated by admin)
- `GET /api/gallery/public-albums` - Public albums gallery (this endpoint)

### Authenticated Endpoints

- `GET /api/albums` - List user's own albums (requires authentication)
- `POST /api/albums` - Create a new album (requires authentication)
- `GET /api/albums/[id]` - Get album details (owner or public/unlisted)
- `PATCH /api/albums/[id]` - Update album (requires ownership)
- `DELETE /api/albums/[id]` - Delete album (requires ownership)
- `GET /api/albums/[id]/images` - Get images in album (owner or public/unlisted)
- `POST /api/albums/[id]/enhance` - Enhance all album images (requires
  ownership)

### Admin Endpoints

- `GET /api/admin/gallery/browse` - Browse all images (admin only)

## Testing

### Test Coverage

The endpoint includes comprehensive test coverage with 100% code coverage:

```bash
# Run unit tests
yarn test src/app/api/gallery/public-albums/route.test.ts

# Run with coverage
yarn test:coverage src/app/api/gallery/public-albums/route.test.ts

# Watch mode
yarn test --watch src/app/api/gallery/public-albums/route.test.ts
```

### Test Scenarios

The test suite covers:

1. **Super Admin Not Found (404)**
   - Verifies correct error response when super admin user doesn't exist
   - Validates database query parameters

2. **Empty Albums (200)**
   - Returns empty items array when no public albums exist
   - Confirms correct database query structure

3. **Successful Response (200)**
   - Returns formatted items from public albums with completed enhancements
   - Tests multiple images with different tiers (TIER_2K, TIER_4K)
   - Validates response structure and field mapping

4. **Image Filtering**
   - Skips images without completed enhancement jobs
   - Skips images with incomplete enhanced data (missing URL or dimensions)

5. **Result Limiting**
   - Limits results to exactly 12 items when more are available
   - Tests with 15 mock images to verify limit enforcement

6. **Error Handling (500)**
   - Database connection failures
   - Prisma query errors
   - Proper error logging

7. **Cache Headers**
   - Validates `Cache-Control` header is set correctly
   - Confirms `public, s-maxage=300, stale-while-revalidate=600`

### Manual Testing

```bash
# Test locally
curl http://localhost:3000/api/gallery/public-albums

# Test with headers
curl -i http://localhost:3000/api/gallery/public-albums

# Test on production
curl https://spike.land/api/gallery/public-albums

# Pretty print JSON response
curl -s http://localhost:3000/api/gallery/public-albums | jq '.'
```

### Integration Testing

```typescript
// Example E2E test with Playwright
test("public albums gallery loads correctly", async ({ page }) => {
  const response = await page.goto("/api/gallery/public-albums");
  expect(response?.status()).toBe(200);

  const data = await response?.json();
  expect(data).toHaveProperty("items");
  expect(Array.isArray(data.items)).toBe(true);

  // Verify cache headers
  const cacheControl = response?.headers()["cache-control"];
  expect(cacheControl).toContain("public");
  expect(cacheControl).toContain("s-maxage=300");
});
```

## Troubleshooting

### Empty Response

**Problem**: API returns `{"items": []}`

**Possible Causes**:

1. No public albums exist for super admin
   - **Solution**: Create an album and set `privacy = 'PUBLIC'`

2. Images have no completed enhancement jobs
   - **Solution**: Enhance images in the album or check job status

3. Enhancement jobs missing URL/dimensions
   - **Solution**: Re-run enhancement or check R2 storage

**Debug Steps**:

```bash
# Check if super admin exists
psql $DATABASE_URL -c "SELECT id, email FROM users WHERE email = 'zolika84@gmail.com';"

# Check public albums
psql $DATABASE_URL -c "SELECT id, name, privacy FROM albums WHERE privacy = 'PUBLIC';"

# Check enhancement jobs
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM enhancement_jobs GROUP BY status;"
```

### 404 Error

**Problem**: API returns `{"error": "Super admin user not found"}`

**Cause**: Super admin account (`zolika84@gmail.com`) doesn't exist in database

**Solution**:

```bash
# Create super admin user (development only)
psql $DATABASE_URL -c "INSERT INTO users (id, email, name) VALUES (gen_random_uuid(), 'zolika84@gmail.com', 'Super Admin');"
```

### 500 Error

**Problem**: API returns `{"error": "Internal server error"}`

**Possible Causes**:

1. Database connection failure
2. Prisma query error
3. Database constraint violation

**Debug Steps**:

```bash
# Check server logs
vercel logs --follow

# Check local logs
tail -f .next/server.log

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Stale Data

**Problem**: API returns outdated images after updating albums

**Cause**: CDN/ISR caching

**Solutions**:

1. **Wait for cache expiry**: Maximum 10 minutes (stale-while-revalidate)

2. **Manual revalidation** (Next.js 15):
   ```typescript
   import { revalidatePath } from "next/cache";
   revalidatePath("/api/gallery/public-albums");
   ```

3. **CDN cache purge** (Vercel):
   ```bash
   vercel env pull
   curl -X PURGE https://spike.land/api/gallery/public-albums
   ```

### Performance Issues

**Problem**: Slow response times

**Debug Steps**:

1. **Check database query performance**:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM albums
   WHERE "userId" = '...' AND privacy = 'PUBLIC'
   ORDER BY "createdAt" DESC;
   ```

2. **Monitor database indexes**:
   ```sql
   SELECT tablename, indexname, indexdef
   FROM pg_indexes
   WHERE tablename IN ('albums', 'album_images', 'enhancement_jobs');
   ```

3. **Check CDN cache hit rate**: Review Vercel Analytics

4. **Profile API route**:
   ```typescript
   console.time("database-query");
   const albums = await prisma.album.findMany(...);
   console.timeEnd("database-query");
   ```

## File Locations

- **Route Handler**:
  `/Users/z/Developer/spike-land-ai/spike.land/src/app/api/gallery/public-albums/route.ts`
- **Unit Tests**:
  `/Users/z/Developer/spike-land-ai/spike.land/src/app/api/gallery/public-albums/route.test.ts`
- **Documentation**:
  `/Users/z/Developer/spike-land-ai/spike.land/docs/API_PUBLIC_ALBUMS_GALLERY.md`
- **Database Schema**:
  `/Users/z/Developer/spike-land-ai/spike.land/prisma/schema.prisma`

## Changelog

### Version History

**2025-01-XX** (Current)

- Added comprehensive documentation
- Detailed implementation and data models
- Enhanced security and performance sections
- Added troubleshooting guide

**2024-XX-XX** (Initial)

- Initial endpoint implementation
- Basic caching strategy
- Core query logic
