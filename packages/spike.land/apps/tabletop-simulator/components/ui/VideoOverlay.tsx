"use client";
import { useEffect, useRef } from "react";

function VideoPlayer({ stream, muted = false }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="w-32 h-24 bg-black rounded-lg border border-white/20 object-cover"
    >
      <track kind="captions" src="" label="Captions" default />
    </video>
  );
}

interface VideoOverlayProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
}

export function VideoOverlay({ localStream, remoteStreams }: VideoOverlayProps) {
  return (
    <div className="fixed top-4 right-4 flex flex-col gap-2 z-50" data-testid="video-overlay">
      {localStream && (
        <div className="relative">
          <VideoPlayer stream={localStream} muted />
          <span className="absolute bottom-1 right-1 text-xs text-white bg-black/50 px-1 rounded">
            You
          </span>
        </div>
      )}
      {Array.from(remoteStreams.entries()).map(([id, stream]) => (
        <div key={id} className="relative">
          <VideoPlayer stream={stream} />
          <span className="absolute bottom-1 right-1 text-xs text-white bg-black/50 px-1 rounded">
            {id.substring(0, 4)}
          </span>
        </div>
      ))}
    </div>
  );
}
