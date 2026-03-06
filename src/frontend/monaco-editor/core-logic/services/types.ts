// Using built-in MessageEvent type from lib.dom.d.ts

/**
 * Message data structure for WebSocket communication
 */
export interface MessageData {
  /** HTML content of the message */
  html: string;
  /** CSS content of the message */
  css: string;
  /** Optional source code */
  code?: string;
  /** Optional transpiled code */
  transpiled?: string;
}

/**
 * Result structure for run message operations
 */
export interface RunMessageResult {
  /** Generated HTML content */
  html: string;
  /** Generated CSS content */
  css: string;
}

/**
 * Configuration options for WebSocket manager
 */
export interface WebSocketConfig {
  /** Retry attempts for failed connections */
  maxRetries?: number;
  /** Delay between retry attempts in milliseconds */
  retryDelay?: number;
  /** Timeout for connection attempts in milliseconds */
  connectionTimeout?: number;
}

/**
 * Dependencies required by WebSocket manager
 */
export interface WebSocketDependencies {
  /** Message handler service */
  messageHandler: IMessageHandlerService;
  /** Service worker manager */
  serviceWorker: IServiceWorkerManager;
  /** Session synchronizer for cross-tab communication */
  sessionSynchronizer: ISessionSynchronizer;
}

/**
 * Interface for message handler service
 */
export interface IMessageHandlerService {
  /** Handle incoming message */
  handleMessage(event: Message): Promise<MessageResponse>;
  /** Handle run message with transpiled code */
  handleRunMessage(transpiled: string): Promise<RunMessageResult | false>;
  /** Cleanup resources */
  cleanup(): void;
}

/**
 * Interface for service worker manager
 */
export interface IServiceWorkerManager {
  /** Setup service worker */
  setup(): Promise<ServiceWorker | undefined>;
}

/**
 * Interface for cross-tab session synchronization
 */
export interface ISessionSynchronizer {
  /** Initialize session */
  init(initialSession?: ICodeSession): Promise<ICodeSession>;
  /** Subscribe to session updates */
  subscribe(callback: (session: ICodeSession) => void): () => void;
  /** Get current code */
  getCode(): Promise<string>;
  /** Get current session */
  getSession(): ICodeSession | null;
  /** Post session update to other tabs */
  broadcastSession(session: ICodeSession & { sender: string }): void;
  /** Close and cleanup resources */
  close(): void;
}

/**
 * Interface for WebSocket manager
 */
export interface IWebSocketManager {
  /** Initialize WebSocket connection */
  init(): Promise<void>;
  /** Handle run message */
  handleRunMessage(transpiled: string): Promise<RunMessageResult | false>;
  /** Cleanup resources */
  cleanup(): void;
}

import type { ICodeSession, Message, MessageResponse } from "../../ui/@/lib/interfaces";
import type { WebSocketEventType } from "./enums";

/**
 * WebSocket event handler type
 */
export type WebSocketEventHandler = (event: MessageEvent | Event) => void;

/**
 * WebSocket event subscription
 */
export interface WebSocketSubscription {
  /** Event type */
  type: WebSocketEventType;
  /** Event handler */
  handler: WebSocketEventHandler;
  /** Unsubscribe function */
  unsubscribe: () => void;
}

/**
 * Copilot service status
 */
export type CopilotStatus = "active" | "loading" | "offline" | "disabled";

/**
 * Interface for AI copilot code completion service
 */
export interface ICopilotService {
  /** Request a code completion given surrounding context */
  requestCompletion(prefix: string, suffix: string, signal: AbortSignal): Promise<string | null>;
  /** Whether copilot is currently enabled */
  isEnabled(): boolean;
  /** Toggle copilot on/off (persisted to localStorage) */
  toggle(): void;
  /** Get current status */
  getStatus(): CopilotStatus;
  /** Subscribe to status changes, returns unsubscribe function */
  onStatusChange(cb: (status: CopilotStatus) => void): () => void;
}

/**
 * Re-export enums from separate file
 */
export { WebSocketEventType, WebSocketState } from "./enums";
