# Agent-First Platform

## CEO Decision

> **CEO Decision: Agent-First Platform**
>
> 1. Every UI action MUST have an MCP tool equivalent. No feature ships without
>    MCP coverage.
> 2. Tool descriptions are marketing copy for agents — they must prime correct
>    behavior.
> 3. Reasonable defaults everywhere. If a param can default, it must.
> 4. Every error response includes a Suggestion for recovery.
> 5. Error investigation principle: "Even if the agent made the mistake — what
>    could WE do to prevent it?"
> 6. Agent-exclusive batch operations are a competitive advantage, not an
>    afterthought.
> 7. MCP is the primary API. The web UI is a client of the same capabilities.

## Architecture

The MCP server at `src/lib/mcp/server/` uses progressive disclosure:

- **5 always-on gateway-meta tools** for discovery
- **All other tools are discoverable** via `search_tools` and `enable_category`
- **OAuth 2.1 + API key auth** via `src/lib/mcp/auth.ts`

### Tool Categories

| Category       | Description                        | Tool Count |
| -------------- | ---------------------------------- | ---------- |
| `gateway-meta` | Discovery tools (always enabled)   | 5          |
| `image`        | AI image generation and management | varies     |
| `codespace`    | Live React app development         | 6          |
| `apps`         | Full My-Apps lifecycle             | 11         |
| `workspace`    | Workspace listing and status       | 3          |
| `inbox`        | Unified inbox management           | 7          |
| `relay`        | AI draft generation                | 5          |
| `vault`        | Encrypted secret storage           | 4          |
| `bootstrap`    | One-session workspace setup        | 4          |
| `tools`        | Dynamic tool registration          | varies     |
| `social`       | Social integrations (TikTok, etc.) | 3+         |
| `boxes`        | EC2 provisioning & VNC sessions    | 3+         |

### Error Prevention Strategy

Every tool handler is wrapped with `safeToolCall()` which:

1. Catches all errors
2. Classifies them into structured `McpErrorCode` values
3. Returns a formatted response with:
   - Error code
   - Human-readable message
   - **Suggestion** telling the agent what to do next
   - **Retryable** flag

### Tool Description Priming Rules

1. First sentence = what it does (visible in tool listings)
2. Second sentence = when to use it vs alternatives
3. `WARNING:` prefix for destructive operations
4. Parameter `.describe()` includes format examples and defaults

## Implementation Phases

### Phase 1: Core Platform Parity (Completed)

- 26 new tools across 4 modules
- `apps.ts` — 11 My-Apps tools
- `workspace.ts` — 3 workspace tools
- `inbox.ts` — 7 inbox tools
- `relay.ts` — 5 relay tools
- `tool-helpers.ts` — shared error wrapper and utilities

### Phase 2: Content + Creative (Planned)

- `calendar.ts` — scheduling and content planning
- `scout.ts` — competitor monitoring
- `crisis.ts` — crisis management
- `image.ts` — image library management
- `vibe.ts` — content generation
- `settings.ts` — profile and API key management

### Phase 3: Full Coverage (Planned)

- `boost.ts` — post boosting
- `connections.ts` — relationship management
- `ab-testing.ts` — A/B testing
- `allocator.ts` — budget allocation
- `admin.ts` — admin-tier operations
