"use client";

import type { ClientConnectionState, ClientMetadata, PeerMessage } from "@/types/webrtc";
import { getStreamMetadata } from "@apps/display/lib/webrtc/utils";
import type { DataConnection, MediaConnection, Peer } from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook for managing peer-to-peer connections (calls and data channels)
 *
 * This hook handles:
 * - Making and receiving calls
 * - Data channel communication
 * - Managing multiple client connections
 * - Connection state tracking
 */
export function usePeerConnection(peer: Peer | null) {
  const [connections, setConnections] = useState<Map<string, ClientConnectionState>>(new Map());
  const connectionsRef = useRef<Map<string, ClientConnectionState>>(new Map());

  // Keep ref in sync with state
  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  /**
   * Update connection state
   */
  const updateConnection = useCallback(
    (clientId: string, updates: Partial<ClientConnectionState>) => {
      setConnections((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(clientId);

        if (existing) {
          newMap.set(clientId, { ...existing, ...updates });
        }

        return newMap;
      });
    },
    [],
  );

  /**
   * Send a message to a client via data connection
   */
  const sendMessage = useCallback((clientId: string, message: PeerMessage) => {
    const connection = connectionsRef.current.get(clientId);
    if (connection?.dataConnection && connection.dataConnection.open) {
      connection.dataConnection.send(message);
    }
  }, []);

  /**
   * Send a message to all connected clients
   */
  const broadcast = useCallback((message: PeerMessage) => {
    connectionsRef.current.forEach((connection) => {
      if (connection.dataConnection && connection.dataConnection.open) {
        connection.dataConnection.send(message);
      }
    });
  }, []);

  /**
   * Call a remote peer and establish media connection
   */
  const callPeer = useCallback(
    (remotePeerId: string, stream: MediaStream) => {
      if (!peer) {
        return;
      }

      // Establish data connection first
      const dataConn = peer.connect(remotePeerId, {
        reliable: true,
        serialization: "json",
      });

      // Establish media connection
      const mediaConn = peer.call(remotePeerId, stream);

      // Create initial connection state
      const clientMetadata: ClientMetadata = {
        id: remotePeerId,
        name: remotePeerId,
        connectedAt: new Date(),
        status: "connecting",
      };

      const connectionState: ClientConnectionState = {
        client: clientMetadata,
        dataConnection: dataConn,
        mediaConnection: mediaConn,
        stream: null,
        streamMetadata: null,
      };

      setConnections((prev) => new Map(prev).set(remotePeerId, connectionState));

      // Handle data connection events
      dataConn.on("open", () => {
        updateConnection(remotePeerId, {
          client: { ...clientMetadata, status: "connected" },
        });
      });

      dataConn.on("data", () => {
        // Handle incoming messages here
      });

      dataConn.on("close", () => {
        updateConnection(remotePeerId, {
          client: { ...clientMetadata, status: "closed" },
        });
      });

      dataConn.on("error", () => {
        updateConnection(remotePeerId, {
          client: { ...clientMetadata, status: "failed" },
        });
      });

      // Handle media connection events
      mediaConn.on("stream", (remoteStream) => {
        const metadata = getStreamMetadata(remoteStream, remotePeerId);

        updateConnection(remotePeerId, {
          stream: remoteStream,
          streamMetadata: metadata,
        });
      });

      mediaConn.on("close", () => {
        // Connection closed
      });

      mediaConn.on("error", () => {
        // Error occurred
      });
    },
    [peer, updateConnection],
  );

  /**
   * Answer an incoming call
   */
  const answerCall = useCallback(
    (call: MediaConnection, stream: MediaStream) => {
      call.answer(stream);

      const clientMetadata: ClientMetadata = {
        id: call.peer,
        name: call.peer,
        connectedAt: new Date(),
        status: "connected",
      };

      const connectionState: ClientConnectionState = {
        client: clientMetadata,
        dataConnection: null,
        mediaConnection: call,
        stream: null,
        streamMetadata: null,
      };

      setConnections((prev) => new Map(prev).set(call.peer, connectionState));

      call.on("stream", (remoteStream) => {
        const metadata = getStreamMetadata(remoteStream, call.peer);

        updateConnection(call.peer, {
          stream: remoteStream,
          streamMetadata: metadata,
        });
      });

      call.on("close", () => {
        updateConnection(call.peer, {
          client: { ...clientMetadata, status: "closed" },
        });
      });

      call.on("error", () => {
        updateConnection(call.peer, {
          client: { ...clientMetadata, status: "failed" },
        });
      });
    },
    [updateConnection],
  );

  /**
   * Disconnect from a specific peer
   */
  const disconnectPeer = useCallback((clientId: string) => {
    const connection = connectionsRef.current.get(clientId);

    if (connection) {
      // Close data connection
      if (connection.dataConnection && connection.dataConnection.open) {
        connection.dataConnection.close();
      }

      // Close media connection
      if (connection.mediaConnection) {
        connection.mediaConnection.close();
      }

      // Stop remote stream
      if (connection.stream) {
        connection.stream.getTracks().forEach((track) => track.stop());
      }

      setConnections((prev) => {
        const newMap = new Map(prev);
        newMap.delete(clientId);
        return newMap;
      });
    }
  }, []);

  /**
   * Disconnect from all peers
   */
  const disconnectAll = useCallback(() => {
    connectionsRef.current.forEach((_, clientId) => {
      disconnectPeer(clientId);
    });
  }, [disconnectPeer]);

  /**
   * Set up event listeners for incoming connections and calls
   */
  useEffect(() => {
    if (!peer) return;

    const handleConnection = (dataConn: DataConnection) => {
      dataConn.on("open", () => {
        const existing = connectionsRef.current.get(dataConn.peer);
        if (existing) {
          updateConnection(dataConn.peer, { dataConnection: dataConn });
        } else {
          const clientMetadata: ClientMetadata = {
            id: dataConn.peer,
            name: dataConn.peer,
            connectedAt: new Date(),
            status: "connected",
          };

          const connectionState: ClientConnectionState = {
            client: clientMetadata,
            dataConnection: dataConn,
            mediaConnection: null,
            stream: null,
            streamMetadata: null,
          };

          setConnections((prev) => new Map(prev).set(dataConn.peer, connectionState));
        }
      });

      dataConn.on("data", () => {
        // Data received
      });

      dataConn.on("close", () => {
        // Connection closed
      });

      dataConn.on("error", () => {
        // Error occurred
      });
    };

    const handleCall = () => {
      // Note: Call must be answered by the application, not automatically
      // Store the call in a pending state or emit an event
    };

    peer.on("connection", handleConnection);
    peer.on("call", handleCall);

    return () => {
      peer.off("connection", handleConnection);
      peer.off("call", handleCall);
    };
  }, [peer, updateConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectAll();
    };
  }, [disconnectAll]);

  return {
    connections,
    callPeer,
    answerCall,
    sendMessage,
    broadcast,
    disconnectPeer,
    disconnectAll,
  };
}
