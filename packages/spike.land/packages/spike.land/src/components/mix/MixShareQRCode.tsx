"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Copy, QrCode, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useState } from "react";

interface MixShareQRCodeProps {
  shareUrl: string;
  className?: string;
}

export function MixShareQRCode({ shareUrl, className }: MixShareQRCodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (clipboardError) {
      // Fallback for older browsers without Clipboard API support
      // execCommand is deprecated but provides necessary browser compatibility
      console.debug(
        "[MixShareQRCode] Clipboard API failed, using fallback:",
        clipboardError instanceof Error
          ? clipboardError.message
          : String(clipboardError),
      );
      try {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        console.error(
          "[MixShareQRCode] Copy failed, clipboard not available:",
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
        );
      }
    }
  }, [shareUrl]);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div
      className={cn(
        // Hidden on mobile, visible on desktop
        "hidden lg:block",
        // Fixed position in bottom-right corner
        "fixed bottom-6 right-6 z-50",
        className,
      )}
    >
      {isExpanded
        ? (
          <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {/* Header with close button */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5" />
                Share this mix
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleToggle}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* QR Code */}
            <div className="p-3">
              <div
                className="rounded-md bg-white p-2"
                data-testid="qr-code-container"
              >
                <QRCodeSVG
                  value={shareUrl}
                  size={120}
                  level="M"
                  includeMargin={false}
                  aria-label="QR code for sharing this mix"
                />
              </div>
            </div>

            {/* Copy button */}
            <div className="px-3 pb-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleCopy}
              >
                {copied
                  ? (
                    <>
                      <Check className="mr-1.5 h-3 w-3" />
                      Copied!
                    </>
                  )
                  : (
                    <>
                      <Copy className="mr-1.5 h-3 w-3" />
                      Copy Link
                    </>
                  )}
              </Button>
            </div>
          </div>
        )
        : (
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-card"
            onClick={handleToggle}
          >
            <QrCode className="h-5 w-5" />
          </Button>
        )}
    </div>
  );
}
