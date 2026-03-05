# D1 + Drizzle ORM Quick Start

This guide covers database development for spike-land-ai services using
Cloudflare D1 and Drizzle ORM. It replaces the archived PostgreSQL + Prisma
guide.

## What is D1?

[Cloudflare D1](https://developers.cloudflare.com/d1/) is a serverless SQLite
database that runs at the Cloudflare edge. Key characteristics:

- **SQLite-based** -- familiar SQL syntax, lightweight, zero configuration
- **Edge-native** -- co-located with Cloudflare Workers for minimal latency
- **Serverless** -- no connection pooling, no server management, no cold starts
- **Built-in replication** -- automatic read replicas across Cloudflare's network
- **Free tier** -- generous limits for development and small projects

In spike-land-ai, D1 is used by:

- **spike-land-mcp** -- MCP registry database (users, workspaces, tools, agents,
  audit logs, etc.)
- **mcp-auth** -- Authentication database (users, sessions, accounts,
  verifications)

## Drizzle ORM Setup

[Drizzle ORM](https://orm.drizzle.team/) is a TypeScript ORM that provides
type-safe database access with zero runtime overhead. We use the SQLite dialect
for D1.

### Dependencies

Each worker that uses D1 includes these packages:

```json
{
  "dependencies": {
    "drizzle-orm": "^0.45.1"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.9"
  }
}
```

### Schema Definition

Schemas are defined using `sqliteTable()` from `drizzle-orm/sqlite-core`. Schema
files live at `db/schema.ts` within each worker package.

Here is a real example from `src/spike-land-mcp/db/schema.ts`:

```typescript
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  role: text("role").notNull().default("user"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    lastUsedAt: integer("last_used_at", { mode: "number" }),
    expiresAt: integer("expires_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("api_keys_user_id_idx").on(t.userId),
    hashIdx: index("api_keys_key_hash_idx").on(t.keyHash),
  }),
);
```

And from `src/mcp-auth/db/schema.ts` (Better Auth convention):

```typescript
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  role: text("role"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  // ...
});
```

### Key Patterns

- **Primary keys**: Always `text("id")` (UUIDs or nanoids, not autoincrement)
- **Timestamps**: Use `integer("...", { mode: "number" })` for Unix timestamps
  or `{ mode: "timestamp" }` for Date objects
- **Foreign keys**: Use `.references(() => table.id, { onDelete: "cascade" })`
- **Indexes**: Define as the third argument to `sqliteTable()`
- **JSON fields**: Store as `text()` with `.default("{}")`, parse in application
  code
- **Relations**: Define separately using `relations()` for type-safe joins

## Migration Commands

### Generate Migrations

After modifying a schema file, generate the SQL migration:

```bash
# spike-land-mcp
cd src/spike-land-mcp
npm run db:generate       # drizzle-kit generate

# mcp-auth
cd src/mcp-auth
npm run db:generate       # drizzle-kit generate
```

This reads the schema, diffs against the previous state, and writes a new SQL
migration file to the `drizzle/` or `migrations/` directory.

### Apply Migrations Locally

Apply migrations to the local D1 database (used during `wrangler dev`):

```bash
# spike-land-mcp
cd src/spike-land-mcp
npm run db:migrate:local  # wrangler d1 migrations apply spike-land-mcp --local
```

### Apply Migrations to Remote (Production)

Apply migrations to the remote D1 database:

```bash
# spike-land-mcp
cd src/spike-land-mcp
npm run db:migrate:remote # wrangler d1 migrations apply spike-land-mcp --remote
```

### Push Schema Directly (mcp-auth)

mcp-auth also supports pushing the schema directly without migration files,
useful during early development:

```bash
cd src/mcp-auth
npm run db:push           # drizzle-kit push
```

## Local Development with `--local`

When you run `wrangler dev`, D1 databases are automatically available locally.
The local D1 state is stored in the `.wrangler/` directory.

```bash
# Start the worker with local D1
npm run dev

# Query the local database directly
npx wrangler d1 execute spike-land-mcp --local \
  --command "SELECT * FROM users LIMIT 10;"

# Run a seed script against local D1
npx wrangler d1 execute spike-land-mcp --local \
  --file ./scripts/seed.sql
```

The `--local` flag ensures you never accidentally touch production data.

## Remote Migrations

For production database changes, always follow this workflow:

1. **Modify the schema** in `db/schema.ts`
2. **Generate a migration**: `npm run db:generate`
3. **Review the generated SQL** in the migrations directory
4. **Test locally**: `npm run db:migrate:local` then `npm run dev`
5. **Apply to remote**: `npm run db:migrate:remote`
6. **Deploy the worker**: `npm run deploy`

Always apply remote migrations **before** deploying the new worker code. The new
code expects the updated schema to be in place.

## Drizzle Studio

mcp-auth includes a Drizzle Studio script for browsing the database with a
visual GUI:

```bash
cd src/mcp-auth
npm run db:studio         # drizzle-kit studio
```

This opens a local web UI where you can browse tables, run queries, and inspect
data. Useful for debugging auth issues.

## Querying D1 from Workers

In your worker code, initialize the Drizzle client from the D1 binding:

```typescript
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export default {
  async fetch(request: Request, env: Env) {
    const db = drizzle(env.DB, { schema });

    // Type-safe queries
    const allUsers = await db.select().from(schema.users);

    const userWithKeys = await db.query.users.findFirst({
      where: eq(schema.users.email, "user@example.com"),
      with: { apiKeys: true },
    });

    // Insert
    await db.insert(schema.users).values({
      id: crypto.randomUUID(),
      email: "new@example.com",
      role: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return new Response("OK");
  },
};
```

## Comparison: Old Stack vs New Stack

| Aspect               | Old (PostgreSQL + Prisma)              | New (D1 + Drizzle)                     |
| --------------------- | -------------------------------------- | -------------------------------------- |
| **Database**          | PostgreSQL (Aurora RDS)                | SQLite (Cloudflare D1)                 |
| **ORM**               | Prisma                                 | Drizzle ORM                            |
| **Schema language**   | `schema.prisma` (custom DSL)           | TypeScript (`sqliteTable()`)           |
| **Migration tool**    | `prisma migrate`                       | `drizzle-kit generate` + `wrangler d1` |
| **Type generation**   | `prisma generate` (separate step)      | Built-in (schema IS the types)         |
| **Connection**        | TCP connection pool (pgbouncer)        | Direct binding (zero latency)          |
| **Hosting**           | AWS Aurora (us-east-1)                 | Cloudflare edge (global)               |
| **Cost**              | ~$50+/month (Aurora + NAT Gateway)     | Free tier / pay-per-query              |
| **Cold start impact** | Connection pool warm-up (~200ms)       | None (binding, not connection)         |
| **Local dev**         | Docker Compose + `prisma db push`      | `wrangler dev --local` (built-in)      |
| **GUI**               | Prisma Studio                          | Drizzle Studio (`drizzle-kit studio`)  |
| **Runtime overhead**  | Prisma Client (~2MB)                   | ~0 (thin SQL wrapper)                  |
| **Replication**       | Manual (Aurora read replicas)          | Automatic (Cloudflare network)         |

The migration from PostgreSQL + Prisma to D1 + Drizzle was completed as part of
the AWS infrastructure decommissioning in March 2026. All production data now
lives in D1.
