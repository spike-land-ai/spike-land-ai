# MCP Development Documentation Index

This index provides a comprehensive overview of the Model Context Protocol (MCP)
server development documentation and related resources.

## Quick Start

**New to MCP?** Start here:

1. Read: [MCP Architecture & Overview](#mcp-architecture--overview) in
   `mcp-server-development.md`
2. Build: Simple Tool Server example from `mcp-server-development.md`
3. Test: Run MCP Inspector locally
4. Deploy: Choose your transport (stdio, Streamable HTTP, or Docker)

## Documentation Map

### Core MCP Documentation

**File**: `mcp-server-development.md` (1,611 lines)

A comprehensive guide covering:

- **MCP Architecture & Overview**
  - What is MCP and why it matters
  - 2025 industry adoption (OpenAI, Google DeepMind, 12,698+ packages)
  - Key problems solved

- **Protocol Fundamentals**
  - Transport mechanisms: STDIO, Streamable HTTP (recommended), SSE (legacy)
  - JSON-RPC 2.0 message format
  - Headers and session management
  - When to use each transport

- **Server Development with TypeScript SDK**
  - Project setup and initialization
  - Key SDK classes and interfaces
  - Complete server example (from boilerplate to running)
  - Building and configuring servers

- **Core Components: Tools, Resources & Prompts**
  - Tools: executable functions for LLMs
  - Resources: read-only data exposure
  - Prompts: instruction templates
  - Schema definitions and patterns
  - Interaction model diagram

- **Error Handling & Input Validation**
  - Multi-layered error handling strategy
  - Error categorization (CLIENT, SERVER, EXTERNAL)
  - Input validation with Zod schema library
  - Logging best practices (stderr for logs, stdout for protocol)

- **Security Best Practices**
  - Multi-layer security architecture diagram
  - Network layer: binding, TLS, origin validation
  - Authentication: JWT tokens
  - Authorization: capability-based ACLs, resource indicators
  - Rate limiting and input sanitization
  - June 2025 spec: Resource Indicators for token scoping

- **Testing & Debugging**
  - MCP Inspector for visual testing
  - MCP Testing Framework
  - Unit testing patterns (Vitest, React Testing Library)
  - Integration testing approaches
  - Debugging techniques (local vs remote, schema validation)

- **Deployment Strategies**
  - NPX distribution (prototyping, learning)
  - Docker deployment (production - recommended)
  - Kubernetes orchestration
  - Environment-specific configuration
  - Security considerations for each method

- **Production Readiness Checklist**
  - 6-week production timeline
  - Phase 1-3 checklists with success metrics
  - Production KPIs and target metrics
  - Monitoring throughput, latency, errors, availability

- **Real-World Examples**
  - Example 1: Simple calculator tool server
  - Example 2: Database query server (resources + tools)
  - Example 3: Streamable HTTP server with authentication

### Related Best Practices

The `docs/best-practices/` directory contains additional guides that complement
MCP development:

| Document                | Focus Area                             | Use Case                      |
| ----------------------- | -------------------------------------- | ----------------------------- |
| `typescript.md`         | TypeScript patterns and best practices | Type-safe MCP servers         |
| `error-handling.md`     | Error handling strategies              | Robust error management       |
| `testing-strategies.md` | Testing approaches                     | Comprehensive test coverage   |
| `logging-monitoring.md` | Observability patterns                 | Production monitoring         |
| `api-design.md`         | API design principles                  | Tool and resource schemas     |
| `state-management.md`   | State management patterns              | Managing server state         |
| `cicd-pipelines.md`     | CI/CD automation                       | Deployment automation         |
| `nextjs-15.md`          | Next.js specific patterns              | Frontend integration with MCP |

---

## Key Topics Deep Dive

### Transport Mechanisms

**When to use STDIO**:

- Local development and testing
- CLI tool integration
- No network overhead needed
- Simple subprocess communication

**When to use Streamable HTTP** (RECOMMENDED):

- Remote server deployments
- Cloud environments (AWS, Azure, GCP)
- Behind load balancers and proxies
- Stateless server design
- Better infrastructure compatibility

**Avoid SSE**: Deprecated in favor of Streamable HTTP (as of June 2025)

### Core MCP Primitives

```
Tools          → Executable functions (LLM-driven actions)
Resources      → Read-only data exposure (application-driven)
Prompts        → Instruction templates (user-driven)
```

Each has distinct purposes and interaction patterns. Use the right primitive for
your use case.

### Security Layers (Production)

1. **Network Layer**: Bind to localhost, validate origins, use TLS
2. **Authentication**: JWT tokens with proper expiration
3. **Authorization**: Capability-based ACLs, resource indicators
4. **Input Validation**: Zod schemas, type checking, sanitization
5. **Business Logic**: Core operations

All layers must work together for defense-in-depth security.

### Error Handling Strategy

Always categorize errors:

```
CLIENT_ERROR → User's fault (validation, auth, not found)
SERVER_ERROR → Your fault (database, service, logic)
EXTERNAL_ERROR → Dependency fault (API down, network)
```

Log full error details to stderr, return safe messages to clients.

### Testing Pyramid

```
   /\         E2E Tests (API integration)
  /  \        Integration Tests (workflows)
 /    \       Unit Tests (tools, functions)
/______\      Infrastructure (Docker, K8s)
```

MCP Inspector handles schema validation, write unit tests for business logic.

### Deployment Timeline

- **Week 1-2**: Protocol compliance and basic error handling
- **Week 3-4**: Security hardening and performance optimization
- **Week 5-6**: Load testing, monitoring, and runbooks

Target production metrics:

- Throughput: >1000 req/sec
- P95 Latency: <100ms
- Error Rate: <0.1%
- Uptime: 99.9%

---

## Official Resources

### Anthropic & MCP Team

- [Model Context Protocol Official Site](https://modelcontextprotocol.io)
- [MCP Specification (2025-06-18)](https://spec.modelcontextprotocol.io/specification/2025-06-18/)
- [MCP Best Practices Guide](https://modelcontextprotocol.info/docs/best-practices/)
- [TypeScript SDK Repository](https://github.com/modelcontextprotocol/typescript-sdk)
- [Example Servers](https://github.com/modelcontextprotocol/servers)

### Development Tools

- [MCP Inspector](https://github.com/modelcontextprotocol/inspector) - Visual
  testing and debugging
- [MCP Testing Framework](https://github.com/haakco/mcp-testing-framework) -
  Unit and integration testing
- [NPM SDK Package](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -
  Latest SDK version

### Community & Learning

- [DEV Community: Building MCP Servers with TypeScript](https://dev.to/shadid12/how-to-build-mcp-servers-with-typescript-sdk-1c28)
- [FreeCodeCamp: MCP Handbook for Developers](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/)
- [Snyk: Building Node.js MCP Servers](https://snyk.io/articles/how-to-build-an-mcp-server-in-node-js-to-provide-up-to-date-api-documentation/)
- [A Complete Guide to MCP in 2025](https://www.keywordsai.co/blog/introduction-to-mcp)

### Security & Operations

- [Docker MCP Catalog](https://www.docker.com/blog/docker-mcp-catalog-secure-way-to-discover-and-run-mcp-servers/)
- [MCP Security Best Practices](https://gopher.security/mcp-security/)
- [Microsoft Learn: Azure Deployment](https://learn.microsoft.com/en-us/azure/developer/ai/build-mcp-server-ts)
- [Deploying Remote MCP Servers](https://www.speakeasy.com/mcp/using-mcp/remote-servers)

---

## Code Examples Included

The `mcp-server-development.md` documentation includes three complete, runnable
examples:

### 1. Simple Calculator Server (STDIO)

- Basic tool implementation
- Input validation with Zod
- Error handling
- ~50 lines of code
- Perfect for learning

### 2. Database Query Server (Resources + Tools)

- Resource listing and reading
- Tool execution with schema validation
- Combined resource + tool pattern
- Security considerations (query validation)
- ~100 lines of code

### 3. Streamable HTTP Server (Authentication)

- Express.js server setup
- JWT authentication middleware
- Rate limiting
- Health check endpoints
- Production-ready structure
- ~80 lines of code

Each example demonstrates best practices and can be used as a template.

---

## Development Workflow

### 1. Setup Phase

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install --save-dev typescript @types/node ts-node
npm install @modelcontextprotocol/sdk
tsc --init
```

### 2. Development Phase

- Create server.ts with tools/resources/prompts
- Write schemas with Zod
- Add error handling and validation
- Test with MCP Inspector

### 3. Testing Phase

- Unit test tools with Vitest
- Integration test workflows
- Schema validation testing
- Load testing (k6, Artillery)

### 4. Deployment Phase

- Choose transport: STDIO (local), Streamable HTTP (remote), or Docker
- Configure environment variables
- Set up monitoring and logging
- Implement health checks and graceful shutdown

### 5. Operations Phase

- Monitor metrics (latency, errors, throughput)
- Set up alerts
- Create runbooks
- Plan incident response

---

## Common Patterns

### Tool Definition Template

```typescript
const myTool: Tool = {
  name: "tool_name",
  description: "What this tool does",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string" },
      param2: { type: "number" },
    },
    required: ["param1"],
  },
};
```

### Error Handling Template

```typescript
try {
  // Validate input
  // Execute tool
  // Return result
} catch (error) {
  // Log full error to stderr
  console.error(JSON.stringify({ error: error.message }));
  // Return safe error to client
  return {
    content: [{ type: "text", text: "Error message", isError: true }],
  };
}
```

### Security Middleware Pattern

```typescript
// 1. Authentication
// 2. Authorization
// 3. Input validation
// 4. Rate limiting
// 5. Business logic
// 6. Audit logging
```

---

## Performance Optimization

### Caching Strategies

- Cache tool responses where appropriate
- Use database connection pooling
- Implement circuit breakers for external APIs

### Async Processing

- Use async/await for non-blocking I/O
- Implement job queues for long-running tasks
- Consider worker threads for CPU-intensive operations

### Monitoring

- Track request latency (p50, p95, p99)
- Monitor error rates by category
- Alert on SLA violations
- Measure tool-specific metrics

---

## Troubleshooting Guide

### Common Issues

**Issue**: "Only write JSON-RPC to stdout" error

- **Solution**: Route all logging to stderr, not stdout
- **Check**: `console.log()` vs `console.error()`

**Issue**: Tool not appearing in MCP Inspector

- **Solution**: Ensure ListToolsRequest handler is registered
- **Check**: Tool schema is valid JSON Schema

**Issue**: Slow response times

- **Solution**: Add caching, optimize database queries
- **Check**: P95 latency trending upward?

**Issue**: Deployment fails with "command not found"

- **Solution**: Ensure Node.js and dependencies are in container
- **Check**: Docker file has npm install step

**Issue**: Authentication failures in production

- **Solution**: Verify JWT secret is configured
- **Check**: Token expiration and refresh strategy

---

## Compliance & Standards

### 2025 Specification Updates

- Resource Indicators for OAuth scoping
- Improved error messaging
- Security clarifications
- Better backwards compatibility

### Versioning

- Current spec: 2025-06-18
- SDK: v1.18.1+
- Always specify `MCP-Protocol-Version` in HTTP headers

### Supported by (as of Dec 2025)

- OpenAI (ChatGPT, Agents SDK)
- Google DeepMind (Gemini)
- Anthropic (Claude)
- Multiple coding assistants (Cursor, VS Code)

---

## Next Steps

1. **Read**: Start with "MCP Architecture & Overview" section
2. **Build**: Create a simple tool server using Example 1
3. **Test**: Run it with MCP Inspector
4. **Learn**: Review error handling and security sections
5. **Deploy**: Choose your deployment strategy
6. **Monitor**: Implement observability and alerting

For questions or additional resources, refer to the official MCP documentation
and community resources linked above.

---

**Last Updated**: December 2025 **Documentation Version**: 1.0 **Spec Version**:
2025-06-18 **TypeScript SDK**: v1.18.1+
