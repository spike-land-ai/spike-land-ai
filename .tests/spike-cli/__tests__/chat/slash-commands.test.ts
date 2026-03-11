import { describe, expect, it, vi } from "vitest";
import {
  extractPrefix,
  getVisibleTools,
  getVisibleToolsEnhanced,
  groupToolsByApp,
  groupToolsByPrefix,
  handleSlashCommand,
  isEntryPointTool,
  parseSlashInput,
  trackToolCallForSession,
} from "../../../../src/cli/spike-cli/core-logic/chat/slash-commands.js";
import { SessionState } from "../../../../src/cli/spike-cli/core-logic/chat/session-state.js";
import { AssertionRuntime } from "../../../../src/cli/spike-cli/core-logic/chat/assertion-runtime.js";
import type { SlashCommandContext } from "../../../../src/cli/spike-cli/core-logic/chat/slash-commands.js";
import type {
  NamespacedTool,
  ServerManager,
} from "../../../../src/cli/spike-cli/core-logic/multiplexer/server-manager.js";
import type { ChatClient, Message } from "../../../../src/cli/spike-cli/ai/client.js";
import { AppRegistryImpl } from "../../../../src/cli/spike-cli/core-logic/chat/app-registry.js";
import type { AppInfo } from "../../../../src/cli/spike-cli/core-logic/chat/app-registry.js";

// Helper to create a mock tool
function mockTool(overrides: Partial<NamespacedTool> & { namespacedName: string }): NamespacedTool {
  return {
    originalName: overrides.namespacedName.replace(/^[^_]+__/, ""),
    serverName: "test-server",
    description: "A test tool",
    inputSchema: { type: "object", properties: {} },
    ...overrides,
  };
}

function createMockManager(tools: NamespacedTool[] = []): ServerManager {
  return {
    getAllTools: vi.fn().mockReturnValue(tools),
    getServerNames: vi.fn().mockReturnValue([...new Set(tools.map((t) => t.serverName))]),
    getServerTools: vi.fn().mockImplementation((name: string) =>
      tools
        .filter((t) => t.serverName === name)
        .map((t) => ({
          name: t.namespacedName,
          description: t.description,
        })),
    ),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"id":"game_123"}' }],
      isError: false,
    }),
    closeAll: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServerManager;
}

function createMockClient(): ChatClient {
  return {
    model: "claude-sonnet-4-6",
  } as unknown as ChatClient;
}

const TEST_APPS: AppInfo[] = [
  {
    slug: "chess-arena",
    name: "Chess Arena",
    icon: "Crown",
    category: "communication",
    tagline: "Multiplayer chess with ELO",
    toolNames: ["chess_create_game", "chess_make_move", "chess_list_games"],
  },
  {
    slug: "qa-studio",
    name: "QA Studio",
    icon: "Microscope",
    category: "developer",
    tagline: "Automated QA toolkit",
    toolNames: ["run_tests", "list_tests", "analyze_coverage"],
  },
];

// ---------- parseSlashInput ----------

describe("parseSlashInput", () => {
  it("parses a simple command", () => {
    expect(parseSlashInput("/tools")).toEqual({
      command: "tools",
      argsRaw: "",
    });
  });

  it("parses a command with filter argument", () => {
    expect(parseSlashInput("/tools chess")).toEqual({
      command: "tools",
      argsRaw: "chess",
    });
  });

  it("parses a tool invocation with JSON args", () => {
    const result = parseSlashInput('/chess_create_game {"time_control": "RAPID_10"}');
    expect(result.command).toBe("chess_create_game");
    expect(result.argsRaw).toBe('{"time_control": "RAPID_10"}');
  });

  it("handles command with extra whitespace", () => {
    // parseSlashInput splits on first space, so "/  tools" has empty command + " tools" trimmed
    expect(parseSlashInput("/  tools  ")).toEqual({
      command: "",
      argsRaw: "tools",
    });
  });

  it("parses command without args", () => {
    expect(parseSlashInput("/quit")).toEqual({
      command: "quit",
      argsRaw: "",
    });
  });
});

// ---------- extractPrefix ----------

describe("extractPrefix", () => {
  it("extracts prefix from namespaced tool name", () => {
    expect(extractPrefix("spike__chess_create_game", "spike")).toBe("chess");
  });

  it("extracts prefix from non-namespaced tool name", () => {
    expect(extractPrefix("chess_create_game", "other-server")).toBe("chess");
  });

  it("returns full name if no underscore", () => {
    expect(extractPrefix("spike__snapshot", "spike")).toBe("snapshot");
  });

  it("uses custom separator", () => {
    expect(extractPrefix("spike---chess_create_game", "spike", "---")).toBe("chess");
  });
});

// ---------- groupToolsByPrefix ----------

describe("groupToolsByPrefix", () => {
  it("groups tools by prefix", () => {
    const tools = [
      mockTool({ namespacedName: "s__chess_create_game", serverName: "s" }),
      mockTool({ namespacedName: "s__chess_make_move", serverName: "s" }),
      mockTool({ namespacedName: "s__audio_upload", serverName: "s" }),
    ];

    const groups = groupToolsByPrefix(tools);
    expect(groups.size).toBe(2);
    expect(groups.get("chess")?.tools).toHaveLength(2);
    expect(groups.get("audio")?.tools).toHaveLength(1);
  });

  it("handles tools without namespace prefix", () => {
    const tools = [
      mockTool({ namespacedName: "list_items", serverName: "other" }),
      mockTool({ namespacedName: "list_users", serverName: "other" }),
    ];

    const groups = groupToolsByPrefix(tools);
    expect(groups.get("list")?.tools).toHaveLength(2);
  });
});

// ---------- isEntryPointTool ----------

describe("isEntryPointTool", () => {
  it("marks create tools as entry points", () => {
    const tool = mockTool({
      namespacedName: "s__chess_create_game",
      inputSchema: {
        type: "object",
        properties: { time_control: { type: "string" } },
        required: ["time_control"],
      },
    });
    expect(isEntryPointTool(tool)).toBe(true);
  });

  it("marks list tools as entry points", () => {
    const tool = mockTool({ namespacedName: "s__chess_list_games" });
    expect(isEntryPointTool(tool)).toBe(true);
  });

  it("marks search tools as entry points", () => {
    const tool = mockTool({ namespacedName: "s__apps_search" });
    expect(isEntryPointTool(tool)).toBe(true);
  });

  it("marks zero-required-param tools as entry points", () => {
    const tool = mockTool({
      namespacedName: "s__browser_snapshot",
      inputSchema: { type: "object", properties: {} },
    });
    expect(isEntryPointTool(tool)).toBe(true);
  });

  it("does not mark dependent tools as entry points", () => {
    const tool = mockTool({
      namespacedName: "s__chess_make_move",
      inputSchema: {
        type: "object",
        properties: {
          game_id: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["game_id", "from", "to"],
      },
    });
    expect(isEntryPointTool(tool)).toBe(false);
  });
});

// ---------- getVisibleTools ----------

describe("getVisibleTools", () => {
  const tools = [
    mockTool({
      namespacedName: "s__chess_create_game",
      serverName: "s",
      inputSchema: {
        type: "object",
        properties: { time_control: { type: "string", default: "BLITZ_5" } },
      },
    }),
    mockTool({
      namespacedName: "s__chess_list_games",
      serverName: "s",
    }),
    mockTool({
      namespacedName: "s__chess_make_move",
      serverName: "s",
      inputSchema: {
        type: "object",
        properties: {
          game_id: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["game_id", "from", "to"],
      },
    }),
  ];

  it("hides dependent tools when no create has been called", () => {
    const state = new SessionState();
    const { visible, hidden } = getVisibleTools(tools, state);
    expect(visible).toHaveLength(2); // create + list
    expect(hidden).toBe(1); // make_move
  });

  it("shows dependent tools after create has been called", () => {
    const state = new SessionState();
    state.recordCreate("chess", ["game_123"]);
    const { visible, hidden } = getVisibleTools(tools, state);
    expect(visible).toHaveLength(3);
    expect(hidden).toBe(0);
  });
});

// ---------- SessionState ----------

describe("SessionState", () => {
  it("tracks created IDs by prefix", () => {
    const state = new SessionState();
    expect(state.hasCreated("chess")).toBe(false);

    state.recordCreate("chess", ["game_1"]);
    expect(state.hasCreated("chess")).toBe(true);
    expect(state.getCreatedIds("chess")).toEqual(["game_1"]);
  });

  it("accumulates IDs across multiple creates", () => {
    const state = new SessionState();
    state.recordCreate("chess", ["game_1"]);
    state.recordCreate("chess", ["game_2"]);
    expect(state.getCreatedIds("chess")).toEqual(["game_1", "game_2"]);
  });

  it("returns empty array for unknown prefix", () => {
    const state = new SessionState();
    expect(state.getCreatedIds("unknown")).toEqual([]);
  });
});

// ---------- SessionState enhanced ID tracking ----------

describe("SessionState enhanced ID tracking", () => {
  it("records IDs from JSON results", () => {
    const state = new SessionState();
    state.recordIds('{"game_id":"g123","player_id":"p456"}');
    expect(state.hasId("game_id")).toBe(true);
    expect(state.hasId("player_id")).toBe(true);
    expect(state.getLatestId("game_id")).toBe("g123");
    expect(state.getLatestId("player_id")).toBe("p456");
  });

  it("returns undefined for unknown ID param", () => {
    const state = new SessionState();
    expect(state.getLatestId("game_id")).toBeUndefined();
    expect(state.hasId("game_id")).toBe(false);
  });

  it("tracks multiple IDs for the same key", () => {
    const state = new SessionState();
    state.recordIds('{"game_id":"g1"}');
    state.recordIds('{"game_id":"g2"}');
    expect(state.getLatestId("game_id")).toBe("g2");
  });

  it("ignores non-JSON results", () => {
    const state = new SessionState();
    state.recordIds("not json");
    expect(state.hasId("game_id")).toBe(false);
  });

  it("ignores non-string ID values", () => {
    const state = new SessionState();
    state.recordIds('{"game_id":123}');
    expect(state.hasId("game_id")).toBe(false);
  });

  it("tracks bare id field", () => {
    const state = new SessionState();
    state.recordIds('{"id":"abc"}');
    expect(state.hasId("id")).toBe(true);
    expect(state.getLatestId("id")).toBe("abc");
  });

  it("tracks config tool calls", () => {
    const state = new SessionState();
    expect(state.hasConfigBeenCalled("set_project_root")).toBe(false);
    state.recordConfigCall("set_project_root");
    expect(state.hasConfigBeenCalled("set_project_root")).toBe(true);
  });
});

// ---------- groupToolsByApp ----------

describe("groupToolsByApp", () => {
  it("groups tools by app when registry has matching tools", () => {
    const appRegistry = new AppRegistryImpl(TEST_APPS);
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        originalName: "chess_create_game",
      }),
      mockTool({
        namespacedName: "s__chess_make_move",
        serverName: "s",
        originalName: "chess_make_move",
      }),
      mockTool({
        namespacedName: "s__run_tests",
        serverName: "s",
        originalName: "run_tests",
      }),
    ];

    const groups = groupToolsByApp(tools, appRegistry);
    expect(groups.size).toBe(2);
    expect(groups.get("chess-arena")?.tools).toHaveLength(2);
    expect(groups.get("chess-arena")?.app?.name).toBe("Chess Arena");
    expect(groups.get("qa-studio")?.tools).toHaveLength(1);
    expect(groups.get("qa-studio")?.app?.name).toBe("QA Studio");
  });

  it("falls back to prefix for unmatched tools", () => {
    const appRegistry = new AppRegistryImpl(TEST_APPS);
    const tools = [
      mockTool({
        namespacedName: "pw__browser_snapshot",
        serverName: "pw",
        originalName: "browser_snapshot",
      }),
      mockTool({
        namespacedName: "pw__browser_navigate",
        serverName: "pw",
        originalName: "browser_navigate",
      }),
    ];

    const groups = groupToolsByApp(tools, appRegistry);
    expect(groups.size).toBe(1);
    expect(groups.get("browser")?.app).toBeNull();
    expect(groups.get("browser")?.tools).toHaveLength(2);
  });

  it("mixes app and non-app groups", () => {
    const appRegistry = new AppRegistryImpl(TEST_APPS);
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        originalName: "chess_create_game",
      }),
      mockTool({
        namespacedName: "pw__browser_snapshot",
        serverName: "pw",
        originalName: "browser_snapshot",
      }),
    ];

    const groups = groupToolsByApp(tools, appRegistry);
    expect(groups.size).toBe(2);
    expect(groups.get("chess-arena")?.app).toBeDefined();
    expect(groups.get("browser")?.app).toBeNull();
  });

  it("returns empty map for no tools", () => {
    const appRegistry = new AppRegistryImpl(TEST_APPS);
    const groups = groupToolsByApp([], appRegistry);
    expect(groups.size).toBe(0);
  });
});

// ---------- getVisibleToolsEnhanced ----------

describe("getVisibleToolsEnhanced", () => {
  it("shows tools when ID has been recorded", () => {
    const state = new SessionState();
    state.recordIds('{"game_id":"g123"}');

    const tools = [
      mockTool({
        namespacedName: "s__chess_make_move",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: {
            game_id: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
          },
          required: ["game_id", "from", "to"],
        },
      }),
    ];

    const { visible, hidden } = getVisibleToolsEnhanced(tools, state);
    expect(visible).toHaveLength(1);
    expect(hidden).toBe(0);
  });

  it("hides tools when required ID is missing", () => {
    const state = new SessionState();

    const tools = [
      mockTool({
        namespacedName: "s__chess_make_move",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: { game_id: { type: "string" } },
          required: ["game_id"],
        },
      }),
    ];

    const { visible, hidden } = getVisibleToolsEnhanced(tools, state);
    expect(visible).toHaveLength(0);
    expect(hidden).toBe(1);
  });

  it("hides config-dependent tools before config is called", () => {
    const state = new SessionState();

    const tools = [
      mockTool({
        namespacedName: "s__run_tests",
        serverName: "s",
        originalName: "run_tests",
        inputSchema: {
          type: "object",
          properties: { target: { type: "string" } },
          required: ["target"],
        },
      }),
    ];

    const { visible, hidden } = getVisibleToolsEnhanced(tools, state);
    expect(visible).toHaveLength(0);
    expect(hidden).toBe(1);
  });

  it("shows config-dependent tools after config is called", () => {
    const state = new SessionState();
    state.recordConfigCall("set_project_root");

    const tools = [
      mockTool({
        namespacedName: "s__run_tests",
        serverName: "s",
        originalName: "run_tests",
        inputSchema: {
          type: "object",
          properties: { target: { type: "string" } },
          required: ["target"],
        },
      }),
    ];

    const { visible, hidden } = getVisibleToolsEnhanced(tools, state);
    // After config is called, tool is no longer blocked by config.
    // "target" is a required non-ID param, so it's not a "dependent" tool —
    // it passes through to the else branch and is visible.
    expect(visible).toHaveLength(1);
    expect(hidden).toBe(0);
  });

  it("always shows entry-point tools", () => {
    const state = new SessionState();

    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        inputSchema: { type: "object", properties: {} },
      }),
    ];

    const { visible } = getVisibleToolsEnhanced(tools, state);
    expect(visible).toHaveLength(1);
  });
});

// ---------- handleSlashCommand (built-in) ----------

describe("handleSlashCommand built-in commands", () => {
  it("handles /quit", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const result = await handleSlashCommand("/quit", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });
    expect(result.exit).toBe(true);
  });

  it("handles /exit", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const result = await handleSlashCommand("/exit", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });
    expect(result.exit).toBe(true);
  });

  it("handles /clear", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const result = await handleSlashCommand("/clear", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });
    expect(result.cleared).toBe(true);
    expect(result.output).toContain("Conversation cleared");
  });

  it("handles /model", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const result = await handleSlashCommand("/model", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });
    expect(result.output).toContain("claude-sonnet-4-6");
  });

  it("handles /servers", async () => {
    const tools = [
      mockTool({ namespacedName: "s__tool1", serverName: "s" }),
      mockTool({ namespacedName: "s__tool2", serverName: "s" }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const result = await handleSlashCommand("/servers", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });
    expect(result.output).toContain("s");
    expect(result.output).toContain("2 tools");
  });

  it("handles /tools with no tools", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const result = await handleSlashCommand("/tools", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });
    expect(result.output).toContain("No tools available");
  });

  it("handles /help", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const result = await handleSlashCommand("/help", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });
    expect(result.output).toContain("/tools");
    expect(result.output).toContain("/servers");
    expect(result.output).toContain("/quit");
    expect(result.output).toContain("/apps");
    expect(result.output).toContain("/core");
    expect(result.output).toContain("Direct tool invocation");
  });

  it("handles /core set and /assertions", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const assertionRuntime = new AssertionRuntime();

    const setResult = await handleSlashCommand(
      "/core set - assertion is satisfied only with enough evidence",
      {
        manager,
        client,
        messages: [],
        sessionState: new SessionState(),
        appRegistry: new AppRegistryImpl([]),
        assertionRuntime,
      },
    );

    const assertionsResult = await handleSlashCommand("/assertions", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
      assertionRuntime,
    });

    expect(setResult.output).toContain("Canonical core updated");
    expect(assertionsResult.output).toContain("[unresolved]");
    expect(assertionsResult.output).toContain("enough evidence");
  });
});

// ---------- /apps command ----------

describe("/apps command", () => {
  it("lists registered apps", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const appRegistry = new AppRegistryImpl(TEST_APPS);

    const result = await handleSlashCommand("/apps", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry,
    });

    expect(result.output).toContain("Chess Arena");
    expect(result.output).toContain("chess-arena");
    expect(result.output).toContain("communication");
    expect(result.output).toContain("QA Studio");
    expect(result.output).toContain("developer");
  });

  it("shows message when no registry available", async () => {
    const manager = createMockManager();
    const client = createMockClient();

    const result = await handleSlashCommand("/apps", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
    });

    expect(result.output).toContain("No app registry available");
  });

  it("shows message when registry is empty", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const appRegistry = new AppRegistryImpl([]);

    const result = await handleSlashCommand("/apps", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry,
    });

    expect(result.output).toContain("No apps registered");
  });
});

// ---------- /tools with app grouping ----------

describe("/tools with app grouping", () => {
  it("uses app-based grouping when registry has apps", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        originalName: "chess_create_game",
      }),
      mockTool({
        namespacedName: "s__chess_list_games",
        serverName: "s",
        originalName: "chess_list_games",
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const appRegistry = new AppRegistryImpl(TEST_APPS);

    const result = await handleSlashCommand("/tools", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry,
    });

    expect(result.output).toContain("Chess Arena");
    expect(result.output).toContain("[communication]");
    expect(result.output).toContain("Multiplayer chess with ELO");
  });

  it("falls back to prefix grouping when registry is empty", async () => {
    const tools = [mockTool({ namespacedName: "s__chess_create_game", serverName: "s" })];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const appRegistry = new AppRegistryImpl([]);

    const result = await handleSlashCommand("/tools", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry,
    });

    // Should fall back to prefix-based display
    expect(result.output).toContain("chess");
  });

  it("filters by app name", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        originalName: "chess_create_game",
      }),
      mockTool({
        namespacedName: "s__run_tests",
        serverName: "s",
        originalName: "run_tests",
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const appRegistry = new AppRegistryImpl(TEST_APPS);

    const result = await handleSlashCommand("/tools chess", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry,
    });

    expect(result.output).toContain("Chess Arena");
    expect(result.output).not.toContain("QA Studio");
  });

  it("filters by category", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        originalName: "chess_create_game",
      }),
      mockTool({
        namespacedName: "s__run_tests",
        serverName: "s",
        originalName: "run_tests",
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const appRegistry = new AppRegistryImpl(TEST_APPS);

    const result = await handleSlashCommand("/tools developer", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry,
    });

    expect(result.output).toContain("QA Studio");
    expect(result.output).not.toContain("Chess Arena");
  });
});

// ---------- auto-fill from session state ----------

describe("auto-fill from session state", () => {
  it("auto-fills game_id from session state", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_make_move",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: {
            game_id: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
          },
          required: ["game_id", "from", "to"],
        },
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const sessionState = new SessionState();

    // Simulate a prior result that had game_id
    sessionState.recordIds('{"game_id":"game_abc"}');

    // Call with from and to but NOT game_id
    await handleSlashCommand('/chess_make_move {"from":"e2","to":"e4"}', {
      manager,
      client,
      messages: [],
      sessionState,
      appRegistry: new AppRegistryImpl([]),
    });

    expect(manager.callTool).toHaveBeenCalledWith("s__chess_make_move", {
      game_id: "game_abc",
      from: "e2",
      to: "e4",
    });
  });

  it("does not override user-provided args", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_make_move",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: {
            game_id: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
          },
          required: ["game_id", "from", "to"],
        },
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const sessionState = new SessionState();
    sessionState.recordIds('{"game_id":"old_game"}');

    await handleSlashCommand('/chess_make_move {"game_id":"user_game","from":"e2","to":"e4"}', {
      manager,
      client,
      messages: [],
      sessionState,
      appRegistry: new AppRegistryImpl([]),
    });

    expect(manager.callTool).toHaveBeenCalledWith("s__chess_make_move", {
      game_id: "user_game",
      from: "e2",
      to: "e4",
    });
  });

  it("records IDs from tool results into session state", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        inputSchema: { type: "object", properties: {} },
      }),
    ];
    const manager = createMockManager(tools);
    // Mock returns {"id":"game_123"}
    const client = createMockClient();
    const sessionState = new SessionState();

    await handleSlashCommand("/chess_create_game", {
      manager,
      client,
      messages: [],
      sessionState,
      appRegistry: new AppRegistryImpl([]),
    });

    // The mock returns '{"id":"game_123"}', so "id" should be tracked
    expect(sessionState.hasId("id")).toBe(true);
    expect(sessionState.getLatestId("id")).toBe("game_123");
  });

  it("records assertion evidence and strips metadata during direct tool calls", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__run_tests",
        serverName: "s",
        originalName: "run_tests",
        inputSchema: {
          type: "object",
          properties: {
            filter: { type: "string" },
          },
        },
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const assertionRuntime = new AssertionRuntime();
    assertionRuntime.setCanonicalCore(
      "- workflow result is valid only if supported by sufficient evidence",
    );
    const assertionId = assertionRuntime.getAssertions()[0]?.id;

    await handleSlashCommand(`/run_tests {"filter":"*.ts","__assertion_ids":["${assertionId}"]}`, {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
      assertionRuntime,
    });

    expect(manager.callTool).toHaveBeenCalledWith("s__run_tests", {
      filter: "*.ts",
    });
    expect(assertionRuntime.getAssertions()[0]?.status).toBe("unresolved");
    expect(assertionRuntime.getEvidence(assertionId).length).toBe(1);
  });
});

// ---------- handleSlashCommand (direct tool invocation) ----------

describe("handleSlashCommand direct tool invocation", () => {
  it("invokes tool with defaults when no args provided", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: {
            time_control: { type: "string", default: "BLITZ_5" },
          },
        },
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();

    const result = await handleSlashCommand("/chess_create_game", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(manager.callTool).toHaveBeenCalledWith("s__chess_create_game", {
      time_control: "BLITZ_5",
    });
    expect(result.exit).toBe(false);
  });

  it("merges user args over defaults", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: {
            time_control: { type: "string", default: "BLITZ_5" },
          },
        },
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();

    await handleSlashCommand('/chess_create_game {"time_control": "RAPID_10"}', {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(manager.callTool).toHaveBeenCalledWith("s__chess_create_game", {
      time_control: "RAPID_10",
    });
  });

  it("shows error for missing required params without readline", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_make_move",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: {
            game_id: { type: "string", description: "The game ID" },
            from: { type: "string" },
            to: { type: "string" },
          },
          required: ["game_id", "from", "to"],
        },
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();

    const result = await handleSlashCommand("/chess_make_move", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(result.output).toContain("Missing required parameters");
    expect(result.output).toContain("game_id");
    expect(manager.callTool).not.toHaveBeenCalled();
  });

  it("returns error for invalid JSON args", async () => {
    const tools = [mockTool({ namespacedName: "s__some_tool", serverName: "s" })];
    const manager = createMockManager(tools);
    const client = createMockClient();

    const result = await handleSlashCommand("/some_tool {invalid}", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(result.output).toContain("Invalid JSON");
  });

  it("returns error for non-existent tool", async () => {
    const manager = createMockManager();
    const client = createMockClient();

    const result = await handleSlashCommand("/nonexistent_tool", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(result.output).toContain("No matching tool found");
  });

  it("resolves tool via fuzzy matching", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: {
            time_control: { type: "string", default: "BLITZ_5" },
          },
        },
      }),
      mockTool({
        namespacedName: "s__chess_create_player",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: { display_name: { type: "string" } },
          required: ["display_name"],
        },
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();

    // "chess_create_g" should fuzzy-match "chess_create_game"
    await handleSlashCommand("/chess_create_g", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(manager.callTool).toHaveBeenCalledWith("s__chess_create_game", {
      time_control: "BLITZ_5",
    });
  });

  it("updates session state after create tool call", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: {
            time_control: { type: "string", default: "BLITZ_5" },
          },
        },
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const sessionState = new SessionState();

    await handleSlashCommand("/chess_create_game", {
      manager,
      client,
      messages: [],
      sessionState,
      appRegistry: new AppRegistryImpl([]),
    });

    expect(sessionState.hasCreated("chess")).toBe(true);
  });
});

// ---------- /tools with filter ----------

describe("/tools with prefix filter", () => {
  it("filters tools by prefix", async () => {
    const tools = [
      mockTool({ namespacedName: "s__chess_create_game", serverName: "s" }),
      mockTool({ namespacedName: "s__chess_list_games", serverName: "s" }),
      mockTool({ namespacedName: "s__audio_upload", serverName: "s" }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();

    const result = await handleSlashCommand("/tools chess", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(result.output).toContain("chess_create_game");
    expect(result.output).toContain("chess_list_games");
    expect(result.output).not.toContain("audio_upload");
  });

  it("shows message for unknown prefix", async () => {
    const tools = [mockTool({ namespacedName: "s__chess_create_game", serverName: "s" })];
    const manager = createMockManager(tools);
    const client = createMockClient();

    const result = await handleSlashCommand("/tools xyz", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(result.output).toContain('No tools found for prefix "xyz"');
  });
});

// ---------- trackToolCallForSession ----------

describe("trackToolCallForSession", () => {
  it("tracks create tool calls", () => {
    const tools = [mockTool({ namespacedName: "s__chess_create_game", serverName: "s" })];
    const state = new SessionState();

    trackToolCallForSession("s__chess_create_game", '{"id":"game_42"}', false, tools, state);

    expect(state.hasCreated("chess")).toBe(true);
    expect(state.getCreatedIds("chess")).toContain("game_42");
  });

  it("ignores non-create tool calls", () => {
    const tools = [mockTool({ namespacedName: "s__chess_make_move", serverName: "s" })];
    const state = new SessionState();

    trackToolCallForSession("s__chess_make_move", '{"success":true}', false, tools, state);

    expect(state.hasCreated("chess")).toBe(false);
  });

  it("ignores errored tool calls", () => {
    const tools = [mockTool({ namespacedName: "s__chess_create_game", serverName: "s" })];
    const state = new SessionState();

    trackToolCallForSession("s__chess_create_game", "Error: failed", true, tools, state);

    expect(state.hasCreated("chess")).toBe(false);
  });

  it("records _created when result has no ID", () => {
    const tools = [mockTool({ namespacedName: "s__chess_create_game", serverName: "s" })];
    const state = new SessionState();

    trackToolCallForSession("s__chess_create_game", '{"status":"ok"}', false, tools, state);

    expect(state.hasCreated("chess")).toBe(true);
    expect(state.getCreatedIds("chess")).toContain("_created");
  });

  it("records IDs from tool results via trackToolCallForSession", () => {
    const tools = [mockTool({ namespacedName: "s__chess_create_game", serverName: "s" })];
    const state = new SessionState();

    trackToolCallForSession(
      "s__chess_create_game",
      '{"game_id":"g999","id":"game_42"}',
      false,
      tools,
      state,
    );

    expect(state.hasId("game_id")).toBe(true);
    expect(state.getLatestId("game_id")).toBe("g999");
  });

  it("tracks config tool calls via trackToolCallForSession", () => {
    const tools = [
      mockTool({
        namespacedName: "s__set_project_root",
        serverName: "s",
        originalName: "set_project_root",
      }),
    ];
    const state = new SessionState();

    trackToolCallForSession("s__set_project_root", '{"success":true}', false, tools, state);

    expect(state.hasConfigBeenCalled("set_project_root")).toBe(true);
  });
});

// ---------- readline interactive prompt ----------

describe("handleSlashCommand with readline interface", () => {
  it("prompts for missing params and executes tool when value provided (lines 283-293)", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_make_move",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: {
            game_id: { type: "string" },
            from: { type: "string" },
          },
          required: ["game_id", "from"],
        },
      }),
    ];
    const manager = createMockManager(tools);
    (manager.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      isError: false,
    });
    const client = createMockClient();
    // Mock readline interface
    const mockRl = {
      question: vi.fn(),
    };
    // promptForParam will call rl.question — make it return a value for each param
    let callCount = 0;
    mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
      callCount++;
      callback(callCount === 1 ? "game_abc" : "e2");
    });

    const result = await handleSlashCommand("/chess_make_move", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
      rl: mockRl as unknown as import("node:readline").Interface,
    });

    expect(result.exit).toBe(false);
    expect(manager.callTool).toHaveBeenCalled();
  });

  it("returns Cancelled when promptForParam returns empty string (line 286-291)", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_make_move",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: { game_id: { type: "string" } },
          required: ["game_id"],
        },
      }),
    ];
    const manager = createMockManager(tools);
    const client = createMockClient();
    const mockRl = { question: vi.fn() };
    // promptForParam returns empty string → cancelled
    mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
      callback(""); // empty → cancels
    });

    const result = await handleSlashCommand("/chess_make_move", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
      rl: mockRl as unknown as import("node:readline").Interface,
    });

    expect(result.output).toContain("Cancelled");
    expect(manager.callTool).not.toHaveBeenCalled();
  });
});

// ---------- Additional branch coverage ----------

describe("handleSlashCommand direct tool invocation — additional branches", () => {
  it("records _created when create tool returns result with no extractable IDs (line 332)", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        inputSchema: { type: "object", properties: {} },
      }),
    ];
    // Return result with no id fields so extractIdsFromResult returns []
    const manager = createMockManager(tools);
    (manager.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: [{ type: "text", text: '{"status":"created"}' }],
      isError: false,
    });
    const client = createMockClient();
    const sessionState = new SessionState();

    await handleSlashCommand("/chess_create_game", {
      manager,
      client,
      messages: [],
      sessionState,
      appRegistry: new AppRegistryImpl([]),
    });

    // Should have recorded "_created" since no IDs were extracted
    expect(sessionState.hasCreated("chess")).toBe(true);
    expect(sessionState.getCreatedIds("chess")).toContain("_created");
  });

  it("formats non-JSON result as plain string (line 343)", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__some_tool",
        serverName: "s",
        inputSchema: { type: "object", properties: {} },
      }),
    ];
    const manager = createMockManager(tools);
    (manager.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: [{ type: "text", text: "plain text result, not JSON" }],
      isError: false,
    });
    const client = createMockClient();

    const result = await handleSlashCommand("/some_tool", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(result.output).toContain("plain text result, not JSON");
  });

  it("records config call when invoking a config-prerequisite tool directly (line 321)", async () => {
    const tools = [
      mockTool({
        namespacedName: "s__set_project_root",
        serverName: "s",
        originalName: "set_project_root",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      }),
    ];
    const manager = createMockManager(tools);
    (manager.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: [{ type: "text", text: '{"ok":true}' }],
      isError: false,
    });
    const client = createMockClient();
    const sessionState = new SessionState();

    await handleSlashCommand('/set_project_root {"path":"/some/path"}', {
      manager,
      client,
      messages: [],
      sessionState,
      appRegistry: new AppRegistryImpl([]),
    });

    expect(sessionState.hasConfigBeenCalled("set_project_root")).toBe(true);
  });

  it("resolveToolName returns best match when scores are similar (ambiguous — line 398-399 false branch)", async () => {
    // Two tools with very similar fuzzy scores — score gap < 2x → ambiguous fallback (line 399)
    const tools = [
      mockTool({
        namespacedName: "s__chess_make_move",
        serverName: "s",
        inputSchema: { type: "object", properties: {} },
      }),
      mockTool({
        namespacedName: "s__chess_make_list",
        serverName: "s",
        inputSchema: { type: "object", properties: {} },
      }),
    ];
    const manager = createMockManager(tools);
    (manager.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      isError: false,
    });
    const client = createMockClient();

    // "chess_make" matches both equally — ambiguous → returns first match anyway
    await handleSlashCommand("/chess_make", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    // Should have called one of the two tools (the best fuzzy match)
    expect(manager.callTool).toHaveBeenCalled();
  });

  it("resolveToolName auto-executes best fuzzy match when score gap >= 2x (lines 385-399)", async () => {
    // "chess_create_game" should heavily score above "chess_create_player" when we type "chess_create_ga"
    const tools = [
      mockTool({
        namespacedName: "s__chess_create_game",
        serverName: "s",
        inputSchema: { type: "object", properties: {} },
      }),
      mockTool({
        namespacedName: "s__chess_create_player",
        serverName: "s",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      }),
    ];
    const manager = createMockManager(tools);
    (manager.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      isError: false,
    });
    const client = createMockClient();
    const sessionState = new SessionState();

    // "chess_create_ga" strongly matches "chess_create_game" (exact prefix)
    // but less so "chess_create_player" — triggers the 2x score gap branch
    await handleSlashCommand("/chess_create_ga", {
      manager,
      client,
      messages: [],
      sessionState,
      appRegistry: new AppRegistryImpl([]),
    });

    expect(manager.callTool).toHaveBeenCalledWith("s__chess_create_game", expect.anything());
  });
});

// ---------- /model with argsRaw and default case ----------

describe("handleSlashCommand — /model and default branches", () => {
  it("returns 'No servers connected' when /servers called with no servers (line 148)", async () => {
    const manager = createMockManager(); // no tools, so getServerNames returns []
    (manager.getServerNames as ReturnType<typeof vi.fn>).mockReturnValue([]);
    const client = createMockClient();

    const result = await handleSlashCommand("/servers", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(result.output).toContain("No servers connected");
    expect(result.exit).toBe(false);
  });

  it("returns 'Model is fixed' when /model is called with an argument (line 167)", async () => {
    const manager = createMockManager();
    const client = createMockClient();

    const result = await handleSlashCommand("/model some-other-model", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(result.output).toContain("Model is fixed for this session");
    expect(result.output).toContain("claude-sonnet-4-6");
    expect(result.exit).toBe(false);
  });

  it("falls through to direct tool call for unrecognized commands (line 205 is unreachable dead code)", async () => {
    // The default case in handleBuiltinCommand is unreachable because BUILTIN_COMMANDS
    // exactly mirrors the switch cases. Unknown commands go to handleDirectToolCall instead.
    const manager = createMockManager();
    const client = createMockClient();

    // An unknown command just tries tool resolution and returns "No matching tool found"
    const result = await handleSlashCommand("/totally_unknown_cmd", {
      manager,
      client,
      messages: [],
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    });

    expect(result.output).toContain("No matching tool found");
    expect(result.exit).toBe(false);
  });
});

// ---------- MessageParam type compatibility ----------

describe("SlashCommandContext accepts MessageParam[]", () => {
  it("accepts Anthropic MessageParam[] as messages", async () => {
    const manager = createMockManager();
    const client = createMockClient();
    const messages: Message[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    // This should compile and work without type errors
    const ctx: SlashCommandContext = {
      manager,
      client,
      messages,
      sessionState: new SessionState(),
      appRegistry: new AppRegistryImpl([]),
    };

    const result = await handleSlashCommand("/clear", ctx);
    expect(result.cleared).toBe(true);
    expect(messages.length).toBe(0);
  });
});
