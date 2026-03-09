export interface Mention {
  type: "user" | "channel" | "role" | "file";
  id: string;
  raw: string;
}

/**
 * Extracts mentions from text.
 * - @username -> user
 * - #channel-slug -> channel
 * - @role -> role
 * - @/path/to/file -> file
 */
export function extractMentions(text: string): Mention[] {
  const mentions: Mention[] = [];
  const regex = /(?:^|\s)(@|#)([a-zA-Z0-9_\-\/]+)(?=\s|$|[.,!?])/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0].trim();
    const prefix = match[1];
    const id = match[2];

    if (prefix === "#") {
      mentions.push({ type: "channel", id: id!, raw });
    } else if (prefix === "@") {
      if (id!.startsWith("/")) {
        mentions.push({ type: "file", id: id!, raw });
      } else {
        // Just assuming user for now unless it's a known role like "here" or "channel"
        if (id === "here" || id === "channel" || id === "everyone") {
          mentions.push({ type: "role", id, raw });
        } else {
          mentions.push({ type: "user", id: id!, raw });
        }
      }
    }
  }

  return mentions;
}
