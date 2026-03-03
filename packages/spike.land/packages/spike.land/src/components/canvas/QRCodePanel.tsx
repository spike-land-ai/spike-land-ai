"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildCanvasUrl } from "@/lib/canvas";
import { Copy, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useState } from "react";
import { type CanvasSettings, CanvasSettingsForm } from "./CanvasSettingsForm";

interface QRCodePanelProps {
  albumId: string;
  shareToken: string;
  albumName: string;
}

const DEFAULT_SETTINGS: CanvasSettings = {
  rotation: 0,
  order: "album",
  interval: 10,
};

export function QRCodePanel({
  albumId,
  shareToken,
  albumName,
}: QRCodePanelProps) {
  const [settings, setSettings] = useState<CanvasSettings>(DEFAULT_SETTINGS);
  const [copied, setCopied] = useState(false);

  const canvasUrl = buildCanvasUrl(albumId, shareToken, settings);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(canvasUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for browsers without clipboard API
      console.debug(
        "[QRCodePanel] Clipboard API unavailable, using fallback:",
        error instanceof Error ? error.message : String(error),
      );
      const textArea = document.createElement("textarea");
      textArea.value = canvasUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [canvasUrl]);

  const handleOpenCanvas = useCallback(() => {
    window.open(canvasUrl, "_blank", "noopener,noreferrer");
  }, [canvasUrl]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Canvas Display</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div
            className="rounded-lg bg-white p-2"
            data-testid="qr-code-container"
          >
            <QRCodeSVG
              value={canvasUrl}
              size={160}
              level="M"
              includeMargin={true}
              aria-label={`QR code for ${albumName} canvas display`}
            />
          </div>
        </div>

        <CanvasSettingsForm settings={settings} onChange={setSettings} />
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleCopyUrl}
          data-testid="copy-url-button"
        >
          <Copy className="mr-2 h-4 w-4" />
          {copied ? "Copied!" : "Copy URL"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleOpenCanvas}
          data-testid="open-canvas-button"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open
        </Button>
      </CardFooter>
    </Card>
  );
}
