/**
 * @spike-land-ai/eslint-config/react
 *
 * Shared ESLint flat config with React + React Hooks support.
 * Requires peer deps: eslint-plugin-react, eslint-plugin-react-hooks
 *
 * Usage (simple):
 *   import config from "@spike-land-ai/eslint-config/react";
 *   export default config;
 *
 * Usage (with extra ignores):
 *   import { createReactConfig } from "@spike-land-ai/eslint-config/react";
 *   export default createReactConfig({ ignores: ["dist-vite/**", "dts/**"] });
 */
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

import { createConfig } from "./index.mjs";

/**
 * Create a React-enabled ESLint flat config.
 *
 * @param {object} [options]
 * @param {string[]} [options.ignores] - Additional ignore patterns
 * @returns ESLint flat config array
 */
export function createReactConfig({ ignores = [] } = {}) {
  return createConfig({
    ignores,
    files: ["**/*.ts", "**/*.tsx"],
    jsx: true,
    extraPlugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    extraRules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  });
}

export default createReactConfig();
