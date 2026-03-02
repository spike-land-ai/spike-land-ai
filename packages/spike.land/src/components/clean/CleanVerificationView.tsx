"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CleaningTask } from "@/lib/clean/types";
import { Camera, SkipForward } from "lucide-react";
import { useState } from "react";
import { CleanCamera } from "./CleanCamera";

interface CleanVerificationViewProps {
  task: CleaningTask;
  onCapture: (base64: string) => void;
  onSkip: () => void;
}

export function CleanVerificationView({ task, onCapture, onSkip }: CleanVerificationViewProps) {
  const [showCamera, setShowCamera] = useState(false);

  if (showCamera) {
    return <CleanCamera onCapture={onCapture} onCancel={() => setShowCamera(false)} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Verify: {task.description}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Take a photo to verify this task is done and earn bonus points!
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip}>
            <SkipForward className="h-4 w-4 mr-2" />
            Skip Photo
          </Button>
          <Button className="flex-1" onClick={() => setShowCamera(true)}>
            <Camera className="h-4 w-4 mr-2" />
            Take Photo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
