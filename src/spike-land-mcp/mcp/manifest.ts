/**
 * Tool Registration Manifest
 *
 * Complete manifest of all tool modules for spike-land-mcp.
 * Each module is dynamically imported with try/catch so missing
 * (not-yet-migrated) modules are gracefully skipped.
 *
 * Unlike spike.land which passes (registry, userId), our version
 * passes (registry, userId, db) since Drizzle DB is injected per-request.
 */

import type { ToolRegistry } from "./registry";
import type { DrizzleDB } from "../db/index";

type RegisterFn = (registry: ToolRegistry, userId: string, db: DrizzleDB, kv?: KVNamespace) => void;

async function tryRegister(
  modulePath: string,
  fnName: string,
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  kv?: KVNamespace,
): Promise<void> {
  try {
    const mod: Record<string, unknown> = await import(modulePath);
    const fn = mod[fnName];
    if (typeof fn === "function") {
      (fn as RegisterFn)(registry, userId, db, kv);
    }
  } catch {
    // Module not yet migrated — skip silently
  }
}

/**
 * Tool module entries: [modulePath, registerFunctionName]
 * Order matches spike.land's tool-manifest.ts registration order.
 */
const TOOL_MODULES: Array<[string, string]> = [
  // ─── Gateway meta (always-on) ───
  ["../tools/gateway-meta", "registerGatewayMetaTools"],

  // ─── Core platform ───
  ["../tools/auth", "registerAuthTools"],
  ["../tools/workspaces", "registerWorkspacesTools"],
  ["../tools/billing", "registerBillingTools"],
  ["../tools/vault", "registerVaultTools"],
  ["../tools/storage", "registerStorageTools"],
  ["../tools/boxes", "registerBoxesTools"],
  ["../tools/reminders", "registerRemindersTools"],
  ["../tools/permissions", "registerPermissionsTools"],
  ["../tools/marketplace", "registerMarketplaceTools"],
  ["../tools/bootstrap", "registerBootstrapTools"],
  ["../tools/apps", "registerAppsTools"],
  ["../tools/arena", "registerArenaTools"],
  ["../tools/create", "registerCreateTools"],
  ["../tools/learnit", "registerLearnItTools"],
  ["../tools/skill-store", "registerSkillStoreTools"],
  ["../tools/tool-factory", "registerToolFactoryTools"],
  ["../tools/mcp-registry", "registerMcpRegistryTools"],

  // ─── Store ───
  ["../tools/store/apps", "registerStoreAppsTools"],
  ["../tools/store/install", "registerStoreInstallTools"],
  ["../tools/store/search", "registerStoreSearchTools"],
  ["../tools/store/skills", "registerStoreSkillsTools"],
  ["../tools/store/ab", "registerStoreAbTools"],

  // ─── Agent / Identity ───
  ["../tools/agent-management", "registerAgentManagementTools"],
  ["../tools/agent-inbox", "registerAgentInboxTools"],
  ["../tools/capabilities", "registerCapabilitiesTools"],

  // ─── Communication / AI ───
  ["../tools/chat", "registerChatTools"],
  ["../tools/direct-message", "registerDirectMessageTools"],
  ["../tools/ai-gateway", "registerAiGatewayTools"],
  ["../tools/tts", "registerTtsTools"],
  ["../tools/communication-tools", "registerEmailTools"],
  ["../tools/communication-tools", "registerNewsletterTools"],
  ["../tools/communication-tools", "registerNotificationsTools"],

  // ─── Configuration ───
  ["../tools/configuration-tools", "registerEnvironmentTools"],
  ["../tools/settings", "registerSettingsTools"],

  // ─── Blog / Content ───
  ["../tools/blog", "registerBlogTools"],

  // ─── BAZDMEG ───
  ["../tools/bazdmeg/faq", "registerBazdmegFaqTools"],
  ["../tools/bazdmeg/index", "registerBazdmegTools"],
  ["../tools/bazdmeg/memory", "registerBazdmegMemoryTools"],
  ["../tools/bazdmeg/workflow", "registerBazdmegWorkflowTools"],
  ["../tools/bazdmeg/telemetry", "registerBazdmegTelemetryTools"],
  ["../tools/bazdmeg/gates", "registerBazdmegGatesTools"],
  ["../tools/bazdmeg/skill-sync", "registerBazdmegSkillSyncTools"],

  // ─── Reactive tool graphs ───
  ["../tools/reactions", "registerReactionsTools"],

  // ─── Orchestration ───
  ["../tools/context-architect", "registerContextArchitectTools"],
  ["../tools/sandbox", "registerSandboxTools"],
  ["../tools/orchestrator", "registerOrchestratorTools"],
  ["../tools/lie-detector", "registerLieDetectorTools"],
  ["../tools/req-interview", "registerReqInterviewTools"],
  ["../tools/codebase-explain", "registerCodebaseExplainTools"],
  ["../tools/decisions", "registerDecisionsTools"],

  // ─── Swarm / AI Orchestration ───
  ["../tools/swarm", "registerSwarmTools"],
  ["../tools/swarm-monitoring", "registerSwarmMonitoringTools"],

  // ─── MCP Observability ───
  ["../tools/mcp-observability", "registerMcpObservabilityTools"],

  // ─── Error log / GitHub ───
  ["../tools/sentry-bridge", "registerSentryBridgeTools"],
  ["../tools/github-admin", "registerGitHubAdminTools"],
  ["../tools/github-issue-search", "registerGitHubIssueSearchTools"],

  // ─── Platform infrastructure ───
  ["../tools/audit", "registerAuditTools"],

  // ─── Distributed Systems Simulators ───
  ["../tools/crdt", "registerCrdtTools"],
  ["../tools/netsim", "registerNetsimTools"],
  ["../tools/causality", "registerCausalityTools"],
  ["../tools/bft", "registerBftTools"],

  // ─── Distributed Planner / Coder ───
  ["../tools/session", "registerSessionTools"],
  ["../tools/codegen", "registerCodegenTools"],
  ["../tools/diff", "registerDiffTools"],
  ["../tools/testgen", "registerTestgenTools"],
  ["../tools/retro", "registerRetroTools"],

  // ─── Career ───
  ["../tools/career/index", "registerCareerTools"],
  ["../tools/career/growth", "registerCareerGrowthTools"],

  // ─── esbuild ───
  ["../tools/esbuild", "registerEsbuildTools"],
  ["../tools/build-from-github", "registerBuildFromGithubTools"],

  // ─── Learning Quiz ───
  ["../tools/quiz", "registerQuizTools"],
];

/**
 * Register all tool modules.
 * Modules that haven't been migrated yet will be silently skipped.
 */
export async function registerAllTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  kv?: KVNamespace,
): Promise<void> {
  for (const [modulePath, fnName] of TOOL_MODULES) {
    await tryRegister(modulePath, fnName, registry, userId, db, kv);
  }
}
