/**
 * useTimeline - Hook for managing timeline state and interactions
 * Provides zoom, scroll, playhead, and time/pixel conversion utilities
 */

"use client";

import { useCallback, useRef, useState } from "react";
import type { SnapGrid, TimelineState } from "../types";

const DEFAULT_ZOOM = 50; // pixels per second
const MIN_ZOOM = 10;
const MAX_ZOOM = 200;

interface UseTimelineOptions {
  defaultZoom?: number;
  defaultSnapEnabled?: boolean;
  defaultSnapGrid?: SnapGrid;
}

interface UseTimelineReturn {
  // State
  state: TimelineState;

  // Conversion utilities
  timeToPixels: (time: number) => number;
  pixelsToTime: (pixels: number) => number;
  snapTime: (time: number) => number;

  // Actions
  setZoom: (zoom: number) => void;
  setScrollOffset: (offset: number) => void;
  setPlayheadTime: (time: number) => void;
  setSelectedTrackId: (id: string | null) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapGrid: (grid: SnapGrid) => void;

  // Playback animation
  startPlayheadAnimation: (startTime: number, audioContext?: AudioContext) => void;
  stopPlayheadAnimation: () => void;

  // Scrubbing
  scrubRef: React.MutableRefObject<{
    startX: number;
    startTime: number;
    lastTime: number;
  } | null>;
  startScrub: (x: number, currentTime: number) => void;
  updateScrub: (x: number) => number;
  endScrub: () => void;
}

export function useTimeline(options: UseTimelineOptions = {}): UseTimelineReturn {
  const { defaultZoom = DEFAULT_ZOOM, defaultSnapEnabled = true, defaultSnapGrid = 0.1 } = options;

  const [state, setState] = useState<TimelineState>({
    zoom: defaultZoom,
    scrollOffset: 0,
    playheadTime: 0,
    selectedTrackId: null,
    snapEnabled: defaultSnapEnabled,
    snapGrid: defaultSnapGrid,
  });

  const animationRef = useRef<number | null>(null);
  const animationStartRef = useRef<{
    wallTime: number;
    contextTime: number;
    playheadTime: number;
    audioContext: AudioContext | null;
  } | null>(null);
  const scrubRef = useRef<{
    startX: number;
    startTime: number;
    lastTime: number;
  } | null>(null);

  // Conversion utilities
  const timeToPixels = useCallback((time: number) => time * state.zoom, [state.zoom]);

  const pixelsToTime = useCallback((pixels: number) => pixels / state.zoom, [state.zoom]);

  const snapTime = useCallback(
    (time: number) => {
      if (!state.snapEnabled) return time;
      return Math.round(time / state.snapGrid) * state.snapGrid;
    },
    [state.snapEnabled, state.snapGrid],
  );

  // State setters
  const setZoom = useCallback((zoom: number) => {
    setState((prev) => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
    }));
  }, []);

  const setScrollOffset = useCallback((offset: number) => {
    setState((prev) => ({
      ...prev,
      scrollOffset: Math.max(0, offset),
    }));
  }, []);

  const setPlayheadTime = useCallback((time: number) => {
    setState((prev) => ({
      ...prev,
      playheadTime: Math.max(0, time),
    }));
  }, []);

  const setSelectedTrackId = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedTrackId: id,
    }));
  }, []);

  const setSnapEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      snapEnabled: enabled,
    }));
  }, []);

  const setSnapGrid = useCallback((grid: SnapGrid) => {
    setState((prev) => ({
      ...prev,
      snapGrid: grid,
    }));
  }, []);

  // Playhead animation for playback
  const startPlayheadAnimation = useCallback((startTime: number, audioContext?: AudioContext) => {
    // Cancel any existing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    animationStartRef.current = {
      wallTime: performance.now(),
      contextTime: audioContext?.currentTime ?? 0,
      playheadTime: startTime,
      audioContext: audioContext ?? null,
    };

    const animate = () => {
      if (!animationStartRef.current) return;

      const { audioContext: ctx, contextTime, wallTime, playheadTime } = animationStartRef.current;
      // Prefer AudioContext clock when available to stay in sync with audio
      const elapsed = ctx ? ctx.currentTime - contextTime : (performance.now() - wallTime) / 1000;
      const newTime = playheadTime + elapsed;

      setState((prev) => ({
        ...prev,
        playheadTime: newTime,
      }));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  const stopPlayheadAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    animationStartRef.current = null;
  }, []);

  // Scrubbing
  const startScrub = useCallback((x: number, currentTime: number) => {
    scrubRef.current = {
      startX: x,
      startTime: currentTime,
      lastTime: currentTime,
    };
  }, []);

  const updateScrub = useCallback(
    (x: number): number => {
      if (!scrubRef.current) return state.playheadTime;

      const deltaX = x - scrubRef.current.startX;
      const deltaTime = deltaX / state.zoom;
      const newTime = Math.max(0, scrubRef.current.startTime + deltaTime);

      scrubRef.current.lastTime = newTime;
      setPlayheadTime(newTime);

      return newTime;
    },
    [state.zoom, state.playheadTime, setPlayheadTime],
  );

  const endScrub = useCallback(() => {
    scrubRef.current = null;
  }, []);

  return {
    state,
    timeToPixels,
    pixelsToTime,
    snapTime,
    setZoom,
    setScrollOffset,
    setPlayheadTime,
    setSelectedTrackId,
    setSnapEnabled,
    setSnapGrid,
    startPlayheadAnimation,
    stopPlayheadAnimation,
    scrubRef,
    startScrub,
    updateScrub,
    endScrub,
  };
}
