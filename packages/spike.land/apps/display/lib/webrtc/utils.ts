/**
 * Utility functions for WebRTC operations
 */

import type {
  MediaConstraints,
  StreamMetadata,
  WebRTCError,
  WebRTCErrorInfo,
} from "@/types/webrtc";

/**
 * Default media constraints for video streaming
 */
export const DEFAULT_VIDEO_CONSTRAINTS: MediaConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  audio: true,
};

/**
 * Get user media stream with the specified constraints
 */
export async function getUserMediaStream(
  constraints: MediaConstraints = DEFAULT_VIDEO_CONSTRAINTS,
): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    throw createWebRTCError("permission-denied", "Failed to access media devices", error as Error);
  }
}

/**
 * Get display media (screen sharing) stream
 */
export async function getDisplayMediaStream(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    } as DisplayMediaStreamOptions);
    return stream;
  } catch (error) {
    throw createWebRTCError("permission-denied", "Failed to access screen sharing", error as Error);
  }
}

/**
 * Stop all tracks in a media stream
 */
export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * Extract metadata from a media stream
 */
export function getStreamMetadata(
  stream: MediaStream,
  peerId: string,
  streamType: "video" | "audio" | "screen" = "video",
): StreamMetadata {
  const videoTrack = stream.getVideoTracks()[0];
  const settings = videoTrack?.getSettings();

  return {
    peerId,
    streamType,
    isActive: stream.active,
    videoSettings: settings
      ? {
          width: settings.width || 0,
          height: settings.height || 0,
          frameRate: settings.frameRate || 0,
        }
      : undefined,
  };
}

/**
 * Check if the browser supports WebRTC
 */
export function isWebRTCSupported(): boolean {
  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    window.RTCPeerConnection
  );
}

/**
 * Create a standardized WebRTC error
 */
export function createWebRTCError(
  type: WebRTCError,
  message: string,
  originalError?: Error,
): WebRTCErrorInfo {
  return {
    type,
    message,
    originalError,
  };
}

/**
 * Generate a random peer ID
 */
export function generatePeerId(prefix: string = "peer"): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate if a peer ID is in correct format
 */
export function isValidPeerId(peerId: string | null | undefined): peerId is string {
  if (!peerId) return false;
  // Peer IDs should be alphanumeric with hyphens/underscores
  return /^[a-zA-Z0-9-_]+$/.test(peerId);
}

/**
 * Create QR code data URL for a peer ID
 */
export function createConnectionUrl(peerId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/client?hostId=${peerId}`;
}

/**
 * Parse connection URL to extract peer ID
 */
export function parseConnectionUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get("hostId");
  } catch {
    return null;
  }
}

/**
 * Get video element dimensions that maintain aspect ratio
 */
export function calculateVideoLayout(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
): { width: number; height: number } {
  const containerRatio = containerWidth / containerHeight;
  const videoRatio = videoWidth / videoHeight;

  let width: number;
  let height: number;

  if (containerRatio > videoRatio) {
    // Container is wider than video
    height = containerHeight;
    width = height * videoRatio;
  } else {
    // Container is taller than video
    width = containerWidth;
    height = width / videoRatio;
  }

  return { width, height };
}

/**
 * Monitor stream health and detect issues
 */
export function monitorStreamHealth(stream: MediaStream, onInactive: () => void): () => void {
  const tracks = stream.getTracks();

  const handlers = tracks.map((track) => {
    const handler = () => {
      if (!stream.active) {
        onInactive();
      }
    };

    track.addEventListener("ended", handler);
    return { track, handler };
  });

  // Return cleanup function
  return () => {
    handlers.forEach(({ track, handler }) => {
      track.removeEventListener("ended", handler);
    });
  };
}
