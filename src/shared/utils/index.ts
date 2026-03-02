/**
 * Shared utility functions for both web and mobile apps
 */

import { ENHANCEMENT_COSTS, IMAGE_CONSTRAINTS, TOKEN_REGENERATION } from "../constants";
import type { EnhancementTierKey } from "../constants";

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Get the token cost for an enhancement tier
 */
export function getEnhancementCost(tier: EnhancementTierKey): number {
  return ENHANCEMENT_COSTS[tier];
}

/**
 * Calculate tokens that would be regenerated since last regeneration
 */
export function calculateRegeneratedTokens(
  lastRegeneration: Date,
  currentBalance: number,
  maxTokens: number = TOKEN_REGENERATION.MAX_FREE_TOKENS,
): number {
  const now = Date.now();
  const lastRegenMs = lastRegeneration.getTime();
  const elapsedMs = now - lastRegenMs;

  const intervals = Math.floor(elapsedMs / TOKEN_REGENERATION.REGEN_INTERVAL_MS);
  const tokensToAdd = intervals * TOKEN_REGENERATION.TOKENS_PER_REGEN;

  return Math.min(currentBalance + tokensToAdd, maxTokens) - currentBalance;
}

/**
 * Get time until next token regeneration in milliseconds
 */
export function getTimeUntilNextRegen(lastRegeneration: Date): number {
  const now = Date.now();
  const lastRegenMs = lastRegeneration.getTime();
  const elapsedMs = now - lastRegenMs;

  const remainingMs =
    TOKEN_REGENERATION.REGEN_INTERVAL_MS - (elapsedMs % TOKEN_REGENERATION.REGEN_INTERVAL_MS);

  return remainingMs;
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0) return "0 B";
  if (!isFinite(bytes)) return "Unknown";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) {
    return "in the future";
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 7) {
    return date.toLocaleDateString();
  }
  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  }
  return "Just now";
}

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currency: string = "GBP",
  locale: string = "en-GB",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

// ============================================================================
// Image Utilities
// ============================================================================

/**
 * Get dimensions for a tier
 */
export function getTierDimensions(tier: EnhancementTierKey): number {
  return IMAGE_CONSTRAINTS.TIER_DIMENSIONS[tier];
}

/**
 * Parse aspect ratio string to width/height ratio
 */
export function parseAspectRatio(aspectRatio: string): { width: number; height: number } | null {
  const parts = aspectRatio.split(":").map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const width = parseInt(parts[0], 10);
  const height = parseInt(parts[1], 10);

  if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

/**
 * Calculate dimensions maintaining aspect ratio within max dimension
 */
export function calculateOutputDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth >= originalHeight) {
    const width = Math.min(originalWidth, maxDimension);
    const height = Math.round(width / aspectRatio);
    return { width, height };
  } else {
    const height = Math.min(originalHeight, maxDimension);
    const width = Math.round(height * aspectRatio);
    return { width, height };
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if a MIME type is allowed for image upload
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return (IMAGE_CONSTRAINTS.ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}
