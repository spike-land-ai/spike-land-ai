"use client";
import type { MediaConnection } from "peerjs";
import type Peer from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";

export function useGameMedia(
  peer: Peer | null,
  connections: Map<string, { dataConnection: unknown }>,
) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const activeCalls = useRef<Map<string, MediaConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const enableMedia = useCallback(async (video: boolean = true, audio: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (e) {
      console.error("Failed to get media", e);
      return null;
    }
  }, []);

  const callAll = useCallback(() => {
    if (!localStream || !peer) return;

    connections.forEach((_conn, peerId: string) => {
      // Skip if already calling this peer
      if (activeCalls.current.has(peerId)) return;

      const call = peer.call(peerId, localStream);
      activeCalls.current.set(peerId, call);

      call.on("stream", (remoteStream: MediaStream) => {
        setRemoteStreams((prev) => new Map(prev).set(peerId, remoteStream));
      });

      call.on("close", () => {
        activeCalls.current.delete(peerId);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
      });
    });
  }, [localStream, peer, connections]);

  // Listen for incoming calls and auto-answer
  useEffect(() => {
    if (!peer) return;

    const handleCall = (call: MediaConnection) => {
      const peerId = call.peer;

      // Answer with local stream if available
      const stream = localStreamRef.current;
      if (stream) {
        call.answer(stream);
      } else {
        // Answer without stream for now, can add later
        call.answer();
      }

      activeCalls.current.set(peerId, call);

      call.on("stream", (remoteStream: MediaStream) => {
        setRemoteStreams((prev) => new Map(prev).set(peerId, remoteStream));
      });

      call.on("close", () => {
        activeCalls.current.delete(peerId);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
      });
    };

    peer.on("call", handleCall);

    return () => {
      peer.off("call", handleCall);
    };
  }, [peer]);

  // Cleanup on unmount
  useEffect(() => {
    const calls = activeCalls.current;
    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
      calls.forEach((call) => call.close());
    };
  }, [localStream]);

  return { localStream, remoteStreams, enableMedia, callAll };
}
