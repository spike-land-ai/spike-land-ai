# Cross-Origin MCP Integration

## Summary

You can call spike.land MCP tooling from another website, browser app,
Cloudflare Worker, or backend without hosting on the same origin.

The safest rule is:

- use `mcp.spike.land` for direct cross-origin browser and Worker integrations
- use `spike.land` when you want first-party UX routes or same-origin behavior

The MCP worker itself is CORS-open. Authentication still applies to anything
beyond the anonymous discovery surface.

---

## What Is Public

These endpoints are readable without authentication:

- `https://mcp.spike.land/tools`
- `https://mcp.spike.land/apps`
- `https://mcp.spike.land/.well-known/oauth-authorization-server`
- `https://mcp.spike.land/.well-known/oauth-protected-resource/mcp`

Use these for:

- listing tools
- reading app catalog metadata
- bootstrapping OAuth device flow
- generating dynamic UIs from tool schemas

---

## What Requires Auth

Authenticated runtime calls go through:

- `https://mcp.spike.land/mcp`

Supported bearer tokens:

- API keys with `sk_` prefix
- OAuth access tokens with `mcp_` prefix

If you do not pass a bearer token, the runtime only permits the explicit
anonymous discovery tools.

---

## Recommended Integration Patterns

### 1. Browser App On Another Origin

Use this when you want an app on your own domain to call spike.land directly.

- fetch public tool/app metadata from `mcp.spike.land`
- obtain an API key or OAuth token
- call `mcp.spike.land/mcp` with JSON-RPC

This is the cleanest “embed spike.land tools into my existing product” path.

### 2. Cloudflare Worker Or Backend Service

Use this when you want server-side orchestration or secret handling.

- store bearer credentials server-side
- call `mcp.spike.land/mcp` from your Worker or server
- optionally proxy a narrower set of tools to your frontend

This is the right default for production integrations with shared secrets.

### 3. Offline/Hybrid Browser App

Use this when you want online discovery but local execution after install.

- use public metadata online
- mirror app/tool metadata locally
- persist state via IndexedDB
- compile locally with esbuild-wasm where needed

See [../develop/OFFLINE_BUNDLE_GUIDE.md](../develop/OFFLINE_BUNDLE_GUIDE.md).

---

## Authentication Choices

### API Key

Best for:

- internal tools
- server-to-server calls
- personal automations

Properties:

- simplest integration
- bearer token with `sk_` prefix
- generated from spike.land account settings or equivalent internal tooling

### OAuth Device Flow

Best for:

- user-authorized apps
- CLIs
- shared products where each end user should grant access directly

Properties:

- standards-friendly device flow
- approval happens on spike.land
- returned bearer token uses `mcp_` prefix

The current scope model defaults to `mcp`. Fine-grained scope partitioning is
not yet the primary control plane, so build around `mcp` as the current access
scope.

---

## JSON-RPC Call Shape

Tool execution uses MCP JSON-RPC over HTTP.

Typical call:

```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "method": "tools/call",
  "params": {
    "name": "search_tools",
    "arguments": {
      "query": "store"
    }
  }
}
```

Recommended headers:

```http
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json, text/event-stream
```

The runtime normalizes `Accept` internally, but setting it correctly avoids
client confusion.

---

## Rate Limits

Current code-backed limits worth planning around:

- authenticated `/mcp`: 120 requests per 60 seconds baseline per user/key,
  with stricter effective limits for low-ELO callers
- `/oauth/device`: 10 requests per 5 minutes per IP
- `/oauth/token`: 60 requests per 5 minutes per IP

A 429 response includes `Retry-After` where appropriate. Build exponential
backoff and retry behavior into your client.

---

## CORS Notes

Important distinction:

- `mcp.spike.land` is wildcard CORS for MCP/public metadata
- `spike.land` has a more restrictive first-party CORS policy
- `auth-mcp.spike.land` is allowlisted for auth/session behavior

That means:

- direct cross-origin browser clients should prefer `mcp.spike.land`
- first-party pages on `spike.land` can use proxied routes
- auth/session cookie flows are not the same thing as public MCP metadata access

---

## When To Proxy Instead Of Calling Directly

Proxy through your own backend if:

- you do not want bearer credentials exposed to the browser
- you need to meter or constrain tool access
- you want to combine spike.land calls with your own business logic
- you need a stable app-specific facade instead of exposing the raw tool surface

Call spike.land directly if:

- you want the fastest path to integration
- your client already has user-approved credentials
- you want to render UIs from live tool metadata

---

## Related Docs

- [../api/CROSS_ORIGIN_API_GUIDE.md](../api/CROSS_ORIGIN_API_GUIDE.md)
- [../features/APP_STORE_OVERVIEW.md](../features/APP_STORE_OVERVIEW.md)
- [../features/SHARED_TOOL_LIBRARY.md](../features/SHARED_TOOL_LIBRARY.md)
