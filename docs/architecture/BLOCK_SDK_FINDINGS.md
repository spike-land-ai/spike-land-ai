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

Three `StorageAdapter` implementations share one interface:

| Adapter | Target | SQL | KV | Blobs |
|---|---|---|---|---|
| `d1Adapter` | CF Workers | D1 database | KV namespace (or Map fallback) | R2 bucket |
| `idbAdapter` | Browser | Regex SQL parser over IDB object stores | IDB object store | IDB object store |
| `createMemoryAdapter` | Node.js (tests) | In-memory Map with regex parser | In-memory Map | In-memory Map |

All three are confirmed working — `block-tasks` runs on D1 in production and memory in tests.

### Clean API surface

`defineBlock()` returns a `Block` with:
- `initialize(storage)` — runs CREATE TABLE migrations
- `createProcedures(storage, userId)` — builds typed procedure handlers
- `getTools(storage, userId)` — returns `BuiltTool[]` for MCP registration
- `schema`, `migrations`, `toolNames` — introspectable metadata

---

## The Gaps

### Schema DSL limitations

`defineTable()` supports 5 column types (`string`, `number`, `boolean`, `u64`, `enum`) with two modifiers (`primaryKey()`, `optional()`).

**Missing:**
- Foreign keys — no `.references()` method
- Indexes — no index definitions
- Composite primary keys — only single-column PK
- Column defaults — no `.default()` method
- Check constraints — no validation at schema level

`schemaToSQL()` generates bare `CREATE TABLE IF NOT EXISTS` statements. For anything beyond simple per-block CRUD tables, use Drizzle directly.

### IDB regex SQL parser

The IDB adapter (`src/block-sdk/adapters/idb.ts`, ~350 lines) implements SQL by regex-matching against patterns:

**Supported:** `CREATE TABLE`, `INSERT INTO ... VALUES`, `SELECT * FROM ... WHERE`, `UPDATE ... SET ... WHERE`, `DELETE FROM ... WHERE`

**Not supported:**
- `JOIN` (any type)
- `ORDER BY` / `LIMIT` / `OFFSET`
- `GROUP BY` / `HAVING` / aggregate functions
- Subqueries
- Column-specific `SELECT` (only `SELECT *`)
- `OR` conditions (only `AND`)
- `LIKE` / `IN` / `BETWEEN` operators

This works for the exact SQL patterns that `defineBlock()` procedures generate, but breaks on anything more complex. The parser is intentionally minimal — it's not trying to be sql.js.

### No SQLite adapter

The blog post's original ASCII table listed `better-sqlite3` for Node.js, but the actual implementation is an in-memory Map with the same regex parser. There is no adapter wrapping a real SQLite database (via better-sqlite3 or sql.js WASM). This means:

- Node.js testing doesn't exercise real SQL semantics
- No way to persist data in Node.js without D1 or a real database

A `sqlite` adapter using better-sqlite3 would close this gap for local dev and integration testing.

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
| Browser-side data persistence | block-sdk `idbAdapter` | Works for simple CRUD patterns |
| Test doubles for storage | block-sdk `createMemoryAdapter` | Fast, no setup, synchronous batch |

---

## Recommended Improvements

1. **Add `better-sqlite3` adapter** — real SQL semantics for Node.js testing and local dev
2. **Extend schema DSL** — `.default()`, `.index()`, `.references()` methods
3. **IDB: add ORDER BY / LIMIT** — the two most-needed SQL features for list queries
4. **Publish to GitHub Packages** — unblock external consumers
5. **Bridge with Drizzle** — allow blocks to reference Drizzle tables or vice versa

---

*This assessment is based on reading the actual source files, not design docs. Last verified: 2026-03-04.*
