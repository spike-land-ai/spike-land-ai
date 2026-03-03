"use client";

/**
 * Meta Pixel Component
 *
 * Server-side analytics should be used instead of client-side.
 * This component is retained as a no-op to prevent breaking existing imports.
 */

interface MetaPixelProps {
  /** CSP nonce for inline script execution */
  nonce?: string;
}

/**
 * Meta Pixel tracking component (Disabled)
 * Analytics should be sent by our server not clients.
 */
export function MetaPixel(_props: MetaPixelProps) {
  return null;
}
