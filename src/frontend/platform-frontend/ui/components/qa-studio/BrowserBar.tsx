import { useState } from "react";
import { Search, RotateCcw, Camera, FormInput, AppWindow, ArrowLeft, ArrowRight } from "lucide-react";

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
    <div className="flex items-center gap-2 p-3 border-b border-border bg-background">
      <div className="flex items-center gap-1">
        <button
          disabled={true}
          className="p-1.5 rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
          title="Back (disabled)"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          disabled={true}
          className="p-1.5 rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
          title="Forward (disabled)"
          aria-label="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onRefresh}
          disabled={isCalling}
          className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          title="Refresh"
          aria-label="Refresh"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex items-center bg-muted/30 border border-border rounded-md px-3 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200">
        <Search className="w-4 h-4 text-muted-foreground/70 mr-2" />
        <input 
          type="text" 
          className="flex-1 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground"
          value={url} 
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onNavigate(url); }}
          disabled={isCalling}
          placeholder="Search or enter web address"
        />
      </div>

      <button 
        onClick={() => onNavigate(url)} 
        disabled={isCalling} 
        className="px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-sm"
      >
        Go
      </button>

      <div className="h-6 w-px bg-border/60 mx-1"></div>

      <div className="flex items-center gap-1">
        <button 
          onClick={onScreenshot} 
          disabled={isCalling} 
          className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          title="Take Screenshot"
          aria-label="Take Screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button 
          onClick={onGetForms} 
          disabled={isCalling} 
          className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          title="Get Forms"
          aria-label="Get Forms"
        >
          <FormInput className="w-4 h-4" />
        </button>
        <button 
          onClick={onGetTabs} 
          disabled={isCalling} 
          className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          title="Get Tabs"
          aria-label="Get Tabs"
        >
          <AppWindow className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
