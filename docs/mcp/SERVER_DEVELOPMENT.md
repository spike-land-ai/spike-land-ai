# MCP Server Development: Comprehensive Best Practices Guide

## Table of Contents

1. [MCP Architecture & Overview](#mcp-architecture--overview)
2. [Protocol Fundamentals](#protocol-fundamentals)
3. [Server Development with TypeScript SDK](#server-development-with-typescript-sdk)
4. [Core Components: Tools, Resources & Prompts](#core-components-tools-resources--prompts)
5. [Error Handling & Input Validation](#error-handling--input-validation)
6. [Security Best Practices](#security-best-practices)
7. [Testing & Debugging](#testing--debugging)
8. [Deployment Strategies](#deployment-strategies)
9. [Production Readiness Checklist](#production-readiness-checklist)
10. [Real-World Examples](#real-world-examples)

---

## MCP Architecture & Overview

### What is the Model Context Protocol?

The **Model Context Protocol (MCP)** is an open standard that enables language
models to access external data sources and perform specialized tasks in a
standardized way. Think of it as a "bridge" that gives LLMs controlled access to
specific data sources, APIs, and operations.

### Why MCP Matters

MCP solves three critical problems:

1. **Context Gap**: LLMs need access to current, domain-specific data beyond
   their training data
2. **Tool Integration**: Standardized way to expose APIs and operations to AI
   models
3. **Vendor Neutrality**: Works across Claude, ChatGPT, Cursor, VS Code, and
   other AI-powered applications

### Key Statistics (2025)

- Adopted by **OpenAI** (March 2025) across ChatGPT, Agents SDK, and Responses
  API
- Supported by **Google DeepMind** (April 2025) in upcoming Gemini models
- **12,698+** npm packages depend on the TypeScript SDK
- Official SDKs available in **Python, TypeScript, and Java/Kotlin**

---

## Protocol Fundamentals

### Transport Mechanisms

MCP uses **JSON-RPC 2.0** as its wire format and supports multiple transport
mechanisms:

#### 1. Standard Input/Output (STDIO)

**Best for**: Local integrations, CLI tools, development

**How it works**:

- Client launches MCP server as a subprocess
- Server reads JSON-RPC messages from stdin
- Server writes responses to stdout
- Messages are newline-delimited and must not contain embedded newlines
- Logging goes to stderr (clients may ignore)

**Advantages**:

- Microsecond-level response times (no network overhead)
- Simple subprocess management
- Ideal for local development and testing

**Configuration Example**:

```json
{
  "command": "node",
  "args": ["/path/to/mcp-server.js"]
}
```

#### 2. Streamable HTTP (Modern Standard - Recommended)

**Best for**: Remote servers, web applications, distributed systems

**How it works**:

- Uses HTTP POST for client-to-server messages
- Uses Server-Sent Events (SSE) streams for server-to-client messages
- Stateless: servers don't need persistent connections
- Single-endpoint architecture

**Advantages**:

- Infrastructure-friendly (compatible with proxies, CDNs, load balancers)
- Stateless server design enables horizontal scaling
- Works through firewalls and NATs
- Better for cloud deployments

**Message Flow**:

```
Client → POST /mcp → Server
Server ← SSE Stream ← Client (for notifications)
```

#### 3. Server-Sent Events (SSE) - Legacy

**Status**: Deprecated in favor of StreamableHTTP

Originally used for remote MCP access but now superseded by the more efficient
StreamableHTTP transport.

### Message Format

All transports use JSON-RPC 2.0 with MCP-specific headers:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "example_tool",
    "arguments": { "param": "value" }
  }
}
```

**Headers for Streamable HTTP**:

```http
POST /mcp HTTP/1.1
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-06-18
Mcp-Session-Id: [optional session identifier]
```

---

## Server Development with TypeScript SDK

### Project Setup

#### 1. Initialize TypeScript Project

```bash
# Create project directory
mkdir my-mcp-server && cd my-mcp-server

# Initialize package.json
npm init -y

# Install TypeScript and dependencies
npm install --save-dev typescript @types/node ts-node
npm install @modelcontextprotocol/sdk

# Create TypeScript configuration
tsc --init
```

#### 2. Create Basic Server Structure

```typescript
// src/server.ts
import {
  CallToolRequest,
  CallToolResult,
  Server,
  StdioServerTransport,
  Tool,
} from "@modelcontextprotocol/sdk";

// Initialize server with metadata
const server = new Server({
  name: "example-server",
  version: "1.0.0",
});

// Handle tool calls
server.setRequestHandler(
  CallToolRequest,
  async (request: CallToolRequest): Promise<CallToolResult> => {
    if (request.params.name === "add_numbers") {
      const args = request.params.arguments as {
        a: number;
        b: number;
      };
      return {
        content: [
          {
            type: "text",
            text: `Result: ${args.a + args.b}`,
          },
        ],
      };
    }
    throw new Error(`Unknown tool: ${request.params.name}`);
  },
);

// Start server with stdio transport
const transport = new StdioServerTransport();
server.connect(transport);
```

#### 3. Build and Configure

```bash
# Build TypeScript to JavaScript
npx tsc

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/server.js
```

### Key SDK Classes

| Class                  | Purpose                   | Example                           |
| ---------------------- | ------------------------- | --------------------------------- |
| `Server`               | Main server instance      | `new Server({name: "my-server"})` |
| `StdioServerTransport` | Stdio-based communication | `new StdioServerTransport()`      |
| `Tool`                 | Tool definition           | Describes inputs and outputs      |
| `Resource`             | Data exposure             | Wraps files, APIs, databases      |
| `Prompt`               | Instruction templates     | Reusable prompts for LLMs         |

---

## Core Components: Tools, Resources & Prompts

### Tools: Executable Functions

**Purpose**: Enable LLMs to perform actions and gather data dynamically.

**Definition Pattern**:

```typescript
import { Tool } from "@modelcontextprotocol/sdk";

// Define tool schema
const searchTool: Tool = {
  name: "search",
  description: "Search for information",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
      limit: {
        type: "number",
        description: "Maximum results (default: 10)",
        default: 10,
      },
    },
    required: ["query"],
  },
};

// Register tool handler
server.setRequestHandler(CallToolRequest, async (request) => {
  if (request.params.name === "search") {
    const { query, limit } = request.params.arguments as {
      query: string;
      limit?: number;
    };

    // Perform search
    const results = await performSearch(query, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results),
        },
      ],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});
```

**Tool Design Best Practices**:

1. **Single Responsibility**: One tool = one focused task
2. **Clear Descriptions**: Write descriptions that LLMs can understand
3. **Strict Schemas**: Use JSON Schema to define exact input/output formats
4. **Error Handling**: Return meaningful error messages within tool results
5. **Avoid Proliferation**: Don't create a tool for every API endpoint; group
   related operations

### Resources: Data Exposure

**Purpose**: Provide read-only data that clients can surface to users or models.

**Definition Pattern**:

```typescript
import { ReadResourceRequest, Resource } from "@modelcontextprotocol/sdk";

// Define resources
const resources: Resource[] = [
  {
    uri: "file:///config.json",
    name: "application_config",
    description: "Application configuration",
    mimeType: "application/json",
  },
  {
    uri: "database://users",
    name: "user_list",
    description: "List of application users",
    mimeType: "application/json",
  },
];

// Handle resource listing
server.setRequestHandler(ListResourcesRequest, async () => {
  return {
    resources: resources,
  };
});

// Handle resource reading
server.setRequestHandler(
  ReadResourceRequest,
  async (request: ReadResourceRequest) => {
    if (request.params.uri === "file:///config.json") {
      return {
        contents: [
          {
            uri: "file:///config.json",
            mimeType: "application/json",
            text: JSON.stringify(configData),
          },
        ],
      };
    }
    throw new Error(`Unknown resource: ${request.params.uri}`);
  },
);
```

**Resource Types**:

- **Static**: Configuration files, documentation
- **Dynamic**: Database records, API responses
- **Templated**: Resources with parameters (e.g., `database://users/{id}`)

### Prompts: Instruction Templates

**Purpose**: Provide reusable instruction templates that help users interact
with LLMs consistently.

**Definition Pattern**:

```typescript
import {
  GetPromptRequest,
  Prompt,
  PromptMessage,
} from "@modelcontextprotocol/sdk";

// Define prompts
const codeReviewPrompt: Prompt = {
  name: "code_review",
  description: "Analyze code quality and suggest improvements",
  arguments: [
    {
      name: "language",
      description: "Programming language",
      required: true,
    },
    {
      name: "code",
      description: "Code to review",
      required: true,
    },
  ],
};

// Handle prompt requests
server.setRequestHandler(
  GetPromptRequest,
  async (request: GetPromptRequest) => {
    if (request.params.name === "code_review") {
      const { language, code } = request.params.arguments as {
        language: string;
        code: string;
      };

      const messages: PromptMessage[] = [
        {
          role: "user",
          content:
            `Review this ${language} code for quality, performance, and security:\n\n${code}`,
        },
      ];

      return {
        messages: messages,
      };
    }
    throw new Error(`Unknown prompt: ${request.params.name}`);
  },
);
```

**Prompt Design Best Practices**:

1. **Clear Intent**: Prompts should guide consistent LLM behavior
2. **Parameterization**: Accept arguments for flexibility
3. **Context Inclusion**: Include relevant context in the template
4. **Constraint Definition**: Specify expected response format and boundaries

### Interaction Model

```
┌─────────────────┐
│  User/LLM       │
└────────┬────────┘
         │
    ┌────┴─────┬─────────┬──────────┐
    │           │         │          │
    v           v         v          v
[Prompt]   [Tool Call] [Resource] [Response]
    │           │         │
    └───────────┴────────┬────────┘
                         │
                    ┌────v─────────┐
                    │  MCP Server   │
                    │  (Executes)   │
                    └──────────────┘
```

---

## Error Handling & Input Validation

### Error Handling Strategy

Implement multi-layered error handling with clear categorization:

```typescript
// Define error types
enum ErrorCategory {
  CLIENT_ERROR = "CLIENT_ERROR", // Validation, auth, not found
  SERVER_ERROR = "SERVER_ERROR", // Internal failure
  EXTERNAL_ERROR = "EXTERNAL_ERROR", // Dependency failure
}

interface ErrorResponse {
  category: ErrorCategory;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Centralized error handling
async function executeToolSafely(
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  try {
    // Input validation (happens first)
    validateToolInput(toolName, args);

    // Business logic execution
    const result = await executeTool(toolName, args);

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (error) {
    // Log full error internally (for debugging)
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        tool: toolName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );

    // Return safe error to client
    if (error instanceof ValidationError) {
      return {
        content: [
          {
            type: "text",
            text: `Validation failed: ${error.message}`,
            isError: true,
          },
        ],
      };
    }

    if (error instanceof ExternalServiceError) {
      return {
        content: [
          {
            type: "text",
            text: `Service temporarily unavailable. Please retry.`,
            isError: true,
          },
        ],
      };
    }

    // Generic error (hides internal details)
    return {
      content: [
        {
          type: "text",
          text: "An unexpected error occurred. Please contact support.",
          isError: true,
        },
      ],
    };
  }
}
```

### Input Validation with Zod

**TypeScript-first schema validation**:

```typescript
import { z } from "zod";

// Define schemas
const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
});

const fileUploadSchema = z.object({
  filename: z.string().regex(/^[a-zA-Z0-9._-]+$/),
  content: z.string().max(10 * 1024 * 1024), // 10MB max
  mimeType: z.string().regex(/^[a-z]+\/[a-z0-9+.-]+$/),
});

// Validate before processing
function validateAndProcessSearch(args: unknown) {
  const validArgs = searchSchema.parse(args);
  // validArgs is now type-safe: { query: string, limit: number, offset: number }
  return performSearch(validArgs.query, validArgs.limit, validArgs.offset);
}

// Error handling for Zod
function handleValidationError(error: z.ZodError) {
  return {
    errors: error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
      code: e.code,
    })),
  };
}
```

### Logging Best Practice

**Critical Rule**: MCP servers must only write JSON-RPC messages to stdout. All
logging must go to stderr.

```typescript
// Correct: Logging to stderr
console.error(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "ERROR",
    message: "Database connection failed",
    error: error.message,
  }),
);

// Incorrect: Would corrupt protocol
console.log("Debug message"); // Never do this!

// Best practice: Structured logging helper
function logToStderr(level: string, message: string, context?: object) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    }),
  );
}
```

---

## Security Best Practices

### Multi-Layer Security Architecture

```
┌──────────────────────────────────────────┐
│         Network Layer                    │
│  • Bind to localhost only (127.0.0.1)   │
│  • Use TLS for remote connections        │
│  • Validate Origin headers               │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│      Authentication Layer                │
│  • Verify client credentials             │
│  • JWT token validation                  │
│  • Session management                    │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│      Authorization Layer                 │
│  • Capability-based ACLs                 │
│  • Resource-level permissions            │
│  • Rate limiting per client              │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│      Input Validation Layer              │
│  • Schema validation (Zod)               │
│  • Type checking                         │
│  • Sanitization                          │
└──────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│      Business Logic                      │
│  • Core server operations                │
│  • Data processing                       │
└──────────────────────────────────────────┘
```

### Implementation Example

```typescript
// Network security
const server = new Server({ name: "secure-server", version: "1.0.0" });

// Use Streamable HTTP with proper binding
app.listen(3000, "127.0.0.1"); // Only localhost, not 0.0.0.0

// Middleware: Origin validation
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ["http://localhost:3000", "http://localhost:8000"];

  if (!origin || !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  next();
});

// Middleware: Authentication
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization" });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyJWT(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
});

// Middleware: Rate limiting
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  keyGenerator: (req) => req.user?.id || req.ip,
});

app.use(limiter);

// Tool implementation with security checks
server.setRequestHandler(CallToolRequest, async (request) => {
  const { name, arguments: args } = request.params;

  // 1. Permission check
  if (!userHasToolAccess(req.user, name)) {
    return {
      content: [
        {
          type: "text",
          text: "Permission denied",
          isError: true,
        },
      ],
    };
  }

  // 2. Input validation
  const validationSchema = getToolSchema(name);
  const validArgs = validationSchema.parse(args);

  // 3. Audit logging
  logToolCall(req.user.id, name, validArgs);

  // 4. Execution
  try {
    const result = await executeTool(name, validArgs);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (error) {
    logToolError(req.user.id, name, error);
    throw error;
  }
});
```

### Authorization Pattern: Resource Indicators (2025)

June 2025 MCP spec update introduced Resource Indicators for secure token
scoping:

```typescript
// Client: Request token for specific resource
const tokenRequest = {
  resource_indicator: "https://mcp-server.example.com",
  scope: ["read:files", "write:metadata"],
};

// Server: Validate token is scoped for this server
function validateTokenScope(token: string, expectedResource: string): boolean {
  const decoded = jwt.decode(token);

  // Token issued for this server?
  if (decoded.aud !== expectedResource) {
    // Token intended for different service
    return false;
  }

  return true;
}
```

This prevents malicious servers from using tokens issued for other services.

---

## Testing & Debugging

### Testing Tools

#### MCP Inspector

Visual testing and debugging tool for MCP servers:

```bash
# Test local stdio server
npx @modelcontextprotocol/inspector node dist/server.js

# Test Streamable HTTP server
npx @modelcontextprotocol/inspector --transport http http://localhost:3000

# Enable debug output
DEBUG=mcp:* npx @modelcontextprotocol/inspector node dist/server.js
```

**Features**:

- Interactive UI for tool testing
- Schema validation
- Request/response visualization
- Error diagnosis

#### MCP Testing Framework

Advanced testing framework for comprehensive validation:

```bash
npm install @mcp/testing-framework --save-dev
```

### Unit Testing Example

```typescript
import { Server } from "@modelcontextprotocol/sdk";
import { describe, expect, it } from "vitest";

describe("MCP Server - Tools", () => {
  it("should execute add_numbers tool correctly", async () => {
    const server = new Server({ name: "test-server" });

    // Set up tool handler
    server.setRequestHandler(CallToolRequest, async (request) => {
      if (request.params.name === "add_numbers") {
        const { a, b } = request.params.arguments;
        return {
          content: [{ type: "text", text: String(a + b) }],
        };
      }
      throw new Error("Unknown tool");
    });

    // Test execution
    const result = await server.request(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "add_numbers",
          arguments: { a: 5, b: 3 },
        },
      },
      CallToolRequest,
    );

    expect(result.content[0].text).toBe("8");
  });

  it("should handle validation errors", async () => {
    // Test with invalid inputs
    const result = await server.request(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "add_numbers",
          arguments: { a: "not a number", b: 3 },
        },
      },
      CallToolRequest,
    );

    expect(result.content[0].isError).toBe(true);
  });
});
```

### Integration Testing

```typescript
import { test } from "@playwright/test";

test.describe("MCP Server Integration", () => {
  test("should list tools", async ({ fetch }) => {
    const response = await fetch("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });

    const data = await response.json();

    expect(data.result).toHaveProperty("tools");
    expect(data.result.tools.length).toBeGreaterThan(0);
  });

  test("should call tool with correct params", async ({ fetch }) => {
    const response = await fetch("http://localhost:3000/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "search",
          arguments: { query: "test", limit: 10 },
        },
      }),
    });

    const data = await response.json();

    expect(data.result).toBeDefined();
    expect(data.result.content).toBeDefined();
  });
});
```

### Debugging Techniques

#### 1. Enable Debug Logging

```bash
# Comprehensive MCP protocol logging
DEBUG=mcp:* node dist/server.js

# Specific module debugging
DEBUG=mcp:server node dist/server.js
```

#### 2. Local vs Remote Testing

```bash
# Local testing (faster, direct debugging)
npx @modelcontextprotocol/inspector node dist/server.js

# Remote testing (CI environment)
# Configure BASE_URL environment variable
BASE_URL=https://staging.example.com npx test:e2e
```

#### 3. Schema Validation

The MCP Inspector automatically validates:

- Tool input schemas match specifications
- Resource URIs are properly formed
- Message formats comply with JSON-RPC

---

## Deployment Strategies

### 1. NPX Distribution (Prototyping)

**Best for**: Learning, official Anthropic servers, local development

```bash
npm publish

# Usage by clients
npx @yourorg/mcp-server
```

**Configuration** (Claude Desktop):

```json
{
  "mcpServers": {
    "example": {
      "command": "npx",
      "args": ["-y", "@yourorg/mcp-server"]
    }
  }
}
```

**Security Note**: Executes code directly on host system with full privileges.
Only for trusted packages.

### 2. Docker Deployment (Production - Recommended)

**Best for**: Production, sensitive data, reproducible environments

#### Dockerfile Template

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY dist ./dist

# Expose if using HTTP
EXPOSE 3000

# Security: Run as non-root
RUN addgroup -g 1000 mcp && adduser -D -u 1000 -G mcp mcp
USER mcp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "dist/server.js"]
```

#### Docker Compose

```yaml
version: "3.8"

services:
  mcp-server:
    build: .
    container_name: mcp-server
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
      # Security: Use secrets for credentials
      API_KEY: ${API_KEY}
    volumes:
      # Mount read-only for config
      - ./config.json:/app/config.json:ro
    restart: unless-stopped
    networks:
      - mcp-network
    security_opt:
      - no-new-privileges:true

networks:
  mcp-network:
    driver: bridge
```

#### Docker Configuration in MCP Clients

```json
{
  "mcpServers": {
    "example": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "API_KEY", "ghcr.io/myorg/mcp-server"]
    }
  }
}
```

### 3. Container Orchestration (Kubernetes)

**Best for**: Large-scale deployments, high availability

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
  namespace: ai-agents

spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-server

  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      serviceAccountName: mcp-server
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000

      containers:
        - name: server
          image: ghcr.io/myorg/mcp-server:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: NODE_ENV
              value: production
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: mcp-secrets
                  key: api-key
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: mcp-server
  namespace: ai-agents

spec:
  selector:
    app: mcp-server
  ports:
    - port: 3000
      targetPort: 3000
      name: http
  type: ClusterIP
```

### Environment-Specific Configuration

```typescript
// config.ts
interface ServerConfig {
  port: number;
  host: string;
  environment: "development" | "staging" | "production";
  logLevel: "debug" | "info" | "warn" | "error";
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  database: {
    url: string;
    pool: number;
  };
}

const getConfig = (): ServerConfig => {
  const env = process.env.NODE_ENV || "development";

  const baseConfig: ServerConfig = {
    port: parseInt(process.env.PORT || "3000"),
    host: process.env.HOST || "127.0.0.1",
    environment: env as "development" | "staging" | "production",
    logLevel: (process.env.LOG_LEVEL || "info") as
      | "debug"
      | "info"
      | "warn"
      | "error",
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
    },
    database: {
      url: process.env.DATABASE_URL || "postgresql://localhost/mcp",
      pool: parseInt(process.env.DB_POOL_SIZE || "10"),
    },
  };

  if (env === "production") {
    return {
      ...baseConfig,
      host: "0.0.0.0", // Use appropriate binding for container
      logLevel: "warn",
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 1000,
      },
    };
  }

  return baseConfig;
};

export default getConfig();
```

---

## Production Readiness Checklist

### Phase 1: Weeks 1-2 - Foundation

- [ ] Protocol compliance verification with MCP Inspector
- [ ] Error handling for all failure paths
- [ ] Input validation with schemas (Zod)
- [ ] Basic monitoring and health checks

**Success Metrics**:

- All tools execute correctly via Inspector
- Error messages are clear and actionable
- Schema validation catches invalid inputs

### Phase 2: Weeks 3-4 - Security & Performance

- [ ] Authentication implementation (JWT tokens)
- [ ] Authorization with capability-based ACLs
- [ ] Rate limiting per client
- [ ] Input sanitization and output encoding
- [ ] Performance optimization and caching
- [ ] Database connection pooling

**Success Metrics**:

- All security layers functioning
- P95 latency < 100ms
- Zero unhandled exceptions

### Phase 3: Weeks 5-6 - Observability & Resilience

- [ ] Comprehensive structured logging
- [ ] Distributed tracing (optional)
- [ ] Circuit breakers for external dependencies
- [ ] Graceful degradation strategies
- [ ] Load testing and chaos engineering
- [ ] Runbooks for common issues

**Success Metrics**:

- Throughput > 1000 req/sec
- Error rate < 0.1%
- 99.9%+ uptime SLA

### Production Metrics

Monitor these KPIs:

```typescript
interface ProductionMetrics {
  // Throughput
  requestsPerSecond: number;
  toolCallsPerSecond: number;

  // Latency
  p50Latency: number; // milliseconds
  p95Latency: number;
  p99Latency: number;

  // Errors
  errorRate: number; // percentage
  exceptionRate: number;
  validationErrorRate: number;

  // Availability
  uptime: number; // percentage
  deploymentFrequency: number;
  failureRecoveryTime: number;
}

// Target Production Metrics (2025)
const targets: ProductionMetrics = {
  requestsPerSecond: 1000,
  toolCallsPerSecond: 500,
  p50Latency: 50, // ms
  p95Latency: 100,
  p99Latency: 500,
  errorRate: 0.001, // 0.1%
  exceptionRate: 0.0001,
  validationErrorRate: 0.05, // 5%
  uptime: 0.999, // 99.9%
  deploymentFrequency: 7, // per week
  failureRecoveryTime: 5, // minutes
};
```

---

## Real-World Examples

### Example 1: Simple Tool Server

**Use Case**: Calculator service

```typescript
import {
  CallToolRequest,
  CallToolResult,
  Server,
  StdioServerTransport,
  Tool,
} from "@modelcontextprotocol/sdk";
import { z } from "zod";

const server = new Server({
  name: "calculator",
  version: "1.0.0",
});

// Define tools
const calculatorTools: Tool[] = [
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
  {
    name: "multiply",
    description: "Multiply two numbers",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["a", "b"],
    },
  },
];

// Tool schemas for validation
const addSchema = z.object({ a: z.number(), b: z.number() });
const multiplySchema = z.object({ a: z.number(), b: z.number() });

// Register tool handler
server.setRequestHandler(
  CallToolRequest,
  async (request: CallToolRequest): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "add") {
        const { a, b } = addSchema.parse(args);
        return {
          content: [{ type: "text", text: String(a + b) }],
        };
      }

      if (name === "multiply") {
        const { a, b } = multiplySchema.parse(args);
        return {
          content: [{ type: "text", text: String(a * b) }],
        };
      }

      return {
        content: [
          { type: "text", text: `Unknown tool: ${name}`, isError: true },
        ],
      };
    } catch (error) {
      console.error(JSON.stringify({ tool: name, error: String(error) }));
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            isError: true,
          },
        ],
      };
    }
  },
);

// Export tools endpoint handler
server.setRequestHandler(ListToolsRequest, async () => {
  return { tools: calculatorTools };
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

### Example 2: Resource & Tool Combination Server

**Use Case**: Database query server

```typescript
import {
  CallToolRequest,
  ListResourcesRequest,
  ReadResourceRequest,
  Resource,
  Server,
  Tool,
} from "@modelcontextprotocol/sdk";
import Database from "better-sqlite3";

const server = new Server({
  name: "database",
  version: "1.0.0",
});

const db = new Database(":memory:");

// Resources: expose database schema
server.setRequestHandler(ListResourcesRequest, async () => {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    )
    .all() as Array<{ name: string }>;

  const resources: Resource[] = tables.map((table) => ({
    uri: `database://schema/${table.name}`,
    name: `${table.name}_schema`,
    description: `Schema for ${table.name} table`,
    mimeType: "application/json",
  }));

  return { resources };
});

server.setRequestHandler(
  ReadResourceRequest,
  async (request: ReadResourceRequest) => {
    const match = request.params.uri.match(
      /^database:\/\/schema\/(.+)$/,
    );
    if (!match) {
      throw new Error(`Invalid resource URI: ${request.params.uri}`);
    }

    const tableName = match[1];

    // Get table schema
    const columns = db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{
        name: string;
        type: string;
        notnull: number;
      }>;

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(columns, null, 2),
        },
      ],
    };
  },
);

// Tools: query database
const queryTool: Tool = {
  name: "query",
  description: "Execute SQL query",
  inputSchema: {
    type: "object",
    properties: {
      sql: { type: "string", description: "SQL query to execute" },
    },
    required: ["sql"],
  },
};

server.setRequestHandler(CallToolRequest, async (request) => {
  if (request.params.name === "query") {
    const { sql } = request.params.arguments as { sql: string };

    // Security: Validate query (simple check - expand in production)
    if (sql.toLowerCase().includes("drop")) {
      return {
        content: [
          {
            type: "text",
            text: "DROP operations not allowed",
            isError: true,
          },
        ],
      };
    }

    try {
      const result = db.prepare(sql).all();
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Query error: ${
              error instanceof Error ? error.message : "Unknown"
            }`,
            isError: true,
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

server.setRequestHandler(ListToolsRequest, async () => {
  return { tools: [queryTool] };
});
```

### Example 3: Streamable HTTP Server

**Use Case**: Remote MCP server with authentication

```typescript
import { Server as MCPServer } from "@modelcontextprotocol/sdk";
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";

const app = express();
const mcpServer = new MCPServer({
  name: "http-server",
  version: "1.0.0",
});

// Middleware: JSON parsing
app.use(express.json());

// Middleware: Authentication
app.use((req: Request, res: Response, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization" });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// MCP Endpoint: Handle both POST (messages) and GET (SSE stream)
app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const message = req.body;

    // Process MCP message
    const response = await mcpServer.handle(message);

    // Send JSON response or SSE stream
    if (response.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      for await (const event of response.stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
    } else {
      res.json(response);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "127.0.0.1", () => {
  console.error(
    JSON.stringify({
      message: "MCP server listening",
      port: PORT,
      timestamp: new Date().toISOString(),
    }),
  );
});
```

---

## References & Resources

### Official Documentation

- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs/concepts/transports)
- [MCP Best Practices Guide](https://modelcontextprotocol.info/docs/best-practices/)
- [MCP TypeScript SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Inspector Tool](https://github.com/modelcontextprotocol/inspector)

### Community Resources

- [Building MCP Servers with TypeScript SDK - DEV Community](https://dev.to/shadid12/how-to-build-mcp-servers-with-typescript-sdk-1c28)
- [FreeCodeCamp: How to Build a Custom MCP Server](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/)
- [MCP Server Examples on GitHub](https://github.com/modelcontextprotocol/servers)
- [Docker MCP Catalog](https://www.docker.com/blog/docker-mcp-catalog-secure-way-to-discover-and-run-mcp-servers/)

### Security & Operations

- [MCP Security Best Practices](https://gopher.security/mcp-security/mcp-security-checklist-owasp-best-practices)
- [Error Handling in MCP Servers](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)
- [Unit Testing MCP Servers](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/)

### Deployment & DevOps

- [Microsoft Learn: Building MCP Servers on Azure](https://learn.microsoft.com/en-us/azure/developer/ai/build-mcp-server-ts)
- [Deploying Remote MCP Servers - Speakeasy](https://www.speakeasy.com/mcp/using-mcp/remote-servers)
- [How to Run MCP Servers with Docker - Snyk](https://snyk.io/articles/how-to-run-mcp-servers-with-docker/)

---

## Conclusion

Building production-ready MCP servers requires attention to:

1. **Protocol Compliance**: Use the MCP Inspector to validate schemas and
   message formats
2. **Security First**: Implement multi-layer validation, authentication, and
   authorization
3. **Error Handling**: Categorize errors and return safe messages to clients
4. **Testing**: Unit test tools, integration test workflows, and load test
   production
5. **Monitoring**: Measure latency, throughput, errors, and availability
6. **Deployment**: Choose appropriate transport (stdio, Streamable HTTP, Docker)
7. **Documentation**: Provide clear descriptions and examples for tool schemas

By following these best practices, you'll build MCP servers that are secure,
performant, and maintainable for production use.

---

**Last Updated**: December 2025 **Framework**: MCP Specification 2025-06-18
**SDK Versions**: TypeScript SDK v1.18.1+
