"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePeer } from "./usePeer";
import { usePeerConnection } from "./usePeerConnection";
import { usePeerDataChannel } from "./usePeerDataChannel";
import { usePeerDiscovery } from "./usePeerDiscovery";
import { useYjsSync } from "./useYjsSync";

export function useGameRoom(roomId: string) {
  const { doc, isSynced } = useYjsSync(roomId);
  const { peer, peerId } = usePeer();

  // Track which peers we've sent full state to
  const sentFullStateTo = useRef<Set<string>>(new Set());

  // Get the data handler first so we can pass it to usePeerConnection
  const { handleIncomingData, broadcastUpdate, sendFullState } = usePeerDataChannel(doc);

  // Wrap handleIncomingData to log and ignore peerId parameter
  const onPeerData = useCallback(
    (data: unknown) => {
      handleIncomingData(data);
    },
    [handleIncomingData],
  );

  // Pass the data handler directly to usePeerConnection
  // This ensures the listener is attached immediately when connection opens
  const { connections, connectData } = usePeerConnection(peer, onPeerData);

  // Get set of connected peer IDs for discovery
  const connectedPeerIds = useMemo(() => {
    return new Set(connections.keys());
  }, [connections]);

  // Automatic peer discovery via API
  usePeerDiscovery({
    roomId,
    peerId,
    connectedPeers: connectedPeerIds,
    onPeerDiscovered: connectData,
    enabled: !!peer && !!peerId && isSynced,
  });

  // Send full state when new peers connect
  useEffect(() => {
    if (!doc || !isSynced) return;

    // When connections change, check if we need to send full state to new peers
    connections.forEach((conn, peerId) => {
      if (conn.dataConnection?.open && !sentFullStateTo.current.has(peerId)) {
        console.log(`[P2P] New peer connected: ${peerId}, sending full state`);
        sendFullState(conn.dataConnection);
        sentFullStateTo.current.add(peerId);
      }
    });

    // Clean up tracking for disconnected peers
    sentFullStateTo.current.forEach((peerId) => {
      if (!connections.has(peerId)) {
        sentFullStateTo.current.delete(peerId);
      }
    });
  }, [connections, doc, isSynced, sendFullState]);

  // Broadcast local Yjs updates to all connected peers
  useEffect(() => {
    if (!doc) return;

    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin !== "remote") {
        console.log(
          `[P2P] Broadcasting local update (${update.length} bytes) to ${connections.size} peers`,
        );
        broadcastUpdate(update, connections);
      }
    };

    doc.on("update", handleUpdate);

    return () => {
      doc.off("update", handleUpdate);
    };
  }, [doc, connections, broadcastUpdate]);

  // Log when ready
  useEffect(() => {
    if (isSynced && peerId) {
      console.log(`[P2P] Synced and ready. Peer ID: ${peerId}`);
    }
  }, [isSynced, peerId]);

  return {
    doc,
    peer,
    peerId,
    connections,
    connectToPeer: connectData,
    isSynced,
  };
}
