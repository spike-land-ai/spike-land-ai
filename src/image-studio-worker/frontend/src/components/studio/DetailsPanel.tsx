import React from "react";
import { X, Info, Tag, Palette, Zap, Clock, ExternalLink } from "lucide-react";
import type { StudioAsset } from "../../services/studio-engine";

interface DetailsPanelProps {
  asset: StudioAsset | null;
  onClose: () => void;
}

export function DetailsPanel({ asset, onClose }: DetailsPanelProps) {
  if (!asset) return null;

  return (
    <aside className="fixed inset-x-0 bottom-0 md:inset-auto md:top-24 md:right-8 md:bottom-8 w-full md:w-80 h-[80vh] md:h-auto glass-panel rounded-t-[2.5rem] md:rounded-[2.5rem] border-white/10 z-[150] overflow-hidden flex flex-col animate-in slide-in-from-bottom-full md:slide-in-from-right-8 duration-500 pb-[env(safe-area-inset-bottom)] md:pb-0">
      {/* Mobile Handle */}
      <div className="md:hidden flex justify-center pt-4 shrink-0">
        <div className="w-12 h-1 bg-white/10 rounded-full" />
      </div>

      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-neon/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-neon" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Neural Insight</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 nice-scrollbar">
        {/* Preview */}
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl overflow-hidden border border-white/5 bg-obsidian-900 group relative">
            <img src={asset.url} alt={asset.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent opacity-60" />
          </div>
          <h3 className="font-bold text-white tracking-tight leading-tight text-lg">{asset.name}</h3>
        </div>

        {/* Intelligence Actions - Expanded for Mobile */}
        <div className="space-y-4">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Unified Orchestration</span>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: "enhance", icon: Zap, label: "Enhance", color: "text-amber-neon", bg: "hover:bg-amber-neon/5 hover:border-amber-neon/30" },
              { id: "autotag", icon: Tag, label: "Autotag", color: "text-emerald-neon", bg: "hover:bg-emerald-neon/5 hover:border-emerald-neon/30" },
              { id: "social", icon: Palette, label: "Social", color: "text-purple-400", bg: "hover:bg-purple-400/5 hover:border-purple-400/30" },
              { id: "upscale", icon: Maximize, label: "Upscale", color: "text-orange-400", bg: "hover:bg-orange-400/5 hover:border-orange-400/30" }
            ].map((tool) => (
              <button key={tool.id} className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 transition-all group ${tool.bg}`}>
                <tool.icon className={`w-5 h-5 ${tool.color} group-hover:scale-110 transition-transform`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white">{tool.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Trace Data */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Trace Data</span>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-600 font-bold uppercase">Linguistic Root</span>
              <span className="text-gray-400 font-medium bg-white/5 px-2 py-0.5 rounded-full">Text-to-Image</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-600 font-bold uppercase">Manifested</span>
              <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                <Clock className="w-3 h-3" />
                <span>Just now</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-white/5 bg-white/5 shrink-0">
        <button className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-obsidian-950 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-200 transition-all active:scale-95 shadow-xl shadow-white/5">
          <ExternalLink className="w-4 h-4 stroke-[3]" />
          Open Full Source
        </button>
      </div>
    </aside>
  );
}
