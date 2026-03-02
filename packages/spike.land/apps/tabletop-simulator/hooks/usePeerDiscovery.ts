"use client";
import { useCallback, useEffect, useRef } from "react";

interface UsePeerDiscoveryOptions {
  roomId: string;
  peerId: string | null;
  connectedPeers: Set<string>;
  onPeerDiscovered: (peerId: string) => void;
  enabled?: boolean;
}

// Heartbeat interval - register with server every 10 seconds
const HEARTBEAT_INTERVAL_MS = 10000;

// Cooldown for retrying failed peers - wait 60 seconds before trying again
const FAILED_PEER_COOLDOWN_MS = 60000;

export function usePeerDiscovery({
  roomId,
  peerId,
  connectedPeers,
  onPeerDiscovered,
  enabled = true,
}: UsePeerDiscoveryOptions) {
  const isRegisteredRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectedPeersRef = useRef(connectedPeers);
  // Track peers we're currently trying to connect to
  const pendingConnectionsRef = useRef<Set<string>>(new Set());
  // Track failed connection attempts with timestamp
  const failedPeersRef = useRef<Map<string, number>>(new Map());

  // Keep ref in sync
  useEffect(() => {
    connectedPeersRef.current = connectedPeers;
    // Clear pending status for connected peers
    connectedPeers.forEach((id) => {
      pendingConnectionsRef.current.delete(id);
      failedPeersRef.current.delete(id);
    });
  }, [connectedPeers]);

  // Check if a peer should be skipped (failed recently)
  const shouldSkipPeer = useCallback((targetPeerId: string): boolean => {
    const failedAt = failedPeersRef.current.get(targetPeerId);
    if (failedAt && Date.now() - failedAt < FAILED_PEER_COOLDOWN_MS) {
      return true;
    }
    return false;
  }, []);

  // Mark a peer as failed
  const markPeerFailed = useCallback((targetPeerId: string) => {
    pendingConnectionsRef.current.delete(targetPeerId);
    failedPeersRef.current.set(targetPeerId, Date.now());
  }, []);

  // Register with server and get other peers
  const registerAndDiscover = useCallback(async () => {
    if (!peerId || !roomId) return;

    try {
      const response = await fetch(`/api/tabletop/rooms/${roomId}/peers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId }),
      });

      if (!response.ok) {
        console.warn("[Discovery] Failed to register with server");
        return;
      }

      const data = await response.json();
      const discoveredPeers: string[] = data.peers || [];

      // Connect to any peers we're not already connected to
      discoveredPeers.forEach((discoveredPeerId) => {
        if (
          discoveredPeerId !== peerId &&
          !connectedPeersRef.current.has(discoveredPeerId) &&
          !pendingConnectionsRef.current.has(discoveredPeerId) &&
          !shouldSkipPeer(discoveredPeerId)
        ) {
          console.log(`[Discovery] Found new peer: ${discoveredPeerId}`);
          pendingConnectionsRef.current.add(discoveredPeerId);
          onPeerDiscovered(discoveredPeerId);
        }
      });

      isRegisteredRef.current = true;
    } catch (error) {
      console.error("[Discovery] Error during registration:", error);
    }
  }, [roomId, peerId, onPeerDiscovered, shouldSkipPeer]);

  // Unregister from server
  const unregister = useCallback(async () => {
    if (!peerId || !roomId || !isRegisteredRef.current) return;

    try {
      await fetch(`/api/tabletop/rooms/${roomId}/peers?peerId=${peerId}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("[Discovery] Error during unregistration:", error);
    }
  }, [roomId, peerId]);

  // Start discovery when enabled and peer ID is available
  useEffect(() => {
    if (!enabled || !peerId || !roomId) return;

    // Initial registration
    registerAndDiscover();

    // Set up heartbeat for ongoing discovery
    heartbeatIntervalRef.current = setInterval(() => {
      registerAndDiscover();
    }, HEARTBEAT_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      unregister();
    };
  }, [enabled, peerId, roomId, registerAndDiscover, unregister]);

  return {
    registerAndDiscover,
    unregister,
    markPeerFailed,
  };
}
