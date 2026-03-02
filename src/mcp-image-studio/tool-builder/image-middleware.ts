/**
 * Image Studio Middleware
 *
 * Composable middleware for mcp-image-studio tools.
 * Extracted from the ToolBuilder class into independent, reusable functions.
 */

import { createProcedure, middleware } from "@spike-land-ai/shared/tool-builder";
import type {
  AlbumHandle,
  AlbumRow,
  EnhancementJobRow,
  EnhancementTier,
  ImageId,
  ImageRow,
  ImageStudioDeps,
  ToolContext,
  ToolEvent,
} from "../types.js";
import { errorResult, toolEvent } from "../types.js";
import { resolveImageOrError, consumeCreditsOrError } from "../define-tool.js";
import { tryCatch } from "../tools/try-catch.js";

// ─── Entity type mapping ───

type EntityTypeMap = {
  image: ImageRow;
  album: AlbumRow;
  images: ImageRow[];
};

type ResolvedEntities<R extends Record<string, keyof EntityTypeMap>> = {
  [K in keyof R]: EntityTypeMap[R[K]];
};

// ─── Middleware: inject ToolContext ───

function withToolContext(
  userId: string,
  deps: ImageStudioDeps,
  notify?: (event: ToolEvent) => void,
) {
  return middleware<
    Record<string, unknown>,
    { userId: string; deps: ImageStudioDeps; notify?: (event: ToolEvent) => void }
  >(async ({ ctx, next }) => {
    return next({ ...ctx, userId, deps, notify });
  });
}

// ─── Middleware: entity resolution ───

/**
 * Resolve entities from input fields.
 * Maps field names to entity types ("image" | "album" | "images").
 *
 * @example
 * ```ts
 * .use(withResolves({ image_id: "image" }))
 * // ctx.entities.image_id is now ImageRow
 * ```
 */
function withResolves<R extends Record<string, keyof EntityTypeMap>>(config: R) {
  return middleware<
    { userId: string; deps: ImageStudioDeps },
    { userId: string; deps: ImageStudioDeps; entities: ResolvedEntities<R> }
  >(async ({ input, ctx, next }) => {
    const inputRecord = input as Record<string, unknown>;
    const entities: Record<string, unknown> = {};

    for (const [fieldKey, entityType] of Object.entries(config)) {
      const val = inputRecord[fieldKey];
      if (!val) continue;

      if (entityType === "image") {
        const { error, image } = await resolveImageOrError(ctx.deps, val as ImageId);
        if (error) return error;
        entities[fieldKey] = image;
      } else if (entityType === "images") {
        const resolveResult = await tryCatch(ctx.deps.resolvers.resolveImages(val as ImageId[]));
        if (!resolveResult.ok) {
          return errorResult("RESOLVE_FAILED", resolveResult.error.message);
        }
        if (!resolveResult.data) {
          return errorResult("RESOLVE_FAILED", "Failed to resolve images");
        }
        entities[fieldKey] = resolveResult.data;
      } else if (entityType === "album") {
        const resolveResult = await tryCatch(ctx.deps.resolvers.resolveAlbum(val as AlbumHandle));
        if (!resolveResult.ok) {
          return errorResult("ALBUM_NOT_FOUND", resolveResult.error.message);
        }
        if (!resolveResult.data) {
          return errorResult("ALBUM_NOT_FOUND", `Album not found: ${val}`);
        }
        entities[fieldKey] = resolveResult.data;
      }
    }

    return next({
      ...ctx,
      entities: entities as ResolvedEntities<R>,
    });
  });
}

// ─── Middleware: ownership verification ───

/**
 * Verify that resolved entities belong to the current user.
 * Must be used after withResolves.
 *
 * @example
 * ```ts
 * .use(withResolves({ image_id: "image" }))
 * .use(withOwnership(["image_id"]))
 * ```
 */
function withOwnership<TFields extends string>(fieldKeys: TFields[]) {
  return middleware<
    { userId: string; entities: Record<TFields, { userId: string }> },
    { userId: string; entities: Record<TFields, { userId: string }> }
  >(async ({ ctx, next }) => {
    for (const fieldKey of fieldKeys) {
      const entity = ctx.entities[fieldKey];
      if (entity && entity.userId !== ctx.userId) {
        return errorResult("UNAUTHORIZED", `You do not have permission to access: ${fieldKey}`);
      }
    }
    return next(ctx);
  });
}

// ─── Middleware: credit consumption ───

interface CreditsConfig {
  cost: (input: unknown, deps: ImageStudioDeps) => number;
  source: string;
  sourceIdField?: string;
}

/**
 * Consume credits before handler execution.
 *
 * @example
 * ```ts
 * .use(withCredits({
 *   cost: (input) => ENHANCEMENT_COSTS[input.tier],
 *   source: "enhance",
 *   sourceIdField: "image_id",
 * }))
 * ```
 */
function withCredits(config: CreditsConfig) {
  return middleware<
    { userId: string; deps: ImageStudioDeps; notify?: (event: ToolEvent) => void },
    {
      userId: string;
      deps: ImageStudioDeps;
      notify?: (event: ToolEvent) => void;
      billing: { creditsCost: number };
    }
  >(async ({ input, ctx, next }) => {
    const cost = config.cost(input, ctx.deps);
    if (cost > 0) {
      const inputRecord = input as Record<string, unknown>;
      const sourceId = config.sourceIdField
        ? (inputRecord[config.sourceIdField] as string)
        : undefined;

      const toolCtx: ToolContext = {
        userId: ctx.userId,
        deps: ctx.deps,
        notify: ctx.notify,
      };

      const { error } = await consumeCreditsOrError(
        ctx.deps,
        ctx.userId,
        cost,
        config.source,
        sourceId,
        toolCtx,
      );
      if (error) return error;
    }

    return next({ ...ctx, billing: { creditsCost: cost } });
  });
}

// ─── Middleware: job creation ───

interface JobConfig {
  imageIdField: string;
}

/**
 * Create an enhancement job before handler execution.
 *
 * @example
 * ```ts
 * .use(withJob({ imageIdField: "image_id" }))
 * // ctx.jobs.currentJob is now EnhancementJobRow
 * ```
 */
function withJob(config: JobConfig) {
  return middleware<
    {
      userId: string;
      deps: ImageStudioDeps;
      notify?: (event: ToolEvent) => void;
      billing?: { creditsCost: number };
    },
    {
      userId: string;
      deps: ImageStudioDeps;
      notify?: (event: ToolEvent) => void;
      billing?: { creditsCost: number };
      jobs: { currentJob: EnhancementJobRow };
    }
  >(async ({ input, ctx, next }) => {
    const inputRecord = input as Record<string, unknown>;
    const imageId = inputRecord[config.imageIdField] as ImageId;
    const tier = (inputRecord.tier as EnhancementTier | undefined) ?? "FREE";
    const creditsCost = ctx.billing?.creditsCost ?? 0;

    const jobResult = await tryCatch(
      ctx.deps.db.jobCreate({
        imageId,
        userId: ctx.userId,
        tier,
        creditsCost,
        status: "PENDING",
        processingStartedAt: null,
        metadata: null,
      }),
    );

    if (!jobResult.ok || !jobResult.data) {
      return errorResult("JOB_CREATE_FAILED", "Failed to create job");
    }

    if (ctx.notify) {
      ctx.notify(
        toolEvent("job:created", jobResult.data.id, {
          imageId,
          tier,
          creditsCost,
        }),
      );
    }

    return next({ ...ctx, jobs: { currentJob: jobResult.data } });
  });
}

// ─── Composed base procedure for image tools ───

/**
 * Create a base procedure for image studio tools.
 * Injects userId, deps, and optional notify into context.
 *
 * @example
 * ```ts
 * const t = createImageProcedure(userId, deps, notify);
 * const tool = t
 *   .use(withResolves({ image_id: "image" }))
 *   .use(withOwnership(["image_id"]))
 *   .tool("delete", "Delete an image", { ... })
 *   .handler(async ({ input, ctx }) => { ... });
 * ```
 */
export function createImageProcedure(
  userId: string,
  deps: ImageStudioDeps,
  notify?: (event: ToolEvent) => void,
) {
  return createProcedure().use(withToolContext(userId, deps, notify));
}

/** Pre-composed procedure for static tool definitions that receive ToolContext at runtime */
export const imageProcedure = createProcedure<ToolContext>();

export { withResolves, withOwnership, withCredits, withJob, withToolContext };
