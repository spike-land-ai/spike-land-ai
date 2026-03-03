import { useEffect, useState } from "react";
import { Sparkles, Wand2, MousePointer2 } from "lucide-react";

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  toolName: string;
  timestamp: number;
}

interface Cursor {
  id: number;
  x: number;
  y: number;
  label: string;
  color: string;
}

export function AnimatedGenerations() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cursors, setCursors] = useState<Cursor[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchCalls() {
      try {
        const url = import.meta.env.VITE_API_URL || "";
        const res = await fetch(`${url}/api/monitoring/calls`);
        const data = await res.json();
        if (!isMounted || !data.calls) return;

        const generated: GeneratedImage[] = [];
        for (const call of data.calls) {
          if (call.status !== "COMPLETED") continue;
          if (!call.result) continue;

          try {
            const parsedResult = JSON.parse(call.result);
            let resultData: any = parsedResult;
            if (parsedResult.content?.[0]?.text) {
              try {
                resultData = JSON.parse(parsedResult.content[0].text);
              } catch (e) {}
            }

            const imgUrl = resultData.url || resultData.outputImageUrl || resultData.enhancedUrl;

            if (imgUrl && typeof imgUrl === "string" && imgUrl.startsWith("http")) {
              const args = typeof call.args === "string" ? JSON.parse(call.args) : call.args;
              generated.push({
                id: call.id,
                url: imgUrl,
                prompt: args.prompt || args.description || "Generated Asset",
                toolName: call.toolName,
                timestamp: new Date(call.createdAt).getTime(),
              });
            }
          } catch (e) {}
        }

        const unique = generated.filter((v, i, a) => a.findIndex((t) => t.url === v.url) === i);
        setImages(unique.slice(0, 15));
      } catch (err) {}
    }

    fetchCalls();
    const interval = setInterval(fetchCalls, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Ghost Cursor Logic
  useEffect(() => {
    const labels = ["Aura_9", "PixelMapper", "NeuralOps", "SynthDirector", "Vizionary"];
    const colors = ["text-amber-neon", "text-emerald-neon", "text-blue-400", "text-purple-400", "text-pink-400"];
    
    const initialCursors = labels.map((label, i) => ({
      id: i,
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10,
      label,
      color: colors[i]
    }));
    setCursors(initialCursors);

    const interval = setInterval(() => {
      setCursors(prev => prev.map(c => ({
        ...c,
        x: Math.max(5, Math.min(95, c.x + (Math.random() - 0.5) * 10)),
        y: Math.max(5, Math.min(95, c.y + (Math.random() - 0.5) * 10)),
      })));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center rounded-[2.5rem] bg-white/5 border border-white/5">
        <div className="flex flex-col items-center gap-4 opacity-20">
          <Sparkles className="w-10 h-10 text-amber-neon animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Awaiting Manifestations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-[2.5rem] overflow-hidden group border border-white/5 bg-obsidian-900 shadow-2xl">
      {images.map((img, idx) => (
        <div
          key={img.id}
          className={`absolute inset-0 transition-all duration-[2000ms] ease-out
            ${idx === activeIndex ? "opacity-100 scale-100 saturate-100 blur-0" : "opacity-0 scale-110 saturate-0 blur-xl"}
          `}
        >
          <img src={img.url} alt={img.prompt} className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-obsidian-950/20 to-transparent" />
          
          <div className="absolute bottom-0 left-0 right-0 p-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-amber-neon backdrop-blur-md">
                {img.toolName.replace("img_", "MANIFEST.")}
              </div>
            </div>
            <p className="text-xl font-bold text-white tracking-tight line-clamp-2 leading-tight">
              {img.prompt}
            </p>
          </div>
        </div>
      ))}

      {/* Ghost Cursors Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {cursors.map((c) => (
          <div 
            key={c.id}
            className={`absolute transition-all duration-[3000ms] ease-in-out ${c.color} opacity-40`}
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          >
            <div className="flex flex-col items-start gap-1">
              <MousePointer2 className="w-4 h-4 fill-current" />
              <div className="px-2 py-0.5 rounded bg-black/50 border border-white/10 backdrop-blur-sm">
                <span className="text-[8px] font-black uppercase tracking-tighter text-white/80">{c.label}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute top-6 left-6 flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-neon animate-ping" />
        <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Neural Feed Active</span>
      </div>
    </div>
  );
}
