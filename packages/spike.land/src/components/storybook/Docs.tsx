"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronUp, Clipboard, Info, ShieldCheck, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

export function PageHeader({
  title,
  description,
  usage,
  badge,
}: {
  title: string;
  description: string;
  usage?: string;
  badge?: string;
}) {
  return (
    <div className="space-y-6 mb-12">
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl md:text-5xl font-bold font-heading tracking-tight text-foreground drop-shadow-sm">
            {title}
          </h1>
          {badge && (
            <Badge variant="secondary" className="text-xs font-mono px-2 py-0.5 self-center">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-xl text-muted-foreground/90 max-w-3xl leading-relaxed">{description}</p>
      </div>
      {usage && (
        <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 text-primary-text text-base flex gap-4 items-start shadow-sm">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium opacity-90">{usage}</p>
        </div>
      )}
    </div>
  );
}

export function UsageGuide({ dos, donts }: { dos: string[]; donts?: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-10">
      <div className="space-y-4 p-6 rounded-2xl bg-success/5 border border-success/20 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Check className="w-24 h-24 text-success" />
        </div>
        <div className="flex items-center gap-2 text-success relative z-10">
          <div className="p-1 rounded-full bg-success/10 border border-success/20">
            <Check className="h-4 w-4" strokeWidth={3} />
          </div>
          <h3 className="font-bold uppercase tracking-wider text-xs">Do</h3>
        </div>
        <ul className="space-y-3 relative z-10">
          {dos.map((item, i) => (
            <li key={i} className="text-sm text-foreground/90 flex gap-3 items-start">
              <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <span className="leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      </div>
      {donts && donts.length > 0 && (
        <div className="space-y-4 p-6 rounded-2xl bg-destructive/5 border border-destructive/20 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <X className="w-24 h-24 text-destructive" />
          </div>
          <div className="flex items-center gap-2 text-destructive relative z-10">
            <div className="p-1 rounded-full bg-destructive/10 border border-destructive/20">
              <X className="h-4 w-4" strokeWidth={3} />
            </div>
            <h3 className="font-bold uppercase tracking-wider text-xs">Don't</h3>
          </div>
          <ul className="space-y-3 relative z-10">
            {donts.map((item, i) => (
              <li key={i} className="text-sm text-foreground/90 flex gap-3 items-start">
                <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AccessibilityPanel({ notes }: { notes: string[] }) {
  return (
    <div className="my-10 p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 space-y-4 relative overflow-hidden">
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck className="h-5 w-5" />
        <h3 className="font-bold uppercase tracking-wider text-xs font-heading">
          Accessibility (WCAG AA)
        </h3>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
        {notes.map((note, i) => (
          <li
            key={i}
            className="text-sm text-muted-foreground flex gap-3 items-start opacity-90 group hover:opacity-100 transition-opacity"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0 group-hover:scale-125 transition-transform" />
            <span className="leading-snug">{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComponentSample({
  title,
  description,
  children,
  className,
  code,
  importPath,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  code?: string;
  importPath?: string;
}) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("space-y-4 group/sample", className)}>
      <div className="space-y-1">
        <h3 className="text-lg font-bold font-heading group-hover/sample:text-primary transition-colors duration-300">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {importPath && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0a0a1a] border border-white/10 font-mono text-xs text-primary/80">
          <code>{importPath}</code>
        </div>
      )}
      <div className="p-8 md:p-12 rounded-3xl border border-border/50 bg-background/50 backdrop-blur-sm flex items-center justify-center min-h-[200px] shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-primary/20">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative z-10 w-full flex justify-center">{children}</div>
      </div>
      {code && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowCode((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            {showCode ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Hide Code
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                View Code
              </>
            )}
          </button>
          {showCode && (
            <div className="relative bg-[#0a0a1a] border border-white/10 rounded-xl p-4">
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[#e2e8f0] transition-colors duration-200"
                aria-label="Copy code"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Clipboard className="h-3.5 w-3.5" />
                )}
              </button>
              <pre className="font-mono text-sm text-[#e2e8f0] overflow-x-auto pr-10 whitespace-pre-wrap">
                <code>{code}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
