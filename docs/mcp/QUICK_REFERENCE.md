# MCP Server Development - Quick Reference

Fast lookup for common tasks and patterns.

## Transport Selection

| Use Case             | Transport           | Binding        | Protocol                     |
| -------------------- | ------------------- | -------------- | ---------------------------- |
| Local development    | STDIO               | subprocess     | JSON-RPC via stdin/stdout    |
| Remote/Cloud         | **Streamable HTTP** | 127.0.0.1:PORT | JSON-RPC via HTTP POST + SSE |
| Legacy systems       | SSE                 | remote         | Deprecated - avoid           |
| Container deployment | Docker + stdio      | isolated env   | JSON-RPC via stdin/stdout    |

**Recommendation**: Use Streamable HTTP for 95% of production servers.

---

## Project Setup (30 seconds)

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install --save-dev typescript @types/node ts-node
tsc --init
```

---

## Minimal Server (30 lines)

```typescript
import {
  CallToolRequest,
  ListToolsRequest,
  Server,
  StdioServerTransport,
} from "@modelcontextprotocol/sdk";

const server = new Server({ name: "example", version: "1.0.0" });

server.setRequestHandler(ListToolsRequest, async () => ({
  tools: [
    {
      name: "add",
      description: "Add two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequest, async (req) => {
  if (req.params.name === "add") {
    const { a, b } = req.params.arguments as { a: number; b: number };
    return { content: [{ type: "text", text: String(a + b) }] };
  }
  throw new Error("Unknown tool");
});

server.connect(new StdioServerTransport());
```

---

## Input Validation Pattern

```typescript
import { z } from "zod";

// Define schema
const addSchema = z.object({
  a: z.number(),
  b: z.number(),
});

// Validate
try {
  const args = addSchema.parse(request.params.arguments);
  // args is now type-safe
} catch (error) {
  return { content: [{ type: "text", text: "Invalid input", isError: true }] };
}
```

---

## Error Handling Template

```typescript
try {
  // Validate input
  const validArgs = schema.parse(args);

  // Execute
  const result = await doSomething(validArgs);

  // Return success
  return { content: [{ type: "text", text: result }] };
} catch (error) {
  // Log to stderr (never stdout!)
  console.error(JSON.stringify({ error: error.message }));

  // Return safe error message
  return {
    content: [{
      type: "text",
      text: error instanceof ValidationError ? "Invalid input" : "Server error",
      isError: true,
    }],
  };
}
```

---

## Tool Definition Checklist

```typescript
✓ name: "snake_case_name"
✓ description: "Clear description for LLM"
✓ inputSchema: {
    type: "object",
    properties: { /* param definitions */ },
    required: [ /* required params */ ]
  }
✓ Handler registered with server.setRequestHandler()
✓ Error handling included
✓ Input validation with Zod or similar
```

---

## Security Checklist

```
Network Layer
  ✓ Bind to 127.0.0.1 only (not 0.0.0.0)
  ✓ Use TLS for remote connections
  ✓ Validate Origin header

Authentication
  ✓ JWT token verification
  ✓ Token expiration checks
  ✓ Refresh token handling

Authorization
  ✓ Capability-based ACLs
  ✓ Resource-level permissions
  ✓ Rate limiting per client

Input Validation
  ✓ Schema validation (Zod)
  ✓ Type checking
  ✓ Sanitization

Logging
  ✓ All logs to stderr
  ✓ No sensitive data in logs
  ✓ Structured JSON format
```

---

## Testing with MCP Inspector

```bash
# Local stdio server
npx @modelcontextprotocol/inspector node dist/server.js

# Remote HTTP server
npx @modelcontextprotocol/inspector --transport http http://localhost:3000

# With debug output
DEBUG=mcp:* npx @modelcontextprotocol/inspector node dist/server.js
```

---

## Deployment Quick Start

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
USER 1000:1000
CMD ["node", "dist/server.js"]
```

### Docker Compose

```yaml
services:
  mcp:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      API_KEY: ${API_KEY}
```

### Client Configuration

```json
{
  "mcpServers": {
    "my-server": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "API_KEY", "ghcr.io/org/server"]
    }
  }
}
```

---

## Environment Variables

```bash
# Core
NODE_ENV=production
PORT=3000
HOST=127.0.0.1

# Security
JWT_SECRET=your-secret-key
API_KEY=your-api-key

# Logging
LOG_LEVEL=info

# Performance
DB_POOL_SIZE=10
CACHE_TTL=300

# Monitoring (Vercel Analytics + structured logging)
```

---

## Logging Pattern

```typescript
// ERROR (internal debug)
console.error(JSON.stringify({
  level: "error",
  message: "Database connection failed",
  context: { tableName: "users" },
  error: error.message,
}));

// INFO (operational)
console.error(JSON.stringify({
  level: "info",
  message: "Tool executed",
  tool: "search",
  durationMs: 145,
}));

// NEVER do this (breaks protocol!)
console.log("Debug message");
```

---

## Performance Targets (Production)

| Metric      | Target      | Frequency     |
| ----------- | ----------- | ------------- |
| P50 Latency | <50ms       | Every request |
| P95 Latency | <100ms      | Every request |
| P99 Latency | <500ms      | Every request |
| Throughput  | >1000 req/s | Per minute    |
| Error Rate  | <0.1%       | Per minute    |
| Uptime      | 99.9%       | Per month     |

---

## Common Errors & Fixes

### "Only write JSON-RPC to stdout"

**Problem**: Using `console.log()` for debug messages **Fix**: Route logs to
`console.error()` instead

```typescript
console.error("debug"); // OK
console.log("debug"); // BREAKS PROTOCOL
```

### Tool not visible in Inspector

**Problem**: ListToolsRequest handler not registered **Fix**: Add handler:

```typescript
server.setRequestHandler(ListToolsRequest, async () => ({
  tools: [/* your tools */],
}));
```

### "Invalid token"

**Problem**: JWT secret mismatch **Fix**: Verify JWT_SECRET is set correctly:

```bash
echo $JWT_SECRET  # Check value
# Regenerate if needed
```

### Slow responses

**Problem**: N+1 queries or unoptimized logic **Fix**: Add monitoring, use
profiler, implement caching

```bash
node --prof dist/server.js  # CPU profile
# Process with: node --prof-process ...
```

---

## Headers & Metadata

### HTTP Request (Streamable HTTP)

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-06-18
Mcp-Session-Id: [optional-session-id]
Authorization: Bearer [jwt-token]

{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
```

### Server Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"jsonrpc": "2.0", "id": 1, "result": {"tools": [...]}}
```

---

## Message Types

```typescript
// Request
{
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "tool_name",
    arguments: { /* input */ }
  }
}

// Response (success)
{
  jsonrpc: "2.0",
  id: 1,
  result: {
    content: [{
      type: "text",
      text: "result text"
    }]
  }
}

// Response (error)
{
  jsonrpc: "2.0",
  id: 1,
  error: {
    code: -32600,
    message: "Invalid Request"
  }
}
```

---

## Development Commands

```bash
# Development
npm run dev              # Start in watch mode
npm run build           # Compile TypeScript
npm start               # Run compiled server

# Testing
npm test                # Run unit tests
npm run test:watch     # Watch mode
npm run test:coverage  # Check coverage

# Quality
npm run lint            # ESLint
npm run type-check     # TypeScript strict

# Debugging
DEBUG=* npm start       # Full debug logging
npx inspector           # Visual testing tool
```

---

## Monitoring Checklist

```
Response Latency
  ✓ P50 (median)
  ✓ P95 (95th percentile)
  ✓ P99 (99th percentile)
  ✓ Max (worst case)

Error Metrics
  ✓ Error rate (%)
  ✓ Errors by type
  ✓ Errors by tool
  ✓ Retry success rate

System Health
  ✓ Memory usage
  ✓ CPU usage
  ✓ Connections (active)
  ✓ Database pool (available)

Availability
  ✓ Uptime (%)
  ✓ MTTR (mean time to recover)
  ✓ Deployments per week
  ✓ Failed deployments
```

---

## Resources

**Official**:

- [MCP Spec](https://modelcontextprotocol.io)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)

**Learning**:

- [Full Guide](./mcp-server-development.md) (1,611 lines, comprehensive)
- [Index & Navigation](./MCP_DEVELOPMENT_INDEX.md) (this quick reference)

**Community**:

- [DEV Community Articles](https://dev.to/shadid12/how-to-build-mcp-servers-with-typescript-sdk-1c28)
- [Example Servers](https://github.com/modelcontextprotocol/servers)

---

**Last Updated**: December 2025 **Spec Version**: 2025-06-18 **SDK Version**:
v1.18.1+
