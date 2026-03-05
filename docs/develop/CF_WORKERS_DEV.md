# Cloudflare Workers Local Development Guide

This guide covers local development for the spike-land-ai Cloudflare Workers
services: **spike-edge**, **spike-land-mcp**, and **mcp-auth**.

## Prerequisites

- **Node.js 24** (via NVM)
- **wrangler** (installed as a devDependency in each worker package, v4.69+)
- A Cloudflare account with appropriate permissions (for remote dev and deploys)

Each worker package includes `wrangler` in its `devDependencies`, so no global
install is needed. Just run `npm install` in the package directory.

## Starting Local Dev Servers

All three workers use the same local dev command:

```bash
# spike-edge (edge API service)
cd src/spike-edge
npm run dev            # wrangler dev

# spike-land-mcp (MCP registry, 80+ tools, D1-backed)
cd src/spike-land-mcp
npm run dev            # wrangler dev

# mcp-auth (authentication service, Better Auth + Drizzle)
cd src/mcp-auth
npm run dev            # wrangler dev
```

### Remote Dev Mode

spike-edge supports remote dev mode, which connects to production bindings
(R2 buckets, Durable Objects, etc.) while running locally:

```bash
cd src/spike-edge
npm run dev:remote     # wrangler dev --remote
```

Use remote mode when you need to test against real R2 buckets or Durable Objects
that cannot be emulated locally.

## Local Secrets with `.dev.vars`

Wrangler reads local secrets from a `.dev.vars` file in the worker's root
directory. This file is **not checked into git**.

Create a `.dev.vars` file for each worker that needs secrets:

```bash
# src/spike-edge/.dev.vars
STRIPE_SECRET_KEY=sk_test_...
GEMINI_API_KEY=...
CLAUDE_OAUTH_TOKEN=...
GITHUB_TOKEN=ghp_...
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

```bash
# src/mcp-auth/.dev.vars
AUTH_SECRET=your-local-auth-secret
```

Each worker's `env.ts` file documents the expected environment variables. Check
there for the full list of required bindings.

## Production Log Streaming

Use `wrangler tail` to stream real-time logs from a deployed worker:

```bash
# Stream logs from a specific worker
npx wrangler tail spike-edge
npx wrangler tail spike-land-mcp
npx wrangler tail mcp-auth

# Filter by status (useful for debugging errors)
npx wrangler tail spike-edge --status error

# Filter by search string
npx wrangler tail spike-edge --search "POST /proxy"

# JSON output for piping to other tools
npx wrangler tail spike-edge --format json
```

## D1 Database Queries

Workers that use D1 (spike-land-mcp, mcp-auth) support local and remote
database operations via wrangler:

```bash
# Execute SQL against the local D1 database
npx wrangler d1 execute spike-land-mcp --local --command "SELECT * FROM users LIMIT 5;"

# Execute SQL against the remote (production) D1 database
npx wrangler d1 execute spike-land-mcp --remote --command "SELECT COUNT(*) FROM registered_tools;"

# Run a SQL file
npx wrangler d1 execute spike-land-mcp --local --file ./seed.sql
```

See the [D1 Quick Start](./D1_QUICK_START.md) guide for migration and schema
management details.

## Worker-Specific Scripts

### spike-edge

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Local wrangler dev server            |
| `npm run dev:remote` | Remote dev (uses production bindings)|
| `npm run deploy`     | Deploy to production (minified)      |
| `npm run typecheck`  | TypeScript type checking             |
| `npm run lint`       | ESLint                               |
| `npm test`           | Vitest                               |

### spike-land-mcp

| Command                   | Description                       |
| ------------------------- | --------------------------------- |
| `npm run dev`             | Local wrangler dev server         |
| `npm run deploy`          | Deploy to production              |
| `npm run deploy:staging`  | Deploy to staging                 |
| `npm run db:generate`     | Generate Drizzle migrations       |
| `npm run db:migrate:local`| Apply migrations locally          |
| `npm run db:migrate:remote`| Apply migrations to remote D1    |
| `npm run typecheck`       | TypeScript type checking          |
| `npm test`                | Vitest                            |

### mcp-auth

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Local wrangler dev server            |
| `npm run deploy`     | Deploy to Cloudflare Workers         |
| `npm run db:generate`| Generate Drizzle migrations          |
| `npm run db:push`    | Push schema to database              |
| `npm run db:studio`  | Open Drizzle Studio (database GUI)   |
| `npm run typecheck`  | TypeScript type checking             |
| `npm test`           | Vitest                               |

## Common Issues

### Port Conflicts

By default, `wrangler dev` binds to port 8787. When running multiple workers
simultaneously, you will get port conflicts. Override the port per worker:

```bash
# Terminal 1
cd src/spike-edge
npx wrangler dev --port 8787

# Terminal 2
cd src/spike-land-mcp
npx wrangler dev --port 8788

# Terminal 3
cd src/mcp-auth
npx wrangler dev --port 8789
```

Alternatively, configure the port in each worker's `wrangler.toml`:

```toml
[dev]
port = 8788
```

### Binding Errors

If you see errors like `ERROR: No binding found for ...`, it usually means:

1. **Missing D1 binding** -- The `wrangler.toml` references a D1 database that
   does not exist locally. Run the migration command to initialize:
   ```bash
   npm run db:migrate:local
   ```

2. **Missing R2 bucket** -- Local R2 buckets are created automatically on first
   access during `wrangler dev`. If you see errors, check that your
   `wrangler.toml` has the correct bucket name.

3. **Missing service binding** -- Some workers reference other workers via
   service bindings (e.g., spike-edge references AUTH_MCP). When running locally,
   the bound worker must also be running. Start both workers in separate
   terminals.

4. **Missing Durable Object** -- If a Durable Object migration is referenced in
   `wrangler.toml`, wrangler handles it automatically in local mode. If you see
   errors, try clearing the local state:
   ```bash
   rm -rf .wrangler/state
   ```

### Authentication Failures in Local Dev

When spike-edge calls mcp-auth via a service binding, both workers must be
running locally. If auth calls fail, verify:

- mcp-auth is running on the expected port
- The service binding in spike-edge's `wrangler.toml` points to the correct
  worker name

### Stale Local State

If local dev behaves unexpectedly after pulling new code, clear the local
wrangler state:

```bash
rm -rf .wrangler/
npm run db:migrate:local   # re-apply migrations
```
