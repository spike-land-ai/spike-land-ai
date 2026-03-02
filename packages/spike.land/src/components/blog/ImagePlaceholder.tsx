import { Camera, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface ImagePlaceholderProps {
  /** Description text to display in the placeholder */
  description: string;
  /** Type of image placeholder - affects visual styling */
  type: "original" | "enhanced";
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Placeholder component for images in blog posts.
 * Used to indicate where an image will be placed before actual images are available.
 *
 * - "original" type: Gray background with camera icon (for source/before images)
 * - "enhanced" type: Teal-tinted background with sparkle icon (for AI-enhanced images)
 *
 * @example
 * ```mdx
 * <ImagePlaceholder
 *   description="Original photo before enhancement"
 *   type="original"
 * />
 *
 * <ImagePlaceholder
 *   description="AI-enhanced result with improved clarity"
 *   type="enhanced"
 * />
 * ```
 */
export function ImagePlaceholder({ description, type, className }: ImagePlaceholderProps) {
  const isEnhanced = type === "enhanced";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        "w-full aspect-video rounded-lg border-2 border-dashed",
        "p-6 my-6",
        isEnhanced ? "bg-teal-950/30 border-teal-700" : "bg-gray-800/50 border-gray-600",
        className,
      )}
      role="img"
      aria-label={`Image placeholder: ${description}`}
    >
      <div
        className={cn(
          "flex items-center justify-center w-16 h-16 rounded-full",
          isEnhanced ? "bg-teal-900/50 text-teal-400" : "bg-gray-700 text-gray-400",
        )}
        aria-hidden="true"
      >
        {isEnhanced ? <Sparkles className="w-8 h-8" /> : <Camera className="w-8 h-8" />}
      </div>
      <p
        className={cn(
          "text-sm text-center max-w-md leading-relaxed",
          isEnhanced ? "text-teal-300" : "text-gray-400",
        )}
      >
        {description}
      </p>
      <span
        className={cn(
          "text-xs font-medium uppercase tracking-wide",
          isEnhanced ? "text-teal-500" : "text-gray-500",
        )}
      >
        {isEnhanced ? "Enhanced" : "Original"}
      </span>
    </div>
  );
}
