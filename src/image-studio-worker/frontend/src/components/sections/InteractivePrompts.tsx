import { useState } from "react";
import { Sparkles, Loader2, Edit3 } from "lucide-react";

const PRE_GENERATED = [
  {
    id: "demo-1",
    prompt: "A neon-lit cyberpunk street market with rain reflecting vibrant pink and cyan lights, cinematic 8k resolution, photorealistic",
    url: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "demo-2",
    prompt: "Ethereal crystal floating in a dark void, emitting soft bioluminescent glow, macro photography, sharp focus",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "demo-3",
    prompt: "Minimalist geometric architecture in desert landscape, surreal lighting, warm color palette, 3d render",
    url: "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "demo-4",
    prompt: "Vintage mechanical typewriter overgrown with glowing alien flora, intricate details, moody atmosphere",
    url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=800&auto=format&fit=crop"
  }
];

export function InteractivePrompts({ onEdit }: { onEdit: (url: string, prompt: string) => void }) {
  return (
    <section className="relative px-6 md:px-12 py-12 md:py-24 z-10 max-w-7xl mx-auto border-t border-white/5">
      <div className="text-center mb-12 space-y-4">
        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase">
          Try the <span className="text-amber-neon">Neural</span> Engine
        </h2>
        <p className="text-gray-400 font-medium">Click a prompt to manifest it into reality.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PRE_GENERATED.map((item) => (
          <InteractiveCard key={item.id} item={item} onEdit={onEdit} />
        ))}
      </div>
    </section>
  );
}

function InteractiveCard({ item, onEdit }: { item: typeof PRE_GENERATED[0], onEdit: (url: string, prompt: string) => void }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handleClick = () => {
    if (state === "idle") {
      setState("loading");
      setTimeout(() => {
        setState("done");
      }, 4000);
    }
  };

  return (
    <div 
      onClick={state === "idle" ? handleClick : undefined}
      className={`group relative aspect-square rounded-3xl overflow-hidden border transition-all duration-700 bg-obsidian-900 cursor-pointer
        ${state === "idle" ? "hover:border-amber-neon/50 border-white/10 hover:shadow-[0_0_30px_rgba(255,170,0,0.15)] hover:scale-[1.02]" : ""}
        ${state === "loading" ? "border-amber-neon shadow-[0_0_40px_rgba(255,170,0,0.2)] scale-[1.02]" : ""}
        ${state === "done" ? "border-emerald-neon shadow-[0_0_40px_rgba(16,185,129,0.2)]" : ""}
      `}
    >
      {/* Idle State */}
      <div className={`absolute inset-0 p-6 flex flex-col justify-center items-center text-center transition-all duration-1000 ${state !== "idle" ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100"}`}>
        <Sparkles className="w-8 h-8 text-gray-600 mb-6 group-hover:text-amber-neon transition-colors duration-500" />
        <p className="text-sm font-semibold text-gray-300 leading-relaxed">"{item.prompt}"</p>
        <div className="absolute bottom-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-gray-500 group-hover:text-amber-neon transition-colors duration-500">
          Click to Manifest
        </div>
      </div>

      {/* Loading State */}
      <div className={`absolute inset-0 bg-obsidian-900 flex flex-col justify-center items-center transition-all duration-1000 z-10 ${state === "loading" ? "opacity-100 scale-100" : "opacity-0 scale-110 pointer-events-none"}`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-neon/5 to-transparent animate-pulse" />
        <Loader2 className="w-10 h-10 text-amber-neon animate-spin mb-4" />
        <p className="text-[10px] font-black text-amber-neon uppercase tracking-[0.3em] animate-pulse">Neural Flux...</p>
      </div>

      {/* Done State */}
      <div className={`absolute inset-0 transition-all duration-1000 z-20 ${state === "done" ? "opacity-100 scale-100" : "opacity-0 scale-110 pointer-events-none"}`}>
        <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-obsidian-950/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-4">
          <p className="text-xs font-bold text-white line-clamp-2">{item.prompt}</p>
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(item.url, item.prompt); }}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-neon/10 hover:bg-emerald-neon/20 border border-emerald-neon/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 backdrop-blur-md"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit in Studio
          </button>
        </div>
      </div>
    </div>
  );
}
