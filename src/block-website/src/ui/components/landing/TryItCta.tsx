import { useState, useEffect } from "react";
import { Link } from "../ui/link";

export function TryItCta() {
  const [copied, setCopied] = useState(false);
  const command = "claude mcp add spike-land --transport http https://spike.land/mcp";

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copied]);

  return (
    <section className="py-16 bg-background border-t border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">
          Ready to try?
        </h2>
        
        <div className="max-w-2xl mx-auto mb-6">
          <div className="rounded-xl overflow-hidden border border-[#334155] shadow-lg bg-[#0f172a] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="font-mono text-sm overflow-x-auto w-full text-left flex gap-2">
              <span className="text-cyan-400 shrink-0">$</span>
              <span className="text-slate-200 break-all">{command}</span>
            </div>
            <button
              onClick={handleCopy}
              aria-label="Copy command to clipboard"
              className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-md transition-colors text-sm font-medium w-full sm:w-auto"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        <Link href="/tools" className="inline-flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
          Or browse tools first 
          <span className="ml-1 group-hover:translate-x-1 transition-transform" aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
