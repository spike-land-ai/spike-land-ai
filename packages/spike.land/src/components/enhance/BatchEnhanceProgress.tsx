"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CheckCircle, Circle, Loader2, XCircle, XOctagon } from "lucide-react";
import Image from "next/image";
import * as React from "react";

export interface BatchImageStatus {
  imageId: string;
  thumbnailUrl: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  enhancedUrl?: string;
  error?: string;
}

export interface BatchEnhanceProgressProps {
  images: BatchImageStatus[];
  tier: "TIER_1K" | "TIER_2K" | "TIER_4K";
  onCancel?: () => void;
  onComplete?: () => void;
  className?: string;
}

const TIER_LABELS = {
  TIER_1K: "1K",
  TIER_2K: "2K",
  TIER_4K: "4K",
} as const;

function StatusOverlay({ status }: { status: BatchImageStatus["status"] }) {
  switch (status) {
    case "COMPLETED":
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-green-500/30 backdrop-blur-[1px]">
          <CheckCircle className="h-6 w-6 text-green-500 drop-shadow-md" aria-hidden="true" />
        </div>
      );
    case "PROCESSING":
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/30 backdrop-blur-[1px]">
          <Loader2
            className="h-6 w-6 text-blue-500 animate-spin drop-shadow-md"
            aria-hidden="true"
          />
        </div>
      );
    case "FAILED":
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/30 backdrop-blur-[1px]">
          <XCircle className="h-6 w-6 text-red-500 drop-shadow-md" aria-hidden="true" />
        </div>
      );
    case "PENDING":
    default:
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-500/20 backdrop-blur-[1px]">
          <Circle className="h-6 w-6 text-gray-400 drop-shadow-md" aria-hidden="true" />
        </div>
      );
  }
}

function getStatusLabel(status: BatchImageStatus["status"]): string {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "PROCESSING":
      return "Processing";
    case "FAILED":
      return "Failed";
    case "PENDING":
    default:
      return "Pending";
  }
}

export function BatchEnhanceProgress({
  images,
  tier,
  onCancel,
  onComplete,
  className,
}: BatchEnhanceProgressProps) {
  const completedCount = images.filter((img) => img.status === "COMPLETED").length;
  const processingCount = images.filter((img) => img.status === "PROCESSING").length;
  const pendingCount = images.filter((img) => img.status === "PENDING").length;
  const failedCount = images.filter((img) => img.status === "FAILED").length;

  const totalCount = images.length;
  const finishedCount = completedCount + failedCount;
  const progressPercentage = totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : 0;

  const isComplete = finishedCount === totalCount && totalCount > 0;

  React.useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  const tierLabel = TIER_LABELS[tier];

  return (
    <div
      className={cn("space-y-4 p-4 bg-muted/50 rounded-lg", className)}
      role="region"
      aria-label="Batch enhancement progress"
    >
      <div className="text-center">
        <h3 className="text-lg font-semibold">
          Enhancing {totalCount} photo{totalCount !== 1 ? "s" : ""} at {tierLabel} quality
        </h3>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progress</span>
          <span>{progressPercentage}%</span>
        </div>
        <Progress
          value={progressPercentage}
          className="h-3"
          aria-label={`Enhancement progress: ${progressPercentage}%`}
        />
      </div>

      <div
        className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2"
        role="list"
        aria-label="Image processing status"
      >
        {images.map((image) => (
          <div
            key={image.imageId}
            className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted"
            role="listitem"
            aria-label={`${getStatusLabel(image.status)}: Image ${image.imageId}`}
            title={image.error || getStatusLabel(image.status)}
          >
            <Image
              src={image.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              fill
              unoptimized
            />
            <StatusOverlay status={image.status} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Badge variant="default" className="bg-green-500 hover:bg-green-500/80">
          Completed: {completedCount}
        </Badge>
        <span className="text-muted-foreground">|</span>
        <Badge variant="default" className="bg-blue-500 hover:bg-blue-500/80">
          Processing: {processingCount}
        </Badge>
        <span className="text-muted-foreground">|</span>
        <Badge variant="secondary">Pending: {pendingCount}</Badge>
        <span className="text-muted-foreground">|</span>
        <Badge variant="destructive">Failed: {failedCount}</Badge>
      </div>

      {onCancel && !isComplete && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onCancel} className="gap-2">
            <XOctagon className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
