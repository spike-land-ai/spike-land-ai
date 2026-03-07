# CLAUDE.md

## Overview

BAZDMEG MCP server for workspace isolation, quality gates, and context
engineering. Provides hard boundaries on which files Claude Code agents can
access within the spike-land-ai monorepo. Published as
`@spike-land-ai/bazdmeg-mcp`, runs in Node.js.

## Commands

```bash
npm run build         # Compile TypeScript (tsc)
npm test              # Run tests (Vitest)
npm run test:coverage # Tests with coverage
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm start             # Run the MCP server (stdio)
```

## Architecture

```
├── index.ts                # McpServer entry + stdio transport
├── types.ts                # All Zod schemas + interfaces
├── workspace-state.ts      # Singleton: current workspace + config file writer
├── workspace-resolver.ts   # Pure path resolution from package.json deps
├── context-bundle.ts       # Context engineering: CLAUDE.md + types + API surface
├── telemetry.ts            # JSONL telemetry logger
├── gates/
│   └── engine.ts           # 6 quality gates (5 from spike-review + workspace scope)
├── tools/
│   ├── workspace.ts        # enter/exit/status workspace tools
│   ├── context.ts          # context bundle serving + feedback tools
│   ├── gates.ts            # run/check/list quality gates
│   ├── workflow.ts         # checkpoint tools (bootstrap, interview, pre-pr)
│   └── escalation.ts       # stuck signal + context gap logging
└── __test-utils__/
    ├── mock-server.ts      # Mock MCP server for tests
    └── fixtures.ts         # Fake monorepo builder for tests
```

## MCP Tools (24)

**Workspace**: `bazdmeg_enter_workspace`, `bazdmeg_workspace_status`,
`bazdmeg_exit_workspace` **Context**: `bazdmeg_get_context`,
`bazdmeg_report_context_gap`, `bazdmeg_review_session` **Gates**:
`bazdmeg_run_gates`, `bazdmeg_check_gate`, `bazdmeg_list_gates` **Workflow**:
`bazdmeg_session_bootstrap`, `bazdmeg_planning_interview`,
`bazdmeg_pre_pr_check` **Ship**: `bazdmeg_auto_ship` — lint → typecheck → test →
gates → commit → push (fail-fast) **Escalation**: `bazdmeg_signal_stuck`
**Fixer**: `bazdmeg_fixer_start`, `bazdmeg_fixer_assign_personas`,
`bazdmeg_fixer_report_finding`, `bazdmeg_fixer_quiz`,
`bazdmeg_fixer_validate`, `bazdmeg_fixer_status`,
`bazdmeg_fixer_advance`, `bazdmeg_fixer_report`,
`bazdmeg_fixer_cancel`, `bazdmeg_fixer_my_assignment`

## Code Quality Rules

- Never use `any` type — use `unknown` or proper types
- Never add `eslint-disable` or `@ts-ignore` comments
- TypeScript strict mode
- All business logic must have test coverage (90%+)

## Dependencies

- `@spike-land-ai/mcp-server-base` for result helpers
- No other internal dependencies (leaf package)
