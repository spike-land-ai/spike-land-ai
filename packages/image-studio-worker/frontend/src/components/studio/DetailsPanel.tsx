import React from "react";
import { Clock, ExternalLink, Maximize, Palette, Tag, X, Zap } from "lucide-react";
import type { StudioAsset } from "../../services/studio-engine";

interface DetailsPanelProps {
  asset: StudioAsset | null;
  onClose: () => void;
  onAction: (action: string) => void;
}

export function DetailsPanel({ asset, onClose, onAction }: DetailsPanelProps) {
  if (!asset) return null;

  return (
    <aside className="fixed inset-x-0 bottom-0 md:inset-auto md:top-20 md:right-4 md:bottom-4 w-full md:w-72 h-[70vh] md:h-auto glass-panel rounded-t-[2rem] md:rounded-[2rem] border-white/10 z-[150] overflow-hidden flex flex-col animate-in slide-in-from-bottom-full md:slide-in-from-right-4 duration-500 pb-[env(safe-area-inset-bottom)] md:pb-0 shadow-2xl shadow-black/50">
      {/* Mobile Handle */}
      <div className="md:hidden flex justify-center pt-3 shrink-0">
        <div className="w-10 h-1 bg-white/10 rounded-full" />
      </div>

      {/* Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-neon/10 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-amber-neon" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
            Neural Insight
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group"
        >
          <X className="w-4 h-4 text-gray-600 group-hover:text-gray-300" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 nice-scrollbar">
        {/* Preview */}
        <div className="space-y-3">
          <div className="aspect-square rounded-xl overflow-hidden border border-white/5 bg-obsidian-900 group relative">
            <img
              src={asset.url}
              alt={asset.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent opacity-40" />
          </div>
          <h3 className="font-bold text-white tracking-tight leading-tight text-base">
            {asset.name}
          </h3>
        </div>

        {/* Intelligence Actions */}
        <div className="space-y-3">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">
            Unified Orchestration
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                id: "enhance",
                icon: Zap,
                label: "Enhance",
                color: "text-amber-neon",
                bg: "hover:bg-amber-neon/5 hover:border-amber-neon/20",
              },
              {
                id: "autotag",
                icon: Tag,
                label: "Autotag",
                color: "text-emerald-neon",
                bg: "hover:bg-emerald-neon/5 hover:border-emerald-neon/20",
              },
              {
                id: "social",
                icon: Palette,
                label: "Social",
                color: "text-purple-400",
                bg: "hover:bg-purple-400/5 hover:border-purple-400/20",
              },
              {
                id: "upscale",
                icon: Maximize,
                label: "Upscale",
                color: "text-orange-400",
                bg: "hover:bg-orange-400/5 hover:border-orange-400/20",
              },
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => onAction(tool.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 border border-white/5 transition-all group ${tool.bg}`}
              >
                <tool.icon
                  className={`w-4 h-4 ${tool.color} group-hover:scale-110 transition-transform`}
                />
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-white">
                  {tool.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Trace Data */}
        <div className="space-y-3 pt-3 border-t border-white/5">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">
            Trace Data
          </span>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-gray-600 font-bold uppercase">Root</span>
              <span className="text-gray-400 font-bold bg-white/5 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                Text-to-Image
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-gray-600 font-bold uppercase">Manifested</span>
              <div className="flex items-center gap-1.5 text-gray-400 font-bold">
                <Clock className="w-3 h-3" />
                <span>Just now</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-5 border-t border-white/5 bg-white/5 shrink-0">
        <button className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-white text-obsidian-950 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-gray-200 transition-all active:scale-95 shadow-xl">
          <ExternalLink className="w-3.5 h-3.5 stroke-[3]" />
          View Source
        </button>
      </div>
    </aside>
  );
}
