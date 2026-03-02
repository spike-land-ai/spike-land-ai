"use client";
import type { DataConnection, MediaConnection } from "peerjs";
import type Peer from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";

type DataHandler = (data: unknown, peerId: string) => void;

export function usePeerConnection(peer: Peer | null, onData?: DataHandler) {
  const [connections, setConnections] = useState<
    Map<
      string,
      {
        dataConnection: DataConnection | null;
        mediaConnection: MediaConnection | null;
      }
    >
  >(new Map());
  const connectionsRef = useRef(connections);
  const onDataRef = useRef(onData);

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  // Setup connection with data listener attached immediately
  const setupConnection = useCallback((conn: DataConnection, peerId: string) => {
    // Attach data listener IMMEDIATELY before adding to state
    conn.on("data", (data) => {
      console.log(
        `[P2P] Received data from ${peerId}:`,
        data instanceof Uint8Array ? `Uint8Array(${data.length})` : typeof data,
      );
      onDataRef.current?.(data, peerId);
    });

    conn.on("close", () => {
      console.log(`[P2P] Connection closed with ${peerId}`);
      setConnections((prev) => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
    });

    conn.on("error", (err) => {
      console.error(`[P2P] Connection error with ${peerId}:`, err);
    });

    // Now add to state (this triggers effects in other hooks)
    setConnections((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(peerId) || { dataConnection: null, mediaConnection: null };
      newMap.set(peerId, { ...existing, dataConnection: conn });
      return newMap;
    });
    console.log(`[P2P] Connection established with ${peerId}`);
  }, []);

  // Connect to a peer (Data)
  const connectData = useCallback(
    (remoteId: string) => {
      if (!peer) {
        console.warn("[P2P] Cannot connect - peer not initialized");
        return;
      }
      console.log(`[P2P] Initiating connection to ${remoteId}`);
      const conn = peer.connect(remoteId, { reliable: true });

      conn.on("open", () => {
        console.log(`[P2P] Outgoing connection opened to ${remoteId}`);
        setupConnection(conn, remoteId);
      });
    },
    [peer, setupConnection],
  );

  // Handle incoming connections
  useEffect(() => {
    if (!peer) return;

    const handleConnection = (conn: DataConnection) => {
      console.log(`[P2P] Incoming connection from ${conn.peer}`);
      conn.on("open", () => {
        console.log(`[P2P] Incoming connection opened from ${conn.peer}`);
        setupConnection(conn, conn.peer);
      });
    };

    peer.on("connection", handleConnection);

    return () => {
      peer.off("connection", handleConnection);
    };
  }, [peer, setupConnection]);

  return { connections, connectData };
}
