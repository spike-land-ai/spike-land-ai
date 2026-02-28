import type { DataConnection, MediaConnection, Peer } from "peerjs";

export type MediaConstraints = MediaStreamConstraints;

export interface StreamMetadata {
  peerId: string;
  streamType: "video" | "audio" | "screen";
  isActive: boolean;
  videoSettings?: {
    width: number;
    height: number;
    frameRate: number;
  } | undefined;
}

export type WebRTCError =
  | "permission-denied"
  | "network-error"
  | "not-supported"
  | "unknown";

export interface WebRTCErrorInfo {
  type: WebRTCError;
  message: string;
  originalError?: Error | undefined;
}

export interface PeerConfig {
  peerId?: string | undefined;
  role: "host" | "client";
  serverConfig?: {
    host: string;
    port: number;
    path: string;
    secure: boolean;
  } | undefined;
}

export interface ClientMetadata {
  id: string;
  name: string;
  connectedAt: Date;
  status: "connecting" | "connected" | "closed" | "failed";
}

export interface ClientConnectionState {
  client: ClientMetadata;
  dataConnection: DataConnection | null;
  mediaConnection: MediaConnection | null;
  stream: MediaStream | null;
  streamMetadata: StreamMetadata | null;
}

export type PeerMessage = Record<string, unknown>;

export interface PeerConnectionState {
  peer: Peer | null;
  peerId: string | null;
  status: "disconnected" | "connecting" | "connected" | "failed" | "closed";
  error: string | null;
}
