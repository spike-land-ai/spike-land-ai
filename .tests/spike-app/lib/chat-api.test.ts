import { describe, expect, it } from "vitest";
import { resolveChatBase, toWebSocketBase } from "../../../src/frontend/platform-frontend/core-logic/api";

describe("chat api helpers", () => {
  it("disables chat when no production base URL is configured", () => {
    expect(resolveChatBase(false, undefined)).toBe("");
    expect(resolveChatBase(false, "")).toBe("");
  });

  it("preserves configured production chat base URLs", () => {
    expect(resolveChatBase(false, "https://chat.example.com")).toBe("https://chat.example.com");
  });

  it("converts http bases to websocket bases", () => {
    expect(toWebSocketBase("https://chat.example.com")).toBe("wss://chat.example.com");
    expect(toWebSocketBase("http://localhost:8787")).toBe("ws://localhost:8787");
  });
});
