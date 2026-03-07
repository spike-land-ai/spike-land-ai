import { useState } from "react";
import { ScreenshotViewer } from "./ScreenshotViewer";
import { cn } from "../../../styling/cn";
import { Copy, CheckCircle2 } from "lucide-react";

interface Props {
  screenshotData?: string;
  tabsData?: unknown;
  formsData?: unknown;
}

export function SidePanel({ screenshotData, tabsData, formsData }: Props) {
  const [activeTab, setActiveTab] = useState<"screenshot" | "forms" | "tabs">("screenshot");
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (data: unknown, type: string) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      <div className="p-3 border-b border-border bg-background">
        <div className="flex p-1 bg-muted rounded-lg border border-border/40">
          {(["screenshot", "forms", "tabs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative bg-muted/10">
        {activeTab === "screenshot" && <ScreenshotViewer {...(screenshotData !== undefined ? { base64Data: screenshotData } : {})} />}
        {activeTab === "forms" && (
          <div className="p-4 h-full overflow-auto scrollbar-thin scrollbar-thumb-border animate-in fade-in slide-in-from-right-2 duration-300">
            {formsData ? (
              <div className="space-y-3 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground">Extracted Form Data</h3>
                  <button
                    onClick={() => handleCopy(formsData, 'forms')}
                    className="flex items-center gap-1.5 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 rounded-md font-medium transition-colors border border-primary/20"
                  >
                    {copied === 'forms' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === 'forms' ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="text-[11px] flex-1 overflow-auto font-mono bg-[#0f111a] text-slate-50 p-4 rounded-lg border border-border whitespace-pre-wrap break-all leading-relaxed shadow-inner">
                  {JSON.stringify(formsData, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 text-sm text-center p-8 space-y-2">
                <p>No forms data available.</p>
                <p className="text-[11px]">Click the forms icon in the browser bar to fetch forms.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === "tabs" && (
          <div className="p-4 h-full overflow-auto scrollbar-thin scrollbar-thumb-border animate-in fade-in slide-in-from-right-2 duration-300">
            {tabsData ? (
              <div className="space-y-3 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground">Open Browser Tabs</h3>
                  <button
                    onClick={() => handleCopy(tabsData, 'tabs')}
                    className="flex items-center gap-1.5 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 rounded-md font-medium transition-colors border border-primary/20"
                  >
                    {copied === 'tabs' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === 'tabs' ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="text-[11px] flex-1 overflow-auto font-mono bg-[#0f111a] text-slate-50 p-4 rounded-lg border border-border whitespace-pre-wrap break-all leading-relaxed shadow-inner">
                  {JSON.stringify(tabsData, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 text-sm text-center p-8 space-y-2">
                <p>No tabs data available.</p>
                <p className="text-[11px]">Click the tabs icon in the browser bar to fetch open tabs.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
