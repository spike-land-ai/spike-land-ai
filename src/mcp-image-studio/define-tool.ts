import type {
  CallToolResult,
  EnhancementTier,
  ImageId,
  ImageStudioDeps,
  ToolContext,
  AlbumHandle,
  EnhancementJobRow,
  ImageRow,
  AlbumRow,
} from "./types.js";
import { errorResult, toolEvent } from "./types.js";
import { tryCatch } from "./tools/try-catch.js";
// Helper for resolving an image, abstracting repetitive tryCatch logic
export async function resolveImageOrError(
  deps: ImageStudioDeps,
  imageId: ImageId,
): Promise<{ image?: ImageRow; error?: CallToolResult }> {
  const resolveResult = await tryCatch(deps.resolvers.resolveImage(imageId));
  if (!resolveResult.ok) {
    return { error: errorResult("IMAGE_NOT_FOUND", resolveResult.error.message) };
  }
  if (!resolveResult.data) {
    return { error: errorResult("IMAGE_NOT_FOUND", `Image not found: ${imageId}`) };
  }
  return { image: resolveResult.data };
}

// Helper for resolving multiple images
export async function resolveImagesOrError(
  deps: ImageStudioDeps,
  imageIds: ImageId[],
): Promise<{ images?: ImageRow[]; error?: CallToolResult }> {
  const resolveResult = await tryCatch(deps.resolvers.resolveImages(imageIds));
  if (!resolveResult.ok) {
    return { error: errorResult("RESOLVE_FAILED", resolveResult.error.message) };
  }
  if (!resolveResult.data) {
    return { error: errorResult("RESOLVE_FAILED", "Failed to resolve images") };
  }
  return { images: resolveResult.data };
}

// Helper for consuming credits
export async function consumeCreditsOrError(
  deps: ImageStudioDeps,
  userId: string,
  amount: number,
  source: string,
  sourceId?: string,
  ctx?: ToolContext,
): Promise<{ error?: CallToolResult }> {
  const consumeResult = await tryCatch(
    deps.credits.consume({
      userId,
      amount,
      source,
      sourceId,
    }),
  );

  if (!consumeResult.ok) {
    return { error: errorResult("CREDIT_CONSUME_FAILED", consumeResult.error.message) };
  }
  if (!consumeResult.data.success) {
    return {
      error: errorResult(
        "CREDIT_CONSUME_FAILED",
        consumeResult.data.error ?? "Failed to consume credits",
      ),
    };
  }

  if (ctx?.notify) {
    ctx.notify(toolEvent("credits:consumed", userId, { amount, source, sourceId }));
  }

  return {};
}

import { z } from "zod";
import { DomainError } from "./tools/try-catch.js";

// ─── Tool Builder Framework ───

// What entities did we resolve
// image_id -> "image" meaning the handler gets entities.image_id
type ResolvedEntities = Record<string, "image" | "album" | "images">;

type ResolvedDependencies<R extends ResolvedEntities> = {
  entities: {
    [K in keyof R]: R[K] extends "image"
      ? ImageRow
      : R[K] extends "album"
        ? AlbumRow
        : R[K] extends "images"
          ? ImageRow[]
          : never;
  };
};

interface ResolvesConfig {
  [field: string]: "image" | "album" | "images";
}

interface CreditsConfig<InputType> {
  cost: (input: InputType, deps: ImageStudioDeps) => number;
  source: string;
  sourceIdField?: keyof InputType & string;
}

interface JobConfig<InputType> {
  imageIdField: keyof InputType & string;
}

class ToolBuilder<TInput, TCtx extends ToolContext, TFields extends z.ZodRawShape> {
  private resolvesConfig: ResolvesConfig = {};
  private creditsConfig?: CreditsConfig<TInput>;
  private jobConfig?: JobConfig<TInput>;
  private requireOwnershipFields: string[] = [];
  private validates: Array<(input: TInput, ctx: TCtx) => CallToolResult | void> = [];
  private contextValidates: Array<(input: TInput, ctx: TCtx) => CallToolResult | void> = [];
  private _agentInstructions?: string;

  constructor(
    private name: string,
    private description: string,
    private fields: TFields,
    private zodSchema: z.ZodObject<TFields>,
  ) {}

  agentInstructions(instructions: string): this {
    this._agentInstructions = instructions;
    return this;
  }

  resolves<R extends ResolvedEntities>(
    config: R,
  ): ToolBuilder<TInput, TCtx & ResolvedDependencies<R>, TFields> {
    this.resolvesConfig = { ...this.resolvesConfig, ...config };
    return this as unknown as ToolBuilder<TInput, TCtx & ResolvedDependencies<R>, TFields>;
  }

  requireOwnership(fieldKeys: (keyof TInput & string)[]): this {
    this.requireOwnershipFields.push(...fieldKeys);
    return this;
  }

  validate(fn: (input: TInput, ctx: TCtx) => CallToolResult | void): this {
    this.validates.push(fn);
    return this;
  }

  validateContext(fn: (input: TInput, ctx: TCtx) => CallToolResult | void): this {
    this.contextValidates.push(fn);
    return this;
  }

  credits(
    config: CreditsConfig<TInput>,
  ): ToolBuilder<TInput, TCtx & { billing: { creditsCost: number } }, TFields> {
    this.creditsConfig = config;
    return this as unknown as ToolBuilder<
      TInput,
      TCtx & { billing: { creditsCost: number } },
      TFields
    >;
  }

  job(
    config: JobConfig<TInput>,
  ): ToolBuilder<TInput, TCtx & { jobs: { currentJob: EnhancementJobRow } }, TFields> {
    this.jobConfig = config;
    return this as unknown as ToolBuilder<
      TInput,
      TCtx & { jobs: { currentJob: EnhancementJobRow } },
      TFields
    >;
  }

  handler(fn: (input: TInput, ctx: TCtx) => Promise<CallToolResult> | CallToolResult) {
    const {
      name,
      description,
      fields,
      zodSchema,
      resolvesConfig,
      creditsConfig,
      jobConfig,
      requireOwnershipFields,
      _agentInstructions,
    } = this;

    const safeParse = (data: unknown) => {
      const parsed = zodSchema.safeParse(data);
      if (parsed.success) {
        return { success: true as const, data: parsed.data as TInput };
      } else {
        return { success: false as const, error: { message: parsed.error.message } };
      }
    };

    const wrappedHandler = async (input: unknown, ctx: ToolContext): Promise<CallToolResult> => {
      try {
        const { userId, deps } = ctx;

        // 1. Validation
        const parsed = safeParse(input);
        if (!parsed.success) {
          return errorResult("INVALID_INPUT", `Validation failed:\n${parsed.error.message}`);
        }

        const validArgs = parsed.data;
        const extendedCtx: Record<string, unknown> & {
          entities: Record<string, unknown>;
          billing: Record<string, unknown>;
          jobs: Record<string, unknown>;
        } = { ...ctx, entities: {}, billing: {}, jobs: {} };

        // 1.5 Custom Validations (pre-resolution)
        for (const vFn of this.validates) {
          const err = vFn(validArgs, extendedCtx as TCtx);
          if (err) return err;
        }

        // 2. Resolutions
        for (const [fieldKey, entityType] of Object.entries(resolvesConfig)) {
          const val = (validArgs as Record<string, unknown>)[fieldKey];
          if (!val) continue;

          if (entityType === "image") {
            const { error, image } = await resolveImageOrError(deps, val as ImageId);
            if (error) return error;

            if (image && requireOwnershipFields.includes(fieldKey)) {
              if (image.userId !== userId) {
                return errorResult(
                  "UNAUTHORIZED",
                  `You do not have permission to access image: ${val}`,
                );
              }
            }

            extendedCtx.entities[fieldKey] = image;
          } else if (entityType === "images") {
            const resolveResult = await tryCatch(deps.resolvers.resolveImages(val as ImageId[]));
            if (!resolveResult.ok) {
              return errorResult("RESOLVE_FAILED", resolveResult.error.message);
            }
            if (!resolveResult.data) {
              return errorResult("RESOLVE_FAILED", "Failed to resolve images");
            }
            if (requireOwnershipFields.includes(fieldKey)) {
              for (const img of resolveResult.data) {
                if (img.userId !== userId) {
                  return errorResult(
                    "UNAUTHORIZED",
                    `You do not have permission to access image: ${img.id}`,
                  );
                }
              }
            }
            extendedCtx.entities[fieldKey] = resolveResult.data;
          } else if (entityType === "album") {
            const resolveResult = await tryCatch(deps.resolvers.resolveAlbum(val as AlbumHandle));
            if (!resolveResult.ok) {
              return errorResult("ALBUM_NOT_FOUND", resolveResult.error.message);
            }
            if (!resolveResult.data) {
              return errorResult("ALBUM_NOT_FOUND", `Album not found: ${val}`);
            }
            if (requireOwnershipFields.includes(fieldKey)) {
              if (resolveResult.data.userId !== userId) {
                return errorResult(
                  "UNAUTHORIZED",
                  `You do not have permission to access album: ${val}`,
                );
              }
            }
            extendedCtx.entities[fieldKey] = resolveResult.data;
          }
        }

        // 2.5 Context Validations (post-resolution)
        for (const vFn of this.contextValidates) {
          const err = vFn(validArgs, extendedCtx as TCtx);
          if (err) return err;
        }

        // 3. Credits
        let cost = 0;
        if (creditsConfig) {
          cost = creditsConfig.cost(validArgs, deps);
          extendedCtx.billing.creditsCost = cost;
          if (cost > 0) {
            const sourceId = creditsConfig.sourceIdField
              ? ((validArgs as Record<string, unknown>)[creditsConfig.sourceIdField] as string)
              : undefined;

            const { error } = await consumeCreditsOrError(
              deps,
              userId,
              cost,
              creditsConfig.source,
              sourceId,
              ctx,
            );
            if (error) return error;
          }
        }

        // 4. Job Creation
        if (jobConfig) {
          const imageId = (validArgs as Record<string, unknown>)[jobConfig.imageIdField] as ImageId;
          const tier =
            ((validArgs as Record<string, unknown>).tier as EnhancementTier | undefined) ??
            ("FREE" as const);

          const jobResult = await tryCatch(
            deps.db.jobCreate({
              imageId,
              userId,
              tier,
              creditsCost: cost,
              status: "PENDING",
              processingStartedAt: null,
              metadata: null,
            }),
          );

          if (!jobResult.ok || !jobResult.data) {
            return errorResult("JOB_CREATE_FAILED", "Failed to create job");
          }
          extendedCtx.jobs.currentJob = jobResult.data;

          if (ctx.notify) {
            ctx.notify(
              toolEvent("job:created", jobResult.data.id, { imageId, tier, creditsCost: cost }),
            );
          }
        }

        // 5. Invoke Handler
        const rawResult = await fn(validArgs, extendedCtx as TCtx);
        if (_agentInstructions && !rawResult.isError) {
          rawResult.content.push({
            type: "text",
            text: `\n[Agent Instructions]: ${_agentInstructions}`,
          });
        }
        return rawResult;
      } catch (err) {
        if (err instanceof DomainError) {
          return errorResult(err.code, err.message, err.retryable);
        }
        throw err;
      }
    };

    return {
      name,
      description,
      fields,
      schema: { safeParse },
      handler: wrappedHandler,
    };
  }
}

export function defineTool<TFields extends z.ZodRawShape>(
  name: string,
  description: string,
  fields: TFields,
) {
  const zodSchema = z.object(fields);
  type ExtractedInput = z.infer<typeof zodSchema>;

  return new ToolBuilder<ExtractedInput, ToolContext, TFields>(
    name,
    description,
    fields,
    zodSchema,
  );
}

// ─── Parallel Processing Helper ───
export async function processBatch<T, U>(
  items: T[],
  processor: (item: T) => Promise<U>,
  _concurrency = 5,
): Promise<{ successful: U[]; failed: Error[] }> {
  const results = await Promise.allSettled(items.map(processor));
  return {
    successful: results
      .filter((r): r is PromiseFulfilledResult<Awaited<U>> => r.status === "fulfilled")
      .map((r) => r.value as U),
    failed: results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason),
  };
}
