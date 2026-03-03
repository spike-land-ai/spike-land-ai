"use client";

import { Check, Clipboard } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CodePreviewProps {
  code: string;
  language?: string;
  title?: string;
  tabs?: { label: string; code: string; }[];
}

export function CodePreview({
  code,
  language = "tsx",
  title,
  tabs,
}: CodePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const activeCode = tabs ? (tabs[activeTab]?.code ?? code) : code;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a1a]">
        <div className="flex items-center gap-3">
          {title && <span className="font-mono text-xs text-white/40">{title}</span>}
          {tabs && (
            <div className="flex gap-1">
              {tabs.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    "px-3 py-1 rounded-md font-mono text-xs transition-colors",
                    i === activeTab
                      ? "bg-white/10 text-[#e2e8f0]"
                      : "text-white/40 hover:text-white/60",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(v => !v)}
          aria-expanded={isExpanded}
          aria-controls="code-preview-content"
          className="font-mono text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {isExpanded ? "Hide Code ▴" : "Show Code ▾"}
        </button>
      </div>

      {isExpanded && (
        <div id="code-preview-content" className="relative bg-[#0a0a1a]">
          <button
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy code"}
            className={cn(
              "absolute top-3 right-3 p-1.5 rounded-md transition-colors",
              "text-white/40 hover:text-white/80 hover:bg-white/10",
            )}
          >
            {copied
              ? <Check className="w-4 h-4 text-green-400" />
              : <Clipboard className="w-4 h-4" />}
          </button>
          <pre className="overflow-x-auto p-4 pr-12">
            <code
              className={cn(
                "font-mono text-sm text-[#e2e8f0]",
                `language-${language}`,
              )}
            >
              {activeCode}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}
