"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Custom hook that returns progress (0-1) of an element scrolling into view.
 * Uses a scroll/resize listener for continuous tracking so the animation
 * responds smoothly as the user scrolls up and down.
 */
export function useInViewProgress() {
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);
  const targetProgress = useRef(0);
  const currentProgress = useRef(0);

  const animate = useCallback(() => {
    // Smooth lerp: current + (target - current) * factor
    // Using a factor of 0.1 for nice "springy" smoothing
    const diff = targetProgress.current - currentProgress.current;

    if (Math.abs(diff) < 0.001) {
      currentProgress.current = targetProgress.current;
      setProgress(targetProgress.current);
      animationFrameRef.current = 0;
      return;
    }

    currentProgress.current += diff * 0.15;
    setProgress(currentProgress.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const updateProgress = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // Appearance: 0 when element top hits window bottom, 1 when element is ~60% into view
    // A slightly larger window (0.6 instead of 0.5) gives more room for the animation to complete
    const appearance = (windowHeight - rect.top) / (windowHeight * 0.6);
    const p = Math.min(Math.max(appearance, 0), 1);

    targetProgress.current = p;

    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // SSR fallback
    if (typeof IntersectionObserver === "undefined") {
      setProgress(1);
      return undefined;
    }

    let listening = false;

    const startListening = () => {
      if (listening) return;
      listening = true;
      window.addEventListener("scroll", updateProgress, { passive: true });
      window.addEventListener("resize", updateProgress, { passive: true });
      updateProgress();
    };

    const stopListening = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
    };

    // Use IntersectionObserver to only track scroll when element is near viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          startListening();
        } else {
          stopListening();
        }
      },
      { rootMargin: "200px 0px 200px 0px", threshold: 0 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      stopListening();
    };
  }, [updateProgress]);

  return { ref, progress };
}
