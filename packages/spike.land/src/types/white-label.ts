/**
 * White-Label Types and Validation Schemas
 *
 * Type definitions for white-label workspace customization.
 * Resolves #924
 */

import type {
  DomainVerificationStatus,
  SslCertificateStatus,
  WorkspaceWhiteLabelConfig,
} from "@/generated/prisma";
import { z } from "zod";

// =============================================================================
// Re-export Prisma Types
// =============================================================================

export type { DomainVerificationStatus, SslCertificateStatus, WorkspaceWhiteLabelConfig };

// =============================================================================
// Validation Schemas
// =============================================================================

/**
 * Hex color validation schema
 * Accepts 3-digit (#RGB) and 6-digit (#RRGGBB) hex colors
 */
const hexColorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format")
  .optional();

/**
 * Domain validation schema
 * Validates basic domain format (e.g., example.com, subdomain.example.com)
 */
const domainSchema = z
  .string()
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i,
    "Invalid domain format",
  )
  .optional();

/**
 * Font family validation schema
 * Accepts Google Fonts names or web-safe font stacks
 */
const fontFamilySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[a-zA-Z0-9\s,'-]+$/,
    "Font family must contain only letters, numbers, spaces, commas, hyphens, and apostrophes",
  )
  .optional();

/**
 * URL validation schema
 */
const urlSchema = z.string().url("Invalid URL format").optional();

/**
 * Validation schema for creating/updating white-label configuration
 */
export const whiteLabelConfigSchema = z.object({
  // Custom Domain Configuration
  customDomain: domainSchema,
  customDomainVerified: z.boolean().optional(),
  dnsVerificationToken: z.string().optional(),
  dnsVerificationStatus: z
    .enum(["PENDING", "VERIFYING", "VERIFIED", "FAILED", "EXPIRED"])
    .optional(),
  sslCertificateStatus: z
    .enum(["PENDING", "PROVISIONING", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "FAILED"])
    .optional(),
  sslCertificateIssuedAt: z.string().datetime().optional().nullable(),
  sslCertificateExpiresAt: z.string().datetime().optional().nullable(),

  // Visual Customization
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  fontFamily: fontFamilySchema,
  logoUrl: urlSchema,
  logoR2Key: z.string().optional(),
  faviconUrl: urlSchema,
  faviconR2Key: z.string().optional(),

  // Email Branding
  emailSenderName: z.string().min(1).max(200).optional(),
  emailSenderDomain: domainSchema,
  emailSenderVerified: z.boolean().optional(),
  emailHeaderLogoUrl: urlSchema,
  emailFooterText: z.string().max(5000).optional(),

  // Login & Portal Customization
  loginPageTitle: z.string().min(1).max(200).optional(),
  loginPageDescription: z.string().max(1000).optional(),
  loginBackgroundUrl: urlSchema,
  loginBackgroundR2Key: z.string().optional(),
  showPoweredBySpikeLand: z.boolean().optional(),

  // PDF Report Branding
  pdfHeaderLogoUrl: urlSchema,
  pdfFooterText: z.string().max(1000).optional(),
  pdfWatermarkUrl: urlSchema,
});

/**
 * Type for validated white-label configuration input
 */
export type WhiteLabelConfigInput = z.infer<typeof whiteLabelConfigSchema>;

/**
 * Validation schema for partial updates (PATCH requests)
 */
export const whiteLabelConfigPatchSchema = whiteLabelConfigSchema.partial();

/**
 * Type for partial white-label configuration updates
 */
export type WhiteLabelConfigPatchInput = z.infer<typeof whiteLabelConfigPatchSchema>;

// =============================================================================
// Upload Types
// =============================================================================

/**
 * Supported image formats for logo upload
 */
export const LOGO_FORMATS = ["image/png", "image/jpeg", "image/svg+xml"] as const;
export type LogoFormat = (typeof LOGO_FORMATS)[number];

/**
 * Supported formats for favicon upload
 */
export const FAVICON_FORMATS = ["image/x-icon", "image/png"] as const;
export type FaviconFormat = (typeof FAVICON_FORMATS)[number];

/**
 * Supported formats for background image upload
 */
export const BACKGROUND_FORMATS = ["image/png", "image/jpeg", "image/webp"] as const;
export type BackgroundFormat = (typeof BACKGROUND_FORMATS)[number];

/**
 * Maximum file sizes (in bytes)
 */
export const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FAVICON_SIZE = 100 * 1024; // 100KB
export const MAX_BACKGROUND_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Upload validation schema for logo
 */
export const logoUploadSchema = z.object({
  file: z.instanceof(File),
  mimeType: z.enum(LOGO_FORMATS),
  size: z.number().max(MAX_LOGO_SIZE, "Logo file size must not exceed 5MB"),
});

/**
 * Upload validation schema for favicon
 */
export const faviconUploadSchema = z.object({
  file: z.instanceof(File),
  mimeType: z.enum(FAVICON_FORMATS),
  size: z.number().max(MAX_FAVICON_SIZE, "Favicon file size must not exceed 100KB"),
});

/**
 * Upload validation schema for background image
 */
export const backgroundUploadSchema = z.object({
  file: z.instanceof(File),
  mimeType: z.enum(BACKGROUND_FORMATS),
  size: z.number().max(MAX_BACKGROUND_SIZE, "Background image file size must not exceed 10MB"),
});

// =============================================================================
// Response Types
// =============================================================================

/**
 * API response for white-label configuration
 */
export interface WhiteLabelConfigResponse {
  success: boolean;
  data?: WorkspaceWhiteLabelConfig;
  error?: string;
}

/**
 * API response for domain verification
 */
export interface DomainVerificationResponse {
  success: boolean;
  data?: {
    verificationToken: string;
    instructions: {
      recordType: "TXT";
      host: string;
      value: string;
      ttl: number;
    };
    status: DomainVerificationStatus;
  };
  error?: string;
}

/**
 * API response for domain/SSL status check
 */
export interface DomainStatusResponse {
  success: boolean;
  data?: {
    dnsVerificationStatus: DomainVerificationStatus;
    sslCertificateStatus: SslCertificateStatus;
    customDomainVerified: boolean;
    sslCertificateIssuedAt?: Date | null;
    sslCertificateExpiresAt?: Date | null;
    daysUntilExpiration?: number;
  };
  error?: string;
}

/**
 * API response for image upload
 */
export interface ImageUploadResponse {
  success: boolean;
  data?: {
    url: string;
    r2Key: string;
  };
  error?: string;
}

// =============================================================================
// Theme Types
// =============================================================================

/**
 * CSS custom properties generated from white-label config
 */
export interface ThemeCssVariables {
  "--wl-primary": string;
  "--wl-secondary": string;
  "--wl-accent": string;
  "--wl-font-family": string;
}

/**
 * Theme configuration for runtime application
 */
export interface RuntimeThemeConfig {
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  fonts: {
    family?: string;
  };
  logos: {
    main?: string;
    favicon?: string;
  };
  branding: {
    showPoweredBySpikeLand: boolean;
  };
}
