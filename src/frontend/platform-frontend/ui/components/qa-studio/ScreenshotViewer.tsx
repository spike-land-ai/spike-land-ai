import { useState } from "react";
import { Camera, Maximize2, Minimize2 } from "lucide-react";

interface Props {
  base64Data?: string;
}

export function ScreenshotViewer({ base64Data }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  if (!base64Data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 text-sm p-8 text-center space-y-3 bg-muted/5">
        <div className="p-4 bg-muted/20 rounded-full">
          <Camera className="w-8 h-8 opacity-20" />
        </div>
        <p className="max-w-[200px] leading-relaxed">
          No screenshot available. Click the camera icon above to capture.
        </p>
      </div>
    );
  }

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-xl flex flex-col p-6 animate-in fade-in duration-300">
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setFullscreen(false)}
            className="p-3 bg-card glass-card border border-border rounded-full hover:bg-muted/80 transition-all hover:scale-110 active:scale-90 shadow-xl"
          >
            <Minimize2 className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center">
          <img
            src={`data:image/png;base64,${base64Data}`}
            alt="Screenshot"
            className="max-w-full max-h-full rounded-2xl border border-border/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative bg-muted/5 flex items-center justify-center overflow-auto group p-4">
      <button
        onClick={() => setFullscreen(true)}
        className="absolute top-6 right-6 z-10 p-2.5 bg-background/90 glass-card backdrop-blur-md border border-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 translate-y-2 group-hover:translate-y-0"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
      <img
        src={`data:image/png;base64,${base64Data}`}
        alt="Screenshot"
        className="max-w-full rounded-xl border border-border/60 shadow-lg transition-transform duration-500 group-hover:scale-[1.01]"
      />
    </div>
  );
}
