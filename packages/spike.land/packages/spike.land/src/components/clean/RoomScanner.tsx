"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CleanCamera } from "@/components/clean/CleanCamera";
import { Loader2, ScanLine, Sparkles } from "lucide-react";

interface RoomScannerProps {
  onScanComplete: (base64Photo: string) => void;
  onCancel?: () => void;
  analyzing?: boolean;
}

type ScannerView = "prompt" | "camera" | "analyzing";

import { useState } from "react";

export function RoomScanner(
  { onScanComplete, onCancel, analyzing = false }: RoomScannerProps,
) {
  const [view, setView] = useState<ScannerView>(
    analyzing ? "analyzing" : "prompt",
  );

  if (analyzing || view === "analyzing") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="relative">
            <ScanLine className="h-12 w-12 text-primary animate-pulse" />
            <Loader2 className="h-5 w-5 text-primary/60 animate-spin absolute -bottom-1 -right-1" />
          </div>
          <div>
            <p className="text-lg font-semibold">Analyzing your room...</p>
            <p className="text-sm text-muted-foreground mt-1">
              AI is identifying tasks to help you clean
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (view === "camera") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-center">
          Take a photo of your room
        </h2>
        <CleanCamera
          onCapture={base64 => {
            setView("analyzing");
            onScanComplete(base64);
          }}
          onCancel={() => setView("prompt")}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          Room Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Take a photo of the room you want to clean. Our AI will analyze it and generate a
          personalized task list, sorted by difficulty so you can start with quick wins.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0"
            onClick={() => setView("camera")}
          >
            <Sparkles className="h-5 w-5" />
            Scan Room
          </Button>
          {onCancel && (
            <Button
              variant="outline"
              size="lg"
              onClick={onCancel}
              className="sm:w-auto"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
