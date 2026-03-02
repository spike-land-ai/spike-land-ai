import type { DataConnection } from "peerjs";
import { useCallback, useRef } from "react";
import * as Y from "yjs";

type ConnectionMap = Map<string, { dataConnection: DataConnection | null }>;

export function usePeerDataChannel(doc: Y.Doc | null) {
  const sentFullStateToRef = useRef<Set<string>>(new Set());

  // Broadcast an update to all connected peers
  const broadcastUpdate = useCallback((update: Uint8Array, connections: ConnectionMap) => {
    connections.forEach((conn, peerId) => {
      if (conn.dataConnection?.open) {
        try {
          conn.dataConnection.send(update);
        } catch (err) {
          console.error(`[P2P] Failed to send update to ${peerId}:`, err);
        }
      }
    });
  }, []);

  // Send full state to a specific peer (call when connection is established)
  const sendFullState = useCallback(
    (connection: DataConnection) => {
      if (!doc) return;

      const peerId = connection.peer;
      if (sentFullStateToRef.current.has(peerId)) {
        console.log(`[P2P] Already sent full state to ${peerId}, skipping`);
        return;
      }

      const fullState = Y.encodeStateAsUpdate(doc);
      console.log(`[P2P] Sending full state (${fullState.length} bytes) to ${peerId}`);
      try {
        connection.send(fullState);
        sentFullStateToRef.current.add(peerId);
      } catch (err) {
        console.error(`[P2P] Failed to send full state to ${peerId}:`, err);
      }
    },
    [doc],
  );

  // Process incoming data from a peer
  const handleIncomingData = useCallback(
    (data: unknown) => {
      if (!doc) {
        console.warn("[P2P] Received data but doc is null");
        return;
      }

      if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        const update = new Uint8Array(data);
        console.log(`[P2P] Applying remote update (${update.length} bytes)`);
        try {
          Y.applyUpdate(doc, update, "remote");
        } catch (err) {
          console.error("[P2P] Failed to apply update:", err);
        }
      } else {
        console.warn("[P2P] Received unexpected data type:", typeof data);
      }
    },
    [doc],
  );

  // Clear the sent state tracking for a peer (call when connection closes)
  const clearPeerState = useCallback((peerId: string) => {
    sentFullStateToRef.current.delete(peerId);
  }, []);

  return { handleIncomingData, broadcastUpdate, sendFullState, clearPeerState };
}
