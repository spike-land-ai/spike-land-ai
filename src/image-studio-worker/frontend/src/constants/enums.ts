export const ENHANCEMENT_TIERS = ["FREE", "TIER_1K", "TIER_2K", "TIER_4K"] as const;
export type EnhancementTier = (typeof ENHANCEMENT_TIERS)[number];

export const JOB_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ALBUM_PRIVACY = ["PRIVATE", "UNLISTED", "PUBLIC"] as const;
export type AlbumPrivacy = (typeof ALBUM_PRIVACY)[number];

export const PIPELINE_VISIBILITY = ["PRIVATE", "PUBLIC"] as const;
export type PipelineVisibility = (typeof PIPELINE_VISIBILITY)[number];

export const EXPORT_FORMATS = ["png", "jpg", "webp"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const WATERMARK_POSITIONS = [
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
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

export const SMART_CROP_PRESETS = [
  "instagram_square",
  "instagram_story",
  "twitter_header",
  "facebook_cover",
  "youtube_thumbnail",
  "linkedin_banner",
  "custom",
] as const;
export type SmartCropPreset = (typeof SMART_CROP_PRESETS)[number];

export const STYLE_NAMES = [
  "oil_painting",
  "watercolor",
  "anime",
  "pixel_art",
  "sketch",
  "pop_art",
  "impressionist",
  "cyberpunk",
] as const;
export type StyleName = (typeof STYLE_NAMES)[number];

export const BLEND_MODES = ["overlay", "multiply", "screen", "dissolve"] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export const BG_OUTPUT_FORMATS = ["png", "webp"] as const;
export type BgOutputFormat = (typeof BG_OUTPUT_FORMATS)[number];

export const CURRENT_EVENT_STYLES = ["editorial", "documentary", "artistic", "news"] as const;
export type CurrentEventStyle = (typeof CURRENT_EVENT_STYLES)[number];

export const DETAIL_LEVELS = ["brief", "detailed", "alt_text"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export const SUBJECT_TYPES = ["character", "object"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const REFERENCE_ROLES = ["style", "subject", "composition", "color"] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

export const BRAND_ASSETS = ["logo", "social_header", "business_card", "ad_creative"] as const;
export type BrandAsset = (typeof BRAND_ASSETS)[number];

export const ASPECT_RATIOS = [
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
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const MODEL_PREFERENCES = ["default", "quality", "speed", "latest"] as const;
export type ModelPreference = (typeof MODEL_PREFERENCES)[number];

export const GENERATION_RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;
export type GenerationResolution = (typeof GENERATION_RESOLUTIONS)[number];

export const ENHANCEMENT_COSTS: Record<EnhancementTier, number> = {
  FREE: 0,
  TIER_1K: 2,
  TIER_2K: 5,
  TIER_4K: 10,
};

export const ADVANCED_FEATURE_COSTS = {
  subjectRef: 1,
  text: 1,
  grounding: 2,
  compare: 1,
} as const;

export const MAX_BATCH_SIZE = 20;
