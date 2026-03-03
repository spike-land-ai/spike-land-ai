"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Clipboard, Terminal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface McpConfigSnippetProps {
  label?: string;
  code?: string;
  config?: Record<string, unknown>;
  language?: string;
  className?: string;
}

export function McpConfigSnippet({
  label = "Config",
  code,
  config,
  className,
}: McpConfigSnippetProps) {
  const [copied, setCopied] = useState(false);

  const displayCode = code || (config ? JSON.stringify(config, null, 2) : "");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/50 bg-black/40 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/20 ring-1 ring-red-500/50" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/20 ring-1 ring-yellow-500/50" />
            <div className="h-3 w-3 rounded-full bg-green-500/20 ring-1 ring-green-500/50" />
          </div>
          <div className="ml-2 flex items-center gap-1.5 rounded-md bg-background/50 px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border/50">
            <Terminal className="h-3 w-3" />
            <span className="font-medium">{label}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-background/50"
          onClick={handleCopy}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied
              ? (
                <motion.div
                  key="check"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Check className="h-4 w-4 text-green-500" />
                </motion.div>
              )
              : (
                <motion.div
                  key="copy"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Clipboard className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              )}
          </AnimatePresence>
          <span className="sr-only">Copy code</span>
        </Button>
      </div>
      <div className="relative overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <pre className="text-muted-foreground">
          {displayCode}
        </pre>
      </div>
    </Card>
  );
}
