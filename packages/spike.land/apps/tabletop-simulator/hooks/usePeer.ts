"use client";
import Peer from "peerjs";
import { useEffect, useRef, useState } from "react";
import { isE2EMode } from "../lib/e2e-utils";

// Store peer instances globally to survive React Strict Mode double-mount
const peerCache = new Map<string, { peer: Peer; refCount: number }>();

export function usePeer() {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const cacheKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // In E2E mode, return a mock peer ID immediately without connecting
    // This avoids timeouts waiting for PeerJS server connections
    if (isE2EMode()) {
      const mockPeerId = "e2e-mock-" + Math.random().toString(36).slice(2, 9);
      setPeerId(mockPeerId);
      // Don't create real Peer - leave peer as null but peerId populated
      return;
    }

    // Generate a stable cache key for this component instance
    const cacheKey = cacheKeyRef.current ?? Math.random().toString(36).substr(2, 9);
    cacheKeyRef.current = cacheKey;

    // Check if we already have a peer for this key (Strict Mode re-mount)
    const cached = peerCache.get(cacheKey);
    if (cached) {
      cached.refCount++;
      setPeer(cached.peer);
      setPeerId(cached.peer.id);
      return () => {
        cached.refCount--;
        // Only destroy if no more references
        if (cached.refCount <= 0) {
          peerCache.delete(cacheKey);
          cached.peer.destroy();
        }
      };
    }

    // Create new peer
    const id = Math.random().toString(36).substr(2, 9);
    const newPeer = new Peer(id, {
      debug: 1, // Reduce debug verbosity
    });

    peerCache.set(cacheKey, { peer: newPeer, refCount: 1 });

    newPeer.on("open", (openId) => {
      setPeer(newPeer);
      setPeerId(openId);
    });

    newPeer.on("error", (err) => {
      console.error("[P2P] Peer error:", err);
    });

    return () => {
      const entry = peerCache.get(cacheKey);
      if (entry) {
        entry.refCount--;
        // Only destroy if no more references (handles Strict Mode)
        if (entry.refCount <= 0) {
          peerCache.delete(cacheKey);
          newPeer.destroy();
        }
      }
    };
  }, []);

  return { peer, peerId };
}
