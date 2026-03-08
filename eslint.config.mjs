/**
 * Root ESLint flat config for the spike-land-ai monorepo.
 *
 * Inlines the logic from @spike-land-ai/eslint-config so there is
 * no per-package eslint config needed. The shared config is still
 * published for external consumers via MCP publish tool.
 */
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import boundariesPlugin from "eslint-plugin-boundaries";

// ─── Shared Rules ────────────────────────────────────────────────────────────

const sharedRules = {
  ...tseslint.configs.recommended.reduce((acc, config) => ({ ...acc, ...config.rules }), {}),
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    },
  ],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    {
      prefer: "type-imports",
      fixStyle: "separate-type-imports",
      disallowTypeAnnotations: false,
    },
  ],
  "dot-notation": "error",
};

// ─── Config ──────────────────────────────────────────────────────────────────

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "src/**/dist/**",
      "src/**/dist-vite/**",
      "coverage/**",
      ".tsbuildinfo",
      ".wrangler/**",
      "packages/**",
      "src/esbuild-wasm/**",
      "src/monaco-editor/**",
      "src/core/chess/core-logic/prisma.ts",
      "**/*.d.ts",
      ".yarn/**",
      "**/routeTree.gen.ts",
    ],
  },
  // TypeScript files (non-React)
  {
    files: ["src/**/*.ts", ".tests/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: sharedRules,
  },
  // React/TSX files
  {
    files: ["src/**/*.tsx", ".tests/**/*.tsx", "scripts/**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...sharedRules,
      "react/no-unescaped-entities": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
    settings: {
      react: { version: "detect" },
    },
  },
  // Test file overrides
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "dot-notation": "off",
    },
  },
  // Config files at root
  {
    files: ["*.config.ts", "*.config.mjs"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...sharedRules,
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
