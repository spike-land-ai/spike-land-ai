import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/_next/",
          "/settings/",
          "/my-apps/",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: ["/", "/blog/", "/docs/", "/tools/", "/store/"],
        disallow: ["/api/", "/admin/", "/settings/", "/my-apps/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/blog/", "/docs/", "/tools/", "/store/"],
        disallow: ["/api/", "/admin/", "/settings/", "/my-apps/"],
      },
    ],
    sitemap: "https://spike.land/sitemap.xml",
    host: "https://spike.land",
  };
}
