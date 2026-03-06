import { useState } from "react";
import { ScreenshotViewer } from "./ScreenshotViewer";
import { cn } from "../../../styling/cn";

interface Props {
  screenshotData?: string;
  tabsData?: unknown;
  formsData?: unknown;
}

export function SidePanel({ screenshotData, tabsData, formsData }: Props) {
  const [activeTab, setActiveTab] = useState<"screenshot" | "forms" | "tabs">("screenshot");

  return (
    <div className="flex flex-col h-full border-l border-border bg-card/80 dark:glass-card backdrop-blur-md shadow-inner">
      <div className="p-3 border-b border-border bg-muted/20">
        <div className="flex p-1 bg-muted/50 rounded-xl border border-border/40">
          {(["screenshot", "forms", "tabs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 px-3 py-2 text-[13px] font-semibold rounded-lg transition-all duration-200",
                activeTab === tab
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "screenshot" && <ScreenshotViewer {...(screenshotData !== undefined ? { base64Data: screenshotData } : {})} />}
        {activeTab === "forms" && (
          <div className="p-4 h-full overflow-auto bg-muted/5 scrollbar-thin scrollbar-thumb-border animate-in fade-in slide-in-from-right-2 duration-300">
            {formsData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Extracted Form Data</h3>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">JSON</span>
                </div>
                <pre className="text-[11px] font-mono bg-muted/30 p-4 rounded-xl border border-border/60 whitespace-pre-wrap break-all leading-relaxed shadow-sm">
                  {JSON.stringify(formsData, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 text-sm text-center p-8 space-y-2 opacity-60">
                <p>No forms data available.</p>
                <p className="text-[11px]">Refresh the browser bar to fetch forms.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === "tabs" && (
          <div className="p-4 h-full overflow-auto bg-muted/5 scrollbar-thin scrollbar-thumb-border animate-in fade-in slide-in-from-right-2 duration-300">
            {tabsData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Open Browser Tabs</h3>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">JSON</span>
                </div>
                <pre className="text-[11px] font-mono bg-muted/30 p-4 rounded-xl border border-border/60 whitespace-pre-wrap break-all leading-relaxed shadow-sm">
                  {JSON.stringify(tabsData, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 text-sm text-center p-8 space-y-2 opacity-60">
                <p>No tabs data available.</p>
                <p className="text-[11px]">Click the tabs icon to fetch open tabs.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
