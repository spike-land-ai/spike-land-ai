"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Camera, Loader2 } from "lucide-react";
import { qaScreenshot, qaViewport } from "@/lib/qa-studio/actions";
import Image from "next/image";
import { isActionError, type QaScreenshotResult } from "@/lib/qa-studio/types";

type PanelStatus = "idle" | "loading" | "success" | "error";

const VIEWPORT_PRESETS = [
  { value: "desktop", label: "Desktop (1440x900)" },
  { value: "tablet", label: "Tablet (768x1024)" },
  { value: "mobile", label: "Mobile (375x812)" },
] as const;

export function ScreenshotPanel() {
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [screenshot, setScreenshot] = useState<QaScreenshotResult | null>(null);
  const [fullPage, setFullPage] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("desktop");
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      if (selectedPreset) {
        const vpResult = await qaViewport({ preset: selectedPreset });
        if (isActionError(vpResult)) {
          setError(vpResult.error);
          setStatus("error");
          return;
        }
      }
      const result = await qaScreenshot({ fullPage });
      if (isActionError(result)) {
        setError(result.error);
        setStatus("error");
        return;
      }
      setScreenshot(result);
      setStatus("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Screenshot failed";
      setError(message);
      setStatus("error");
    }
  }, [fullPage, selectedPreset]);

  const handlePresetChange = useCallback(async (value: string) => {
    setSelectedPreset(value);
    const result = await qaViewport({ preset: value });
    if (isActionError(result)) {
      // Viewport change will be applied on next capture after navigation
    }
  }, []);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Screenshot
          </CardTitle>
          <Button size="sm" onClick={handleCapture} disabled={status === "loading"}>
            {status === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Camera className="h-3.5 w-3.5 mr-1.5" />
            )}
            Capture
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Select value={selectedPreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Viewport" />
            </SelectTrigger>
            <SelectContent>
              {VIEWPORT_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <label
              htmlFor="fullpage-toggle"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              Full page
            </label>
            <Switch id="fullpage-toggle" checked={fullPage} onCheckedChange={setFullPage} />
          </div>
        </div>

        {status === "loading" && <Skeleton className="w-full aspect-video rounded-lg" />}

        {status === "error" && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {status === "success" && screenshot && (
          <div className="relative rounded-lg overflow-hidden border border-border/30">
            <Image
              src={`data:image/png;base64,${screenshot.base64}`}
              alt={`Screenshot of ${screenshot.url}`}
              className="w-full h-auto"
              width={1440}
              height={900}
              unoptimized
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1">
              <p className="text-[10px] text-white/70 truncate">
                {screenshot.url}
                {screenshot.fullPage ? " (full page)" : ""}
              </p>
            </div>
          </div>
        )}

        {status === "idle" && (
          <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-border/30 text-muted-foreground text-xs">
            Click Capture to take a screenshot
          </div>
        )}
      </CardContent>
    </Card>
  );
}
