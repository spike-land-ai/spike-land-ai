"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import NextImage from "next/image";

type DeviceType = "mobile" | "tablet" | "desktop";

interface Screenshot {
  id: string;
  label: string;
  device: DeviceType;
  url?: string;
  width: number;
  height: number;
}

interface ScreenshotViewerProps {
  screenshots: Screenshot[];
}

const deviceStyles: Record<DeviceType, string> = {
  mobile: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  tablet: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  desktop: "bg-green-500/10 text-green-400 border-green-500/20",
};

export function ScreenshotViewer({ screenshots }: ScreenshotViewerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {screenshots.map(screenshot => (
        <Card key={screenshot.id} className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-zinc-100 font-medium truncate">
                {screenshot.label}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs shrink-0 capitalize",
                  deviceStyles[screenshot.device],
                )}
              >
                {screenshot.device}
              </Badge>
            </div>
            <div
              className="relative rounded-md bg-zinc-800 border border-zinc-700 overflow-hidden w-full"
              style={{ aspectRatio: `${screenshot.width} / ${screenshot.height}` }}
            >
              {screenshot.url
                ? (
                  <NextImage
                    src={screenshot.url}
                    alt={screenshot.label}
                    fill
                    className="object-cover"
                  />
                )
                : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-zinc-600 font-mono">
                      No preview
                    </span>
                  </div>
                )}
            </div>
            <p className="text-xs text-zinc-500 font-mono">
              {screenshot.width} x {screenshot.height}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
