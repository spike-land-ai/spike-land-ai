# SEO Best Practices for Next.js Applications

A comprehensive guide to optimizing Next.js applications for search engines,
covering technical SEO, performance, content optimization, and indexing
strategies.

## Table of Contents

1. [Technical SEO](#technical-seo)
2. [Performance & Core Web Vitals](#performance--core-web-vitals)
3. [Content SEO & Structured Data](#content-seo--structured-data)
4. [URL Structure & Redirects](#url-structure--redirects)
5. [Social Media Integration](#social-media-integration)
6. [Indexing & Search Console](#indexing--search-console)
7. [Mobile SEO](#mobile-seo)
8. [SEO Audit Checklist](#seo-audit-checklist)
9. [Tools & Resources](#tools--resources)

---

## Technical SEO

### 1. Metadata API (Next.js 13+)

The Metadata API is the cornerstone of SEO in Next.js. It provides a type-safe
way to define metadata for pages and layouts.

#### Static Metadata

Export a `metadata` object from `layout.tsx` or `page.tsx`:

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Title",
  description: "Page description - keep between 120-160 characters",
  keywords: ["keyword1", "keyword2"],
  authors: [{ name: "Your Name", url: "https://yoursite.com" }],
  canonical: "https://yoursite.com/page",
};

export default function Page() {
  return <h1>Page content</h1>;
}
```

**Best Practices:**

- Title: 50-60 characters for full visibility in search results
- Description: 120-160 characters, action-oriented language
- Include primary keywords naturally
- Each page should have unique metadata

#### Dynamic Metadata

Use `generateMetadata` function for dynamic pages (blogs, products, etc.):

```typescript
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url: `https://yoursite.com/blog/${id}`,
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default async function BlogPost({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);
  return <article>{/* Content */}</article>;
}
```

#### Title Templates

Create consistent titles across your site:

```typescript
export const metadata: Metadata = {
  title: {
    template: "%s | My Site",
    default: "My Site - Your Home for [Service]",
  },
  description: "Your site description",
};
```

This automatically appends "| My Site" to all child page titles.

### 2. Sitemap Generation

#### Using Next.js Built-in API (Recommended)

Create `app/sitemap.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://yoursite.com",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: "https://yoursite.com/blog",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://yoursite.com/pricing",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
```

#### Dynamic Sitemap with Database

For sites with many pages (blogs, products):

```typescript
import { db } from "@/lib/db";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Get all blog posts
  const posts = await db.post.findMany({
    select: { slug: true, updatedAt: true },
  });

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://yoursite.com/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: "https://yoursite.com",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
  ];

  return [...baseEntries, ...postEntries];
}
```

**Important:** Google ignores sitemaps with more than 50,000 entries. For large
sites, create multiple sitemaps with a sitemap index.

### 3. Robots.txt Configuration

Create `app/robots.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/private/", "/admin/", "/dashboard/"],
      },
      {
        userAgent: "AdsBot-Google",
        allow: "/",
      },
    ],
    sitemap: "https://yoursite.com/sitemap.xml",
  };
}
```

**Best Practices:**

- Block admin/private areas from crawling
- Include sitemap URL
- Restrict bot access if needed
- Be consistent with `.htaccess` rules (if applicable)

---

## Performance & Core Web Vitals

Core Web Vitals are critical ranking factors. Google measures three key metrics:

### 1. Largest Contentful Paint (LCP)

**Target:** < 2.5 seconds

Measures loading performance - time until the largest visible element renders.

**Optimization Strategies:**

```typescript
// 1. Use Next.js Image Component
import Image from "next/image";

export default function ProductCard() {
  return (
    <div>
      <Image
        src="/product.jpg"
        alt="Product"
        width={600}
        height={400}
        priority // Use for above-the-fold images
      />
    </div>
  );
}
```

**Image Optimization Tips:**

- Use `priority` prop for above-the-fold images
- Use modern formats: WebP with JPEG fallback
- Resize images to actual display size
- Lazy load images below the fold (default behavior)
- Use responsive image sizes with `sizes` prop:

```typescript
<Image
  src="/responsive-image.jpg"
  alt="Responsive"
  width={1200}
  height={600}
  sizes="(max-width: 768px) 100vw,
         (max-width: 1200px) 50vw,
         33vw"
/>;
```

**Script Loading Optimization:**

```typescript
import Script from "next/script";

export default function Analytics() {
  return (
    <>
      {/* Defer non-critical scripts */}
      <Script
        src="https://analytics.example.com/track.js"
        strategy="lazyOnload"
      />

      {/* Load critical scripts after interactive */}
      <Script
        src="https://critical-vendor.js"
        strategy="afterInteractive"
      />
    </>
  );
}
```

**Font Loading:**

```typescript
import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  preload: true, // Preload for critical fonts
});

export default function RootLayout() {
  return (
    <html className={geistMono.className}>
      <body>{/* Content */}</body>
    </html>
  );
}
```

### 2. Interaction to Next Paint (INP)

**Target:** < 200 milliseconds

Measures responsiveness to user interactions (clicks, taps, keyboard).

**Optimization Strategies:**

```typescript
// 1. Minimize JavaScript with Server Components
export default function Page() {
  // This runs on the server, not sent to browser
  return <ClientComponent data={fetchedData} />;
}

// 2. Use dynamic imports for non-critical JS
import dynamic from "next/dynamic";

const HeavyComponent = dynamic(
  () => import("@/components/HeavyComponent"),
  { loading: () => <div>Loading...</div> },
);

export default function Page() {
  return <HeavyComponent />;
}

// 3. Debounce expensive operations
import { debounce } from "lodash";
import { useCallback, useState } from "react";

export default function SearchInput() {
  const [results, setResults] = useState([]);

  const handleSearch = useCallback(
    debounce((query: string) => {
      // Expensive search operation
      fetch(`/api/search?q=${query}`)
        .then((res) => res.json())
        .then(setResults);
    }, 300),
    [],
  );

  return (
    <input
      type="text"
      onChange={(e) => handleSearch(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### 3. Cumulative Layout Shift (CLS)

**Target:** < 0.1

Measures visual stability - unexpected layout changes during page load.

**Optimization Strategies:**

```typescript
// 1. Set fixed dimensions on media
<Image
  src="/image.jpg"
  alt="Fixed size"
  width={300} // Always set dimensions
  height={200}
/>

// 2. Reserve space for ads and embeds
<div className="ad-container" style={{ minHeight: '250px' }}>
  <Script src="//ad-script.js" strategy="lazyOnload" />
</div>

// 3. Use transforms for animations (no layout recalculation)
<div className="animate-slide">
  Content that slides
</div>

// CSS - transforms are GPU accelerated
.animate-slide {
  animation: slide 0.3s ease-out;
}

@keyframes slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

// 4. Avoid animating width/height/margin
// BAD - causes layout shift
@keyframes bad {
  from { width: 0; }
  to { width: 100%; }
}

// GOOD - uses transform
@keyframes good {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

// 5. Use font-display: swap for web fonts
// In globals.css or font declaration
@font-face {
  font-family: 'CustomFont';
  src: url('/font.woff2') format('woff2');
  font-display: swap; // Show fallback immediately
}
```

**Measuring Core Web Vitals:**

```typescript
// app/components/WebVitals.tsx
"use client";

import { useEffect } from "react";
import { getCLS, getFCP, getFID, getLCP, getTTFB } from "web-vitals";

export function WebVitals() {
  useEffect(() => {
    getCLS(console.log);
    getFID(console.log);
    getFCP(console.log);
    getLCP(console.log);
    getTTFB(console.log);
  }, []);

  return null;
}
```

---

## Content SEO & Structured Data

### 1. JSON-LD Structured Data

Implement JSON-LD for rich snippets and better SERP appearance.

#### Product Schema

```typescript
import type { Product, WithContext } from "schema-dts";

export default async function ProductPage({ params }: Props) {
  const product = await getProduct(params.id);

  const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    offers: {
      "@type": "Offer",
      url: `https://yoursite.com/products/${product.id}`,
      priceCurrency: "USD",
      price: product.price.toString(),
      availability: "https://schema.org/InStock",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating.average,
      reviewCount: product.rating.count,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* Product content */}
    </>
  );
}
```

#### Article Schema

```typescript
import type { Article, WithContext } from "schema-dts";

export default async function BlogPost({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);

  const jsonLd: WithContext<Article> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      "@type": "Person",
      name: post.author.name,
      url: post.author.website,
    },
    publisher: {
      "@type": "Organization",
      name: "Your Site Name",
      logo: {
        "@type": "ImageObject",
        url: "https://yoursite.com/logo.png",
      },
    },
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* Article content */}
    </article>
  );
}
```

#### Organization Schema

```typescript
// app/layout.tsx
import type { Organization, WithContext } from "schema-dts";

const organizationSchema: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Your Company",
  description: "What your company does",
  url: "https://yoursite.com",
  logo: "https://yoursite.com/logo.png",
  sameAs: [
    "https://www.facebook.com/yourcompany",
    "https://twitter.com/yourcompany",
    "https://www.linkedin.com/company/yourcompany",
  ],
  contact: {
    "@type": "ContactPoint",
    contactType: "Customer Support",
    email: "support@yoursite.com",
    telephone: "+1-800-555-0100",
  },
};

export default function RootLayout() {
  return (
    <html>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>{/* Content */}</body>
    </html>
  );
}
```

**Security Tip:** Always sanitize JSON-LD to prevent XSS attacks:

```typescript
const sanitizedJson = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
```

### 2. FAQ Schema

```typescript
import type { FAQPage, WithContext } from "schema-dts";

const faqSchema: WithContext<FAQPage> = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Next.js?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Next.js is a React framework for production that enables...",
      },
    },
    {
      "@type": "Question",
      name: "Is Next.js free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Next.js is completely free and open source.",
      },
    },
  ],
};
```

### 3. Content Best Practices

**For AI Engine Optimization (AEO):**

- Use clear FAQ sections with direct answers
- Structure content with headers (H1, H2, H3)
- Write concise, scannable content
- Include keywords naturally without stuffing
- Target long-tail keywords and questions
- Provide comprehensive answers that answer AI queries

**Content Structure:**

```typescript
export default function BlogPost() {
  return (
    <article>
      <h1>Main Topic (H1 - use once per page)</h1>

      <section>
        <h2>First Subsection</h2>
        <p>Introduction paragraph</p>

        <h3>More Specific Topic</h3>
        <p>Detailed content</p>
      </section>

      <section>
        <h2>FAQ Section</h2>
        <details>
          <summary>Question 1</summary>
          <p>Direct answer to the question</p>
        </details>
        <details>
          <summary>Question 2</summary>
          <p>Another answer</p>
        </details>
      </section>
    </article>
  );
}
```

---

## URL Structure & Redirects

### 1. URL Best Practices

**Good URL Structure:**

```
https://yoursite.com/blog/seo-best-practices
https://yoursite.com/products/category/product-name
https://yoursite.com/docs/getting-started
```

**Avoid:**

```
https://yoursite.com/page?id=123&type=blog
https://yoursite.com/b/a1B2c3
https://yoursite.com/content/2024/12/06/post
```

**Rules:**

- Keep URLs short and readable
- Use hyphens to separate words (not underscores)
- Use lowercase letters
- Include primary keywords
- Avoid unnecessary parameters
- Use consistent structure

### 2. Canonical URLs

For dynamic routes, always specify canonical URLs:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  return {
    canonical: `https://yoursite.com/blog/${slug}`,
    // ... other metadata
  };
}
```

For complex cases with parameters:

```typescript
// If you have pages with multiple URLs pointing to same content
export const metadata: Metadata = {
  alternates: {
    canonical: "https://yoursite.com/canonical-path",
  },
};
```

### 3. URL Redirects

**Permanent Redirects (301):**

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects: async () => {
    return [
      {
        source: "/old-page",
        destination: "/new-page",
        permanent: true, // 301 redirect
      },
      {
        source: "/old-blog/:slug",
        destination: "/articles/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
```

**Temporary Redirects (302):**

```typescript
redirects: (async () => {
  return [
    {
      source: "/sale",
      destination: "/special-offer",
      permanent: false, // 302 redirect
    },
  ];
});
```

### 4. Multi-language Canonical URLs

For sites with multiple language versions:

```typescript
export const metadata: Metadata = {
  alternates: {
    languages: {
      "en-US": "https://yoursite.com/en/blog/post",
      "es-ES": "https://yoursite.es/es/blog/post",
      "fr-FR": "https://yoursite.fr/fr/blog/post",
      "x-default": "https://yoursite.com/blog/post",
    },
  },
};
```

---

## Social Media Integration

### 1. OpenGraph Tags

OpenGraph tags control how content appears when shared on social media.

```typescript
export const metadata: Metadata = {
  openGraph: {
    type: 'article',
    locale: 'en_US',
    url: 'https://yoursite.com/article',
    title: 'Article Title',
    description: 'Article description that appears in preview',
    images: [
      {
        url: 'https://yoursite.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OG Image Alt Text',
      },
    ],
    siteName: 'Your Site Name',
  ],
}
```

**Image Dimensions:**

- Facebook: 1200x630px (recommended)
- LinkedIn: 1200x627px
- Twitter: 1200x630px (for summary_large_image)

### 2. Twitter Card Tags

```typescript
export const metadata: Metadata = {
  twitter: {
    card: "summary_large_image",
    title: "Tweet Title (max 70 chars)",
    description: "Tweet description (max 200 chars)",
    creator: "@yourhandle",
    images: ["https://yoursite.com/twitter-image.png"],
  },
};
```

**Card Types:**

- `summary`: Small card with title and description
- `summary_large_image`: Large card with image
- `player`: For video/audio content
- `app`: For mobile apps

### 3. Dynamic OG Image Generation

Generate dynamic images for each post using `@vercel/og`:

```typescript
// app/api/og/route.ts
import { ImageResponse } from "next/og";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "Default Title";
  const author = searchParams.get("author") || "Your Site";

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          textAlign: "center",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: 60, marginTop: 40 }}>
          {title}
        </div>
        <div style={{ fontSize: 30, color: "#666", marginTop: 20 }}>
          By {author}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
```

Use in metadata:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  return {
    openGraph: {
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(post.title)}&author=${
            encodeURIComponent(post.author)
          }`,
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}
```

### 4. Testing Social Cards

**Tools:**

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://developer.twitter.com/en/docs/twitter-for-websites/cards/guides/getting-started)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

---

## Indexing & Search Console

### 1. Google Search Console Setup

**Step 1: Create Property**

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Click "Add Property"
3. Enter your website URL
4. Choose verification method:
   - TXT record (recommended for DNS access)
   - Meta tag
   - HTML file upload
   - Google Analytics
   - Google Tag Manager

**Step 2: Verify Domain**

For DNS verification:

```dns
your-verification-code.acme.com TXT v=spf1 google-site-verification=your-token-here
```

For HTML meta tag:

```html
<meta name="google-site-verification" content="your-token-here" />
```

**Step 3: Submit Sitemap**

1. In GSC, go to "Sitemaps"
2. Enter: `https://yoursite.com/sitemap.xml`
3. Click "Submit"

### 2. Indexing Strategy

**Static Site Generation (SSG) - Best for SEO**

Pre-rendered pages are crawled 3x faster:

```typescript
// app/blog/[slug]/page.tsx
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export const revalidate = 3600; // Revalidate every hour

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  return <article>{/* Content */}</article>;
}
```

**Server-Side Rendering (SSR) - When Dynamic**

Use when content changes frequently:

```typescript
export const revalidate = 0; // No caching
// or
export const dynamic = "force-dynamic";

export default async function DynamicPage({ params }: Props) {
  const data = await fetchFreshData();
  return <div>{/* Content */}</div>;
}
```

**Incremental Static Regeneration (ISR)**

Balance between static and dynamic:

```typescript
export const revalidate = 60; // Revalidate every 60 seconds

export default async function Page({ params }: Props) {
  const data = await fetchData();
  return <div>{/* Content */}</div>;
}
```

### 3. Google Indexing API

For faster indexing of newly published content:

```typescript
// lib/indexing-api.ts
async function notifyGoogle(urls: string[]) {
  const accessToken = await getAccessToken();

  for (const url of urls) {
    await fetch("https://indexing.googleapis.com/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requests: [
          {
            url: url,
            type: "URL_UPDATED",
          },
        ],
      }),
    });
  }
}
```

**Usage:**

```typescript
// app/api/publish/route.ts
export async function POST(request: Request) {
  const { postId, slug } = await request.json();

  // Save post
  const post = await savePost(postId, slug);

  // Notify Google
  await notifyGoogle([`https://yoursite.com/blog/${slug}`]);

  return Response.json({ success: true });
}
```

### 4. Handling Duplicate Content

**Method 1: Canonical Tags**

```typescript
export const metadata: Metadata = {
  alternates: {
    canonical: "https://yoursite.com/preferred-url",
  },
};
```

**Method 2: Robots Meta Tag**

```typescript
export const metadata: Metadata = {
  robots: {
    index: false, // Don't index this URL
    follow: true, // But follow links
  },
};
```

**Method 3: Redirects**

```typescript
// next.config.ts
redirects: (async () => {
  return [
    {
      source: "/duplicate-page",
      destination: "/canonical-page",
      permanent: true,
    },
  ];
});
```

### 5. Handling Unwanted URLs

Prevent indexing of private or duplicate content:

```typescript
// app/admin/page.tsx
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// Or in next.config.ts - robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/admin/", "/private/", "/tmp/"],
    },
  };
}
```

---

## Mobile SEO

### 1. Responsive Design

Next.js works perfectly with Tailwind CSS for responsive design:

```typescript
export default function ResponsiveComponent() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Automatically adapts: 1 col on mobile, 2 on tablet, 4 on desktop */}
      <Card />
      <Card />
      <Card />
      <Card />
    </div>
  );
}
```

**Mobile-First Approach:**

```typescript
// Design for mobile first, enhance for larger screens
<div className="text-sm md:text-base lg:text-lg">
  Text scales appropriately
</div>

<Image
  src="/responsive-image.jpg"
  alt="Responsive"
  width={1200}
  height={600}
  sizes="(max-width: 640px) 100vw,
         (max-width: 1024px) 50vw,
         33vw"
/>
```

### 2. Mobile Performance

**Lighthouse Mobile Target:**

- Largest Contentful Paint: < 2.5s
- First Input Delay: < 100ms (now INP < 200ms)
- Cumulative Layout Shift: < 0.1

**Optimization Checklist:**

- Image optimization (WebP format, lazy loading)
- Critical CSS inlining
- Defer non-critical JavaScript
- Minimize HTTP requests
- Enable compression (gzip/brotli)
- Use service workers for caching

```typescript
// Enable compression in next.config.ts
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig = {
  compress: true,
  // other config
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);
```

### 3. Mobile-First Indexing

Google crawls the mobile version first:

```typescript
// Ensure same content on mobile and desktop
export const metadata: Metadata = {
  // Use detailed descriptions
  description: "Detailed content description for all devices",
  // Ensure same canonical
  alternates: {
    canonical: "https://yoursite.com/page",
  },
};

export default function Page() {
  return (
    <div>
      {/* Same content for all viewports */}
      {/* Don't hide important info behind mobile-only toggles */}
      <Content />
    </div>
  );
}
```

**Don'ts:**

- Don't hide important content on mobile
- Don't simplify content for mobile users
- Don't use different URLs for mobile/desktop
- Don't use mobile-only redirects

### 4. Viewport Meta Tag

Automatically included in Next.js, but ensure proper setup:

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};
```

---

## SEO Audit Checklist

### On-Page SEO

- [ ] **Title Tags**
  - [ ] 50-60 characters
  - [ ] Includes primary keyword
  - [ ] Unique per page
  - [ ] Compelling copy

- [ ] **Meta Descriptions**
  - [ ] 120-160 characters
  - [ ] Action-oriented language
  - [ ] Includes target keywords
  - [ ] Unique per page

- [ ] **Headings (H1-H6)**
  - [ ] One H1 per page
  - [ ] Logical hierarchy
  - [ ] Keywords included naturally
  - [ ] Descriptive text

- [ ] **Content Quality**
  - [ ] Original content
  - [ ] Solves user problems
  - [ ] Proper formatting
  - [ ] Adequate length (300+ words)
  - [ ] Internal links (3-5 per page)

- [ ] **URL Structure**
  - [ ] Descriptive, keyword-relevant
  - [ ] Uses hyphens (not underscores)
  - [ ] Lowercase
  - [ ] Under 75 characters

### Technical SEO

- [ ] **Site Architecture**
  - [ ] Logical structure
  - [ ] Max 3 clicks to any page
  - [ ] Clear navigation
  - [ ] Breadcrumbs on deep pages

- [ ] **Mobile Friendliness**
  - [ ] Responsive design
  - [ ] Fast mobile performance
  - [ ] Touch-friendly buttons
  - [ ] Readable text sizes

- [ ] **Performance Metrics**
  - [ ] LCP < 2.5 seconds
  - [ ] INP < 200 milliseconds
  - [ ] CLS < 0.1
  - [ ] TTFB < 600ms

- [ ] **Indexing**
  - [ ] Sitemap.xml submitted
  - [ ] robots.txt configured
  - [ ] No crawl errors
  - [ ] Correct canonical tags

- [ ] **Structured Data**
  - [ ] JSON-LD implemented
  - [ ] Schema.org validation passed
  - [ ] Rich snippets appear in results
  - [ ] No structured data errors

### Content & Links

- [ ] **Content Quality**
  - [ ] No duplicate content
  - [ ] Fresh content (updated regularly)
  - [ ] FAQ sections included
  - [ ] Content matches search intent

- [ ] **Internal Linking**
  - [ ] Links use descriptive anchor text
  - [ ] No orphan pages
  - [ ] Links to important pages
  - [ ] Logical link distribution

- [ ] **Backlinks**
  - [ ] Quality over quantity
  - [ ] Relevant domains
  - [ ] Natural anchor text
  - [ ] No spammy links

### Social & Branding

- [ ] **Social Media Tags**
  - [ ] OpenGraph tags present
  - [ ] Twitter cards configured
  - [ ] Correct image dimensions
  - [ ] Tested sharing

- [ ] **Branding**
  - [ ] Consistent business name
  - [ ] Logo visible
  - [ ] Contact information available
  - [ ] About page present

### Tools Integration

- [ ] **Google Search Console**
  - [ ] Property verified
  - [ ] Sitemap submitted
  - [ ] No critical errors
  - [ ] Coverage monitored

- [ ] **Google Analytics**
  - [ ] Properly implemented
  - [ ] Goals configured
  - [ ] Real user data collected

- [ ] **Monitoring**
  - [ ] Ranking tracked
  - [ ] Traffic monitored
  - [ ] Alerts configured
  - [ ] Regular audits scheduled

---

## Tools & Resources

### Official Documentation

- [Next.js SEO Guide](https://nextjs.org/learn/seo/introduction-to-seo)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Google Search Central](https://developers.google.com/search)
- [Google Search Console](https://search.google.com/search-console)

### Performance Measurement Tools

- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [Lighthouse (Chrome DevTools)](https://developers.google.com/web/tools/lighthouse)
- [Web Vitals Chrome Extension](https://chrome.google.com/webstore/detail/web-vitals/ahfhijdlegdabablpippeac/)
- [GTmetrix](https://gtmetrix.com/)
- [WebPageTest](https://www.webpagetest.org/)

### SEO Analysis Tools

- [Ahrefs SEO Toolbar](https://ahrefs.com/toolbar)
- [MozBar SEO Toolbar](https://moz.com/tools/seo-toolbar)
- [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/)
- [SEMrush](https://www.semrush.com/)

### Content & Markup Validation

- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema Markup Validator](https://validator.schema.org/)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://developer.twitter.com/en/docs/twitter-for-websites/cards/guides/getting-started)

### Popular Next.js SEO Libraries

- [next-seo](https://github.com/garmeeh/next-seo) - Simplified SEO management
- [schema-dts](https://www.npmjs.com/package/schema-dts) - TypeScript schema
  definitions
- [next-sitemap](https://www.npmjs.com/package/next-sitemap) - Advanced sitemap
  generation
- [serialize-javascript](https://www.npmjs.com/package/serialize-javascript) -
  Safe JSON serialization

### Key Metrics & Targets (2025)

| Metric                          | Target       | Tool                           |
| ------------------------------- | ------------ | ------------------------------ |
| LCP (Largest Contentful Paint)  | < 2.5s       | PageSpeed Insights, Lighthouse |
| INP (Interaction to Next Paint) | < 200ms      | PageSpeed Insights, Lighthouse |
| CLS (Cumulative Layout Shift)   | < 0.1        | PageSpeed Insights, Lighthouse |
| TTFB (Time to First Byte)       | < 600ms      | WebPageTest, Lighthouse        |
| Core Web Vitals Score           | Green (Good) | Google Search Console          |

---

## Best Practices Summary

### Do's ✅

- Use Next.js's built-in SEO features (Metadata API, Image component, etc.)
- Implement structured data (JSON-LD) for rich snippets
- Generate dynamic metadata for dynamic pages
- Use Server Components to reduce client JavaScript
- Optimize images with `next/image`
- Implement dynamic sitemap generation
- Compress content (gzip/brotli)
- Use ISR for frequently updated content
- Set up Google Search Console and monitor crawl stats
- Target long-tail keywords and answer user questions
- Build for mobile-first experience

### Don'ts ❌

- Don't use only Client Components for SEO-critical pages
- Don't hide important content from search engines
- Don't use `<meta name="robots" content="noindex">` unless intentional
- Don't have duplicate content without canonical tags
- Don't bloat images or use wrong formats
- Don't implement lazy loading on above-the-fold content
- Don't ignore Core Web Vitals metrics
- Don't stuff keywords unnaturally
- Don't create thin content with little value
- Don't redirect mobile users to different content
- Don't ignore mobile-first indexing

---

## References

1. [Next.js 15 SEO Best Practices - DEV Community](https://dev.to/joodi/maximizing-seo-with-meta-data-in-nextjs-15-a-comprehensive-guide-4pa7)
2. [Core Web Vitals Overview - Google Developers](https://developers.google.com/search/docs/appearance/core-web-vitals)
3. [Next.js JSON-LD Guide - Official Docs](https://nextjs.org/docs/app/guides/json-ld)
4. [Mobile-First Indexing Best Practices - Google Search Central](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing)
5. [Canonical URL SEO Guide - Web Peak](https://webpeak.org/blog/nextjs-dynamic-route-seo-best-practices/)
6. [OpenGraph & Twitter Cards - Next.js Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
7. [Vercel Core Web Vitals Optimization Guide](https://vercel.com/kb/guide/optimizing-core-web-vitals-in-2024)
8. [Next.js Crawling and Indexing - Next.js Learn](https://nextjs.org/learn/seo/crawling-and-indexing)

---

**Last Updated:** December 6, 2025 **Next.js Version:** 15+ **Status:** Complete
& Current
