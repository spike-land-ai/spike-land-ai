# CLAUDE.md

## Overview

MCP multiplexer CLI with lazy toolset loading. Aggregates multiple MCP servers,
loads tool definitions on demand, and provides an interactive Claude chat
interface. It is a first-class distribution surface for the spike.land app
store, not just a debugging tool: the same store/search/install/runtime model
available on the web should stay explorable from the CLI. Node.js runtime,
bundled with tsup, published as `@spike-land-ai/spike-cli`.

## Commands

```bash
npm run build        # Bundle with tsup
npm test             # Run tests (Vitest)
npm run test:coverage # Tests with coverage
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

## Architecture

```
├── index.ts          # Library entry point
├── cli.ts            # CLI entry point (bin: spike)
├── commands/         # CLI subcommands (serve, chat, shell, status)
├── multiplexer/      # Core MCP multiplexer logic
├── transport/        # MCP transport implementations
├── auth/             # spike.land authentication
├── registry/         # MCP server registry client
├── chat/             # Claude chat integration
├── shell/            # Interactive REPL
├── config/           # Configuration management
├── alias/            # Tool alias system
├── completions/      # Shell completions
├── onboarding/       # First-run setup
└── util/             # Shared utilities
```

**Key pattern**: The multiplexer discovers MCP servers from a registry, lazily
loads their tool schemas, and presents a unified tool surface to AI clients.

## App Store Notes

- Favor workflows where app-store discovery and MCP runtime access feel native
  in the CLI.
- Keep the mental model aligned with the web docs: apps are bundles of MCP
  tools, categories evolve, and store surfaces should remain callable from any
  client.

## Code Quality Rules

- Never use `any` type — use `unknown` or proper types
- Never add `eslint-disable` or `@ts-ignore` comments
- TypeScript strict mode
- All business logic must have test coverage

## CI/CD

- Shared workflow: `.github/.github/workflows/ci-publish.yml`
- Changesets for versioning
- Publishes to GitHub Packages (`@spike-land-ai/*`)
