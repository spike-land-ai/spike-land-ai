import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We test the manifest structure and conditional logic without mocking
// every individual tool module. The actual register functions are tested
// in their own test files. The mcp-server.test.ts tests that
// registerAllTools is called correctly.

// Hoisted mocks for modules with conditions we need to test
const { mockIsJulesAvailable, mockIsGatewayAvailable } = vi.hoisted(() => ({
  mockIsJulesAvailable: vi.fn().mockReturnValue(false),
  mockIsGatewayAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock("./tools/jules", () => ({
  registerJulesTools: vi.fn(),
  isJulesAvailable: mockIsJulesAvailable,
}));
vi.mock("./tools/gateway", () => ({
  registerGatewayTools: vi.fn(),
  isGatewayAvailable: mockIsGatewayAvailable,
}));

// Mock all in-tree tool modules with no-op register functions.
// vi.mock calls are hoisted, so each must be a static string literal.
vi.mock("./tools/gateway-meta", () => ({ registerGatewayMetaTools: vi.fn() }));
vi.mock("./tools/storage", () => ({ registerStorageTools: vi.fn() }));
vi.mock("./tools/gallery", () => ({ registerGalleryTools: vi.fn() }));
vi.mock("./tools/boxes", () => ({ registerBoxesTools: vi.fn() }));
vi.mock("./tools/jobs", () => ({ registerJobsTools: vi.fn() }));
vi.mock("./tools/reminders", () => ({ registerRemindersTools: vi.fn() }));
vi.mock("./tools/share", () => ({ registerShareTools: vi.fn() }));
vi.mock("./tools/permissions", () => ({ registerPermissionsTools: vi.fn() }));
vi.mock("./tools/image", () => ({ registerImageTools: vi.fn() }));
vi.mock("./tools/vault", () => ({ registerVaultTools: vi.fn() }));
vi.mock("./tools/tool-factory", () => ({ registerToolFactoryTools: vi.fn() }));
vi.mock("./tools/marketplace", () => ({ registerMarketplaceTools: vi.fn() }));
vi.mock("./tools/bootstrap", () => ({ registerBootstrapTools: vi.fn() }));
vi.mock("./tools/apps", () => ({ registerAppsTools: vi.fn() }));
vi.mock("./tools/arena", () => ({ registerArenaTools: vi.fn() }));
vi.mock("./tools/album-images", () => ({ registerAlbumImagesTools: vi.fn() }));
vi.mock(
  "./tools/album-management",
  () => ({ registerAlbumManagementTools: vi.fn() }),
);
vi.mock(
  "./tools/batch-enhance",
  () => ({ registerBatchEnhanceTools: vi.fn() }),
);
vi.mock(
  "./tools/enhancement-jobs",
  () => ({ registerEnhancementJobsTools: vi.fn() }),
);
vi.mock("./tools/create", () => ({ registerCreateTools: vi.fn() }));
vi.mock("./tools/learnit", () => ({ registerLearnItTools: vi.fn() }));
vi.mock("./tools/admin", () => ({ registerAdminTools: vi.fn() }));
vi.mock("./tools/auth", () => ({ registerAuthTools: vi.fn() }));
vi.mock("./tools/skill-store", () => ({ registerSkillStoreTools: vi.fn() }));
vi.mock("./tools/workspaces", () => ({ registerWorkspacesTools: vi.fn() }));
vi.mock(
  "./tools/agent-management",
  () => ({ registerAgentManagementTools: vi.fn() }),
);
vi.mock("./tools/billing", () => ({ registerBillingTools: vi.fn() }));
vi.mock("./tools/pipelines", () => ({ registerPipelinesTools: vi.fn() }));
vi.mock("./tools/pipeline", () => ({ registerPipelineTools: vi.fn() }));
vi.mock("./tools/reports", () => ({ registerReportsTools: vi.fn() }));
vi.mock("./tools/chat", () => ({ registerChatTools: vi.fn() }));
vi.mock("./tools/ai-gateway", () => ({ registerAiGatewayTools: vi.fn() }));
vi.mock("./tools/tts", () => ({ registerTtsTools: vi.fn() }));
vi.mock("./tools/capabilities", () => ({ registerCapabilitiesTools: vi.fn() }));
vi.mock("./tools/bazdmeg-faq", () => ({ registerBazdmegFaqTools: vi.fn() }));
vi.mock("./tools/bazdmeg", () => ({ registerBazdmegTools: vi.fn() }));
vi.mock(
  "./tools/bazdmeg-memory",
  () => ({ registerBazdmegMemoryTools: vi.fn() }),
);
vi.mock(
  "./tools/bazdmeg-workflow",
  () => ({ registerBazdmegWorkflowTools: vi.fn() }),
);
vi.mock(
  "./tools/bazdmeg-telemetry",
  () => ({ registerBazdmegTelemetryTools: vi.fn() }),
);
vi.mock(
  "./tools/bazdmeg-gates",
  () => ({ registerBazdmegGatesTools: vi.fn() }),
);
vi.mock(
  "./tools/bazdmeg-skill-sync",
  () => ({ registerBazdmegSkillSyncTools: vi.fn() }),
);
vi.mock(
  "./tools/context-architect",
  () => ({ registerContextArchitectTools: vi.fn() }),
);
vi.mock("./tools/sandbox", () => ({ registerSandboxTools: vi.fn() }));
vi.mock("./tools/orchestrator", () => ({ registerOrchestratorTools: vi.fn() }));
vi.mock("./tools/lie-detector", () => ({ registerLieDetectorTools: vi.fn() }));
vi.mock(
  "./tools/req-interview",
  () => ({ registerReqInterviewTools: vi.fn() }),
);
vi.mock(
  "./tools/codebase-explain",
  () => ({ registerCodebaseExplainTools: vi.fn() }),
);
vi.mock("./tools/decisions", () => ({ registerDecisionsTools: vi.fn() }));
vi.mock("./tools/dashboard", () => ({ registerDashboardTools: vi.fn() }));
vi.mock(
  "./tools/sentry-bridge",
  () => ({ registerSentryBridgeTools: vi.fn() }),
);
vi.mock("./tools/github-admin", () => ({ registerGitHubAdminTools: vi.fn() }));
vi.mock(
  "./tools/direct-message",
  () => ({ registerDirectMessageTools: vi.fn() }),
);
vi.mock(
  "./tools/github-issue-search",
  () => ({ registerGitHubIssueSearchTools: vi.fn() }),
);
vi.mock("./tools/store-ab", () => ({ registerStoreAbTools: vi.fn() }));
vi.mock("./tools/audit", () => ({ registerAuditTools: vi.fn() }));
vi.mock("./tools/reactions", () => ({ registerReactionsTools: vi.fn() }));
vi.mock("./tools/dev", () => ({ registerDevTools: vi.fn() }));
vi.mock("./tools/store-apps", () => ({ registerStoreAppsTools: vi.fn() }));
vi.mock("./tools/store-install", () => ({ registerStoreInstallTools: vi.fn() }));
vi.mock("./tools/store-search", () => ({ registerStoreSearchTools: vi.fn() }));
vi.mock("./tools/store-skills", () => ({ registerStoreSkillsTools: vi.fn() }));
vi.mock("./tools/esbuild", () => ({ registerEsbuildTools: vi.fn() }));
vi.mock(
  "./tools/build-from-github",
  () => ({ registerBuildFromGithubTools: vi.fn() }),
);
vi.mock("./tools/communication-tools", () => ({
  registerEmailTools: vi.fn(),
  registerNewsletterTools: vi.fn(),
  registerNotificationsTools: vi.fn(),
}));
vi.mock("./tools/configuration-tools", () => ({
  registerEnvironmentTools: vi.fn(),
  registerSettingsTools: vi.fn(),
}));
vi.mock("./tools/planning-tools", () => ({
  architectTools: [],
}));
vi.mock(
  "./tools/mcp-observability",
  () => ({ registerMcpObservabilityTools: vi.fn() }),
);
vi.mock("./tools/agent-inbox", () => ({ registerAgentInboxTools: vi.fn() }));
vi.mock("./tools/crdt", () => ({ registerCrdtTools: vi.fn() }));
vi.mock("./tools/netsim", () => ({ registerNetsimTools: vi.fn() }));
vi.mock("./tools/causality", () => ({ registerCausalityTools: vi.fn() }));
vi.mock("./tools/bft", () => ({ registerBftTools: vi.fn() }));

// Mock array-based tool modules (Distributed Planner/Coder)
vi.mock("./tools/session", () => ({ sessionTools: [] }));
vi.mock("./tools/codegen", () => ({ codegenTools: [] }));
vi.mock("./tools/diff", () => ({ diffTools: [] }));
vi.mock("./tools/testgen", () => ({ testgenTools: [] }));
vi.mock("./tools/security", () => ({ securityTools: [] }));
vi.mock("./tools/retro", () => ({ retroTools: [] }));

// Mock store-apps imports — fromStandalone wraps these into register fns
vi.mock("../../../../packages/store-apps/shared/adapter", () => ({
  fromStandalone: vi.fn((tools: unknown[]) => {
    const fn = vi.fn();
    (fn as unknown as { _tools: unknown[]; })._tools = tools;
    return fn;
  }),
}));

vi.mock("../../../../packages/store-apps/chess-arena/tools", () => ({
  chessArenaTools: [],
}));
vi.mock("../../../../packages/store-apps/tabletop-sim/tools", () => ({
  tabletopSimTools: [],
}));
vi.mock("../../../../packages/store-apps/audio-studio/tools", () => ({
  audioStudioTools: [],
}));
vi.mock("../../../../packages/store-apps/page-builder/tools", () => ({
  pageBuilderTools: [],
}));
vi.mock("../../../../packages/store-apps/content-hub/tools", () => ({
  contentHubTools: [],
}));
vi.mock("../../../../packages/store-apps/mcp-explorer/tools", () => ({
  mcpExplorerTools: [],
}));
vi.mock("../../../../packages/store-apps/codespace/tools", () => ({
  codespaceTools: [],
}));
vi.mock("../../../../packages/store-apps/qa-studio/tools", () => ({
  qaStudioTools: [],
}));
vi.mock("../../../../packages/store-apps/state-machine/tools", () => ({
  stateMachineTools: [],
}));
vi.mock("../../../../packages/store-apps/cleansweep/tools", () => ({
  cleansweepTools: [],
}));
vi.mock("../../../../packages/store-apps/career-navigator/tools", () => ({
  careerNavigatorTools: [],
}));
vi.mock("../../../../packages/store-apps/be-uniq/tools", () => ({
  beUniqTools: [],
}));
vi.mock("../../../../packages/store-apps/ai-orchestrator/tools", () => ({
  aiOrchestratorTools: [],
}));
vi.mock("../../../../packages/store-apps/code-review-agent/tools", () => ({
  codeReviewAgentTools: [],
}));

import { registerAllTools, TOOL_MODULES } from "./tool-manifest";

describe("tool-manifest", () => {
  const userId = "test-user-123";
  const mockRegistry = { register: vi.fn() } as unknown as Parameters<
    typeof registerAllTools
  >[0];

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsJulesAvailable.mockReturnValue(false);
    mockIsGatewayAvailable.mockReturnValue(false);
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("TOOL_MODULES", () => {
    it("should export a non-empty array of tool module entries", () => {
      expect(Array.isArray(TOOL_MODULES)).toBe(true);
      expect(TOOL_MODULES.length).toBeGreaterThan(70);
    });

    it("should have register function on every entry", () => {
      for (const entry of TOOL_MODULES) {
        expect(typeof entry.register).toBe("function");
      }
    });

    it("should have condition as function or undefined on every entry", () => {
      for (const entry of TOOL_MODULES) {
        if (entry.condition !== undefined) {
          expect(typeof entry.condition).toBe("function");
        }
      }
    });

    it("should have exactly 6 conditional entries (jules, gateway, github-admin, github-issue-search, dev, qa-studio)", () => {
      const conditionalEntries = TOOL_MODULES.filter(
        e => e.condition !== undefined,
      );
      expect(conditionalEntries.length).toBe(6);
    });
  });

  describe("registerAllTools", () => {
    it("should call all unconditional register functions", () => {
      // Wrap inline register functions (arrow fns for sessionTools, etc.) in spies
      for (const entry of TOOL_MODULES) {
        if (
          !entry.condition
          && typeof (entry.register as ReturnType<typeof vi.fn>).mock === "undefined"
        ) {
          entry.register = vi.fn(entry.register);
        }
      }

      registerAllTools(mockRegistry, userId);

      const unconditionalEntries = TOOL_MODULES.filter(e => !e.condition);
      for (const entry of unconditionalEntries) {
        expect(entry.register).toHaveBeenCalledWith(mockRegistry, userId);
      }
    });

    it("should skip conditional tools when conditions return false", () => {
      mockIsJulesAvailable.mockReturnValue(false);
      mockIsGatewayAvailable.mockReturnValue(false);
      delete process.env.GH_PAT_TOKEN;

      registerAllTools(mockRegistry, userId);

      const conditionalEntries = TOOL_MODULES.filter(e => e.condition);
      for (const entry of conditionalEntries) {
        expect(entry.register).not.toHaveBeenCalled();
      }
    });

    it("should register jules tools when isJulesAvailable returns true", () => {
      mockIsJulesAvailable.mockReturnValue(true);
      registerAllTools(mockRegistry, userId);

      const conditionalCalled = TOOL_MODULES.filter(
        e =>
          e.condition
          && (e.register as ReturnType<typeof vi.fn>).mock?.calls?.length > 0,
      );
      expect(conditionalCalled.length).toBeGreaterThan(0);
    });

    it("should register gateway tools when isGatewayAvailable returns true", () => {
      mockIsGatewayAvailable.mockReturnValue(true);
      registerAllTools(mockRegistry, userId);

      const conditionalCalled = TOOL_MODULES.filter(
        e =>
          e.condition
          && (e.register as ReturnType<typeof vi.fn>).mock?.calls?.length > 0,
      );
      expect(conditionalCalled.length).toBeGreaterThan(0);
    });

    it("should register github admin tools when GH_PAT_TOKEN is set", () => {
      vi.stubEnv("GH_PAT_TOKEN", "test-gh-token");
      registerAllTools(mockRegistry, userId);

      const conditionalCalled = TOOL_MODULES.filter(
        e =>
          e.condition
          && (e.register as ReturnType<typeof vi.fn>).mock?.calls?.length > 0,
      );
      expect(conditionalCalled.length).toBeGreaterThan(0);
    });

    it("should register dev tools when NODE_ENV is development", () => {
      vi.stubEnv("NODE_ENV", "development");
      registerAllTools(mockRegistry, userId);

      // Dev + qa-studio both have development condition
      const conditionalCalled = TOOL_MODULES.filter(
        e =>
          e.condition
          && (e.register as ReturnType<typeof vi.fn>).mock?.calls?.length > 0,
      );
      expect(conditionalCalled.length).toBeGreaterThanOrEqual(2);
    });

    it("should skip dev tools when NODE_ENV is production", () => {
      vi.stubEnv("NODE_ENV", "production");
      registerAllTools(mockRegistry, userId);

      // Only unconditional tools should be called
      const conditionalCalled = TOOL_MODULES.filter(
        e =>
          e.condition
          && (e.register as ReturnType<typeof vi.fn>).mock?.calls?.length > 0,
      );
      expect(conditionalCalled.length).toBe(0);
    });

    it("should register both jules and gateway when both are available", () => {
      mockIsJulesAvailable.mockReturnValue(true);
      mockIsGatewayAvailable.mockReturnValue(true);
      registerAllTools(mockRegistry, userId);

      const conditionalCalled = TOOL_MODULES.filter(
        e =>
          e.condition
          && (e.register as ReturnType<typeof vi.fn>).mock?.calls?.length > 0,
      );
      expect(conditionalCalled.length).toBeGreaterThanOrEqual(2);
    });

    it("should register all conditional tools when all conditions are met", () => {
      mockIsJulesAvailable.mockReturnValue(true);
      mockIsGatewayAvailable.mockReturnValue(true);
      vi.stubEnv("GH_PAT_TOKEN", "token");
      vi.stubEnv("NODE_ENV", "development");

      registerAllTools(mockRegistry, userId);

      // All 6 conditional entries should be called
      const conditionalEntries = TOOL_MODULES.filter(e => e.condition);
      for (const entry of conditionalEntries) {
        expect(entry.register).toHaveBeenCalledWith(mockRegistry, userId);
      }
    });

    it("should include store-app entries with categories", () => {
      const storeAppCategories = TOOL_MODULES
        .filter(e =>
          e.categories?.some(c =>
            ["chess-game", "audio", "swarm", "review", "tabletop", "blog"].includes(c)
          )
        )
        .flatMap(e => e.categories ?? []);

      expect(storeAppCategories).toContain("chess-game");
      expect(storeAppCategories).toContain("audio");
      expect(storeAppCategories).toContain("swarm");
      expect(storeAppCategories).toContain("review");
      expect(storeAppCategories).toContain("tabletop");
      expect(storeAppCategories).toContain("blog");
    });
  });
});
