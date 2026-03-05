/**
 * Image Studio MCP Package — Shared Types
 *
 * Dependency injection interface, branded ID types, and strict parameter types.
 * No direct Prisma imports — everything is injected.
 */

// ─── Branded Type Infrastructure ───

declare const _brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [_brand]: B };

export type ImageId = Brand<string, "ImageId">;
export type AlbumHandle = Brand<string, "AlbumHandle">;
export type PipelineId = Brand<string, "PipelineId">;
export type JobId = Brand<string, "JobId">;
export type SubjectLabel = Brand<string, "SubjectLabel">;

// ── Branded Type Guards ──

export function isImageId(s: unknown): s is ImageId {
  return typeof s === "string" && s.length > 0 && s.length <= 64;
}
export function isAlbumHandle(s: unknown): s is AlbumHandle {
  return typeof s === "string" && s.length > 0 && s.length <= 64;
}
export function isPipelineId(s: unknown): s is PipelineId {
  return typeof s === "string" && s.length > 0 && s.length <= 64;
}
export function isJobId(s: unknown): s is JobId {
  return typeof s === "string" && s.length > 0 && s.length <= 64;
}
export function isSubjectLabel(s: unknown): s is SubjectLabel {
  return typeof s === "string" && s.length > 0 && s.length <= 128;
}

// ── Branded Type Constructors (throw on invalid) ──

export function asImageId(s: string): ImageId {
  if (!isImageId(s)) throw new Error(`Invalid ImageId: "${s}"`);
  return s;
}
export function asAlbumHandle(s: string): AlbumHandle {
  if (!isAlbumHandle(s)) throw new Error(`Invalid AlbumHandle: "${s}"`);
  return s;
}
export function asPipelineId(s: string): PipelineId {
  if (!isPipelineId(s)) throw new Error(`Invalid PipelineId: "${s}"`);
  return s;
}
export function asJobId(s: string): JobId {
  if (!isJobId(s)) throw new Error(`Invalid JobId: "${s}"`);
  return s;
}
export function asSubjectLabel(s: string): SubjectLabel {
  if (!isSubjectLabel(s)) throw new Error(`Invalid SubjectLabel: "${s}"`);
  return s;
}

// ─── Structural Parameter Types ───

export type HexColor = Brand<string, "HexColor">;
export type Percentage = Brand<number, "Percentage">;

export function asHexColor(s: string): HexColor {
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`Invalid hex color: ${s}`);
  }
  return s as HexColor;
}

export function asPercentage(n: number): Percentage {
  if (n < 0 || n > 100) {
    throw new Error(`Percentage must be 0-100, got ${n}`);
  }
  return n as Percentage;
}

// ─── Enums (mirror Prisma enums without importing Prisma) ───

import {
  type CallToolResult,
  errorResult as baseErrorResult,
  jsonResult,
  textResult,
} from "@spike-land-ai/mcp-server-base";

export const ENHANCEMENT_TIER_VALUES = [
  "FREE",
  "TIER_0_5K",
  "TIER_1K",
  "TIER_2K",
  "TIER_4K",
] as const;
export type EnhancementTier = (typeof ENHANCEMENT_TIER_VALUES)[number];

export const JOB_STATUS_VALUES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type JobStatus = (typeof JOB_STATUS_VALUES)[number];

export const ALBUM_PRIVACY_VALUES = ["PRIVATE", "UNLISTED", "PUBLIC"] as const;
export type AlbumPrivacy = (typeof ALBUM_PRIVACY_VALUES)[number];

export const PIPELINE_VISIBILITY_VALUES = ["PRIVATE", "PUBLIC"] as const;
export type PipelineVisibility = (typeof PIPELINE_VISIBILITY_VALUES)[number];

// ─── Strict Union Types for Enum-like Parameters ───

export const EXPORT_FORMAT_VALUES = ["png", "jpg", "webp"] as const;
export type ExportFormat = (typeof EXPORT_FORMAT_VALUES)[number];

export const WATERMARK_POSITION_VALUES = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITION_VALUES)[number];

export const SMART_CROP_PRESET_VALUES = [
  "instagram_square",
  "instagram_story",
  "twitter_header",
  "facebook_cover",
  "youtube_thumbnail",
  "linkedin_banner",
  "custom",
] as const;
export type SmartCropPreset = (typeof SMART_CROP_PRESET_VALUES)[number];

export const STYLE_NAME_VALUES = [
  "oil_painting",
  "watercolor",
  "anime",
  "pixel_art",
  "sketch",
  "pop_art",
  "impressionist",
  "cyberpunk",
] as const;
export type StyleName = (typeof STYLE_NAME_VALUES)[number];

export const BLEND_MODE_VALUES = ["overlay", "multiply", "screen", "dissolve"] as const;
export type BlendMode = (typeof BLEND_MODE_VALUES)[number];

export const BG_OUTPUT_FORMAT_VALUES = ["png", "webp"] as const;
export type BgOutputFormat = (typeof BG_OUTPUT_FORMAT_VALUES)[number];

export const CURRENT_EVENT_STYLE_VALUES = ["editorial", "documentary", "artistic", "news"] as const;
export type CurrentEventStyle = (typeof CURRENT_EVENT_STYLE_VALUES)[number];

export const DETAIL_LEVEL_VALUES = ["brief", "detailed", "alt_text"] as const;
export type DetailLevel = (typeof DETAIL_LEVEL_VALUES)[number];

export const SUBJECT_TYPE_VALUES = ["character", "object"] as const;
export type SubjectType = (typeof SUBJECT_TYPE_VALUES)[number];

export const REFERENCE_ROLE_VALUES = ["style", "subject", "composition"] as const;
export type ReferenceRole = (typeof REFERENCE_ROLE_VALUES)[number];

export const BRAND_ASSET_VALUES = [
  "logo",
  "social_header",
  "business_card",
  "ad_creative",
] as const;
export type BrandAsset = (typeof BRAND_ASSET_VALUES)[number];

export const ICON_TARGET_VALUES = ["favicon", "ios", "android", "both"] as const;
export type IconTarget = (typeof ICON_TARGET_VALUES)[number];

export const ICON_STYLE_VALUES = ["flat", "3d", "gradient", "outlined", "filled"] as const;
export type IconStyle = (typeof ICON_STYLE_VALUES)[number];

export const ALBUM_IMAGE_ACTION_VALUES = ["add", "remove"] as const;
export type AlbumImageAction = (typeof ALBUM_IMAGE_ACTION_VALUES)[number];

export const DIAGRAM_TYPE_VALUES = [
  "architecture",
  "flowchart",
  "sequence",
  "er",
  "network",
] as const;
export type DiagramType = (typeof DIAGRAM_TYPE_VALUES)[number];

export const DIAGRAM_STYLE_VALUES = ["technical", "hand_drawn", "minimal"] as const;
export type DiagramStyle = (typeof DIAGRAM_STYLE_VALUES)[number];

export const AVATAR_STYLE_VALUES = ["photo", "cartoon", "abstract", "pixel"] as const;
export type AvatarStyle = (typeof AVATAR_STYLE_VALUES)[number];

export const RESIZE_FIT_VALUES = ["cover", "contain", "fill", "inside", "outside"] as const;
export type ResizeFit = (typeof RESIZE_FIT_VALUES)[number];

export const SHARE_ACTION_VALUES = ["share", "unshare"] as const;
export type ShareAction = (typeof SHARE_ACTION_VALUES)[number];

export const SCREENSHOT_DEVICE_VALUES = [
  "iphone",
  "android",
  "macbook",
  "ipad",
  "browser",
] as const;
export type ScreenshotDevice = (typeof SCREENSHOT_DEVICE_VALUES)[number];

export const SCREENSHOT_BACKGROUND_VALUES = [
  "gradient",
  "solid",
  "transparent",
  "blurred",
] as const;
export type ScreenshotBackground = (typeof SCREENSHOT_BACKGROUND_VALUES)[number];

export const HISTORY_TYPE_VALUES = ["generation", "enhancement", "all"] as const;
export type HistoryType = (typeof HISTORY_TYPE_VALUES)[number];

export const JOB_TYPE_VALUES = ["generation", "enhancement"] as const;
export type JobType = (typeof JOB_TYPE_VALUES)[number];

export const IMG_DEFAULTS = {
  tier: "TIER_1K" as const,
  aspectRatio: "1:1" as const,
  modelPreference: "default" as const,
  resolution: "1K" as const,
  blendMode: "overlay" as const,
  blendStrength: 50,
  exportFormat: "png" as const,
  exportQuality: 85,
  smartCropPreset: "instagram_square" as const,
  styleTransferStrength: 75,
  watermarkPosition: "bottom-right" as const,
  watermarkOpacity: 50,
  paletteCount: 5,
  describeDetailLevel: "brief" as const,
  bgRemovalFormat: "png" as const,
  subjectType: "character" as const,
  listLimit: 20,
  pipelineListLimit: 50,
  promptGenerate: "A beautiful, high-quality photograph",
  promptAdvanced: "A creative, detailed illustration",
  promptGrounded: "A photorealistic scene",
  promptTextImage: "A stylish poster design",
  promptSubject: "A scene featuring the selected subjects",
  promptReference: "Generate based on the reference images",
  promptStyleBlend: "Blend the subject and style",
  promptModify: "Enhance this image",
  promptTextOverlay: "Add text to this image with clear typography",
  promptIconApp: "An app icon design, clean and modern.",
  promptIconFavicon: "A favicon icon design, simple and recognizable at small sizes.",
  promptBannerOg: "An Open Graph social preview image, gradient style.",
  watermarkText: "©",
  currentEventStyle: "editorial" as const,
  brandAssets: ["logo", "social_header", "business_card", "ad_creative"] as const,
} as const;

// ─── Shared schemas ───

export const SUPPORTED_ASPECT_RATIOS = [
  "1:1",
  "3:2",
  "2:3",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
  "1:4",
  "1:8",
  "4:1",
  "8:1",
] as const;

export type AspectRatio = (typeof SUPPORTED_ASPECT_RATIOS)[number];

export const MODEL_PREFERENCE_VALUES = ["default", "quality", "speed", "latest"] as const;
export type ModelPreference = (typeof MODEL_PREFERENCE_VALUES)[number];

export const GENERATION_OUTPUT_FORMAT_VALUES = ["png", "jpeg", "webp"] as const;
export type GenerationOutputFormat = (typeof GENERATION_OUTPUT_FORMAT_VALUES)[number];

export const GENERATION_RESOLUTION_VALUES = ["0.5K", "512", "1K", "2K", "4K"] as const;
export type GenerationResolution = (typeof GENERATION_RESOLUTION_VALUES)[number];

export interface SubjectReference {
  label: string;
  type: SubjectType;
  sourceImageId: ImageId;
}

export interface AdvancedGenerationOptions {
  modelPreference?: ModelPreference;
  resolution?: GenerationResolution;
  subjects?: SubjectReference[];
  thinkingMode?: boolean;
  googleSearchGrounding?: boolean;
  textToRender?: string;
  seed?: number;
  outputFormat?: GenerationOutputFormat;
  numImages?: number;
  negativePrompt?: string;
  aspectRatio?: AspectRatio;
}

export const ADVANCED_FEATURE_COSTS = {
  subjectRef: 1, // per ref
  text: 1,
  grounding: 2,
  compare: 1,
} as const;

export const ENHANCEMENT_COSTS: Record<EnhancementTier, number> = {
  FREE: 0,
  TIER_0_5K: 1,
  TIER_1K: 2,
  TIER_2K: 5,
  TIER_4K: 10,
};

export const MAX_BATCH_SIZE = 20;

// ─── Database row types (minimal, what tools actually need) ───

export interface SubjectRow {
  id: string;
  userId: string;
  imageId: ImageId;
  label: string;
  type: SubjectType;
  description: string | null;
  createdAt: Date;
}

export interface ImageRow {
  id: ImageId;
  userId: string;
  name: string;
  description: string | null;
  originalUrl: string;
  originalR2Key: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  originalFormat: string;
  isPublic: boolean;
  viewCount: number;
  tags: string[];
  shareToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnhancementJobRow {
  id: JobId;
  imageId: ImageId;
  userId: string;
  tier: EnhancementTier;
  creditsCost: number;
  status: JobStatus;
  enhancedUrl: string | null;
  enhancedR2Key: string | null;
  enhancedWidth: number | null;
  enhancedHeight: number | null;
  enhancedSizeBytes: number | null;
  errorMessage: string | null;
  retryCount: number;
  metadata: unknown | null;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlbumRow {
  id: string;
  handle: AlbumHandle;
  userId: string;
  name: string;
  description: string | null;
  coverImageId: ImageId | null;
  privacy: AlbumPrivacy;
  defaultTier: EnhancementTier;
  shareToken: string | null;
  sortOrder: number;
  pipelineId: PipelineId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlbumImageRow {
  id: string;
  albumId: string;
  imageId: ImageId;
  sortOrder: number;
  addedAt: Date;
}

export interface PipelineRow {
  id: PipelineId;
  name: string;
  description: string | null;
  userId: string | null;
  visibility: PipelineVisibility;
  shareToken: string | null;
  tier: EnhancementTier;
  analysisConfig: unknown;
  autoCropConfig: unknown;
  promptConfig: unknown;
  generationConfig: unknown;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationJobRow {
  id: JobId;
  userId: string;
  type: "GENERATE" | "MODIFY";
  tier: EnhancementTier;
  creditsCost: number;
  status: JobStatus;
  prompt: string;
  inputImageUrl: string | null;
  outputImageUrl: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  outputSizeBytes: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolCallRow {
  id: string;
  userId: string;
  toolName: string;
  args: string;
  durationMs: number;
  isError: boolean;
  status: "PENDING" | "COMPLETED" | "ERROR";
  result: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Resolver Interface ───

export class ImageStudioResolverError extends Error {
  constructor(public readonly result: CallToolResult) {
    super("resolver");
  }
}

export interface ImageStudioResolvers {
  resolveImage(id: ImageId): Promise<ImageRow>;
  resolveAlbum(handle: AlbumHandle): Promise<AlbumRow>;
  resolvePipeline(id: PipelineId, opts?: { requireOwnership?: boolean }): Promise<PipelineRow>;
  resolveJob(id: JobId): Promise<EnhancementJobRow>;
  resolveGenerationJob(id: JobId): Promise<GenerationJobRow>;
  resolveImages(ids: ImageId[]): Promise<ImageRow[]>;
}

export async function resolve<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; result: CallToolResult }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    if (e instanceof ImageStudioResolverError) {
      return { ok: false, result: e.result };
    }
    throw e;
  }
}

// ─── Dependency Injection Interface ───

export interface ImageStudioDeps {
  db: {
    // EnhancedImage
    imageCreate(
      data: Omit<ImageRow, "id" | "createdAt" | "updatedAt" | "viewCount">,
    ): Promise<ImageRow>;
    imageFindById(id: ImageId): Promise<ImageRow | null>;
    imageFindMany(opts: {
      userId: string;
      limit?: number;
      cursor?: string;
      search?: string;
    }): Promise<ImageRow[]>;
    imageDelete(id: ImageId): Promise<void>;
    imageDeleteMany?(ids: ImageId[]): Promise<number>;
    imageUpdate(
      id: ImageId,
      data: Partial<Pick<ImageRow, "name" | "description" | "tags" | "isPublic" | "shareToken">>,
    ): Promise<ImageRow>;
    imageCount(userId: string): Promise<number>;

    // ImageEnhancementJob
    jobCreate(
      data: Omit<
        EnhancementJobRow,
        | "id"
        | "createdAt"
        | "updatedAt"
        | "retryCount"
        | "enhancedUrl"
        | "enhancedR2Key"
        | "enhancedWidth"
        | "enhancedHeight"
        | "enhancedSizeBytes"
        | "errorMessage"
        | "processingCompletedAt"
      >,
    ): Promise<EnhancementJobRow>;
    jobFindById(id: JobId): Promise<
      | (EnhancementJobRow & {
          image?: Pick<ImageRow, "id" | "name" | "originalUrl">;
        })
      | null
    >;
    jobFindMany(opts: {
      userId: string;
      imageId?: ImageId;
      status?: JobStatus;
      limit?: number;
    }): Promise<EnhancementJobRow[]>;
    jobUpdate(
      id: JobId,
      data: Partial<
        Pick<
          EnhancementJobRow,
          | "status"
          | "enhancedUrl"
          | "enhancedR2Key"
          | "enhancedWidth"
          | "enhancedHeight"
          | "enhancedSizeBytes"
          | "errorMessage"
          | "processingCompletedAt"
        >
      >,
    ): Promise<EnhancementJobRow>;

    // Album
    albumCreate(data: Omit<AlbumRow, "id" | "createdAt" | "updatedAt">): Promise<AlbumRow>;
    albumFindByHandle(
      handle: AlbumHandle,
    ): Promise<(AlbumRow & { _count?: { albumImages: number } }) | null>;
    albumFindById(id: string): Promise<(AlbumRow & { _count?: { albumImages: number } }) | null>;
    albumFindMany(opts: {
      userId: string;
      limit?: number;
    }): Promise<(AlbumRow & { _count: { albumImages: number } })[]>;
    albumUpdate(handle: AlbumHandle, data: Partial<AlbumRow>): Promise<AlbumRow>;
    albumDelete(handle: AlbumHandle): Promise<void>;
    albumMaxSortOrder(userId: string): Promise<number>;

    // AlbumImage
    albumImageAdd(
      albumId: string,
      imageId: ImageId,
      sortOrder: number,
    ): Promise<AlbumImageRow | null>;
    albumImageRemove(albumId: string, imageIds: ImageId[]): Promise<number>;
    albumImageReorder(albumId: string, imageOrder: ImageId[]): Promise<void>;
    albumImageList(albumId: string): Promise<
      (AlbumImageRow & {
        image: Pick<ImageRow, "id" | "name" | "originalUrl" | "originalWidth" | "originalHeight">;
      })[]
    >;
    albumImageMaxSortOrder(albumId: string): Promise<number>;

    // EnhancementPipeline
    pipelineCreate(
      data: Omit<PipelineRow, "id" | "createdAt" | "updatedAt" | "usageCount" | "shareToken">,
    ): Promise<PipelineRow>;
    pipelineFindById(
      id: PipelineId,
    ): Promise<(PipelineRow & { _count?: { albums: number } }) | null>;
    pipelineFindMany(opts: { userId: string; limit?: number }): Promise<PipelineRow[]>;
    pipelineUpdate(id: PipelineId, data: Partial<PipelineRow>): Promise<PipelineRow>;
    pipelineDelete(id: PipelineId): Promise<void>;

    // McpGenerationJob
    generationJobCreate(
      data: Omit<
        GenerationJobRow,
        | "id"
        | "createdAt"
        | "updatedAt"
        | "outputImageUrl"
        | "outputWidth"
        | "outputHeight"
        | "outputSizeBytes"
        | "errorMessage"
        | "inputImageUrl"
      >,
    ): Promise<GenerationJobRow>;
    generationJobFindById(id: JobId): Promise<GenerationJobRow | null>;
    generationJobUpdate(id: JobId, data: Partial<GenerationJobRow>): Promise<GenerationJobRow>;

    // Subject
    subjectCreate?(data: Omit<SubjectRow, "id" | "createdAt">): Promise<SubjectRow>;
    subjectFindMany?(opts: { userId: string }): Promise<SubjectRow[]>;
    subjectDelete?(id: string): Promise<void>;

    // ToolCall
    toolCallCreate?(data: Omit<ToolCallRow, "createdAt" | "updatedAt">): Promise<string>;
    toolCallUpdate?(
      id: string,
      data: Partial<Omit<ToolCallRow, "id" | "userId" | "toolName" | "args" | "createdAt">>,
    ): Promise<void>;
    toolCallList?(opts: { limit: number }): Promise<ToolCallRow[]>;
  };

  credits: {
    hasEnough(userId: string, amount: number): Promise<boolean>;
    consume(opts: {
      userId: string;
      amount: number;
      source: string;
      sourceId?: string;
    }): Promise<{ success: boolean; remaining: number; error?: string }>;
    refund(userId: string, amount: number): Promise<boolean>;
    getBalance(userId: string): Promise<{ remaining: number } | null>;
    estimate(tier: EnhancementTier, count?: number): number;
    calculateGenerationCost(opts: {
      tier: EnhancementTier;
      numImages?: number;
      hasGrounding?: boolean;
      hasTextRender?: boolean;
      numSubjects?: number;
      numReferences?: number;
    }): number;
  };

  storage: {
    upload(
      userId: string,
      data: Buffer | Uint8Array,
      opts: { filename: string; contentType: string },
    ): Promise<{ url: string; r2Key: string; sizeBytes: number }>;
    download(r2Key: string): Promise<Buffer>;
    delete(r2Key: string): Promise<void>;
    deleteMany?(r2Keys: string[]): Promise<number>;
  };

  generation: {
    createGenerationJob(opts: {
      userId: string;
      prompt: string;
      tier: EnhancementTier;
      negativePrompt?: string;
      aspectRatio?: AspectRatio;
      seed?: number;
      outputFormat?: GenerationOutputFormat;
      numImages?: number;
    }): Promise<{ success: boolean; jobId?: string; creditsCost?: number; error?: string }>;
    createModificationJob(opts: {
      userId: string;
      prompt: string;
      imageData: string;
      mimeType: string;
      tier: EnhancementTier;
    }): Promise<{ success: boolean; jobId?: string; creditsCost?: number; error?: string }>;
    createAdvancedGenerationJob?(opts: {
      userId: string;
      prompt: string;
      tier: EnhancementTier;
      options: AdvancedGenerationOptions;
    }): Promise<{ success: boolean; jobId?: string; creditsCost?: number; error?: string }>;
    createReferenceGenerationJob?(opts: {
      userId: string;
      prompt: string;
      tier: EnhancementTier;
      referenceImages: Array<{
        imageId?: string;
        url?: string;
        base64?: string;
        mimeType?: string;
        role: ReferenceRole;
      }>;
      seed?: number;
      outputFormat?: GenerationOutputFormat;
      numImages?: number;
    }): Promise<{ success: boolean; jobId?: string; creditsCost?: number; error?: string }>;
    describeImage?(opts: {
      userId: string;
      imageId: ImageId;
    }): Promise<{ description: string; tags: string[]; error?: string }>;
    extractPalette?(opts: {
      userId: string;
      imageId: ImageId;
    }): Promise<{ palette: string[]; error?: string }>;
    compareImages?(opts: {
      userId: string;
      image1Id?: ImageId;
      image2Id?: ImageId;
      image1Url?: string;
      image2Url?: string;
    }): Promise<{
      comparison: { similarity: number; differences: string[] };
      error?: string;
    }>;
  };

  resolvers: ImageStudioResolvers;

  /** Generate a short random ID (for share tokens) */
  nanoid(length?: number): string;
}

// ─── Tool Registry Interface (subset of main app's ToolRegistry) ───

export type { CallToolResult };

export interface JsonSchema {
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
}

/**
 * Registration type for custom tools using old definition format
 * @deprecated Use `defineTool` instead.
 */
export interface ToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  category: string;
  tier: "free" | "workspace";
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  handler: (input: TInput) => Promise<CallToolResult> | CallToolResult;
  alwaysEnabled?: boolean;
}

export const TOOL_EVENT_TYPES = [
  "image:created",
  "image:updated",
  "image:deleted",
  "album:created",
  "album:updated",
  "album:deleted",
  "album:images_changed",
  "job:created",
  "job:updated",
  "credits:consumed",
  "credits:refunded",
  "generation:started",
  "generation:completed",
  "pipeline:created",
  "pipeline:updated",
  "pipeline:deleted",
  "subject:created",
  "subject:deleted",
] as const;

export type ToolEventType = (typeof TOOL_EVENT_TYPES)[number];

export interface ToolEvent {
  type: ToolEventType;
  entityId: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export function toolEvent(
  type: ToolEventType,
  entityId: string,
  payload?: Record<string, unknown>,
): ToolEvent {
  return {
    type,
    entityId,
    payload,
    timestamp: new Date().toISOString(),
  };
}

export interface ToolContext {
  userId: string;
  deps: ImageStudioDeps;
  /** Optional notification emitter for real-time widget updates */
  notify?: (event: ToolEvent) => void;
  /** Optional progress reporter for long-running operations */
  reportProgress?: (progress: number, total: number, message?: string) => void;
}

export interface ImageStudioToolRegistry {
  register: <T = unknown>(def: ToolDefinition<T>) => void;
}

// ─── Helper Functions ───

export { jsonResult, textResult };

export function batchResult<T extends Record<string, unknown>>(data: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

export const ERROR_CODES = {
  ADD_IMAGES_FAILED: "ADD_IMAGES_FAILED",
  ALBUM_CREATE_FAILED: "ALBUM_CREATE_FAILED",
  ALBUM_NOT_FOUND: "ALBUM_NOT_FOUND",
  ALREADY_PROCESSED: "ALREADY_PROCESSED",
  BALANCE_ERROR: "BALANCE_ERROR",
  BALANCE_NOT_FOUND: "BALANCE_NOT_FOUND",
  BATCH_ENHANCE_FAILED: "BATCH_ENHANCE_FAILED",
  BATCH_STATUS_FAILED: "BATCH_STATUS_FAILED",
  CODE: "CODE",
  COMPARISON_FAILED: "COMPARISON_FAILED",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  CREATE_FAILED: "CREATE_FAILED",
  CREDIT_CONSUME_FAILED: "CREDIT_CONSUME_FAILED",
  CREDIT_ERROR: "CREDIT_ERROR",
  DB_ERROR: "DB_ERROR",
  DELETE_FAILED: "DELETE_FAILED",
  DESCRIPTION_FAILED: "DESCRIPTION_FAILED",
  DOWNLOAD_FAILED: "DOWNLOAD_FAILED",
  ERR1: "ERR1",
  ERR2: "ERR2",
  EXPORT_FAILED: "EXPORT_FAILED",
  FETCH_FAILED: "FETCH_FAILED",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  FORK_FAILED: "FORK_FAILED",
  GENERATION_FAILED: "GENERATION_FAILED",
  HISTORY_FAILED: "HISTORY_FAILED",
  IMAGE_NOT_FOUND: "IMAGE_NOT_FOUND",
  IMAGES_NOT_FOUND: "IMAGES_NOT_FOUND",
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_PARAM: "INVALID_PARAM",
  JOB_CREATE_FAILED: "JOB_CREATE_FAILED",
  LIST_ALBUMS_FAILED: "LIST_ALBUMS_FAILED",
  LIST_FAILED: "LIST_FAILED",
  LIST_IMAGES_FAILED: "LIST_IMAGES_FAILED",
  LIST_PIPELINES_FAILED: "LIST_PIPELINES_FAILED",
  LOOKUP_FAILED: "LOOKUP_FAILED",
  MISSING_IMAGE: "MISSING_IMAGE",
  MISSING_INPUT: "MISSING_INPUT",
  NOT_FOUND: "NOT_FOUND",
  NOT_SUPPORTED: "NOT_SUPPORTED",
  PIPELINE_CREATE_FAILED: "PIPELINE_CREATE_FAILED",
  PIPELINE_NOT_FOUND: "PIPELINE_NOT_FOUND",
  REGISTER_FAILED: "REGISTER_FAILED",
  REORDER_FAILED: "REORDER_FAILED",
  RESOLVE_FAILED: "RESOLVE_FAILED",
  SOURCE_NOT_FOUND: "SOURCE_NOT_FOUND",
  STORAGE_ERROR: "STORAGE_ERROR",
  SUBJECT_LIST_FAILED: "SUBJECT_LIST_FAILED",
  SUBJECT_NOT_FOUND: "SUBJECT_NOT_FOUND",
  TARGET_NOT_FOUND: "TARGET_NOT_FOUND",
  UNSUPPORTED: "UNSUPPORTED",
  UPDATE_FAILED: "UPDATE_FAILED",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  BATCH_TOO_LARGE: "BATCH_TOO_LARGE",
  EMPTY_IMAGE_IDS: "EMPTY_IMAGE_IDS",
  NOT_CONFIRMED: "NOT_CONFIRMED",
  PIPELINE_ERROR: "PIPELINE_ERROR",
  TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  MODIFICATION_FAILED: "MODIFICATION_FAILED",
  PIPELINE_IN_USE: "PIPELINE_IN_USE",
  NO_FIELDS: "NO_FIELDS",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function errorResult(code: ErrorCode, message: string, retryable = false): CallToolResult {
  return baseErrorResult(code, message, retryable);
}
