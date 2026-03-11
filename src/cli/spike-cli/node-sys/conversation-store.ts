/**
 * Conversation persistence — save/load chat sessions to disk.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { homedir } from "node:os";
import type { Message } from "../ai/client.js";
import type { AssertionRuntimeSnapshot } from "../core-logic/chat/assertion-runtime.js";

export interface ConversationMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

export interface SavedConversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  runtime?: AssertionRuntimeSnapshot | null;
}

const CONVERSATIONS_DIR = join(homedir(), ".spike", "conversations");

function ensureDir(): void {
  if (!existsSync(CONVERSATIONS_DIR)) {
    mkdirSync(CONVERSATIONS_DIR, { recursive: true });
  }
}

/**
 * Validate that a user-supplied conversation ID is safe to use as a filename.
 * Rejects IDs containing path separators or other traversal sequences.
 * Returns the resolved absolute path, or null if the ID is invalid.
 */
function safeConversationPath(id: string): string | null {
  // Reject empty, overly long, or obviously dangerous IDs
  if (!id || id.length > 128) return null;

  // Only allow alphanumeric, hyphens, and underscores — no slashes, dots, etc.
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;

  const filePath = resolve(join(CONVERSATIONS_DIR, `${id}.json`));

  // Confirm the resolved path stays within the conversations directory
  const resolvedDir = resolve(CONVERSATIONS_DIR);
  if (!filePath.startsWith(`${resolvedDir}${normalize("/")}`)) return null;

  return filePath;
}

function generateId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${date}-${time}-${rand}`;
}

function extractPreview(messages: Message[]): string {
  for (const msg of messages) {
    if (msg.role === "user" && typeof msg.content === "string") {
      return msg.content.slice(0, 80);
    }
  }
  return "(empty)";
}

/**
 * Save a conversation to disk.
 */
export function saveConversation(
  messages: Message[],
  id?: string,
  runtime?: AssertionRuntimeSnapshot | null,
): ConversationMeta {
  ensureDir();

  const conversationId = id ?? generateId();
  const now = new Date().toISOString();

  // Validate the ID to prevent path traversal (CWE-22)
  const filePath = safeConversationPath(conversationId);
  if (!filePath) {
    throw new Error(`Invalid conversation ID: "${conversationId}"`);
  }

  // Check if updating existing
  let createdAt = now;
  if (existsSync(filePath)) {
    try {
      const existing = JSON.parse(readFileSync(filePath, "utf-8")) as SavedConversation;
      createdAt = existing.createdAt;
    } catch {
      // Corrupt file, overwrite
    }
  }

  const conversation: SavedConversation = {
    id: conversationId,
    createdAt,
    updatedAt: now,
    messages,
    runtime: runtime ?? null,
  };

  writeFileSync(filePath, JSON.stringify(conversation, null, 2), "utf-8");

  return {
    id: conversationId,
    createdAt,
    updatedAt: now,
    messageCount: messages.length,
    preview: extractPreview(messages),
  };
}

/**
 * Load a conversation from disk.
 */
export function loadConversation(id: string): SavedConversation | null {
  ensureDir();

  // Validate the ID to prevent path traversal (CWE-22)
  const filePath = safeConversationPath(id);
  if (!filePath) return null;

  if (!existsSync(filePath)) return null;

  try {
    const data = readFileSync(filePath, "utf-8");
    return JSON.parse(data) as SavedConversation;
  } catch {
    return null;
  }
}

/**
 * List all saved conversations.
 */
export function listConversations(): ConversationMeta[] {
  ensureDir();

  const files = readdirSync(CONVERSATIONS_DIR).filter((f) => f.endsWith(".json"));
  const conversations: ConversationMeta[] = [];

  for (const file of files) {
    try {
      const data = readFileSync(join(CONVERSATIONS_DIR, file), "utf-8");
      const conv = JSON.parse(data) as SavedConversation;
      conversations.push({
        id: conv.id,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages.length,
        preview: extractPreview(conv.messages),
      });
    } catch {
      // Skip corrupt files
    }
  }

  // Sort by updatedAt descending
  conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return conversations;
}
