/**
 * Tool Registration Manifest
 *
 * Single source of truth for all MCP tool modules.
 * Each entry maps a register function to an optional condition.
 * Adding a new tool = 1 import + 1 array entry.
 *
 * Store apps (chess-arena, cleansweep, etc.) are imported from
 * packages/store-apps/ via the fromStandalone() adapter.
 */

import type { ToolRegistry } from "./tool-registry";

// --- Store apps adapter ---
import { fromStandalone } from "../../../../packages/store-apps/shared/adapter";

// --- Store app tool imports ---
import { chessArenaTools } from "../../../../packages/store-apps/chess-arena/tools";
import { tabletopSimTools } from "../../../../packages/store-apps/tabletop-sim/tools";
import { audioStudioTools } from "../../../../packages/store-apps/audio-studio/tools";
import { pageBuilderTools } from "../../../../packages/store-apps/page-builder/tools";
import { contentHubTools } from "../../../../packages/store-apps/content-hub/tools";
import { mcpExplorerTools } from "../../../../packages/store-apps/mcp-explorer/tools";
import { codespaceTools } from "../../../../packages/store-apps/codespace/tools";
import { qaStudioTools as qaStudioStandaloneTools } from "../../../../packages/store-apps/qa-studio/tools";
import { stateMachineTools as stateMachineStandaloneTools } from "../../../../packages/store-apps/state-machine/tools";
import { cleansweepTools } from "../../../../packages/store-apps/cleansweep/tools";
import { careerNavigatorTools } from "../../../../packages/store-apps/career-navigator/tools";
import { beUniqTools } from "../../../../packages/store-apps/be-uniq/tools";
import { aiOrchestratorTools } from "../../../../packages/store-apps/ai-orchestrator/tools";
import { codeReviewAgentTools } from "../../../../packages/store-apps/code-review-agent/tools";

// --- Gateway meta (always-on) ---
import { registerGatewayMetaTools } from "./tools/gateway-meta";

// --- Core platform tools (in-tree) ---
import { registerStorageTools } from "./tools/storage";
import { registerGalleryTools } from "./tools/gallery";
import {
  registerEmailTools,
  registerNewsletterTools,
  registerNotificationsTools,
} from "./tools/communication-tools";
import {
  registerEnvironmentTools,
  registerSettingsTools,
} from "./tools/configuration-tools";
import { architectTools } from "./tools/planning-tools";
import { registerBoxesTools } from "./tools/boxes";
import { registerJobsTools } from "./tools/jobs";
import { registerRemindersTools } from "./tools/reminders";
import { registerShareTools } from "./tools/share";
import { registerPermissionsTools } from "./tools/permissions";
import { registerImageTools } from "./tools/image";
import { registerVaultTools } from "./tools/vault";
import { registerToolFactoryTools } from "./tools/tool-factory";
import { registerMarketplaceTools } from "./tools/marketplace";
import { registerBootstrapTools } from "./tools/bootstrap";
import { registerAppsTools } from "./tools/apps";
import { registerArenaTools } from "./tools/arena";
import { registerAlbumImagesTools } from "./tools/album-images";
import { registerAlbumManagementTools } from "./tools/album-management";
import { registerBatchEnhanceTools } from "./tools/batch-enhance";
import { registerEnhancementJobsTools } from "./tools/enhancement-jobs";
import { registerCreateTools } from "./tools/create";
import { registerLearnItTools } from "./tools/learnit";
import { registerAdminTools } from "./tools/admin";
import { registerAuthTools } from "./tools/auth";
import { registerSkillStoreTools } from "./tools/skill-store";
import { registerStoreAppsTools } from "./tools/store-apps";
import { registerStoreInstallTools } from "./tools/store-install";
import { registerStoreSearchTools } from "./tools/store-search";
import { registerStoreSkillsTools } from "./tools/store-skills";
import { registerWorkspacesTools } from "./tools/workspaces";
import { registerAgentManagementTools } from "./tools/agent-management";
import { registerBillingTools } from "./tools/billing";
import { registerDirectMessageTools } from "./tools/direct-message";
import { registerAgentInboxTools } from "./tools/agent-inbox";
import { registerPipelinesTools } from "./tools/pipelines";
import { registerPipelineTools } from "./tools/pipeline";
import { registerReportsTools } from "./tools/reports";
import { registerChatTools } from "./tools/chat";
import { registerAiGatewayTools } from "./tools/ai-gateway";
import { registerTtsTools } from "./tools/tts";
import { registerCapabilitiesTools } from "./tools/capabilities";

// --- BAZDMEG tools ---
import { registerBazdmegFaqTools } from "./tools/bazdmeg-faq";
import { registerBazdmegTools } from "./tools/bazdmeg";
import { registerBazdmegMemoryTools } from "./tools/bazdmeg-memory";
import { registerBazdmegWorkflowTools } from "./tools/bazdmeg-workflow";
import { registerBazdmegTelemetryTools } from "./tools/bazdmeg-telemetry";
import { registerBazdmegGatesTools } from "./tools/bazdmeg-gates";
import { registerBazdmegSkillSyncTools } from "./tools/bazdmeg-skill-sync";

// --- Reactive tool graphs ---
import { registerReactionsTools } from "./tools/reactions";

// --- Orchestration tools ---
import { registerContextArchitectTools } from "./tools/context-architect";
import { registerSandboxTools } from "./tools/sandbox";
import { registerOrchestratorTools } from "./tools/orchestrator";
import { registerLieDetectorTools } from "./tools/lie-detector";
import { registerReqInterviewTools } from "./tools/req-interview";
import { registerCodebaseExplainTools } from "./tools/codebase-explain";
import { registerDecisionsTools } from "./tools/decisions";

// --- Dashboard ---
import { registerDashboardTools } from "./tools/dashboard";

// --- MCP Observability ---
import { registerMcpObservabilityTools } from "./tools/mcp-observability";

// --- Conditional: error log bridge ---
import { registerSentryBridgeTools } from "./tools/sentry-bridge";
import { registerGitHubAdminTools } from "./tools/github-admin";
import { registerGitHubIssueSearchTools } from "./tools/github-issue-search";

// --- Conditional: availability checks ---
import { isJulesAvailable, registerJulesTools } from "./tools/jules";
import { isGatewayAvailable, registerGatewayTools } from "./tools/gateway";

// --- Store A/B testing ---
import { registerStoreAbTools } from "./tools/store-ab";

// --- Platform infrastructure ---
import { registerAuditTools } from "./tools/audit";

// --- Distributed Systems Simulators (in-tree) ---
import { registerCrdtTools } from "./tools/crdt";
import { registerNetsimTools } from "./tools/netsim";
import { registerCausalityTools } from "./tools/causality";
import { registerBftTools } from "./tools/bft";
import { sessionTools } from "./tools/session";
import { codegenTools } from "./tools/codegen";
import { diffTools } from "./tools/diff";
import { testgenTools } from "./tools/testgen";
import { securityTools } from "./tools/security";
import { retroTools } from "./tools/retro";

// --- esbuild tools ---
import { registerEsbuildTools } from "./tools/esbuild";
import { registerBuildFromGithubTools } from "./tools/build-from-github";

// --- Dev-only tools ---
import { registerDevTools } from "./tools/dev";

/**
 * A tool module entry in the manifest.
 * `condition` is evaluated at registration time — when it returns false,
 * the module's register function is skipped entirely.
 * `categories` declares which tool categories this module registers,
 * enabling per-app MCP servers to include only relevant modules.
 */
export interface ToolModuleEntry {
  register: (registry: ToolRegistry, userId: string) => void;
  categories?: string[];
  condition?: () => boolean;
}

/**
 * Complete manifest of all tool modules.
 * Order matches the original mcp-server.ts registration order.
 *
 * Store apps use fromStandalone() to adapt StandaloneToolDefinition[]
 * arrays into the register(registry, userId) => void pattern.
 */
export const TOOL_MODULES: ToolModuleEntry[] = [
  // Gateway meta (always-on, 5 tools)
  { register: registerGatewayMetaTools, categories: ["gateway-meta"] },

  // Core platform
  { register: registerStorageTools, categories: ["storage"] },
  { register: registerGalleryTools, categories: ["gallery"] },
  { register: registerBoxesTools, categories: ["boxes"] },
  { register: registerJobsTools, categories: ["jobs"] },
  { register: registerRemindersTools, categories: ["reminders"] },
  { register: registerShareTools, categories: ["share"] },
  { register: registerPermissionsTools, categories: ["permissions"] },
  { register: registerImageTools, categories: ["image"] },
  { register: registerVaultTools, categories: ["vault"] },
  { register: registerToolFactoryTools, categories: ["tools"] },
  { register: registerMarketplaceTools, categories: ["marketplace"] },
  { register: registerBootstrapTools, categories: ["bootstrap"] },
  { register: registerAppsTools, categories: ["apps"] },
  { register: registerArenaTools, categories: ["arena"] },
  { register: registerAlbumImagesTools, categories: ["album-images"] },
  { register: registerAlbumManagementTools, categories: ["album-management"] },
  { register: registerBatchEnhanceTools, categories: ["batch-enhance"] },
  { register: registerEnhancementJobsTools, categories: ["enhancement-jobs"] },
  { register: registerCreateTools, categories: ["create"] },
  { register: registerLearnItTools, categories: ["learnit"] },
  { register: registerAdminTools, categories: ["admin"] },
  { register: registerAuthTools, categories: ["auth"] },
  { register: registerSkillStoreTools, categories: ["skill-store"] },
  { register: registerStoreAppsTools, categories: ["store"] },
  { register: registerStoreInstallTools, categories: ["store-install"] },
  { register: registerStoreSearchTools, categories: ["store-search"] },
  { register: registerStoreSkillsTools, categories: ["store-skills"] },
  { register: registerWorkspacesTools, categories: ["workspaces"] },
  { register: registerAgentManagementTools, categories: ["agents"] },
  { register: registerSettingsTools, categories: ["settings"] },
  { register: registerBillingTools, categories: ["billing"] },
  { register: registerDirectMessageTools, categories: ["direct-message"] },
  { register: registerAgentInboxTools, categories: ["agent-inbox"] },
  { register: registerPipelinesTools, categories: ["pipelines"] },
  { register: registerPipelineTools, categories: ["pipeline"] },
  { register: registerReportsTools, categories: ["reports"] },
  { register: registerChatTools, categories: ["chat"] },
  { register: registerAiGatewayTools, categories: ["ai-gateway"] },
  { register: registerNewsletterTools, categories: ["newsletter"] },
  { register: registerTtsTools, categories: ["tts"] },
  { register: registerCapabilitiesTools, categories: ["capabilities"] },

  // ── Store Apps (from packages/store-apps/) ──

  // Codespace (12 tools)
  {
    register: fromStandalone(codespaceTools),
    categories: ["codespace", "filesystem", "codespace-templates"],
  },

  // State Machine (20 tools)
  {
    register: fromStandalone(stateMachineStandaloneTools),
    categories: ["state-machine", "sm-templates"],
  },

  // MCP Explorer (12 tools)
  { register: fromStandalone(mcpExplorerTools), categories: ["mcp-registry", "mcp-analytics"] },

  // BAZDMEG
  { register: registerBazdmegFaqTools, categories: ["bazdmeg"] },
  { register: registerBazdmegTools, categories: ["bazdmeg"] },
  { register: registerBazdmegMemoryTools, categories: ["bazdmeg"] },
  { register: registerBazdmegWorkflowTools, categories: ["bazdmeg"] },
  { register: registerBazdmegTelemetryTools, categories: ["bazdmeg"] },
  { register: registerBazdmegGatesTools, categories: ["bazdmeg"] },
  { register: registerBazdmegSkillSyncTools, categories: ["bazdmeg"] },

  // Reactive tool graphs
  { register: registerReactionsTools, categories: ["reactions"] },

  // Orchestration
  { register: registerContextArchitectTools, categories: ["orchestration"] },
  { register: registerSandboxTools, categories: ["orchestration"] },
  { register: registerOrchestratorTools, categories: ["orchestrator"] },
  { register: registerLieDetectorTools, categories: ["orchestration"] },
  { register: registerReqInterviewTools, categories: ["orchestration"] },
  { register: registerCodebaseExplainTools, categories: ["orchestration"] },
  { register: registerDecisionsTools, categories: ["orchestration"] },

  // AI Orchestrator (15 tools — swarm + swarm-monitoring)
  { register: fromStandalone(aiOrchestratorTools), categories: ["swarm", "swarm-monitoring"] },

  // Dashboard
  { register: registerDashboardTools, categories: ["dash"] },
  { register: registerEnvironmentTools, categories: ["env"] },

  // MCP Observability
  { register: registerMcpObservabilityTools, categories: ["mcp-observability"] },

  // Conditional: availability checks
  { register: registerJulesTools, condition: isJulesAvailable },
  { register: registerGatewayTools, condition: isGatewayAvailable },

  // Error log bridge (always on)
  { register: registerSentryBridgeTools, categories: ["errors"] },
  {
    register: registerGitHubAdminTools,
    categories: ["github-admin"],
    condition: () => !!process.env.GH_PAT_TOKEN,
  },
  {
    register: registerGitHubIssueSearchTools,
    categories: ["github-admin"],
    condition: () => !!process.env.GH_PAT_TOKEN,
  },

  // Store A/B testing
  { register: registerStoreAbTools, categories: ["store-ab"] },

  // Platform infrastructure
  { register: registerEmailTools, categories: ["email"] },
  { register: registerAuditTools, categories: ["audit"] },
  { register: registerNotificationsTools, categories: ["notifications"] },

  // Page Builder (11 tools — pages, blocks, page-ai, page-review, page-templates)
  {
    register: fromStandalone(pageBuilderTools),
    categories: ["pages", "blocks", "page-ai", "page-review", "page-templates"],
  },

  // beUniq (11 tools — avl-profile, avl-social)
  { register: fromStandalone(beUniqTools), categories: ["avl-profile", "avl-social"] },

  // Chess Arena (26 tools)
  {
    register: fromStandalone(chessArenaTools),
    categories: [
      "chess-game",
      "chess-player",
      "chess-challenge",
      "chess-replay",
      "chess-tournament",
    ],
  },

  // Distributed Systems Simulators (in-tree)
  { register: registerCrdtTools, categories: ["crdt"] },
  { register: registerNetsimTools, categories: ["netsim"] },
  { register: registerCausalityTools, categories: ["causality"] },
  { register: registerBftTools, categories: ["bft"] },

  // CleanSweep (19 tools)
  {
    register: fromStandalone(cleansweepTools),
    categories: [
      "clean-photo",
      "clean-scanner",
      "clean-tasks",
      "clean-streaks",
      "clean-reminders",
      "clean-verify",
      "clean-motivate",
      "clean-rooms",
    ],
  },

  // Distributed Planner/Coder (in-tree)
  {
    register: r =>
      sessionTools.forEach(t => r.register({ ...t, category: "session", tier: "workspace" })),
    categories: ["session"],
  },
  {
    register: r =>
      codegenTools.forEach(t => r.register({ ...t, category: "codegen", tier: "workspace" })),
    categories: ["codegen"],
  },
  {
    register: r =>
      diffTools.forEach(t => r.register({ ...t, category: "diff", tier: "workspace" })),
    categories: ["diff"],
  },
  {
    register: r =>
      testgenTools.forEach(t => r.register({ ...t, category: "testgen", tier: "workspace" })),
    categories: ["testgen"],
  },
  {
    register: r =>
      architectTools.forEach(t => r.register({ ...t, category: "architect", tier: "workspace" })),
    categories: ["architect"],
  },
  {
    register: r =>
      securityTools.forEach(t => r.register({ ...t, category: "security", tier: "workspace" })),
    categories: ["security"],
  },
  {
    register: r =>
      retroTools.forEach(t => r.register({ ...t, category: "retro", tier: "workspace" })),
    categories: ["retro"],
  },

  // Code Review Agent (13 tools — review + review-pr)
  { register: fromStandalone(codeReviewAgentTools), categories: ["review", "review-pr"] },

  // esbuild
  { register: registerEsbuildTools, categories: ["esbuild"] },
  { register: registerBuildFromGithubTools, categories: ["esbuild"] },

  // Tabletop Simulator (13 tools)
  { register: fromStandalone(tabletopSimTools), categories: ["tabletop", "tabletop-state"] },

  // Audio Studio (13 tools)
  { register: fromStandalone(audioStudioTools), categories: ["audio", "audio-effects"] },

  // Content Hub (7 tools — blog, blog-management)
  { register: fromStandalone(contentHubTools), categories: ["blog", "blog-management"] },

  // Career Navigator (10 tools)
  { register: fromStandalone(careerNavigatorTools), categories: ["career", "career-growth"] },

  // QA Studio (15 tools, dev-only)
  {
    register: fromStandalone(qaStudioStandaloneTools),
    categories: ["qa-studio", "qa-performance"],
    condition: () => process.env.NODE_ENV === "development",
  },

  // Dev-only (localhost)
  {
    register: registerDevTools,
    categories: ["dev"],
    condition: () => process.env.NODE_ENV === "development",
  },
];

/**
 * Register all tool modules from the manifest.
 * Evaluates conditions and skips modules that don't match.
 */
export function registerAllTools(
  registry: ToolRegistry,
  userId: string,
): void {
  for (const entry of TOOL_MODULES) {
    if (!entry.condition || entry.condition()) {
      entry.register(registry, userId);
    }
  }
}
