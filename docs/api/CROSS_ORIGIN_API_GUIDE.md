# Cross-Origin API Guide

## Base URLs

| Use case | Recommended base URL | Notes |
| --- | --- | --- |
| Public MCP metadata | `https://mcp.spike.land` | Wildcard CORS on the MCP worker |
| Authenticated MCP calls | `https://mcp.spike.land/mcp` | JSON-RPC over HTTP |
| First-party proxy surface | `https://spike.land` | Good for same-origin UX; not the best default for wildcard browser CORS |
| OAuth discovery | `https://mcp.spike.land/.well-known/oauth-authorization-server` | Device flow bootstrap |
| Protected resource metadata | `https://mcp.spike.land/.well-known/oauth-protected-resource/mcp` | Resource metadata for MCP clients |

Useful public endpoints:

- `GET https://mcp.spike.land/tools`
- `GET https://mcp.spike.land/apps`
- `GET https://mcp.spike.land/apps/:slug`

---

## Authentication

### API Keys

Use:

```http
Authorization: Bearer sk_...
```

Best for:

- server-side integrations
- internal dashboards
- automations you control

### OAuth Device Flow

1. Start device auth:

```bash
curl -X POST https://mcp.spike.land/oauth/device \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=my-app&scope=mcp"
```

2. Show the returned `user_code` and `verification_uri` to the user.

3. Poll for the token:

```bash
curl -X POST https://mcp.spike.land/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=<device_code>"
```

4. Use the returned token:

```http
Authorization: Bearer mcp_...
```

Current scope guidance:

- request `scope=mcp`
- finer-grained scopes are not yet the main enforcement boundary in the worker

---

## Anonymous Discovery Calls

Even without auth, the MCP runtime allows a small discovery subset:

- `search_tools`
- `list_categories`
- `get_status`
- `get_tool_info`

That is useful for bootstrapping an integration before the user signs in.

---

## Public Metadata Fetch Example

### Vanilla JavaScript

```js
const res = await fetch("https://mcp.spike.land/tools");
const data = await res.json();

console.log(data.tools);
```

### React Browser Client

```tsx
import { useEffect, useState } from "react";

export function ToolCatalog() {
  const [tools, setTools] = useState([]);

  useEffect(() => {
    fetch("https://mcp.spike.land/tools")
      .then((res) => res.json())
      .then((data) => setTools(data.tools ?? []));
  }, []);

  return <pre>{JSON.stringify(tools, null, 2)}</pre>;
}
```

---

## Authenticated MCP Call Example

### JSON-RPC Request

```json
{
  "jsonrpc": "2.0",
  "id": "call-1",
  "method": "tools/call",
  "params": {
    "name": "store_search",
    "arguments": {
      "query": "qa",
      "limit": 5
    }
  }
}
```

### Browser Or Server Fetch

```js
const res = await fetch("https://mcp.spike.land/mcp", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "call-1",
    method: "tools/call",
    params: {
      name: "store_search",
      arguments: { query: "qa", limit: 5 },
    },
  }),
});

const payload = await res.json();
console.log(payload);
```

### Cloudflare Worker

```ts
export default {
  async fetch(_request: Request): Promise<Response> {
    const upstream = await fetch("https://mcp.spike.land/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MCP_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "worker-1",
        method: "tools/call",
        params: {
          name: "search_tools",
          arguments: { query: "store" },
        },
      }),
    });

    return new Response(upstream.body, upstream);
  },
};
```

### Next.js Route Handler

```ts
export async function POST(): Promise<Response> {
  const res = await fetch("https://mcp.spike.land/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SPIKE_MCP_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "next-1",
      method: "tools/call",
      params: {
        name: "store_featured_apps",
        arguments: {},
      },
    }),
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

---

## Headers And Behavior

Recommended request headers:

- `Authorization: Bearer ...`
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`

Relevant response behavior:

- `429` may include `Retry-After`
- MCP errors can still come back inside a JSON-RPC success envelope, so inspect
  the body and `result.isError` as well as HTTP status

---

## Rate Limits

Current limits defined in source:

| Endpoint | Limit |
| --- | --- |
| `POST /mcp` | 120 requests / 60 seconds baseline per user or API key |
| `POST /oauth/device` | 10 requests / 5 minutes per IP |
| `POST /oauth/token` | 60 requests / 5 minutes per IP |

Notes:

- the MCP route applies stricter effective limits to low-ELO callers
- use retry and backoff around `429`
- treat these as operational limits, not a guarantee that every tool has the
  same cost profile

---

## CORS Guidance

For browser apps on another origin:

- prefer `mcp.spike.land`
- do not assume `spike.land` has the same CORS behavior as the MCP worker
- do not treat auth/session endpoints as public wildcard-CORS resources

For server-side callers:

- CORS is irrelevant, so choose the endpoint that best fits your routing model

---

## Related Docs

- [../mcp/CROSS_ORIGIN_INTEGRATION.md](../mcp/CROSS_ORIGIN_INTEGRATION.md)
- [../features/APP_STORE_OVERVIEW.md](../features/APP_STORE_OVERVIEW.md)
