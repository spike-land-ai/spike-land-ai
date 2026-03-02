"use client";

import type { PeerConfig, PeerConnectionState } from "@/types/webrtc";
import {
  createWebRTCError,
  generatePeerId,
  isWebRTCSupported,
} from "@apps/display/lib/webrtc/utils";
import Peer, { type PeerOptions } from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook for managing a PeerJS connection
 *
 * This hook handles:
 * - Initializing a PeerJS peer instance
 * - Managing connection lifecycle
 * - Handling errors and reconnection
 * - Cleanup on unmount
 */
export function usePeer(config: PeerConfig) {
  const [state, setState] = useState<PeerConnectionState>({
    peer: null,
    peerId: null,
    status: "disconnected",
    error: null,
  });

  const peerRef = useRef<Peer | null>(null);
  const isInitializing = useRef(false);

  /**
   * Initialize the PeerJS connection
   */
  const initialize = useCallback(() => {
    // Prevent multiple simultaneous initializations
    if (isInitializing.current) return;
    if (peerRef.current && !peerRef.current.disconnected && !peerRef.current.destroyed) return;

    // Check browser support
    if (!isWebRTCSupported()) {
      setState((prev) => ({
        ...prev,
        status: "failed",
        error: "Browser does not support WebRTC",
      }));
      return;
    }

    isInitializing.current = true;
    setState((prev) => ({ ...prev, status: "connecting", error: null }));

    try {
      // Generate peer ID if not provided
      const peerId = config.peerId || generatePeerId(config.role);

      // Create PeerJS configuration
      const peerOptions: PeerOptions = {
        debug: process.env.NODE_ENV === "development" ? 2 : 0,
      };

      // Use custom server if provided
      if (config.serverConfig) {
        peerOptions.host = config.serverConfig.host;
        peerOptions.port = config.serverConfig.port;
        peerOptions.path = config.serverConfig.path;
        peerOptions.secure = config.serverConfig.secure;
      }

      // Create new Peer instance
      const peer = new Peer(peerId, peerOptions);

      // Handle successful connection
      peer.on("open", (id) => {
        setState({
          peer,
          peerId: id,
          status: "connected",
          error: null,
        });
        isInitializing.current = false;
      });

      // Handle errors
      peer.on("error", (error) => {
        const errorInfo = createWebRTCError(
          "network-error",
          error.message || "Peer connection error",
          error as Error,
        );
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: errorInfo.message,
        }));
        isInitializing.current = false;
      });

      // Handle disconnection
      peer.on("disconnected", () => {
        setState((prev) => ({
          ...prev,
          status: "disconnected",
        }));
        isInitializing.current = false;
      });

      // Handle close
      peer.on("close", () => {
        setState({
          peer: null,
          peerId: null,
          status: "closed",
          error: null,
        });
        isInitializing.current = false;
      });

      peerRef.current = peer;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to initialize peer",
      }));
      isInitializing.current = false;
    }
  }, [config]);

  /**
   * Reconnect to the PeerJS server
   */
  const reconnect = useCallback(() => {
    if (peerRef.current && peerRef.current.disconnected) {
      setState((prev) => ({ ...prev, status: "connecting" }));
      peerRef.current.reconnect();
    } else {
      initialize();
    }
  }, [initialize]);

  /**
   * Disconnect from the PeerJS server
   */
  const disconnect = useCallback(() => {
    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.disconnect();
    }
  }, []);

  /**
   * Destroy the peer connection completely
   */
  const destroy = useCallback(() => {
    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setState({
      peer: null,
      peerId: null,
      status: "closed",
      error: null,
    });
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();

    // Cleanup on unmount
    return () => {
      if (peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.destroy();
      }
    };
  }, [initialize]);

  return {
    peer: state.peer,
    peerId: state.peerId,
    status: state.status,
    error: state.error,
    reconnect,
    disconnect,
    destroy,
  };
}
