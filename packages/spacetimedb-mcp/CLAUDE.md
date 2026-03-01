# CLAUDE.md

## Overview

MCP server for SpacetimeDB agent coordination — persistent real-time agent state, point-to-point messaging, and task management. Node.js runtime, published as `@spike-land-ai/spacetimedb-mcp`.

## Commands

```bash
npm run build        # Compile TypeScript (tsc)
npm test             # Run tests (Vitest)
npm run test:coverage # Tests with coverage
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm start            # Run the MCP server
```

## Architecture

```
src/
├── index.ts           # MCP server entry point
├── types.ts           # Shared types & result helpers
├── client.ts          # SpacetimeDB connection manager (interface + live impl)
├── tools/
│   ├── agent-tools.ts # Connect, register, list agents, send/get messages
│   └── task-tools.ts  # Create, list, claim, complete tasks
└── __test-utils__/    # Test helpers (mock server, mock client)

module/                # SpacetimeDB server module (deployed to Maincloud)
└── src/
    └── lib.ts         # Tables (Agent, AgentMessage, Task) + reducers
```

**Dependencies**: `@modelcontextprotocol/sdk`, `zod` for validation, `spacetimedb` (runtime-only, dynamically imported).

## MCP Tools

| Tool | Description |
|------|-------------|
| `stdb_connect` | Connect to SpacetimeDB Maincloud instance |
| `stdb_disconnect` | Disconnect from current instance |
| `stdb_register_agent` | Register agent with name and capabilities |
| `stdb_list_agents` | List all agents with online status |
| `stdb_send_message` | Send message to another agent |
| `stdb_get_messages` | Get messages (undelivered by default) |
| `stdb_mark_delivered` | Mark a message as delivered |
| `stdb_create_task` | Create a new coordination task |
| `stdb_list_tasks` | List tasks with optional status filter |
| `stdb_claim_task` | Claim an unassigned pending task |
| `stdb_complete_task` | Mark a task as completed |

## Usage with spike-cli

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "spacetimedb": {
      "command": "node",
      "args": ["./packages/spacetimedb-mcp/dist/index.js"]
    }
  }
}
```

## Code Quality Rules

- Never use `any` type — use `unknown` or proper types
- Never add `eslint-disable` or `@ts-ignore` comments
- TypeScript strict mode
- All business logic must have test coverage

## CI/CD

- Shared workflow: `.github/.github/workflows/ci-publish.yml`
- Changesets for versioning
- Publishes to GitHub Packages (`@spike-land-ai/*`)
- No internal `@spike-land-ai` dependencies (leaf package)
