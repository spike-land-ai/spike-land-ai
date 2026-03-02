"use client";

import { calculateOptimalLayout } from "@apps/display/lib/layout-optimizer";
import { getTwilioIceServers } from "@apps/display/lib/webrtc/config";
import Image from "next/image";
import type { MediaConnection } from "peerjs";
import Peer from "peerjs";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

interface VideoStream {
  id: string;
  stream: MediaStream;
  connection: MediaConnection;
}

export default function DisplayPage() {
  const [displayId, setDisplayId] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [videoStreams, setVideoStreams] = useState<VideoStream[]>([]);
  const [displayDimensions, setDisplayDimensions] = useState({
    width: 1920,
    height: 1080,
  });

  const peerRef = useRef<Peer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize PeerJS and generate QR code
  useEffect(() => {
    let peer: Peer | null = null;

    // Initialize peer with Twilio TURN servers
    const initializePeer = async () => {
      // Fetch Twilio ICE servers for reliable 4G/5G connectivity
      const iceServers = await getTwilioIceServers();

      // Create a new Peer instance with TURN servers for 4G/5G support
      peer = new Peer({
        config: {
          iceServers,
        },
      });

      peerRef.current = peer;

      // Handle peer open event - we now have an ID
      peer.on("open", (id) => {
        setDisplayId(id);

        // Generate QR code URL
        const clientUrl = `${window.location.origin}/apps/display/client?displayId=${id}`;
        QRCode.toDataURL(clientUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        })
          .then((url) => {
            setQrCodeUrl(url);
          })
          .catch(() => {
            // QR code generation failed
          });
      });

      // Handle incoming connections from clients
      peer.on("connection", (dataConnection) => {
        // Send a welcome message
        dataConnection.on("open", () => {
          dataConnection.send({
            type: "welcome",
            message: "Connected to display",
          });
        });
      });

      // Handle incoming media calls from clients
      peer.on("call", (call) => {
        // Answer the call (we don't send our own stream)
        call.answer();

        // Receive the remote stream
        call.on("stream", (remoteStream) => {
          setVideoStreams((prev) => {
            // Check if stream already exists
            const exists = prev.some((vs) => vs.id === call.peer);
            if (exists) {
              return prev;
            }

            // Add new stream
            return [
              ...prev,
              {
                id: call.peer,
                stream: remoteStream,
                connection: call,
              },
            ];
          });
        });

        // Handle call close
        call.on("close", () => {
          setVideoStreams((prev) => {
            const streamToRemove = prev.find((vs) => vs.id === call.peer);
            if (streamToRemove) {
              // Stop all tracks to free up resources
              streamToRemove.stream.getTracks().forEach((track) => track.stop());
            }
            return prev.filter((vs) => vs.id !== call.peer);
          });
        });

        // Handle errors
        call.on("error", () => {
          setVideoStreams((prev) => {
            const streamToRemove = prev.find((vs) => vs.id === call.peer);
            if (streamToRemove) {
              // Stop all tracks to free up resources
              streamToRemove.stream.getTracks().forEach((track) => track.stop());
            }
            return prev.filter((vs) => vs.id !== call.peer);
          });
        });
      });

      // Handle errors
      peer.on("error", () => {
        // Error occurred
      });
    };

    // Start initialization
    initializePeer();

    // Cleanup on unmount
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  // Track display dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDisplayDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Calculate optimal layout
  const layout = calculateOptimalLayout({
    displayWidth: displayDimensions.width,
    displayHeight: displayDimensions.height,
    numClients: videoStreams.length,
    videoAspectRatio: 16 / 9,
    minCellPadding: 8,
  });

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100dvh-3.5rem)] w-full bg-zinc-950 overflow-hidden text-white"
    >
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-[120px]" />
      </div>

      {/* Video Grid */}
      {videoStreams.length > 0 ? (
        <div
          className="grid h-full w-full gap-3 p-3 transition-all duration-700 ease-in-out z-10 relative"
          style={{
            gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
            gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          }}
        >
          {videoStreams.map((videoStream) => (
            <VideoCell
              key={videoStream.id}
              stream={videoStream.stream}
              peerId={videoStream.id}
              layout={layout}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center z-10 relative px-6">
          <div className="text-center max-w-2xl space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Display System
              </div>
              <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-white">
                Smart Video Wall
              </h1>
              <p className="text-zinc-400 text-lg sm:text-xl font-medium max-w-lg mx-auto">
                Transform multiple devices into a single synchronized display. Scan to start
                streaming.
              </p>
            </div>

            {qrCodeUrl && displayId ? (
              <div className="bg-white p-8 rounded-[2rem] inline-block shadow-2xl shadow-blue-500/10 border border-white/10 animate-in fade-in zoom-in duration-500">
                <div className="relative group">
                  <Image
                    src={qrCodeUrl}
                    alt="QR Code"
                    width={220}
                    height={220}
                    className="mx-auto"
                  />
                  <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-lg group-hover:border-emerald-500/40 transition-colors" />
                </div>
                <div className="mt-6 space-y-4">
                  <p className="text-sm text-zinc-600 font-bold uppercase tracking-tight">
                    Scan with mobile device
                  </p>
                  <button
                    onClick={() => {
                      const clientUrl = `${window.location.origin}/apps/display/client?displayId=${displayId}`;
                      window.open(clientUrl, "_blank");
                    }}
                    className="w-full px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-black transition-all hover:scale-[1.02] active:scale-95 shadow-lg border border-white/5"
                  >
                    Open Local Client
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-zinc-500 font-mono text-sm">Generating Display Session...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Code in corner when clients are connected */}
      {videoStreams.length > 0 && qrCodeUrl && displayId && (
        <div className="absolute bottom-6 right-6 bg-white p-4 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 hover:opacity-100 opacity-80 border border-white/10 z-20">
          <Image src={qrCodeUrl} alt="QR Code" width={100} height={100} />
          <p className="text-[10px] text-center mt-2 text-zinc-500 font-black uppercase tracking-widest">
            Add Screen
          </p>
        </div>
      )}

      {/* Status indicator */}
      <div className="absolute top-6 left-6 bg-zinc-900/80 text-white px-4 py-3 rounded-2xl backdrop-blur-xl border border-white/10 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              displayId ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-yellow-500"
            } animate-pulse`}
          />
          <span className="text-xs font-bold uppercase tracking-widest">
            {displayId ? `Display Online (${videoStreams.length} active)` : "Initializing..."}
          </span>
        </div>
        {displayId && (
          <p className="text-[10px] text-zinc-500 mt-1 font-mono tracking-tighter">
            SESSION: {displayId.toUpperCase()}
          </p>
        )}
      </div>
    </div>
  );
}

interface VideoCellProps {
  stream: MediaStream;
  peerId: string;
  layout: {
    videoWidth: number;
    videoHeight: number;
  };
}

function VideoCell({ stream, peerId, layout }: VideoCellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
    }

    // Cleanup when component unmounts or stream changes
    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <div className="relative flex items-center justify-center bg-gray-900 rounded-lg overflow-hidden transition-all duration-500">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="object-cover w-full h-full transition-all duration-500"
        style={{
          maxWidth: `${layout.videoWidth}px`,
          maxHeight: `${layout.videoHeight}px`,
        }}
      />

      {/* Peer ID overlay */}
      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
        {peerId.slice(0, 8)}...
      </div>
    </div>
  );
}
