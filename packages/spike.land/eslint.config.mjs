import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import { createReactConfig } from "@spike-land-ai/eslint-config/react";

export default [
  ...createReactConfig({
    ignores: [
      "out/**",
      "build/**",
      "**/dts/**",
      "src/generated/**",
      "fix-r2-versioning-cache/**",
      ".yarn/**",
      ".pnp.cjs",
      ".pnp.loader.mjs",
      "src/app/.well-known/**",
      "live/**",
      ".github/skills/**",
      "hono-api/**",
      "shell/**",
      "public/**",
    ],
  }),
  // JSX Accessibility rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "jsx-a11y": jsxA11yPlugin,
    },
    rules: {
      ...jsxA11yPlugin.flatConfigs.recommended.rules,
    },
  },
  // App-specific overrides
  {
    files: ["apps/audio-mixer/components/Timeline/Timeline.tsx"],
    rules: {
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-noninteractive-tabindex": "off",
    },
  },
  // Prevent accidental console logging in application source
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
