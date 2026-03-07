/**
 * defineBlock() — the core abstraction for full-stack blocks.
 *
 * A block packages storage schema, business logic (procedures), UI components,
 * and MCP tool definitions into a single composable unit that can deploy to
 * CF Workers, run in the browser, or execute in Node.js.
 */

import type { BuiltTool, CallToolResult, Procedure } from "@spike-land-ai/shared/tool-builder";
import { createProcedure, middleware } from "@spike-land-ai/shared/tool-builder";
import type { SchemaDef, TableDef } from "../core-logic/types.js";
import { schemaToSQL } from "../core-logic/types.js";
import type { StorageAdapter } from "../core-logic/types-block-sdk.js";

/** Base constraint for BuiltTool that avoids handler contravariance issues */
type AnyBuiltTool = BuiltTool<never, CallToolResult>;

// ─── Block Context ─────────────────────────────────────────────────────────

/** Context available to all block procedures */
export interface BlockContext {
  [key: string]: unknown;
  /** The storage adapter (D1, IDB, or memory) */
  storage: StorageAdapter;
  /** Current user ID (injected by auth middleware) */
  userId: string;
  /** Generate a unique ID */
  nanoid: (length?: number) => string;
}

/** Context builder passed to the `procedures` factory */
export interface BlockProcedureContext {
  /** Base procedure with BlockContext injected */
  procedure: Procedure<BlockContext>;
}

// ─── Block Definition Types ────────────────────────────────────────────────

/** Component map — React components provided by the block */
export type BlockComponents = Record<string, unknown>;

/** Block definition input (what the user writes) */
export interface BlockDefinition<
  TStorage extends Record<string, TableDef>,
  TProcedures extends Record<string, AnyBuiltTool>,
  TComponents extends BlockComponents,
> {
  /** Block name (kebab-case identifier) */
  name: string;
  /** Semantic version */
  version: string;
  /** Storage schema — tables the block needs */
  storage: TStorage;
  /** Business logic — procedures with middleware chains */
  procedures: (ctx: BlockProcedureContext) => TProcedures;
  /** React components — UI layer */
  components?: TComponents;
  /** MCP tool configuration — "auto" derives from procedures, or explicit override */
  tools?: "auto" | string[];
}

/** Resolved block — the output of defineBlock() */
export interface Block<
  _TStorage extends Record<string, TableDef>,
  TProcedures extends Record<string, AnyBuiltTool>,
  TComponents extends BlockComponents,
> {
  /** Block name */
  name: string;
  /** Semantic version */
  version: string;
  /** Storage schema */
  schema: SchemaDef;
  /** SQL statements to initialize storage */
  migrations: string[];
  /** Build procedures with a specific storage adapter and user context */
  createProcedures: (storage: StorageAdapter, userId: string) => TProcedures;
  /** React components */
  components: TComponents;
  /** Tool names that should be registered as MCP tools */
  toolNames: string[];
  /** Initialize storage (run migrations) */
  initialize: (storage: StorageAdapter) => Promise<void>;
  /** Get all tools as BuiltTool[] for MCP registration */
  getTools: (storage: StorageAdapter, userId: string) => BuiltTool[];
}

// ─── Simple nanoid implementation ──────────────────────────────────────────

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function nanoid(length = 21): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}

// ─── defineBlock ───────────────────────────────────────────────────────────

/**
 * Define a full-stack block.
 *
 * @example
 * ```ts
 * const myBlock = defineBlock({
 *   name: "task-queue",
 *   version: "1.0.0",
 *   storage: {
 *     tasks: defineTable("tasks", {
 *       id: t.string().primaryKey(),
 *       title: t.string(),
 *       status: t.enum(["pending", "claimed", "done"]),
 *     }),
 *   },
 *   procedures: (ctx) => ({
 *     createTask: ctx.procedure
 *       .tool("create_task", "Create a new task", { title: z.string() })
 *       .handler(async ({ input, ctx }) => {
 *         // ...
 *       }),
 *   }),
 *   tools: "auto",
 * });
 * ```
 */
export function defineBlock<
  TStorage extends Record<string, TableDef>,
  TProcedures extends Record<string, AnyBuiltTool>,
  TComponents extends BlockComponents = Record<string, never>,
>(
  definition: BlockDefinition<TStorage, TProcedures, TComponents>,
): Block<TStorage, TProcedures, TComponents> {
  // Build the schema from table definitions
  const schema: SchemaDef = {};
  for (const [key, tableDef] of Object.entries(definition.storage)) {
    schema[key] = tableDef;
  }

  // Generate SQL migrations
  const migrations = schemaToSQL(schema);

  // Create the procedure factory
  function createProcedures(storage: StorageAdapter, userId: string): TProcedures {
    const blockCtx: BlockContext = { storage, userId, nanoid };

    // Create a base procedure with BlockContext injected via middleware
    const withBlockContext = middleware<Record<string, unknown>, BlockContext>(
      async ({ ctx, next }) => next({ ...ctx, ...blockCtx }),
    );
    const procedure = createProcedure().use(withBlockContext) as unknown as Procedure<BlockContext>;

    // The user's procedure factory receives the context builder
    return definition.procedures({ procedure });
  }

  // Determine which procedures are MCP tools
  const toolNames: string[] = [];
  if (definition.tools === "auto") {
    // Probe with a dummy to discover tool names
    // We create procedures with a no-op storage to introspect names
    const dummyStorage: StorageAdapter = {
      kv: {
        /* v8 ignore next */ get: async (): Promise<null> => null,
        /* v8 ignore next */ put: async (): Promise<void> => {},
        /* v8 ignore next */ delete: async (): Promise<boolean> => false,
        /* v8 ignore next */ list: async (): Promise<[]> => [],
      },
      sql: {
        /* v8 ignore next */ execute: async (): Promise<{ rows: []; rowsAffected: 0 }> => ({ rows: [], rowsAffected: 0 }),
        /* v8 ignore next */ batch: async (): Promise<[]> => [],
      },
    };
    const procs = createProcedures(dummyStorage, "__introspect__");
    for (const [, tool] of Object.entries(procs)) {
      if (tool && typeof tool === "object" && "name" in tool && "handler" in tool) {
        toolNames.push(tool.name);
      }
    }
  } else if (Array.isArray(definition.tools)) {
    toolNames.push(...definition.tools);
  }

  return {
    name: definition.name,
    version: definition.version,
    schema,
    migrations,
    createProcedures,
    components: (definition.components ?? {}) as TComponents,
    toolNames,

    async initialize(storage: StorageAdapter): Promise<void> {
      for (const sql of migrations) {
        await storage.sql.execute(sql);
      }
    },

    getTools(storage: StorageAdapter, userId: string): BuiltTool[] {
      const procs = createProcedures(storage, userId);
      const tools: BuiltTool[] = [];
      for (const [, tool] of Object.entries(procs)) {
        if (
          tool &&
          typeof tool === "object" &&
          "name" in tool &&
          "handler" in tool &&
          toolNames.includes(tool.name)
        ) {
          tools.push(tool as BuiltTool);
        }
      }
      return tools;
    },
  };
}
