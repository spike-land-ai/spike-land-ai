"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface ImagePlaceholderProps {
  file: File;
  progress?: number;
  status: "uploading" | "processing" | "completed" | "failed";
  error?: string;
  className?: string;
}

export function ImagePlaceholder({
  file,
  progress = 0,
  status,
  error,
  className,
}: ImagePlaceholderProps) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    // Generate a client-side preview using FileReader
    // Note: FileReader.readAsDataURL creates a base64 data URL string,
    // NOT a blob URL. Data URLs don't need cleanup/revocation.
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setPreview(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }, [file]);

  const statusLabel = {
    uploading: "Uploading...",
    processing: "Enhancing...",
    completed: "Done",
    failed: error || "Failed",
  };

  return (
    <Card
      className={cn(
        "overflow-hidden relative aspect-square bg-muted",
        status === "failed" && "border-destructive",
        className,
      )}
    >
      {/* Preview image with blur effect */}
      {preview && (
        <Image
          src={preview}
          alt={file.name}
          fill
          className={cn(
            "object-cover transition-all duration-300",
            status === "uploading" || status === "processing"
              ? "blur-sm opacity-70"
              : status === "failed"
                ? "blur-sm opacity-50 grayscale"
                : "blur-0 opacity-100",
          )}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
      )}

      {/* Skeleton when no preview yet */}
      {!preview && <div className="absolute inset-0 animate-pulse bg-muted" />}

      {/* Loading overlay */}
      {(status === "uploading" || status === "processing") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <span className="text-sm font-medium text-foreground">{statusLabel[status]}</span>
          {status === "uploading" && progress > 0 && progress < 100 && (
            <div className="w-24 h-1 mt-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Error overlay */}
      {status === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/20">
          <span className="text-sm font-medium text-destructive">{statusLabel.failed}</span>
        </div>
      )}

      {/* File name at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <p className="text-xs text-white truncate">{file.name}</p>
      </div>
    </Card>
  );
}
