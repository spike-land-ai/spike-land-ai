import { describe, expect, it, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerAgentCommand } from "./agent";

// Mock dependencies
const mockBuilder = {
  withUri: vi.fn().mockImplementation((uri) => { console.log("withUri", uri); return mockBuilder; }),
  withDatabaseName: vi.fn().mockImplementation((name) => { console.log("withDatabaseName", name); return mockBuilder; }),
  onConnect: vi.fn().mockImplementation((cb) => { console.log("onConnect registered"); return mockBuilder; }),
  onDisconnect: vi.fn().mockReturnThis(),
  onConnectError: vi.fn().mockReturnThis(),
  build: vi.fn().mockImplementation(() => { console.log("build called"); })
};

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: vi.fn().mockResolvedValue({ text: "mock response" })
    }
  }
}));

vi.mock("@spike-land-ai/spacetimedb-platform/dist/module_bindings/index.js", () => ({
  DbConnection: {
    builder: () => mockBuilder
  }
}));

vi.mock("express", () => {
  const mockApp = {
    use: vi.fn(),
    post: vi.fn(),
    listen: vi.fn((port, cb) => cb?.())
  };
  const express: any = () => mockApp;
  express.json = vi.fn(() => (req: any, res: any, next: any) => next());
  return {
    default: express
  };
});

describe("agent command", () => {
  let program: Command;

  beforeEach(() => {
    vi.useFakeTimers();
    program = new Command();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  it("registers the agent command", () => {
    registerAgentCommand(program);
    expect(program.commands.find(c => c.name() === "agent")).toBeDefined();
  });

  it("starts the agent when GEMINI_API_KEY is set", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    registerAgentCommand(program);
    const agentCmd = program.commands.find(c => c.name() === "agent")!;
    
    // Call the action handler manually
    await (agentCmd as any)._actionHandler(["--port", "3005"]);
    
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Starting Spike Agent"));
  });

  it("errors and exits if no API key set", async () => {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    
    registerAgentCommand(program);
    const agentCmd = program.commands.find(c => c.name() === "agent")!;
    
    vi.spyOn(console, "error").mockImplementation(() => {});
    await (agentCmd as any)._actionHandler([{}, []]);
    
    expect(process.exit).toHaveBeenCalledWith(1);
    process.env.GEMINI_API_KEY = origKey;
  });

  it("handles completion POST request", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const express = await import("express");
    const app = (express.default as any)();
    
    registerAgentCommand(program);
    const agentCmd = program.commands.find(c => c.name() === "agent")!;
    await (agentCmd as any)._actionHandler([{ port: "3005" }, []]);

    const postCall = app.post.mock.calls.find((c: any) => c[0] === "/completion");
    expect(postCall).toBeDefined();
    
    const handler = postCall[1];
    const req = { body: { prefix: "const x =" } };
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ completion: "mock response" });
  });

  it("initSpacetimeDB connects and sets up listeners", async () => {
    const { initSpacetimeDB } = await import("./agent");
    initSpacetimeDB("ws://test", "mod");
    expect(mockBuilder.withUri).toHaveBeenCalledWith("ws://test");
  });

  it("handleSessionUpdate handles various session states", async () => {
    const { handleSessionUpdate, ai } = await import("./agent");
    const generateSpy = vi.spyOn(ai.models, "generateContent");
    
    // User message
    await handleSessionUpdate({
      codeSpace: "s1",
      messagesJson: JSON.stringify([{ role: "user", content: "hi" }])
    });
    expect(generateSpy).toHaveBeenCalled();

    // Assistant last - should skip
    generateSpy.mockClear();
    await handleSessionUpdate({
      codeSpace: "s2",
      messagesJson: JSON.stringify([{ role: "assistant", content: "hi" }])
    });
    expect(generateSpy).not.toHaveBeenCalled();

    // Empty messages - should skip
    await handleSessionUpdate({
      codeSpace: "s3",
      messagesJson: "[]"
    });
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it("initSpacetimeDB handles connection error", async () => {
    mockBuilder.onConnectError.mockImplementation((cb: any) => {
      cb({}, new Error("fail"));
      return mockBuilder;
    });
    const { initSpacetimeDB } = await import("./agent");
    initSpacetimeDB("ws://test", "mod");
    expect(mockBuilder.onConnectError).toHaveBeenCalled();
  });

  it("initSpacetimeDB handles disconnect", async () => {
    mockBuilder.onDisconnect.mockImplementation((cb: any) => {
      cb();
      return mockBuilder;
    });
    const { initSpacetimeDB } = await import("./agent");
    initSpacetimeDB("ws://test", "mod");
    expect(mockBuilder.onDisconnect).toHaveBeenCalled();
  });
});
