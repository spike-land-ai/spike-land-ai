"use client";

import { Button } from "@/components/ui/button";
import { useCleanCamera } from "@/hooks/useCleanCamera";
import type { CameraErrorKind } from "@/hooks/useCleanCamera";
import {
  detectPlatform,
  getCameraPermissionInstructions,
} from "@/lib/clean/detect-platform";
import {
  AlertTriangle,
  Camera,
  RefreshCw,
  ShieldOff,
  VideoOff,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

interface CleanCameraProps {
  onCapture: (base64: string) => void;
  onCancel: () => void;
}

function CameraErrorIcon({ kind }: { kind: CameraErrorKind | null; }) {
  switch (kind) {
    case "permission-denied":
      return <ShieldOff className="h-12 w-12 text-destructive" />;
    case "no-camera":
      return <VideoOff className="h-12 w-12 text-muted-foreground" />;
    case "not-supported":
      return <AlertTriangle className="h-12 w-12 text-warning" />;
    default:
      return <Camera className="h-12 w-12 text-muted-foreground" />;
  }
}

function CameraErrorMessage(
  { kind, message }: { kind: CameraErrorKind | null; message: string; },
) {
  const platform = useMemo(() => detectPlatform(), []);
  const instructions = useMemo(
    () => getCameraPermissionInstructions(platform),
    [platform],
  );

  if (kind === "permission-denied") {
    return (
      <div className="space-y-2">
        <p className="font-medium text-foreground">Camera access blocked</p>
        <p className="text-sm text-muted-foreground">
          Your browser has denied camera access. To fix this:
        </p>
        <p className="text-sm font-medium text-primary bg-primary/10 rounded-lg px-3 py-2">
          {instructions}
        </p>
        <p className="text-xs text-muted-foreground">Then tap Retry below.</p>
      </div>
    );
  }

  if (kind === "no-camera") {
    return <p className="text-muted-foreground">No camera detected on this device</p>;
  }

  if (kind === "not-supported") {
    return (
      <div className="space-y-2">
        <p className="font-medium text-foreground">Camera not available</p>
        <p className="text-sm text-muted-foreground">
          Camera requires a secure connection (HTTPS). Make sure you are accessing this site over
          HTTPS.
        </p>
      </div>
    );
  }

  return <p className="text-muted-foreground">Could not access camera: {message}</p>;
}

export function CleanCamera({ onCapture, onCancel }: CleanCameraProps) {
  const {
    videoRef,
    isReady,
    error,
    errorKind,
    requestCamera,
    capturePhoto,
    stopCamera,
  } = useCleanCamera();
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    void requestCamera();
    return () => {
      stopCamera();
    };
  }, [requestCamera, stopCamera]);

  const handleCapture = () => {
    const photo = capturePhoto();
    if (photo) {
      setPreview(photo);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setPreview(null);
    void requestCamera();
  };

  const handleConfirm = () => {
    if (preview) {
      onCapture(preview);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <CameraErrorIcon kind={errorKind} />
        <CameraErrorMessage kind={errorKind} message={error} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => void requestCamera()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl">
          <Image
            src={preview}
            alt="Captured room"
            className="w-full rounded-xl"
            width={640}
            height={480}
            unoptimized
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleRetake}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retake
          </Button>
          <Button className="flex-1" onClick={handleConfirm}>
            Use Photo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/60 text-sm">Starting camera...</p>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
        <Button className="flex-1" onClick={handleCapture} disabled={!isReady}>
          <Camera className="h-4 w-4 mr-2" />
          Capture
        </Button>
      </div>
    </div>
  );
}
