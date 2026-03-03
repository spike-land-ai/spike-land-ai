import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockConnectAll,
  mockCloseAll,
  mockDiscoverConfig,
  MockInProcessToolProvider,
} = vi.hoisted(() => {
  const mockConnectAll = vi.fn().mockResolvedValue(undefined);
  const mockCloseAll = vi.fn().mockResolvedValue(undefined);
  const mockDiscoverConfig = vi.fn().mockResolvedValue({ servers: {} });

  class MockInProcessToolProvider {
    static instances: MockInProcessToolProvider[] = [];
    userId: string;
    getAllTools = vi.fn().mockReturnValue([]);
    callTool = vi.fn().mockResolvedValue({ content: [] });
    closeAll = vi.fn().mockResolvedValue(undefined);
    connectAll = vi.fn().mockResolvedValue(undefined);
    getServerNames = vi.fn().mockReturnValue(["in-process"]);

    constructor(userId: string) {
      this.userId = userId;
      MockInProcessToolProvider.instances.push(this);
    }

    static reset() {
      MockInProcessToolProvider.instances = [];
    }
  }

  return { mockConnectAll, mockCloseAll, mockDiscoverConfig, MockInProcessToolProvider };
});

vi.mock("@spike-land-ai/spike-cli", () => {
  class FakeServerManager {
    connectAll = mockConnectAll;
    closeAll = mockCloseAll;
    getAllTools = vi.fn().mockReturnValue([]);
    callTool = vi.fn().mockResolvedValue({ content: [] });
  }
  return {
    ServerManager: FakeServerManager,
    discoverConfig: mockDiscoverConfig,
  };
});

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("./in-process-tool-provider", () => ({
  InProcessToolProvider: MockInProcessToolProvider,
}));

// Import AFTER mocks
const {
  getServerManager,
  removeServerManager,
  closeAllManagers,
  poolSize,
} = await import("./server-manager-pool");

describe("server-manager-pool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockInProcessToolProvider.reset();
    // Default: external multiplexer path (local dev)
    vi.stubEnv("USE_INPROCESS_MCP", "");
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(async () => {
    await closeAllManagers();
    vi.unstubAllEnvs();
  });

  it("creates a new ServerManager for a new user", async () => {
    const manager = await getServerManager("user-1");
    expect(manager).toBeDefined();
    expect(mockDiscoverConfig).toHaveBeenCalledOnce();
    expect(mockConnectAll).toHaveBeenCalledOnce();
    expect(poolSize()).toBe(1);
  });

  it("returns the same manager for the same user", async () => {
    const manager1 = await getServerManager("user-2");
    const manager2 = await getServerManager("user-2");
    expect(manager1).toBe(manager2);
    expect(mockConnectAll).toHaveBeenCalledOnce();
  });

  it("creates separate managers for different users", async () => {
    await getServerManager("user-a");
    await getServerManager("user-b");
    expect(poolSize()).toBe(2);
    expect(mockConnectAll).toHaveBeenCalledTimes(2);
  });

  it("removes a specific user's manager", async () => {
    await getServerManager("user-remove");
    expect(poolSize()).toBe(1);
    await removeServerManager("user-remove");
    expect(poolSize()).toBe(0);
    expect(mockCloseAll).toHaveBeenCalled();
  });

  it("closeAllManagers clears the pool", async () => {
    await getServerManager("user-x");
    await getServerManager("user-y");
    expect(poolSize()).toBe(2);
    await closeAllManagers();
    expect(poolSize()).toBe(0);
  });

  describe("in-process mode", () => {
    it("uses InProcessToolProvider when USE_INPROCESS_MCP=1", async () => {
      vi.stubEnv("USE_INPROCESS_MCP", "1");
      const manager = await getServerManager("docker-user");
      expect(manager).toBeDefined();
      expect(MockInProcessToolProvider.instances).toHaveLength(1);
      expect(MockInProcessToolProvider.instances[0]!.userId).toBe("docker-user");
      // External multiplexer should NOT be called
      expect(mockDiscoverConfig).not.toHaveBeenCalled();
      expect(mockConnectAll).not.toHaveBeenCalled();
    });

    it("uses InProcessToolProvider in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const manager = await getServerManager("prod-user");
      expect(manager).toBeDefined();
      expect(MockInProcessToolProvider.instances).toHaveLength(1);
      expect(MockInProcessToolProvider.instances[0]!.userId).toBe("prod-user");
      expect(mockDiscoverConfig).not.toHaveBeenCalled();
    });

    it("caches in-process provider for same user", async () => {
      vi.stubEnv("USE_INPROCESS_MCP", "1");
      const m1 = await getServerManager("cache-user");
      const m2 = await getServerManager("cache-user");
      expect(m1).toBe(m2);
      expect(MockInProcessToolProvider.instances).toHaveLength(1);
    });
  });

  describe("external fallback", () => {
    it("falls back to InProcessToolProvider when external multiplexer fails", async () => {
      mockDiscoverConfig.mockRejectedValueOnce(
        new Error("Cannot find .mcp.json"),
      );

      const manager = await getServerManager("fallback-user");
      expect(manager).toBeDefined();
      expect(mockDiscoverConfig).toHaveBeenCalledOnce();
      expect(MockInProcessToolProvider.instances).toHaveLength(1);
      expect(MockInProcessToolProvider.instances[0]!.userId).toBe("fallback-user");
    });

    it("falls back to InProcessToolProvider when connectAll fails", async () => {
      mockConnectAll.mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      const manager = await getServerManager("conn-fail-user");
      expect(manager).toBeDefined();
      expect(MockInProcessToolProvider.instances).toHaveLength(1);
      expect(MockInProcessToolProvider.instances[0]!.userId).toBe("conn-fail-user");
    });
  });
});
