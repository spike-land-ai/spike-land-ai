/**
 * @spike-land-ai/eslint-config
 *
 * Shared ESLint flat config for all @spike-land-ai packages.
 * Base config: TypeScript-only (no React/JSX).
 *
 * Usage (simple):
 *   import config from "@spike-land-ai/eslint-config";
 *   export default config;
 *
 * Usage (with extra ignores):
 *   import { createConfig } from "@spike-land-ai/eslint-config";
 *   export default createConfig({ ignores: [".wrangler/**"] });
 */
import tseslint from "typescript-eslint";

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

const testOverrides = {
  files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
  rules: {
    "dot-notation": "off",
  },
};

// Create a customized ESLint flat config.
//
// @param {object} [options]
// @param {string[]} [options.ignores] - Additional ignore patterns (node_modules/dist/coverage always included)
// @param {string[]} [options.files] - File patterns to lint (default: ["**/*.ts"])
// @param {boolean} [options.jsx] - Enable JSX parsing (default: false)
// @param {object} [options.extraPlugins] - Additional plugins to merge
// @param {object} [options.extraRules] - Additional rules to merge
// @param {object} [options.settings] - ESLint settings (e.g., { react: { version: "detect" } })
// @returns ESLint flat config array
export function createConfig({
  ignores = [],
  files = ["**/*.ts"],
  jsx = false,
  extraPlugins = {},
  extraRules = {},
  settings = {},
} = {}) {
  return tseslint.config(
    {
      ignores: ["node_modules/**", "dist/**", "coverage/**", ...ignores],
    },
    {
      files,
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
          ...(jsx ? { ecmaFeatures: { jsx: true } } : {}),
        },
      },
      plugins: {
        "@typescript-eslint": tseslint.plugin,
        ...extraPlugins,
      },
      rules: {
        ...sharedRules,
        ...extraRules,
      },
      ...(Object.keys(settings).length > 0 ? { settings } : {}),
    },
    testOverrides,
  );
}

export { sharedRules, testOverrides };

export default createConfig();
