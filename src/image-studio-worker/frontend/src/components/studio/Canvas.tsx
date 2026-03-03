import React, { useRef, useState } from "react";
import { useCanvas } from "../../hooks/useCanvas";
import { Sparkles, MousePointer2, ZoomIn, ZoomOut, Search, Loader2, Plus, Minus, X, Trash2 } from "lucide-react";
import { ToolOrb } from "./ToolOrb";
import { UploadZone } from "./UploadZone";
import { DetailsPanel } from "./DetailsPanel";
import { StudioEngine } from "../../services/studio-engine";
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
    addAsset,
    setZoom,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    clearAssets
  } = useCanvas();

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAsset = assets.find(a => a.id === selectedAssetId) || null;

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
      const result = await StudioEngine.generateAsset(prompt);
      addAsset({
        id: result.jobId,
        type: "image",
        url: "https://placehold.co/600x400/020203/white?text=Generating...",
        name: prompt
      });
      setPrompt("");
      toast.success("Vision captured on canvas", { id: toastId });
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOrbAction = async (action: string) => {
    if (!selectedAssetId) return;
    
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) return;

    if (action === "delete") {
      updateAssetPosition(asset.id, -10000, -10000); // Hacky delete if no proper removeAsset
      setSelectedAssetId(null);
      toast.success("Asset removed from canvas");
      return;
    }

    toast.info(`Executing ${action} orchestration...`);

    try {
      if (action === "enhance") {
        await StudioEngine.smartEnhance(asset.id);
        toast.success("Enhancement sequence initiated");
      }
      if (action === "social") {
        await StudioEngine.createSocialPack(asset.id);
        toast.success("Social pack appearing on canvas");
      }
    } catch (err: any) {
      toast.error(err.message);
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
          transformOrigin: "0 0"
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
              width: 300 / Math.max(zoom, 0.5)
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAssetId(asset.id);
            }}
          >
            {/* Tool Orb Integration - Only on Desktop */}
            <div className="hidden md:block">
              <ToolOrb 
                isVisible={selectedAssetId === asset.id} 
                onAction={handleOrbAction} 
              />
            </div>

            <div className={`glass-card rounded-2xl overflow-hidden transition-all duration-500 ${
              selectedAssetId === asset.id 
                ? "ring-2 ring-amber-neon shadow-[0_0_50px_rgba(255,170,0,0.3)] scale-105" 
                : "opacity-80 grayscale-[0.5] hover:opacity-100 hover:grayscale-0"
            }`}>
              <div className={`relative aspect-square bg-obsidian-900 flex items-center justify-center ${asset.url.includes("Generating") ? "animate-pulse" : ""}`}>
                {asset.url.includes("Generating") && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                )}
                <img 
                  src={asset.url} 
                  alt={asset.name} 
                  className={`w-full h-full object-cover transition-opacity duration-1000 ${asset.url.includes("Generating") ? "opacity-0" : "opacity-100"}`} 
                />
                {asset.url.includes("Generating") && (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-amber-neon animate-spin" />
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-amber-neon/50">Neural Flux</span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-obsidian-900/90 backdrop-blur-md border-t border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate block mb-1">Asset Trace</span>
                <span className="text-xs font-bold text-gray-200 truncate block">{asset.name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating UI: Global Spark Bar */}
      <div className={`absolute bottom-24 md:top-12 md:bottom-auto left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 md:px-6 z-50 transition-all duration-500 ${selectedAssetId ? "scale-95 opacity-0 pointer-events-none translate-y-4 md:-translate-y-4" : "scale-100 opacity-100"}`}>
        <form onSubmit={handleGenerate} className="glass-panel rounded-2xl md:rounded-[2rem] flex items-center px-4 md:px-8 py-3 md:py-5 gap-3 md:gap-6 focus-within:ring-2 ring-amber-neon/30 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {isGenerating ? (
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-amber-neon animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-amber-neon animate-pulse" />
          )}
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Spark vision..." 
            className="flex-1 bg-transparent border-none outline-none text-base md:text-xl font-medium text-gray-100 placeholder:text-gray-700"
          />
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-tighter">
              <span>⌘</span>
              <span>K</span>
            </div>
          </div>
        </form>
      </div>

      {/* Details Panel Integration */}
      <DetailsPanel 
        asset={selectedAsset} 
        onClose={() => setSelectedAssetId(null)} 
      />

      {/* Canvas Controls */}
      <div className="absolute bottom-6 md:bottom-12 right-6 md:left-1/2 md:-translate-x-1/2 glass-panel rounded-2xl p-1.5 md:p-2 flex items-center gap-1 md:gap-2 z-50 shadow-2xl transition-all">
        <button 
          onClick={handleClear}
          className="p-2 md:p-3 rounded-xl hover:bg-white/10 text-gray-400 hover:text-red-500 transition-colors group"
          title="Clear Canvas"
        >
          <Trash2 className="w-4 h-4 md:w-5 md:h-5 group-active:scale-90 transition-transform" />
        </button>

        <div className="w-px h-6 bg-white/10 mx-0.5 md:mx-1" />
        
        <button className="hidden md:flex p-2 md:p-3 rounded-xl hover:bg-white/10 text-gray-400 hover:text-amber-neon transition-colors group">
          <MousePointer2 className="w-4 h-4 md:w-5 md:h-5 group-active:scale-90 transition-transform" />
        </button>
        
        <div className="hidden md:block w-px h-6 bg-white/10 mx-0.5 md:mx-1" />
        <UploadZone onUploadComplete={addAsset} />
        <div className="w-px h-6 bg-white/10 mx-0.5 md:mx-1" />

        <div className="flex items-center bg-white/5 rounded-xl px-1 md:px-2">
          <button 
            onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.1))}
            className="p-1.5 md:p-2 text-gray-500 hover:text-white transition-colors"
          >
            <Minus className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
          
          <div className="px-2 md:px-4 py-1.5 md:py-2 flex items-center gap-2 md:gap-3 border-x border-white/5">
            <span className="text-[10px] md:text-sm font-black font-mono text-gray-400 w-8 md:w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <button 
            onClick={() => setZoom(prev => Math.min(prev + 0.2, 5))}
            className="p-1.5 md:p-2 text-gray-500 hover:text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-white/10 mx-0.5 md:mx-1" />
        <button 
          onClick={() => setSelectedAssetId(null)}
          className="px-3 md:px-4 py-1.5 md:py-2 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors disabled:opacity-20"
          disabled={!selectedAssetId}
        >
          <span className="hidden md:inline">Reset Selection</span>
          <X className="w-4 h-4 md:hidden" />
        </button>
      </div>
    </div>
  );
}
