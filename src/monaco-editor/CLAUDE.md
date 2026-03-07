# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the `monaco-editor` npm package repository. Monaco Editor Core is built from VS Code source; this repo adds 84 Monarch tokenizer languages, 4 web-worker language services (CSS, HTML, JSON, TypeScript), an LSP client (`@vscode/monaco-lsp-client`), and tree-shakeable feature registrations. The `monaco-editor-core` dependency is a nightly/rc build from VS Code — core editor bugs should be fixed in the VS Code repo, not here.

## Commands

```bash
# Setup (Node 22.21.1 via .nvmrc)
nvm use && npm install

# Build
npm run build                        # ESM + AMD output to out/monaco-editor/
npm run watch                        # TypeScript watch mode (src/ only)

# Test
npm test                             # grammar tests + check-samples
npm run test:grammars                # language grammar tests only
npm run package-for-smoketest        # bundle with webpack + esbuild + vite
npm run smoketest                    # Playwright smoke tests
npm run smoketest-debug              # Playwright debug mode
npm run smoketest-headed             # Playwright headed mode

# Formatting
npm run prettier-check
npm run prettier

# Webpack plugin (separate package)
npm run compile --prefix webpack-plugin

# Local dev server
npm run simpleserver

# Website (separate project, uses yarn)
cd website && yarn install && yarn typedoc && yarn dev
```

### Running a single grammar test

Grammar tests are colocated with languages at `src/languages/definitions/{lang}/{lang}.test.ts`. They run via the `test:grammars` script. To run tests for a specific language, use the test runner's filtering.

## Architecture

```
monaco-editor-core (npm, built from VS Code)
  └─ this repo adds:
       ├─ src/features/          # ~45 tree-shakeable editor features (folding, find, etc.)
       ├─ src/languages/
       │   ├─ definitions/       # 84 Monarch tokenizer languages (each: .ts + .contribution.ts + .test.ts)
       │   └─ features/          # Rich language services with web workers
       │       ├─ css/           # CSS/LESS/SCSS worker
       │       ├─ html/          # HTML worker
       │       ├─ json/          # JSON worker
       │       └─ typescript/    # TypeScript/JS worker
       ├─ src/editor.ts          # Re-exports monaco-editor-core API
       ├─ src/index.ts           # Main entry: all languages + features + LSP
       ├─ monaco-lsp-client/     # @vscode/monaco-lsp-client sub-package
       └─ webpack-plugin/        # monaco-editor-webpack-plugin (separate npm package)
```

### Build Pipeline

- **ESM**: Rollup + esbuild → `out/monaco-editor/esm/`
- **AMD (deprecated)**: Vite in AMD library format → `out/monaco-editor/min/` (prod) and `dev/` (unminified)
- **Types**: Rollup + rollup-plugin-dts → `monaco.d.ts`
- Build orchestrator: `build/build-monaco-editor.ts`
- Entry points and module ID mapping: `build/shared.mjs`

Module ID remapping during build: `src/` → `vs/`, `node_modules/monaco-editor-core/esm/` → `.` (root), `node_modules/` → `external/`.

### Key Files

- `package.json` `vscodeRef` — the VS Code commit used for the current `monaco-editor-core`
- `build/shared.mjs` — defines all entry points and module mappings
- `build/importTypescript.ts` — script to update the bundled TypeScript version

## Contributing a New Language

1. Create `src/languages/definitions/{lang}/{lang}.ts` (Monarch tokenizer)
2. Create `src/languages/definitions/{lang}/{lang}.contribution.ts` (registration)
3. Create `src/languages/definitions/{lang}/{lang}.test.ts` (grammar tests)
4. Edit `src/languages/definitions/register.all.ts` to import the new language
5. Add `website/index/samples/sample.{lang}.txt`
