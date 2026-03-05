// Constants for validation
const MAX_MESSAGE_LENGTH = 100000; // 100KB per message
const MAX_MESSAGES_COUNT = 100;
const VALID_ROLES = ["user", "assistant", "system"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export { MAX_MESSAGE_LENGTH, MAX_MESSAGES_COUNT, VALID_ROLES };
export type { ValidRole };

/**
 * Pure validation function for messages array.
 * Returns null if valid, or an error string describing the issue.
 */
export function validateMessages(messages: unknown): string | null {
  if (!messages || !Array.isArray(messages)) {
    return "Messages must be an array";
  }

  if (messages.length === 0) {
    return "Messages array cannot be empty";
  }

  if (messages.length > MAX_MESSAGES_COUNT) {
    return `Too many messages. Maximum allowed: ${MAX_MESSAGES_COUNT}`;
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg || typeof msg !== "object") {
      return `Message at index ${i} must be an object`;
    }

    const typedMsg = msg as Record<string, unknown>;

    if (
      !typedMsg.role ||
      typeof typedMsg.role !== "string" ||
      !VALID_ROLES.includes(typedMsg.role as ValidRole)
    ) {
      return `Message at index ${i} must have a valid role (${VALID_ROLES.join(", ")})`;
    }

    // Support both 'content' and 'parts' fields
    const hasContent = typedMsg.content !== undefined;
    const hasParts = typedMsg.parts !== undefined;

    if (!hasContent && !hasParts) {
      return `Message at index ${i} must have either 'content' or 'parts'`;
    }

    // Check message size
    const messageSize = JSON.stringify(typedMsg).length;
    if (messageSize > MAX_MESSAGE_LENGTH) {
      return `Message at index ${i} exceeds maximum size limit`;
    }

    // Validate content structure if present
    if (hasContent) {
      if (typeof typedMsg.content !== "string" && !Array.isArray(typedMsg.content)) {
        return `Message at index ${i} content must be a string or array`;
      }

      const content = typedMsg.content;
      if (Array.isArray(content)) {
        const contentParts = content as Record<string, unknown>[];
        for (let j = 0; j < contentParts.length; j++) {
          const part = contentParts[j];
          if (!part || typeof part !== "object" || !("type" in part)) {
            return `Message at index ${i}, content part ${j} must have a type`;
          }
        }
      }
    }

    // Validate parts structure if present
    const messageParts = typedMsg.parts;
    if (hasParts && !Array.isArray(messageParts)) {
      return `Message at index ${i} parts must be an array`;
    }

    if (hasParts && Array.isArray(messageParts)) {
      const parts = messageParts as Record<string, unknown>[];
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        if (!part || typeof part !== "object" || !("type" in part)) {
          return `Message at index ${i}, part ${j} must have a type`;
        }
      }
    }
  }

  return null;
}
