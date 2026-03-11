import { describe, expect, it, vi } from "vitest";
import { AppRegistryImpl } from "../../../../src/cli/spike-cli/core-logic/chat/app-registry.js";
import type { AppInfo } from "../../../../src/cli/spike-cli/core-logic/chat/app-registry.js";
import type { ServerManager } from "../../../../src/cli/spike-cli/core-logic/multiplexer/server-manager.js";

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

describe("AppRegistryImpl", () => {
  describe("constructor", () => {
    it("initializes with provided apps", () => {
      const registry = new AppRegistryImpl(TEST_APPS);
      expect(registry.getAllApps()).toHaveLength(2);
    });

    it("initializes with bundled data when no apps provided", () => {
      const registry = new AppRegistryImpl();
      expect(registry.getAllApps().length).toBeGreaterThan(0);
    });

    it("initializes with empty array", () => {
      const registry = new AppRegistryImpl([]);
      expect(registry.getAllApps()).toHaveLength(0);
    });
  });

  describe("getAppForTool", () => {
    it("returns app for a known tool name", () => {
      const registry = new AppRegistryImpl(TEST_APPS);
      const app = registry.getAppForTool("chess_create_game");
      expect(app).toBeDefined();
      expect(app?.slug).toBe("chess-arena");
    });

    it("returns undefined for unknown tool name", () => {
      const registry = new AppRegistryImpl(TEST_APPS);
      expect(registry.getAppForTool("unknown_tool")).toBeUndefined();
    });

    it("returns correct app for tool belonging to different apps", () => {
      const registry = new AppRegistryImpl(TEST_APPS);
      expect(registry.getAppForTool("run_tests")?.slug).toBe("qa-studio");
      expect(registry.getAppForTool("chess_make_move")?.slug).toBe("chess-arena");
    });
  });

  describe("getApp", () => {
    it("returns app by slug", () => {
      const registry = new AppRegistryImpl(TEST_APPS);
      const app = registry.getApp("chess-arena");
      expect(app).toBeDefined();
      expect(app?.name).toBe("Chess Arena");
    });

    it("returns undefined for unknown slug", () => {
      const registry = new AppRegistryImpl(TEST_APPS);
      expect(registry.getApp("unknown-app")).toBeUndefined();
    });
  });

  describe("getAllApps", () => {
    it("returns all registered apps", () => {
      const registry = new AppRegistryImpl(TEST_APPS);
      const apps = registry.getAllApps();
      expect(apps).toHaveLength(2);
      expect(apps.map((a) => a.slug)).toContain("chess-arena");
      expect(apps.map((a) => a.slug)).toContain("qa-studio");
    });
  });

  describe("bundled registry", () => {
    it("includes chess-arena app", () => {
      const registry = new AppRegistryImpl();
      const app = registry.getApp("chess-arena");
      expect(app).toBeDefined();
      expect(app?.toolNames).toContain("chess_create_game");
    });

    it("maps chess tools correctly", () => {
      const registry = new AppRegistryImpl();
      const app = registry.getAppForTool("chess_make_move");
      expect(app?.slug).toBe("chess-arena");
    });

    it("maps state machine tools correctly", () => {
      const registry = new AppRegistryImpl();
      const app = registry.getAppForTool("sm_create");
      expect(app?.slug).toBe("state-machine");
    });

    it("includes all expected categories", () => {
      const registry = new AppRegistryImpl();
      const categories = new Set(registry.getAllApps().map((a) => a.category));
      expect(categories.has("creative")).toBe(true);
      expect(categories.has("developer")).toBe(true);
      expect(categories.has("communication")).toBe(true);
      expect(categories.has("lifestyle")).toBe(true);
    });
  });

  describe("refreshFromRemote", () => {
    it("updates apps from remote when tool exists", async () => {
      const registry = new AppRegistryImpl([]);
      expect(registry.getAllApps()).toHaveLength(0);

      const remoteApps: AppInfo[] = [
        {
          slug: "new-app",
          name: "New App",
          icon: "Star",
          category: "productivity",
          tagline: "A new app",
          toolNames: ["new_tool"],
        },
      ];

      const manager = {
        getAllTools: vi.fn().mockReturnValue([
          {
            namespacedName: "spike__store_list_apps_with_tools",
            originalName: "store_list_apps_with_tools",
            serverName: "spike",
            description: "List apps",
            inputSchema: { type: "object", properties: {} },
          },
        ]),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: JSON.stringify(remoteApps) }],
          isError: false,
        }),
      } as unknown as ServerManager;

      await registry.refreshFromRemote(manager);

      expect(registry.getAllApps()).toHaveLength(1);
      expect(registry.getApp("new-app")).toBeDefined();
      expect(registry.getAppForTool("new_tool")).toBeDefined();
    });

    it("keeps existing data when remote call fails", async () => {
      const registry = new AppRegistryImpl(TEST_APPS);

      const manager = {
        getAllTools: vi.fn().mockReturnValue([
          {
            namespacedName: "spike__store_list_apps_with_tools",
            originalName: "store_list_apps_with_tools",
            serverName: "spike",
            description: "List apps",
            inputSchema: { type: "object", properties: {} },
          },
        ]),
        callTool: vi.fn().mockRejectedValue(new Error("Network error")),
      } as unknown as ServerManager;

      await registry.refreshFromRemote(manager);

      // Should still have original data
      expect(registry.getAllApps()).toHaveLength(2);
    });

    it("does nothing when tool is not found", async () => {
      const registry = new AppRegistryImpl(TEST_APPS);

      const manager = {
        getAllTools: vi.fn().mockReturnValue([]),
      } as unknown as ServerManager;

      await registry.refreshFromRemote(manager);

      expect(registry.getAllApps()).toHaveLength(2);
    });

    it("does nothing when result is an error", async () => {
      const registry = new AppRegistryImpl(TEST_APPS);

      const manager = {
        getAllTools: vi.fn().mockReturnValue([
          {
            namespacedName: "spike__store_list_apps_with_tools",
            originalName: "store_list_apps_with_tools",
            serverName: "spike",
            description: "List apps",
            inputSchema: { type: "object", properties: {} },
          },
        ]),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Error occurred" }],
          isError: true,
        }),
      } as unknown as ServerManager;

      await registry.refreshFromRemote(manager);

      expect(registry.getAllApps()).toHaveLength(2);
    });

    it("finds tool via namespacedName.endsWith when originalName doesn't match (line 348 false branch)", async () => {
      const registry = new AppRegistryImpl([]);

      const remoteApps: AppInfo[] = [
        {
          slug: "some-app",
          name: "Some App",
          icon: "Star",
          category: "productivity",
          tagline: "Some app",
          toolNames: ["some_tool"],
        },
      ];

      // Tool with a non-matching originalName but namespacedName ends with the target
      const manager = {
        getAllTools: vi.fn().mockReturnValue([
          {
            namespacedName: "spike__store_list_apps_with_tools",
            originalName: "different_original_name", // doesn't match — forces endsWith branch
            serverName: "spike",
            description: "List apps",
            inputSchema: { type: "object", properties: {} },
          },
        ]),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: JSON.stringify(remoteApps) }],
          isError: false,
        }),
      } as unknown as ServerManager;

      await registry.refreshFromRemote(manager);
      expect(registry.getAllApps()).toHaveLength(1);
    });

    it("does nothing when result is empty array (line 359 false branch)", async () => {
      const registry = new AppRegistryImpl(TEST_APPS);

      const manager = {
        getAllTools: vi.fn().mockReturnValue([
          {
            namespacedName: "spike__store_list_apps_with_tools",
            originalName: "store_list_apps_with_tools",
            serverName: "spike",
            description: "List apps",
            inputSchema: { type: "object", properties: {} },
          },
        ]),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "[]" }], // empty array
          isError: false,
        }),
      } as unknown as ServerManager;

      await registry.refreshFromRemote(manager);
      // Should keep original data since empty array → does not update
      expect(registry.getAllApps()).toHaveLength(2);
    });
  });
});
