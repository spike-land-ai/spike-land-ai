"use client";

import { useCallback, useEffect, useRef } from "react";
import { createEngagementCollector, flushEngagement } from "@/lib/tracking/engagement";

interface UseEngagementOptions {
  visitorId: string;
  page: string;
  abVariant?: string;
  sectionIds: string[];
}

/**
 * Thin hook that wraps engagement collection utilities.
 * Sets up scroll, timer, IntersectionObserver, and window event listeners.
 */
export function useEngagement({
  visitorId,
  page,
  abVariant,
  sectionIds,
}: UseEngagementOptions): void {
  const collectorRef = useRef(createEngagementCollector(visitorId, page, abVariant));
  const startTimeRef = useRef(Date.now());

  const flush = useCallback(() => {
    const collector = collectorRef.current;
    if (!collector.isDirty()) return;
    collector.markClean();
    flushEngagement({ ...collector.data });
  }, []);

  // Track time on page
  useEffect(() => {
    const interval = setInterval(() => {
      collectorRef.current.updateTimeOnPage(startTimeRef.current);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const depth = Math.round((window.scrollY / scrollHeight) * 100);
      collectorRef.current.updateScrollDepth(depth);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track section visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            collectorRef.current.addSection(entry.target.id);
          }
        }
      },
      { threshold: 0.3 },
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  // Flush every 5 seconds and on unload
  useEffect(() => {
    const interval = setInterval(flush, 5000);

    const handleUnload = () => {
      collectorRef.current.updateTimeOnPage(startTimeRef.current);
      flush();
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload();
    };
  }, [flush]);

  // Listen for custom engagement events
  useEffect(() => {
    const handler = (e: CustomEvent<{ type: string; value?: string }>) => {
      collectorRef.current.handleEvent(e.detail.type, e.detail.value);
    };

    window.addEventListener("bazdmeg:engagement" as string, handler as EventListener);
    return () =>
      window.removeEventListener("bazdmeg:engagement" as string, handler as EventListener);
  }, []);
}
