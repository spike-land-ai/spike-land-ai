import type { MetadataRoute } from "next";

import { getPostBySlug, getPostSlugs } from "@/lib/blog/get-posts";
import { STORE_APPS } from "@/app/store/data/store-apps";

const BASE_URL = "https://spike.land";

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date();

  // Get all blog post slugs for dynamic sitemap entries
  const blogSlugs = getPostSlugs();
  const blogEntries: MetadataRoute.Sitemap = blogSlugs.map(slug => {
    const post = getPostBySlug(slug);
    return {
      url: `${BASE_URL}/blog/${slug}`,
      lastModified: post ? new Date(post.frontmatter.date) : currentDate,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  // Store app entries (canonical path is /apps/store)
  const storeEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/apps/store`,
      lastModified: currentDate,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    ...STORE_APPS.map(app => ({
      url: `${BASE_URL}/store/${app.slug}`,
      lastModified: currentDate,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];

  return [
    // Core public pages
    {
      url: `${BASE_URL}/`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/community`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/connect`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/create`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/gallery`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/career`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/merch`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.5,
    },

    // Blog
    {
      url: `${BASE_URL}/blog`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogEntries,

    // Store & Apps
    ...storeEntries,
    {
      url: `${BASE_URL}/apps/mcp-explorer`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/apps/chess-arena`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/apps/pixel`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },

    // Auth
    {
      url: `${BASE_URL}/auth/signin`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.5,
    },

    // Legal
    {
      url: `${BASE_URL}/terms`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/cookies`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.3,
    },

    // Documentation
    {
      url: `${BASE_URL}/docs`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/docs/tools`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/docs/api`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/docs/guides`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/docs/components`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
