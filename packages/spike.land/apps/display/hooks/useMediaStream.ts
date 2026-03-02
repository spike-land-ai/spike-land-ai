"use client";

import type { MediaConstraints, StreamMetadata } from "@/types/webrtc";
import {
  getDisplayMediaStream,
  getStreamMetadata,
  getUserMediaStream,
  monitorStreamHealth,
  stopMediaStream,
} from "@apps/display/lib/webrtc/utils";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Stream type that can be acquired
 */
type StreamType = "camera" | "screen";

/**
 * State for media stream management
 */
interface MediaStreamState {
  stream: MediaStream | null;
  metadata: StreamMetadata | null;
  isActive: boolean;
  error: string | null;
}

/**
 * Hook for managing media streams (camera or screen sharing)
 *
 * This hook handles:
 * - Acquiring user media or display media
 * - Managing stream lifecycle
 * - Monitoring stream health
 * - Cleanup on unmount
 */
export function useMediaStream(peerId: string) {
  const [state, setState] = useState<MediaStreamState>({
    stream: null,
    metadata: null,
    isActive: false,
    error: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const cleanupMonitorRef = useRef<(() => void) | null>(null);

  /**
   * Start a media stream
   */
  const startStream = useCallback(
    async (type: StreamType = "camera", constraints?: MediaConstraints) => {
      try {
        setState((prev) => ({ ...prev, error: null }));

        // Stop any existing stream first
        if (streamRef.current) {
          stopMediaStream(streamRef.current);
          streamRef.current = null;
        }

        // Acquire the appropriate stream
        let stream: MediaStream;
        let streamType: "video" | "screen";

        if (type === "camera") {
          stream = await getUserMediaStream(constraints);
          streamType = "video";
        } else {
          stream = await getDisplayMediaStream();
          streamType = "screen";
        }

        streamRef.current = stream;

        // Get stream metadata
        const metadata = getStreamMetadata(stream, peerId, streamType);

        // Monitor stream health
        cleanupMonitorRef.current = monitorStreamHealth(stream, () => {
          setState((prev) => ({ ...prev, isActive: false }));
        });

        setState({
          stream,
          metadata,
          isActive: true,
          error: null,
        });

        return stream;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to start media stream";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [peerId],
  );

  /**
   * Stop the current media stream
   */
  const stopStream = useCallback(() => {
    if (cleanupMonitorRef.current) {
      cleanupMonitorRef.current();
      cleanupMonitorRef.current = null;
    }

    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }

    setState({
      stream: null,
      metadata: null,
      isActive: false,
      error: null,
    });
  }, []);

  /**
   * Toggle a specific track on/off
   */
  const toggleTrack = useCallback((kind: "audio" | "video", enabled?: boolean) => {
    if (!streamRef.current) return;

    const tracks =
      kind === "audio" ? streamRef.current.getAudioTracks() : streamRef.current.getVideoTracks();

    tracks.forEach((track) => {
      track.enabled = enabled !== undefined ? enabled : !track.enabled;
    });
  }, []);

  /**
   * Check if a specific track type is enabled
   */
  const isTrackEnabled = useCallback((kind: "audio" | "video"): boolean => {
    if (!streamRef.current) return false;

    const tracks =
      kind === "audio" ? streamRef.current.getAudioTracks() : streamRef.current.getVideoTracks();

    return tracks.some((track) => track.enabled);
  }, []);

  /**
   * Replace the video track (e.g., switch from camera to screen)
   */
  const replaceVideoTrack = useCallback(async (type: StreamType) => {
    try {
      let newStream: MediaStream;

      if (type === "camera") {
        newStream = await getUserMediaStream();
      } else {
        newStream = await getDisplayMediaStream();
      }

      if (!streamRef.current) {
        streamRef.current = newStream;
        setState((prev) => ({
          ...prev,
          stream: newStream,
          isActive: true,
        }));
        return;
      }

      // Replace video tracks
      const oldVideoTracks = streamRef.current.getVideoTracks();
      const newVideoTrack = newStream.getVideoTracks()[0];

      oldVideoTracks.forEach((track) => {
        streamRef.current?.removeTrack(track);
        track.stop();
      });

      if (newVideoTrack) {
        streamRef.current.addTrack(newVideoTrack);
      }

      setState((prev) => ({
        ...prev,
        stream: streamRef.current,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to replace video track";
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupMonitorRef.current) {
        cleanupMonitorRef.current();
      }
      if (streamRef.current) {
        stopMediaStream(streamRef.current);
      }
    };
  }, []);

  return {
    stream: state.stream,
    metadata: state.metadata,
    isActive: state.isActive,
    error: state.error,
    startStream,
    stopStream,
    toggleTrack,
    isTrackEnabled,
    replaceVideoTrack,
  };
}
