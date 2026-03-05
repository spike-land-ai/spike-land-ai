/**
 * Image Studio MCP Server — Standalone Entry Point
 *
 * Run: node src/mcp-image-studio/dist/index.js
 * Starts a stdio MCP server with all img tools registered.
 */

export {
  registerImageStudioTools,
  /** @deprecated Use registerImageStudioTools */
  registerImageStudioTools as registerNanoTools,
  /** @deprecated Use registerImageStudioTools */
  registerImageStudioTools as registerPixelTools,
} from "./register.js";
export type {
  AlbumHandle,
  AlbumImageRow,
  // Enum types
  AlbumPrivacy,
  AlbumRow,
  AspectRatio,
  BgOutputFormat,
  BlendMode,
  BrandAsset,
  CallToolResult,
  CurrentEventStyle,
  DetailLevel,
  EnhancementJobRow,
  EnhancementTier,
  // Strict enum types
  ExportFormat,
  GenerationJobRow,
  GenerationOutputFormat,
  GenerationResolution,
  // Structural types
  HexColor,
  // Branded ID types
  ImageId,
  // Row types (for DB implementations)
  ImageRow,
  // Core interfaces
  ImageStudioDeps,
  /** @deprecated Use ImageStudioDeps */
  ImageStudioDeps as NanoDeps,
  /** @deprecated Use ImageStudioDeps */
  ImageStudioDeps as PixelDeps,
  ImageStudioResolvers,
  /** @deprecated Use ImageStudioResolvers */
  ImageStudioResolvers as NanoResolvers,
  /** @deprecated Use ImageStudioResolvers */
  ImageStudioResolvers as PixelResolvers,
  ImageStudioToolRegistry,
  /** @deprecated Use ImageStudioToolRegistry */
  ImageStudioToolRegistry as NanoToolRegistry,
  /** @deprecated Use ImageStudioToolRegistry */
  ImageStudioToolRegistry as PixelToolRegistry,
  JobId,
  JobStatus,
  // JSON Schema type
  JsonSchema,
  ModelPreference,
  Percentage,
  PipelineId,
  PipelineRow,
  PipelineVisibility,
  ReferenceRole,
  SmartCropPreset,
  StyleName,
  SubjectLabel,
  SubjectRow,
  SubjectType,
  ToolCallRow,
  ToolDefinition,
  WatermarkPosition,
} from "./types.js";
export {
  // Constants
  ADVANCED_FEATURE_COSTS,
  ALBUM_PRIVACY_VALUES,
  asAlbumHandle,
  // Structural type constructors
  asHexColor,
  // Branded type constructors
  asImageId,
  asJobId,
  asPercentage,
  asPipelineId,
  asSubjectLabel,
  BG_OUTPUT_FORMAT_VALUES,
  BLEND_MODE_VALUES,
  BRAND_ASSET_VALUES,
  CURRENT_EVENT_STYLE_VALUES,
  DETAIL_LEVEL_VALUES,
  ENHANCEMENT_COSTS,
  ENHANCEMENT_TIER_VALUES,
  // Helper functions
  errorResult,
  // Enum value arrays
  EXPORT_FORMAT_VALUES,
  GENERATION_OUTPUT_FORMAT_VALUES,
  GENERATION_RESOLUTION_VALUES,
  // Resolver helpers
  ImageStudioResolverError,
  /** @deprecated Use ImageStudioResolverError */
  ImageStudioResolverError as NanoResolverError,
  /** @deprecated Use ImageStudioResolverError */
  ImageStudioResolverError as PixelResolverError,
  IMG_DEFAULTS,
  /** @deprecated Use IMG_DEFAULTS */
  IMG_DEFAULTS as PIXEL_DEFAULTS,
  isAlbumHandle,
  // Branded type guards
  isImageId,
  isJobId,
  isPipelineId,
  isSubjectLabel,
  JOB_STATUS_VALUES,
  jsonResult,
  MAX_BATCH_SIZE,
  MODEL_PREFERENCE_VALUES,
  PIPELINE_VISIBILITY_VALUES,
  REFERENCE_ROLE_VALUES,
  resolve,
  SMART_CROP_PRESET_VALUES,
  STYLE_NAME_VALUES,
  SUBJECT_TYPE_VALUES,
  SUPPORTED_ASPECT_RATIOS,
  textResult,
  WATERMARK_POSITION_VALUES,
} from "./types.js";
export { type Result, tryCatch } from "./tools/try-catch.js";
export { validateInput, type ValidationResult } from "./validate.js";
export {
  getManifestEntry,
  TOOL_MANIFEST,
  type ToolManifestEntry,
} from "./tool-manifest.js";
