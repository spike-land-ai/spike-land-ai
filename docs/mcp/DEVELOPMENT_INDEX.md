# MCP Development Index

This index combines the general MCP authoring docs with the spike.land-specific
docs for cross-origin access, app-store publishing, and shared-runtime design.

---

## Start With These

| Goal | Document |
| --- | --- |
| Call spike.land MCP from another product | [CROSS_ORIGIN_INTEGRATION.md](./CROSS_ORIGIN_INTEGRATION.md) |
| Understand endpoint/auth details | [../api/CROSS_ORIGIN_API_GUIDE.md](../api/CROSS_ORIGIN_API_GUIDE.md) |
| Build a general MCP server | [SERVER_DEVELOPMENT.md](./SERVER_DEVELOPMENT.md) |
| Follow tool authoring conventions | [TOOL_GUIDELINES.md](./TOOL_GUIDELINES.md) |
| Understand the wider tool architecture | [TOOL_SYSTEM_ANALYSIS.md](./TOOL_SYSTEM_ANALYSIS.md) |

---

## spike.land-Specific MCP Surface

### Public Metadata

- `https://mcp.spike.land/tools` — public tool metadata
- `https://mcp.spike.land/apps` — public app metadata
- `https://mcp.spike.land/.well-known/oauth-authorization-server` — OAuth
  discovery
- `https://mcp.spike.land/.well-known/oauth-protected-resource/mcp` — protected
  resource metadata

### Authenticated Runtime

- `https://mcp.spike.land/mcp` — authenticated tool execution
- bearer tokens supported:
  - API keys with `sk_` prefix
  - OAuth device-flow tokens with `mcp_` prefix

### Anonymous Tool Calls

The authenticated MCP endpoint still permits a small anonymous allowlist for
discovery-style operations:

- `search_tools`
- `list_categories`
- `get_status`
- `get_tool_info`

That makes exploration possible without opening the whole runtime to anonymous
writes.

---

## App Store And Shared Runtime Docs

| Document | Why it matters to MCP developers |
| --- | --- |
| [../features/APP_STORE_OVERVIEW.md](../features/APP_STORE_OVERVIEW.md) | Explains how MCP apps are surfaced and installed |
| [../features/SHARED_TOOL_LIBRARY.md](../features/SHARED_TOOL_LIBRARY.md) | Shows the three shared layers apps build on |
| [../features/AB_TESTING_BUG_DETECTION.md](../features/AB_TESTING_BUG_DETECTION.md) | Documents the platform’s experimentation loop |
| [../security/APP_STORE_SECURITY.md](../security/APP_STORE_SECURITY.md) | Documents trust boundaries and submission gates |

---

## Deployment Paths

| Deployment model | Document |
| --- | --- |
| Dedicated Cloudflare Worker | [../develop/DEPLOY_APP_CLOUDFLARE.md](../develop/DEPLOY_APP_CLOUDFLARE.md) |
| Offline browser bundle | [../develop/OFFLINE_BUNDLE_GUIDE.md](../develop/OFFLINE_BUNDLE_GUIDE.md) |

---

## What To Read In Source

If you are implementing or documenting the current spike.land MCP runtime, the
highest-signal source files are:

- `src/edge-api/spike-land/api/app.ts`
- `src/edge-api/spike-land/api/middleware.ts`
- `src/edge-api/spike-land/api/mcp.ts`
- `src/edge-api/spike-land/api/oauth.ts`
- `src/edge-api/spike-land/core-logic/mcp/manifest.ts`
- `src/edge-api/spike-land/core-logic/mcp/categories.ts`
- `src/edge-api/spike-land/core-logic/tools/store/`

These files define the real integration surface: CORS, auth, categories,
publication flow, and store operations.
