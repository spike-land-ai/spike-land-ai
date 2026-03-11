import { afterEach, describe, expect, it, vi } from "vitest";
import {
  saveConversation,
  loadConversation,
  listConversations,
} from "../../../../src/cli/spike-cli/node-sys/conversation-store.js";
import type { Message } from "../../../../src/cli/spike-cli/ai/client.js";
import { AssertionRuntime } from "../../../../src/cli/spike-cli/core-logic/chat/assertion-runtime.js";

// Mock fs and os modules
vi.mock("node:fs", () => {
  const store = new Map<string, string>();
  return {
    existsSync: vi.fn((path: string) => store.has(path) || path.endsWith("conversations")),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn((path: string) => {
      const content = store.get(path);
      if (!content) throw new Error(`ENOENT: ${path}`);
      return content;
    }),
    writeFileSync: vi.fn((path: string, content: string) => {
      store.set(path, content);
    }),
    readdirSync: vi.fn(() => {
      const files: string[] = [];
      for (const key of store.keys()) {
        if (key.endsWith(".json")) {
          const fileName = key.split("/").pop();
          if (fileName) files.push(fileName);
        }
      }
      return files;
    }),
    __store: store,
  };
});

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/tmp/test-home"),
}));

afterEach(async () => {
  vi.clearAllMocks();
  // Clear the in-memory store so tests don't bleed state into each other
  const fsMod = await import("node:fs");
  (fsMod as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("saveConversation", () => {
  it("saves messages and returns metadata", () => {
    const messages: Message[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];

    const meta = saveConversation(messages, "test-id");
    expect(meta.id).toBe("test-id");
    expect(meta.messageCount).toBe(2);
    expect(meta.preview).toBe("Hello");
  });

  it("persists assertion runtime snapshots alongside messages", () => {
    const messages: Message[] = [{ role: "user", content: "Hello" }];
    const runtime = new AssertionRuntime();
    runtime.setCanonicalCore("- assertion is satisfied only with enough evidence");

    saveConversation(messages, "runtime-id", runtime.getSnapshot());
    const loaded = loadConversation("runtime-id");

    expect(loaded?.runtime?.core?.text).toContain("enough evidence");
    expect(loaded?.runtime?.assertions).toHaveLength(1);
  });
});

describe("loadConversation", () => {
  it("returns null for nonexistent conversation", () => {
    const result = loadConversation("nonexistent");
    expect(result).toBeNull();
  });
});

describe("listConversations", () => {
  it("returns an array", () => {
    const result = listConversations();
    expect(Array.isArray(result)).toBe(true);
  });
});
