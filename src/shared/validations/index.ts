import { z } from "zod";
import { IMAGE_CONSTRAINTS, SUPPORTED_ASPECT_RATIOS } from "../constants";

/**
 * Shared Zod validation schemas for API requests
 * Used by both web and mobile apps
 */

// ============================================================================
// Enhancement Validations
// ============================================================================

export const EnhancementTierSchema = z.enum(["FREE", "TIER_0_5K", "TIER_1K", "TIER_2K", "TIER_4K"]);

export const EnhanceImageRequestSchema = z.object({
  imageId: z.string().min(1),
  tier: EnhancementTierSchema,
  prompt: z.string().optional(),
  pipelineId: z.string().optional(),
});

export const BatchEnhanceRequestSchema = z.object({
  imageIds: z.array(z.string().min(1)).min(1).max(IMAGE_CONSTRAINTS.MAX_BATCH_SIZE),
  tier: EnhancementTierSchema,
});

export type EnhanceImageRequest = z.infer<typeof EnhanceImageRequestSchema>;
export type BatchEnhanceRequest = z.infer<typeof BatchEnhanceRequestSchema>;

// ============================================================================
// MCP Generation Validations
// ============================================================================

export const AspectRatioSchema = z.enum(SUPPORTED_ASPECT_RATIOS);

export const GenerateImageRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  tier: EnhancementTierSchema.default("TIER_1K"),
  aspectRatio: AspectRatioSchema.default("1:1"),
  negativePrompt: z.string().max(1000).optional(),
});

export const ModifyImageRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  tier: EnhancementTierSchema.default("TIER_1K"),
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
});

export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;
export type ModifyImageRequest = z.infer<typeof ModifyImageRequestSchema>;

// ============================================================================
// Album Validations
// ============================================================================

export const AlbumPrivacySchema = z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]);

export const CreateAlbumRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  privacy: AlbumPrivacySchema.default("PRIVATE"),
  defaultTier: EnhancementTierSchema.default("TIER_1K"),
});

export const UpdateAlbumRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  privacy: AlbumPrivacySchema.optional(),
  defaultTier: EnhancementTierSchema.optional(),
  coverImageId: z.string().optional(),
});

export type CreateAlbumRequest = z.infer<typeof CreateAlbumRequestSchema>;
export type UpdateAlbumRequest = z.infer<typeof UpdateAlbumRequestSchema>;

// ============================================================================
// Voucher Validations
// ============================================================================

export const RedeemVoucherRequestSchema = z.object({
  code: z
    .string()
    .min(4)
    .max(20)
    .transform((val) => val.toUpperCase().trim()),
});

export type RedeemVoucherRequest = z.infer<typeof RedeemVoucherRequestSchema>;

// ============================================================================
// Merch Validations
// ============================================================================

export const AddToCartRequestSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  imageId: z.string().optional(),
  uploadedImageUrl: z.string().url().optional(),
  quantity: z.number().int().min(1).max(10).default(1),
  customText: z.string().max(100).optional(),
});

export const ShippingAddressSchema = z.object({
  name: z.string().min(1).max(100),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2), // ISO 2-letter country code
});

export const CreateOrderRequestSchema = z.object({
  shippingAddress: ShippingAddressSchema,
  billingAddress: ShippingAddressSchema.optional(),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

export type AddToCartRequest = z.infer<typeof AddToCartRequestSchema>;
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

// ============================================================================
// Auth Validations
// ============================================================================

export const EmailSchema = z.string().email().max(255);

export const CheckEmailRequestSchema = z.object({
  email: EmailSchema,
});

export const SignUpRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100).optional(),
  referralCode: z.string().max(20).optional(),
});

export type CheckEmailRequest = z.infer<typeof CheckEmailRequestSchema>;
export type SignUpRequest = z.infer<typeof SignUpRequestSchema>;

// ============================================================================
// JSON Column Schemas (Phase 3 - Schema Improvement Plan)
// ============================================================================

export * from "./json-schemas";
