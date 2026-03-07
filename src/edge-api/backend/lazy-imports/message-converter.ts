import type { ModelMessage } from "ai";
import { VALID_ROLES } from "../core-logic/lib/message-validation";
import type { ValidRole } from "../core-logic/lib/message-validation";

interface MessageContentPart {
  type: string;
  text?: string;
  image_url?: {
    url: string;
  };
}

function isMessageContentPart(value: unknown): value is MessageContentPart {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.type === "string";
}

interface MessagePart {
  type: string;
  text?: string;
  url?: string;
  image?: string;
  image_url?: {
    url: string;
  };
}

interface MessageWithParts {
  role: string;
  id?: string;
  parts?: MessagePart[];
  content?: string | MessageContentPart[];
}

export type { MessagePart, MessageWithParts, CoreMessage };

type CoreMessage = ModelMessage;

function isValidRole(role: unknown): role is ValidRole {
  return typeof role === "string" && VALID_ROLES.includes(role as ValidRole);
}

/**
 * Converts frontend message formats (with 'parts' or 'content') into AI SDK CoreMessage format.
 */
export function convertMessages(messages: MessageWithParts[]): CoreMessage[] {
  return messages.map((msg: MessageWithParts): CoreMessage => {
    if (!isValidRole(msg.role)) {
      throw new Error(`Invalid role: ${msg.role}`);
    }

    const validRole = msg.role as ValidRole;

    // Handle messages with 'parts' field (frontend format)
    if (msg.parts && Array.isArray(msg.parts)) {
      const content = msg.parts.map((part: MessagePart) => {
        if (part.type === "text") {
          return { type: "text" as const, text: part.text || "" };
        }
        if (part.type === "image" || part.type === "image_url") {
          const url = part.image_url?.url || part.url || part.image;
          if (url) {
            return { type: "image" as const, image: url };
          }
        }
        return { type: "text" as const, text: "[unsupported content]" };
      });

      return {
        role: validRole,
        content: content.length === 1 && content[0]?.type === "text" ? content[0].text : content,
      } as CoreMessage;
    }

    // Handle messages with 'content' field (standard format)
    if (typeof msg.content === "string") {
      return {
        role: validRole,
        content: msg.content,
      } as CoreMessage;
    }

    if (Array.isArray(msg.content)) {
      return {
        role: validRole,
        content: msg.content.map((part: unknown) => {
          if (!isMessageContentPart(part)) {
            return { type: "text", text: "[invalid content]" };
          }

          if (part.type === "text") {
            return { type: "text", text: part.text || "" };
          }
          if (part.type === "image_url" && part.image_url) {
            return { type: "image", image: part.image_url.url };
          }
          return { type: "text", text: "[unsupported content]" };
        }),
      } as CoreMessage;
    }

    // Fallback for unexpected content types
    return {
      role: validRole,
      content: "[invalid content format]",
    } as CoreMessage;
  });
}
