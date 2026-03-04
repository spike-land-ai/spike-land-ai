import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCanvas } from "../../hooks/useCanvas";
import { Loader2, Minus, MousePointer2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { ToolOrb } from "./ToolOrb";
import { UploadZone } from "./UploadZone";
import { DetailsPanel } from "./DetailsPanel";
import { StudioEngine } from "../../services/studio-engine";
import { callTool, parseToolResult } from "../../api/client";
import { toast } from "sonner";

export function Canvas() {
  const {
    assets,
    zoom,
    pan,
    selectedAssetId,
    handleWheel,
    setSelectedAssetId,
    updateAssetPosition,
    updateAsset,
    addAsset,
    setZoom,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    clearAssets,
  } = useCanvas();

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<Map<string, string>>(new Map()); // assetId -> jobId
  const containerRef = useRef<HTMLDivElement>(null);

  // Poll pending generation jobs and update asset URLs when complete
  const pollJob = useCallback(
    async (assetId: string, jobId: string) => {
      try {
        const result = await callTool("img_job_status", { job_id: jobId });
        const data = parseToolResult<Record<string, unknown>>(result);
        const status = data.status as string;

        if (status === "COMPLETED") {
          const url = (data.outputUrl ?? data.outputImageUrl) as string | undefined;
          if (url) {
            updateAsset(assetId, { url });
          }
          setPendingJobs((prev) => {
            const next = new Map(prev);
            next.delete(assetId);
            return next;
          });
          return true;
        }
        if (status === "FAILED" || status === "CANCELLED") {
          const msg = (data.error ?? data.errorMessage ?? "Generation failed") as string;
          toast.error(msg);
          setPendingJobs((prev) => {
            const next = new Map(prev);
            next.delete(assetId);
            return next;
          });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [updateAsset],
  );

  useEffect(() => {
    if (pendingJobs.size === 0) return;
    let cancelled = false;
    const run = async () => {
      for (const [assetId, jobId] of pendingJobs) {
        if (cancelled) return;
        await pollJob(assetId, jobId);
      }
      if (!cancelled && pendingJobs.size > 0) {
        setTimeout(run, 3000);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [pendingJobs, pollJob]);

  useEffect(() => {
    const initial = sessionStorage.getItem("studio_initial_image");
    if (initial) {
      sessionStorage.removeItem("studio_initial_image");
      try {
        const { url, name } = JSON.parse(initial);
        const assetId = `asset-${Date.now()}`;
        addAsset({
          id: assetId,
          type: "image",
          url,
          name,
        });
        setTimeout(() => setSelectedAssetId(assetId), 100);
      } catch (e) {
        console.error("Failed to parse studio initial image from sessionStorage:", e);
      }
    }
  }, [addAsset, setSelectedAssetId]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || null;

  const handleClear = () => {
    if (assets.length === 0) return;
    if (confirm("Evaporate all manifested assets?")) {
      clearAssets();
      toast.success("Canvas returned to void");
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    const toastId = toast.loading("Sparking your vision...");

    try {
      const result = (await StudioEngine.generateAsset(prompt)) as {
        jobId?: string;
        job_id?: string;
      };
      const jobId = result.jobId ?? result.job_id ?? `gen-${Date.now()}`;
      const assetId = `asset-${jobId}`;
      addAsset({
        id: assetId,
        type: "image",
        url: "generating",
        name: prompt,
      });
      setPendingJobs((prev) => new Map(prev).set(assetId, jobId));
      setPrompt("");
      toast.success("Vision captured on canvas", { id: toastId });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err), {
        id: toastId,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resolveImageId = async (asset: (typeof assets)[0]): Promise<string | null> => {
    // If metadata already has an image_id, use it
    if (asset.metadata?.image_id) return asset.metadata.image_id as string;

    // Try to extract jobId from asset ID (format: asset-<jobId>)
    const jobId = asset.id.replace(/^asset-/, "");
    if (!jobId || jobId === asset.id) return null;

    try {
      const result = await callTool("img_job_status", { job_id: jobId });
      const data = parseToolResult<Record<string, unknown>>(result);
      const imageId = (data.imageId ?? data.image_id ?? data.outputImageId) as string | undefined;
      if (imageId) {
        // Cache it in metadata for future use
        updateAsset(asset.id, { metadata: { ...asset.metadata, image_id: imageId } });
        return imageId;
      }
    } catch {
      // Fall through
    }
    return null;
  };

  const handleOrbAction = async (action: string) => {
    if (!selectedAssetId) return;

    const asset = assets.find((a) => a.id === selectedAssetId);
    if (!asset) return;

    if (action === "delete") {
      updateAssetPosition(asset.id, -10000, -10000);
      setSelectedAssetId(null);
      toast.success("Asset removed from canvas");
      return;
    }

    toast.info(`Executing ${action} orchestration...`);

    try {
      const imageId = await resolveImageId(asset);
      if (!imageId) {
        toast.error("Could not resolve image ID for this asset");
        return;
      }

      if (action === "enhance") {
        await callTool("img_enhance", { image_id: imageId, tier: "TIER_2K" });
        toast.success("Enhancement sequence initiated");
      }
      if (action === "autotag") {
        const result = await callTool("img_auto_tag", { image_id: imageId });
        const data = parseToolResult<Record<string, unknown>>(result);
        toast.success(`Auto-tagged: ${(data.tags as string[])?.join(", ") ?? "done"}`);
      }
      if (action === "social") {
        await StudioEngine.createSocialPack(imageId);
        toast.success("Social pack appearing on canvas");
      }
      if (action === "upscale") {
        await callTool("img_enhance", { image_id: imageId, tier: "TIER_4K" });
        toast.success("Upscale initiated (4K tier)");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-obsidian-950 canvas-grid touch-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Canvas Layer */}
      <div
        className="absolute inset-0 transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {assets.map((asset) => (
          <div
            key={asset.id}
            className={`absolute cursor-move transition-all duration-300 group ${
              selectedAssetId === asset.id ? "z-50" : "z-10"
            }`}
            style={{
              left: asset.x,
              top: asset.y,
              width: 300 / Math.max(zoom, 0.5),
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAssetId(asset.id);
            }}
          >
            {/* Tool Orb Integration - Only on Desktop */}
            <div className="hidden md:block">
              <ToolOrb isVisible={selectedAssetId === asset.id} onAction={handleOrbAction} />
            </div>

            <div
              className={`glass-card rounded-2xl overflow-hidden transition-all duration-500 ${
                selectedAssetId === asset.id
                  ? "ring-2 ring-amber-neon shadow-[0_0_50px_rgba(255,170,0,0.3)] scale-105"
                  : "opacity-80 grayscale-[0.5] hover:opacity-100 hover:grayscale-0"
              }`}
            >
              <div
                className={`relative aspect-square bg-obsidian-900 ${
                  asset.url === "generating" ? "animate-pulse" : ""
                }`}
              >
                {asset.url === "generating" ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-amber-neon animate-spin" />
                      <span className="mt-4 text-[8px] font-black uppercase tracking-[0.3em] text-amber-neon/50">
                        Neural Flux
                      </span>
                    </div>
                  </>
                ) : (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover transition-opacity duration-1000"
                  />
                )}
              </div>
              <div className="p-4 bg-obsidian-900/90 backdrop-blur-md border-t border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate block mb-1">
                  Asset Trace
                </span>
                <span className="text-xs font-bold text-gray-200 truncate block">{asset.name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating UI: Global Spark Bar */}
      <div
        className={`absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] md:top-10 md:bottom-auto left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50 transition-all duration-500 ${
          selectedAssetId
            ? "scale-95 opacity-0 pointer-events-none translate-y-4 md:-translate-y-4"
            : "scale-100 opacity-100"
        }`}
      >
        <form
          onSubmit={handleGenerate}
          className="glass-panel rounded-2xl flex items-center px-4 md:px-6 py-2.5 md:py-4 gap-3 md:gap-4 focus-within:ring-2 ring-amber-neon/30 transition-all shadow-2xl"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-amber-neon animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-amber-neon animate-pulse" />
          )}
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Spark vision..."
            className="flex-1 bg-transparent border-none outline-none text-sm md:text-lg font-semibold text-white placeholder:text-gray-600"
          />
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-gray-500 uppercase tracking-tighter">
              <span>⌘</span>
              <span>K</span>
            </div>
          </div>
        </form>
      </div>

      {/* Details Panel Integration */}
      <DetailsPanel asset={selectedAsset} onClose={() => setSelectedAssetId(null)} onAction={handleOrbAction} />

      {/* Canvas Controls */}
      <div className="absolute top-20 right-4 md:top-auto md:bottom-8 md:left-1/2 md:-translate-x-1/2 glass-panel rounded-2xl p-1 md:p-1.5 flex flex-col md:flex-row items-center gap-1 md:gap-1.5 z-50 shadow-2xl transition-all">
        <button
          onClick={handleClear}
          className="p-2 rounded-xl hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors group"
          title="Clear Canvas"
        >
          <Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5 group-active:scale-90 transition-transform" />
        </button>

        <div className="w-5 h-px md:w-px md:h-5 bg-white/10 my-0.5 md:mx-0.5 md:my-0" />

        <button className="hidden md:flex p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-amber-neon transition-colors group">
          <MousePointer2 className="w-4 h-4 md:w-4.5 md:h-4.5 group-active:scale-90 transition-transform" />
        </button>

        <div className="hidden md:block w-px h-5 bg-white/10 mx-0.5" />
        <UploadZone onUploadComplete={addAsset} />
        <div className="w-5 h-px md:w-px md:h-5 bg-white/10 my-0.5 md:mx-0.5 md:my-0" />

        <div className="flex flex-col md:flex-row items-center bg-white/5 rounded-xl p-1 md:px-1">
          <button
            onClick={() => setZoom((prev) => Math.min(prev + 0.2, 5))}
            className="p-1.5 text-gray-500 hover:text-white transition-colors"
          >
            <Plus className="w-3 h-3 md:w-3.5 md:h-3.5" />
          </button>

          <div className="py-2 px-1 md:px-2 md:py-1 flex items-center gap-2 border-y md:border-y-0 md:border-x border-white/5">
            <span className="text-[9px] md:text-xs font-black font-mono text-gray-400 w-8 md:w-10 text-center uppercase">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <button
            onClick={() => setZoom((prev) => Math.max(prev - 0.2, 0.1))}
            className="p-1.5 text-gray-500 hover:text-white transition-colors"
          >
            <Minus className="w-3 h-3 md:w-3.5 md:h-3.5" />
          </button>
        </div>

        <div className="w-5 h-px md:w-px md:h-5 bg-white/10 my-0.5 md:mx-0.5 md:my-0" />
        <button
          onClick={() => setSelectedAssetId(null)}
          className="px-3 py-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors disabled:opacity-20"
          disabled={!selectedAssetId}
        >
          <span className="hidden md:inline">Reset</span>
          <X className="w-3.5 h-3.5 md:hidden" />
        </button>
      </div>
    </div>
  );
}
