import { useState, useCallback } from "react";
import type { StudioAsset } from "../services/studio-engine";

export function useCanvas() {
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const addAsset = useCallback((asset: Omit<StudioAsset, "x" | "y">) => {
    setAssets((prev) => [
      ...prev,
      { ...asset, x: -pan.x / zoom + 100, y: -pan.y / zoom + 100 }
    ]);
  }, [pan, zoom]);

  const updateAssetPosition = useCallback((id: string, x: number, y: number) => {
    setAssets((prev) =>
      prev.map(a => a.id === id ? { ...a, x, y } : a)
    );
  }, []);

  const updateAsset = useCallback((id: string, updates: Partial<StudioAsset>) => {
    setAssets((prev) =>
      prev.map(a => a.id === id ? { ...a, ...updates } : a)
    );
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      // Zoom
      const delta = -e.deltaY * 0.001;
      setZoom(prev => Math.min(Math.max(prev + delta, 0.1), 5));
    } else {
      // Pan
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  }, []);

  const [lastTouch, setLastTouch] = useState<{ x: number, y: number } | null>(null);

  const clearAssets = useCallback(() => {
    setAssets([]);
    setSelectedAssetId(null);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setLastTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && lastTouch) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouch.x;
      const dy = touch.clientY - lastTouch.y;
      
      setPan(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setLastTouch({ x: touch.clientX, y: touch.clientY });
    }
  }, [lastTouch]);

  const handleTouchEnd = useCallback(() => {
    setLastTouch(null);
  }, []);

  return {
    assets,
    zoom,
    pan,
    selectedAssetId,
    addAsset,
    updateAsset,
    updateAssetPosition,
    setSelectedAssetId,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    setPan,
    setZoom,
    clearAssets
  };
}
