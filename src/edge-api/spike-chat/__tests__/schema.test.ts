import { describe, it, expect } from "vitest";
import {
  channels,
  channelMembers,
  messages,
  reactions,
  readCursors,
  pins,
  bookmarks,
  webhooks,
  agentProfiles,
  slashCommands
} from "../db/schema";

describe("schema", () => {
  it("exports schemas", () => {
    expect(channels).toBeDefined();
    expect(channelMembers).toBeDefined();
    expect(messages).toBeDefined();
    expect(reactions).toBeDefined();
    expect(readCursors).toBeDefined();
    expect(pins).toBeDefined();
    expect(bookmarks).toBeDefined();
    expect(webhooks).toBeDefined();
    expect(agentProfiles).toBeDefined();
    expect(slashCommands).toBeDefined();
  });
});
