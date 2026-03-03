"use client";

import { useEngagement } from "@/hooks/useEngagement";

interface EngagementTrackerProps {
  visitorId: string;
  page: string;
  abVariant?: string;
  sectionIds: string[];
}

/**
 * Invisible component that tracks page engagement.
 * All business logic lives in @/lib/tracking/engagement.
 */
export function EngagementTracker({
  visitorId,
  page,
  abVariant,
  sectionIds,
}: EngagementTrackerProps) {
  useEngagement({ visitorId, page, abVariant, sectionIds });
  return null;
}

/** Helper to fire engagement events from other components */
export function trackEngagement(type: string, value?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("bazdmeg:engagement", {
      detail: { type, value },
    }),
  );
}
