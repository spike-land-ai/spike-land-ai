import React from "react";
import { 
  Wand2, 
  Layers, 
  Monitor, 
  Tag, 
  Trash2, 
  Maximize,
  Share2
} from "lucide-react";

interface ToolOrbProps {
  onAction: (action: string) => void;
  isVisible: boolean;
}

export function ToolOrb({ onAction, isVisible }: ToolOrbProps) {
  if (!isVisible) return null;

  const tools = [
    { id: "enhance", icon: Wand2, label: "Smart Enhance", color: "text-amber-neon" },
    { id: "mockup", icon: Monitor, label: "Device Mockup", color: "text-blue-400" },
    { id: "autotag", icon: Tag, label: "Auto-Tag AI", color: "text-emerald-neon" },
    { id: "social", icon: Share2, label: "Social Pack", color: "text-purple-400" },
    { id: "upscale", icon: Maximize, label: "4K Upscale", color: "text-orange-400" },
    { id: "delete", icon: Trash2, label: "Remove", color: "text-red-500" },
  ];

  return (
    <div className="absolute top-0 right-0 -translate-y-full pb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="glass-panel p-1.5 rounded-2xl flex flex-col gap-1 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onAction(tool.id)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 group transition-all"
          >
            <tool.icon className={`w-4 h-4 ${tool.color} group-hover:scale-110 transition-transform`} />
            <span className="text-xs font-bold text-gray-400 group-hover:text-gray-100 whitespace-nowrap">
              {tool.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
