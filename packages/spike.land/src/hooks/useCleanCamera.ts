"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraErrorKind = "permission-denied" | "no-camera" | "not-supported" | "unknown";
export type PermissionState = "prompt" | "granted" | "denied" | null;

interface UseCleanCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isReady: boolean;
  error: string | null;
  errorKind: CameraErrorKind | null;
  permissionState: PermissionState;
  requestCamera: () => Promise<void>;
  capturePhoto: () => string | null;
  stopCamera: () => void;
}

function classifyError(err: unknown): { message: string; kind: CameraErrorKind } {
  const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : null;

  if (!name) {
    return { message: "Camera access denied", kind: "unknown" };
  }

  switch (name) {
    case "NotAllowedError":
      return { message: "Camera permission denied", kind: "permission-denied" };
    case "NotFoundError":
      return {
        message: "No camera detected on this device",
        kind: "no-camera",
      };
    case "NotReadableError":
      return {
        message: "Camera is in use by another application",
        kind: "unknown",
      };
    default:
      return {
        message: err instanceof Error ? err.message : "Camera access denied",
        kind: "unknown",
      };
  }
}

export function useCleanCamera(): UseCleanCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<CameraErrorKind | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>(null);

  const stopCamera = useCallback(() => {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      setStream(null);
      setIsReady(false);
    }
  }, [stream]);

  const requestCamera = useCallback(async () => {
    setError(null);
    setErrorKind(null);

    // Check if mediaDevices API is available (requires HTTPS)
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera requires a secure connection (HTTPS)");
      setErrorKind("not-supported");
      return;
    }

    // Pre-check permission state if available
    try {
      if (navigator.permissions?.query) {
        const result = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        setPermissionState(result.state as PermissionState);
      }
    } catch {
      // permissions.query may not support 'camera' in all browsers — continue anyway
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setStream(mediaStream);
      setPermissionState("granted");
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setIsReady(true);
        };
      }
    } catch (err) {
      const { message, kind } = classifyError(err);
      setError(message);
      setErrorKind(kind);
      if (kind === "permission-denied") {
        setPermissionState("denied");
      }
    }
  }, []);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !isReady) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, [isReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    };
  }, [stream]);

  return {
    videoRef,
    stream,
    isReady,
    error,
    errorKind,
    permissionState,
    requestCamera,
    capturePhoto,
    stopCamera,
  };
}
