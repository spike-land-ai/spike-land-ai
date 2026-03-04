# SEO Best Practices Quick Reference

Quick links to key sections in the comprehensive SEO guide for Next.js
applications.

## Quick Navigation

### Core Fundamentals

- **[Metadata API](seo-nextjs.md#1-metadata-api-nextjs-13)** - Title,
  description, canonical tags
- **[Sitemap Generation](seo-nextjs.md#2-sitemap-generation)** - Static and
  dynamic sitemaps
- **[robots.txt](seo-nextjs.md#3-robotstxt-configuration)** - Search engine
  crawling rules

### Performance (Critical for Ranking)

- **[Core Web Vitals Overview](seo-nextjs.md#performance--core-web-vitals)** -
  LCP, INP, CLS targets
- **[LCP Optimization](seo-nextjs.md#1-largest-contentful-paint-lcp)** - Image &
  script optimization
- **[CLS Prevention](seo-nextjs.md#3-cumulative-layout-shift-cls)** - Layout
  stability techniques
- **[INP Improvements](seo-nextjs.md#2-interaction-to-next-paint-inp)** -
  Responsiveness optimization

### Content & Schema

- **[JSON-LD Implementation](seo-nextjs.md#1-json-ld-structured-data)** -
  Product, article, organization
- **[FAQ Schema](seo-nextjs.md#2-faq-schema)** - Answer engine optimization
- **[Content Best Practices](seo-nextjs.md#3-content-best-practices)** -
  SEO-friendly content writing

### URLs & Redirects

- **[URL Structure](seo-nextjs.md#1-url-best-practices)** - Keyword-rich, clean
  URLs
- **[Canonical Tags](seo-nextjs.md#2-canonical-urls)** - Duplicate content
  handling
- **[Redirects](seo-nextjs.md#3-url-redirects)** - 301 and 302 redirect setup
- **[Multi-language URLs](seo-nextjs.md#4-multi-language-canonical-urls)** -
  hreflang implementation

### Social Media

- **[OpenGraph Tags](seo-nextjs.md#1-opengraph-tags)** - Facebook, LinkedIn
  sharing
- **[Twitter Cards](seo-nextjs.md#2-twitter-card-tags)** - X/Twitter sharing
- **[Dynamic OG Images](seo-nextjs.md#3-dynamic-og-image-generation)** -
  AI-generated social cards

### Search Console & Indexing

- **[GSC Setup](seo-nextjs.md#1-google-search-console-setup)** - Verification
  and configuration
- **[Indexing Strategy](seo-nextjs.md#2-indexing-strategy)** - SSG, SSR, ISR
  decisions
- **[Google Indexing API](seo-nextjs.md#3-google-indexing-api)** - Fast indexing
  of new content
- **[Duplicate Content Handling](seo-nextjs.md#4-handling-duplicate-content)** -
  Canonical, noindex, redirects

### Mobile & Responsive

- **[Responsive Design](seo-nextjs.md#1-responsive-design)** - Mobile-first
  approach
- **[Mobile Performance](seo-nextjs.md#2-mobile-performance)** - Mobile-specific
  optimization
- **[Mobile-First Indexing](seo-nextjs.md#3-mobile-first-indexing)** - Google's
  mobile priority
- **[Viewport Configuration](seo-nextjs.md#4-viewport-meta-tag)** - Device width
  settings

### Verification & Tools

- **[SEO Audit Checklist](seo-nextjs.md#seo-audit-checklist)** - 140+
  verification points
- **[Tools & Resources](seo-nextjs.md#tools--resources)** - Testing and analysis
  tools
- **[Best Practices Summary](seo-nextjs.md#best-practices-summary)** - Do's and
  Don'ts

---

## Most Requested Topics

### "How do I improve my search ranking?"

1. Ensure Core Web Vitals are green (< 2.5s LCP, < 200ms INP, < 0.1 CLS)
2. Implement structured data (JSON-LD) for rich snippets
3. Create quality content that answers user questions
4. Build internal links naturally
5. Submit sitemap to Google Search Console

### "How do I generate dynamic Open Graph images?"

See [Dynamic OG Image Generation](seo-nextjs.md#3-dynamic-og-image-generation)
using `@vercel/og`

### "How do I optimize images for SEO?"

See [LCP Optimization](seo-nextjs.md#1-largest-contentful-paint-lcp) - use
`next/image` with proper sizing

### "What's the difference between SSG and SSR for SEO?"

See [Indexing Strategy](seo-nextjs.md#2-indexing-strategy) - SSG is 3x faster to
crawl

### "How do I handle duplicate content?"

See [Handling Duplicate Content](seo-nextjs.md#4-handling-duplicate-content) - 3
methods explained

### "How do I set up Google Search Console?"

See [GSC Setup](seo-nextjs.md#1-google-search-console-setup) - Step-by-step
instructions

---

## Code Snippet Index

### Metadata

```typescript
// Static metadata
export const metadata: Metadata = { ... }

// Dynamic metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> { ... }

// Title template
metadata: {
  title: { template: '%s | My Site', default: 'My Site' }
}
```

### Sitemap

```typescript
// app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap { ... }
```

### Robots

```typescript
// app/robots.ts
export default function robots(): MetadataRoute.Robots { ... }
```

### JSON-LD

```typescript
const jsonLd = { '@context': 'https://schema.org', '@type': 'Product', ... }
// Render in <script type="application/ld+json">
```

### Image Optimization

```typescript
<Image
  src="/image.jpg"
  alt="Alt text"
  width={1200}
  height={630}
  priority // For above-the-fold
  sizes="(max-width: 768px) 100vw, 50vw"
/>;
```

### Script Loading

```typescript
<Script
  src="analytics.js"
  strategy="lazyOnload" // For non-critical scripts
/>;
```

---

## Performance Targets (2025)

| Metric | Target             | Status |
| ------ | ------------------ | ------ |
| LCP    | < 2.5 seconds      | Green  |
| INP    | < 200 milliseconds | Green  |
| CLS    | < 0.1              | Green  |
| TTFB   | < 600 milliseconds | Good   |

---

## Google Search Console Checklist

- [ ] Verify property (TXT, meta tag, or Analytics)
- [ ] Submit XML sitemap
- [ ] Check coverage for errors/warnings
- [ ] Review crawl statistics
- [ ] Monitor core web vitals report
- [ ] Set up email alerts
- [ ] Review security issues (if any)
- [ ] Check mobile usability

---

## Audit Checklist Quick Tasks

**Before Launch:**

- [ ] Title: 50-60 characters, includes keyword
- [ ] Description: 120-160 characters, unique
- [ ] Heading structure: One H1, proper hierarchy
- [ ] Images: Optimized with alt text
- [ ] Mobile: Responsive, fast loading
- [ ] Core Web Vitals: All green
- [ ] Structured data: Validated with Google Rich Results Test
- [ ] Sitemap: Generated and submitted
- [ ] robots.txt: Configured and accessible
- [ ] Canonical tags: Present on all pages

**After Launch:**

- [ ] Google Search Console: Indexed and crawlable
- [ ] Google Analytics: Tracking working
- [ ] OpenGraph/Twitter: Tested with share preview
- [ ] Mobile: Tested on actual devices
- [ ] Performance: Lighthouse score > 80
- [ ] Ranking: Track for target keywords

---

## Common Issues & Fixes

**Problem: Pages not indexed**

- Solution: Submit sitemap to GSC, check robots.txt not blocking
- Reference: [Indexing Strategy](seo-nextjs.md#2-indexing-strategy)

**Problem: Poor Core Web Vitals**

- Solution: Optimize images, defer scripts, fix layout shifts
- Reference: [Core Web Vitals](seo-nextjs.md#performance--core-web-vitals)

**Problem: No rich snippets**

- Solution: Implement JSON-LD structured data, validate
- Reference: [JSON-LD Implementation](seo-nextjs.md#1-json-ld-structured-data)

**Problem: Low social media engagement**

- Solution: Add OpenGraph and Twitter card tags, test sharing
- Reference: [Social Media Integration](seo-nextjs.md#social-media-integration)

**Problem: Duplicate content issues**

- Solution: Add canonical tags, set preferred domain
- Reference: [Canonical URLs](seo-nextjs.md#2-canonical-urls)

---

## Resources & Tools

### Official Documentation

- [Next.js SEO Guide](https://nextjs.org/learn/seo/introduction-to-seo)
- [Google Search Central](https://developers.google.com/search)
- [Metadata API Docs](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)

### Testing Tools

- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [Lighthouse (Chrome DevTools)](https://developers.google.com/web/tools/lighthouse)
- [Google Rich Results Test](https://search.google.com/test/rich-results)

### Analysis Tools

- [Google Search Console](https://search.google.com/search-console)
- [Ahrefs SEO Toolbar](https://ahrefs.com/toolbar)
- [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/)

---

## Related Documentation

- [Web Performance Best Practices](web-performance.md) - General performance
  optimization
- [Next.js 15 Guide](nextjs-15.md) - Framework features and patterns
- [React Patterns](react-patterns.md) - Component architecture for SEO
- [TypeScript Best Practices](typescript.md) - Type-safe implementations

---

**Last Updated:** December 6, 2025 **Document Version:** 1.0 **Next.js
Version:** 15+ **Status:** Current & Ready to Use

For complete details, see [seo-nextjs.md](seo-nextjs.md)
