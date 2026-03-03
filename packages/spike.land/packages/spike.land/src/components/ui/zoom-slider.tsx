"use client";

import { cn } from "@/lib/utils";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ZoomLevel } from "./masonry-grid";
import { Slider } from "./slider";

const STORAGE_KEY = "album-zoom-level";

interface ZoomSliderProps {
  value?: ZoomLevel;
  onChange?: (value: ZoomLevel) => void;
  className?: string;
}

export function ZoomSlider({
  value: controlledValue,
  onChange,
  className,
}: ZoomSliderProps) {
  const [internalValue, setInternalValue] = useState<ZoomLevel>(3);
  const [isMounted, setIsMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed >= 1 && parsed <= 5) {
        setInternalValue(parsed as ZoomLevel);
      }
    }
  }, []);

  const value = controlledValue ?? internalValue;

  const handleChange = useCallback(
    (newValue: number[]) => {
      const zoomValue = newValue[0] as ZoomLevel;
      setInternalValue(zoomValue);
      localStorage.setItem(STORAGE_KEY, String(zoomValue));
      onChange?.(zoomValue);
    },
    [onChange],
  );

  const handleZoomOut = useCallback(() => {
    const newValue = Math.max(1, value - 1) as ZoomLevel;
    setInternalValue(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
    onChange?.(newValue);
  }, [value, onChange]);

  const handleZoomIn = useCallback(() => {
    const newValue = Math.min(5, value + 1) as ZoomLevel;
    setInternalValue(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
    onChange?.(newValue);
  }, [value, onChange]);

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <ZoomOut className="h-4 w-4 text-muted-foreground" />
        <div className="w-24 h-2 bg-muted rounded-full" />
        <ZoomIn className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        onClick={handleZoomOut}
        className="text-muted-foreground hover:text-primary transition-colors focus:outline-none focus-visible:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={value <= 1}
        aria-label="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <Slider
        value={[value]}
        min={1}
        max={5}
        step={1}
        onValueChange={handleChange}
        className="w-24"
        aria-label="Zoom level"
      />
      <button
        onClick={handleZoomIn}
        className="text-muted-foreground hover:text-primary transition-colors focus:outline-none focus-visible:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={value >= 5}
        aria-label="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
    </div>
  );
}

// Hook to use the global zoom level
export function useZoomLevel(): [ZoomLevel, (value: ZoomLevel) => void] {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(3);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed >= 1 && parsed <= 5) {
        setZoomLevel(parsed as ZoomLevel);
      }
    }

    // Listen for storage changes from other tabs/components
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const parsed = parseInt(e.newValue, 10);
        if (parsed >= 1 && parsed <= 5) {
          setZoomLevel(parsed as ZoomLevel);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const setZoom = useCallback((value: ZoomLevel) => {
    setZoomLevel(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  // Return default value before mount to avoid hydration issues
  return isMounted ? [zoomLevel, setZoom] : [3, setZoom];
}
