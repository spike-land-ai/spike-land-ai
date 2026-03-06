import { useState } from "react";
import { Search, RotateCcw, Camera, FormInput, AppWindow } from "lucide-react";

interface Props {
  onNavigate: (url: string) => void;
  onRefresh: () => void;
  onScreenshot: () => void;
  onGetForms: () => void;
  onGetTabs: () => void;
  isCalling: boolean;
}

export function BrowserBar({ onNavigate, onRefresh, onScreenshot, onGetForms, onGetTabs, isCalling }: Props) {
  const [url, setUrl] = useState("https://example.com");

  return (
    <div className="flex items-center gap-2 p-2.5 border-b border-border bg-muted/50 dark:glass-card backdrop-blur-sm">
      <button 
        onClick={onRefresh} 
        disabled={isCalling} 
        className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors" 
        title="Refresh"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <div className="flex-1 flex items-center bg-card border border-border rounded-lg px-3 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200">
        <Search className="w-4 h-4 text-muted-foreground mr-2" />
        <input 
          type="text" 
          className="flex-1 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50" 
          value={url} 
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onNavigate(url); }}
          disabled={isCalling}
          placeholder="Enter a URL to navigate..."
        />
      </div>
      <button 
        onClick={() => onNavigate(url)} 
        disabled={isCalling} 
        className="px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 active:scale-[0.98] disabled:opacity-50 transition-all"
      >
        Go
      </button>
      <div className="h-6 w-px bg-border/60 mx-1"></div>
      <div className="flex items-center gap-1">
        <button 
          onClick={onScreenshot} 
          disabled={isCalling} 
          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors" 
          title="Take Screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button 
          onClick={onGetForms} 
          disabled={isCalling} 
          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors" 
          title="Get Forms"
        >
          <FormInput className="w-4 h-4" />
        </button>
        <button 
          onClick={onGetTabs} 
          disabled={isCalling} 
          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors" 
          title="Get Tabs"
        >
          <AppWindow className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
