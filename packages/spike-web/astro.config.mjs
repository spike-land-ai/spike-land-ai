import { defineConfig } from "astro/config";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const sentryOrg = process.env.SENTRY_ORG;
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryProject = process.env.SENTRY_PROJECT ?? "spike-web";
const sentryBuildEnabled = Boolean(sentryOrg && sentryAuthToken && sentryProject);

// https://astro.build/config
export default defineConfig({
  site: "https://spike.land",

  vite: {
    build: {
      sourcemap: sentryBuildEnabled ? "hidden" : false,
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8787",
          changeOrigin: true,
        },
      },
    },
    plugins: [
      tailwindcss(),
      ...(sentryBuildEnabled
        ? [
            sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,
              telemetry: false,
              sourcemaps: {
                filesToDeleteAfterUpload: ["dist/**/*.map"],
              },
              release: {
                deploy: {
                  env: process.env.PUBLIC_SENTRY_ENVIRONMENT ?? "production",
                },
              },
            }),
          ]
        : []),
    ],
  },

  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },

  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) =>
        !page.includes("/dashboard") && !page.includes("/login") && !page.includes("/callback"),
    }),
  ],
});
