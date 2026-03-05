# block-sdk Technical Assessment

> Honest evaluation of `src/block-sdk/` — what works, what's missing, when to use it.
>
> **Date:** 2026-03-04 | **Version:** 0.1.0 (unpublished)

---

## The Good

### Phantom-branded context types (tRPC-style)

`defineBlock()` uses the shared `tool-builder` to inject `BlockContext` (storage, userId, nanoid) via middleware. The context flows through phantom-branded types — you get full type inference in procedure handlers without any casts. This is the same pattern as tRPC's context piping.

### `tools: "auto"` discovery

When `tools: "auto"` is set, `defineBlock()` creates a dummy storage adapter, runs the procedure factory, and introspects which procedures have tool metadata (`.name` + `.handler`). Those become MCP tools automatically. Write a procedure, get a tool — zero registration boilerplate.

### Runtime portability

Four `StorageAdapter` implementations share one interface:

| Adapter | Target | SQL | KV | Blobs |
|---|---|---|---|---|
| `d1Adapter` | CF Workers | D1 database | KV namespace (or Map fallback) | R2 bucket |
| `idbAdapter` | Browser | sql.js WASM (lazy-loaded, IDB persistence) | IDB object store | IDB object store |
| `sqliteAdapter` | Node.js | better-sqlite3 (WAL mode, FK enforcement) | SQLite `__kv__` table | SQLite `__blobs__` table |
| `createMemoryAdapter` | Node.js (tests) | In-memory Map with regex parser | In-memory Map | In-memory Map |

All four are confirmed working — `block-tasks` runs on D1 in production, memory in tests, and sqlite for integration testing.

### Clean API surface

`defineBlock()` returns a `Block` with:
- `initialize(storage)` — runs CREATE TABLE migrations
- `createProcedures(storage, userId)` — builds typed procedure handlers
- `getTools(storage, userId)` — returns `BuiltTool[]` for MCP registration
- `schema`, `migrations`, `toolNames` — introspectable metadata

---

## The Gaps (Resolved / Remaining)

### Schema DSL — extended (resolved 2026-03-04)

`defineTable()` supports 5 column types (`string`, `number`, `boolean`, `u64`, `enum`) with four modifiers:
- `primaryKey()` — mark as primary key
- `optional()` — mark as nullable
- `default(value)` — set a column default (`DEFAULT 'pending'`, `DEFAULT 0`, `DEFAULT 1`)
- `references(table, column)` — inline foreign key (`REFERENCES users(id)`)

Table-level indexes via optional 3rd argument to `defineTable()`:
```typescript
defineTable("tasks", { ... }, {
  indexes: [{ name: "idx_tasks_user", columns: ["user_id"], unique: false }]
})
```
`schemaToSQL()` generates `CREATE TABLE` + `CREATE INDEX IF NOT EXISTS` statements.

**Still missing:** Composite primary keys, check constraints. Use Drizzle for those.

### IDB SQL — sql.js WASM (resolved 2026-03-04)

The IDB adapter now uses sql.js WASM as an in-memory query engine with IDB as durable persistence:
- sql.js WASM is lazy-loaded on first `execute()` call
- IDB remains the source of truth (survives page reloads)
- Writes go to both sql.js and IDB; reads query sql.js only
- **Full SQL support:** ORDER BY, LIMIT, JOIN, GROUP BY, OR, subqueries, column-specific SELECT

### SQLite adapter — better-sqlite3 (resolved 2026-03-04)

`sqliteAdapter()` wraps better-sqlite3 with WAL mode and FK enforcement:
```typescript
import { sqliteAdapter } from "@spike-land-ai/block-sdk/adapters/sqlite";
const adapter = sqliteAdapter(); // in-memory
const adapter = sqliteAdapter({ path: "./data.db" }); // file-backed
```
Full SQL semantics, transactions via `batch()`, KV via `__kv__` table, blobs via `__blobs__` table.

### Two parallel DB systems

The monorepo runs two database abstractions:

1. **Drizzle ORM** — used by `spike-land-mcp` (17 tables), `mcp-auth` (Better Auth tables), `spike-edge`
2. **block-sdk** — used by `block-tasks`, `block-website`

These don't share schemas, migrations, or tooling. Drizzle has `drizzle-kit generate/migrate`. block-sdk has `schemaToSQL()` + `initialize()`. There's no bridge between them.

### v0.1.0 unpublished

`block-sdk` is not yet published to GitHub Packages. It's consumed via workspace references only. The API surface may still change.

---

## When to Use What

| Need | Use | Why |
|---|---|---|
| Simple per-block CRUD (tasks, notes, config) | block-sdk `defineBlock()` | Schema + procedures + MCP tools in one unit |
| Complex relational data (users, tools, subscriptions) | Drizzle ORM | FK, indexes, migrations, Drizzle Studio |
| MCP tool definitions without storage | `shared/tool-builder` | Phantom-branded types, no DB needed |
| Real-time sync between clients | Durable Objects | WebSocket push, not a DB concern |
| Browser-side data persistence | block-sdk `idbAdapter` | Full SQL via sql.js WASM with IDB durability |
| Node.js local dev / integration testing | block-sdk `sqliteAdapter` | Real SQLite with WAL mode and FK enforcement |
| Test doubles for storage | block-sdk `createMemoryAdapter` | Fast, no setup, synchronous batch |

---

## Remaining Improvements

1. ~~Add `better-sqlite3` adapter~~ — **Done** (2026-03-04)
2. ~~Extend schema DSL~~ — **Done** (2026-03-04): `.default()`, `.index()`, `.references()`
3. ~~IDB: full SQL support~~ — **Done** (2026-03-04): sql.js WASM replaces regex parser
4. **Publish to GitHub Packages** — unblock external consumers (not this sprint)
5. **Bridge with Drizzle** — documented decision: keep separate (different tools for different jobs)

---

*This assessment is based on reading the actual source files, not design docs. Last verified: 2026-03-04.*
