/**
 * Shared types for the Apps feature.
 * Consumed by hooks, utilities, and UI components.
 */

import type { APP_BUILD_STATUSES } from "@/lib/validations/app";

export interface AppMessage {
  id: string;
  role: "USER" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: string;
  attachments?: Array<{
    image: {
      id: string;
      originalUrl: string;
    };
  }>;
  /** Version associated with this message (for AGENT messages) */
  codeVersion?: {
    id: string;
    createdAt: string;
  };
}

export interface AppData {
  id: string;
  name: string;
  description: string | null;
  status: (typeof APP_BUILD_STATUSES)[number];
  codespaceId: string | null;
  codespaceUrl: string | null;
  isPublic: boolean;
  isCurated: boolean;
  lastAgentActivity: string | null;
  agentWorking: boolean;
  createdAt: string;
  updatedAt: string;
  requirements: Array<{ id: string; content: string; }>;
  monetizationModels: Array<{ id: string; model: string; }>;
  statusHistory: Array<{
    id: string;
    status: string;
    message: string | null;
    createdAt: string;
  }>;
  _count: {
    messages: number;
    images: number;
  };
}

export interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}

export interface PendingFile {
  id: string;
  file: File;
}

export type PageMode = "loading" | "prompt" | "workspace";

export type AgentStage =
  | "initialize"
  | "processing"
  | "executing_tool"
  | "validating"
  | "complete"
  | "error";
