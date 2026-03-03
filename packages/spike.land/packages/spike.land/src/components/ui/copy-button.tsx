"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Copy } from "lucide-react";
import { useState } from "react";

type CopyState = "idle" | "copied" | "error";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");

  const handleCopy = async () => {
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard) {
        throw new Error("Clipboard API not supported");
      }
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Handle permission denied or unsupported browsers
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={className}
    >
      {state === "copied" && (
        <>
          <Check className="h-4 w-4 mr-1" />
          Copied
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="h-4 w-4 mr-1" />
          Failed
        </>
      )}
      {state === "idle" && (
        <>
          <Copy className="h-4 w-4 mr-1" />
          Copy
        </>
      )}
    </Button>
  );
}
