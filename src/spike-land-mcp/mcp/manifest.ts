/**
 * Tool Registration Manifest
 *
 * Complete manifest of all tool modules for spike-land-mcp.
 * Each module is statically imported to ensure optimal bundling
 * via esbuild for Cloudflare Workers.
 */

import type { ToolRegistry } from "./registry";
import type { DrizzleDB } from "../db/index";

export interface ToolRegistrationEnv {
  kv?: KVNamespace;
  vaultSecret?: string;
}

// ─── Static Imports ───
import { registerGatewayMetaTools } from "../tools/gateway-meta";
import { registerAuthTools } from "../tools/auth";
import { registerWorkspacesTools } from "../tools/workspaces";
import { registerBillingTools } from "../tools/billing";
import { registerVaultTools } from "../tools/vault";
import { registerStorageTools } from "../tools/storage";
import { registerBoxesTools } from "../tools/boxes";
import { registerRemindersTools } from "../tools/reminders";
import { registerPermissionsTools } from "../tools/permissions";
import { registerMarketplaceTools } from "../tools/marketplace";
import { registerBootstrapTools } from "../tools/bootstrap";
import { registerAppsTools } from "../tools/apps";
import { registerArenaTools } from "../tools/arena";
import { registerCreateTools } from "../tools/create";
import { registerLearnItTools } from "../tools/learnit";
import { registerSkillStoreTools } from "../tools/skill-store";
import { registerToolFactoryTools } from "../tools/tool-factory";
import { registerMcpRegistryTools } from "../tools/mcp-registry";
import { registerStoreAppsTools } from "../tools/store/apps";
import { registerStoreInstallTools } from "../tools/store/install";
import { registerStoreSearchTools } from "../tools/store/search";
import { registerStoreSkillsTools } from "../tools/store/skills";
import { registerStoreAbTools } from "../tools/store/ab";
import { registerAgentManagementTools } from "../tools/agent-management";
import { registerAgentInboxTools } from "../tools/agent-inbox";
import { registerCapabilitiesTools } from "../tools/capabilities";
import { registerChatTools } from "../tools/chat";
import { registerDirectMessageTools } from "../tools/direct-message";
import { registerAiGatewayTools } from "../tools/ai-gateway";
import { registerTtsTools } from "../tools/tts";
import { registerEmailTools } from "../tools/communication-tools";
import { registerNewsletterTools } from "../tools/communication-tools";
import { registerNotificationsTools } from "../tools/communication-tools";
import { registerEnvironmentTools } from "../tools/configuration-tools";
import { registerSettingsTools } from "../tools/settings";
import { registerBlogTools } from "../tools/blog";
import { registerBazdmegFaqTools } from "../tools/bazdmeg/faq";
import { registerBazdmegTools } from "../tools/bazdmeg/index";
import { registerBazdmegMemoryTools } from "../tools/bazdmeg/memory";
import { registerBazdmegWorkflowTools } from "../tools/bazdmeg/workflow";
import { registerBazdmegTelemetryTools } from "../tools/bazdmeg/telemetry";
import { registerBazdmegGatesTools } from "../tools/bazdmeg/gates";
import { registerBazdmegSkillSyncTools } from "../tools/bazdmeg/skill-sync";
import { registerReactionsTools } from "../tools/reactions";
import { registerContextArchitectTools } from "../tools/context-architect";
import { registerSandboxTools } from "../tools/sandbox";
import { registerOrchestratorTools } from "../tools/orchestrator";
import { registerLieDetectorTools } from "../tools/lie-detector";
import { registerReqInterviewTools } from "../tools/req-interview";
import { registerCodebaseExplainTools } from "../tools/codebase-explain";
import { registerDecisionsTools } from "../tools/decisions";
import { registerSwarmTools } from "../tools/swarm";
import { registerSwarmMonitoringTools } from "../tools/swarm-monitoring";
import { registerMcpObservabilityTools } from "../tools/mcp-observability";
import { registerSentryBridgeTools } from "../tools/sentry-bridge";
import { registerGitHubAdminTools } from "../tools/github-admin";
import { registerGitHubIssueSearchTools } from "../tools/github-issue-search";
import { registerAuditTools } from "../tools/audit";
import { registerCrdtTools } from "../tools/crdt";
import { registerNetsimTools } from "../tools/netsim";
import { registerCausalityTools } from "../tools/causality";
import { registerBftTools } from "../tools/bft";
import { registerSessionTools } from "../tools/session";
import { registerCodegenTools } from "../tools/codegen";
import { registerDiffTools } from "../tools/diff";
import { registerTestgenTools } from "../tools/testgen";
import { registerRetroTools } from "../tools/retro";
import { registerCareerTools } from "../tools/career/index";
import { registerCareerGrowthTools } from "../tools/career/growth";
import { registerEsbuildTools } from "../tools/esbuild";
import { registerBuildFromGithubTools } from "../tools/build-from-github";
import { registerQuizTools } from "../tools/quiz";

/**
 * Register all tool modules.
 */
export async function registerAllTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  env?: ToolRegistrationEnv,
): Promise<void> {
  try {
    (registerGatewayMetaTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerGatewayMetaTools:", err);
  }
  try {
    (registerAuthTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerAuthTools:", err);
  }
  try {
    (registerWorkspacesTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerWorkspacesTools:", err);
  }
  try {
    (registerBillingTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBillingTools:", err);
  }
  try {
    (registerVaultTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerVaultTools:", err);
  }
  try {
    (registerStorageTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerStorageTools:", err);
  }
  try {
    (registerBoxesTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBoxesTools:", err);
  }
  try {
    (registerRemindersTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerRemindersTools:", err);
  }
  try {
    (registerPermissionsTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerPermissionsTools:", err);
  }
  try {
    (registerMarketplaceTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerMarketplaceTools:", err);
  }
  try {
    (registerBootstrapTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBootstrapTools:", err);
  }
  try {
    (registerAppsTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerAppsTools:", err);
  }
  try {
    (registerArenaTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerArenaTools:", err);
  }
  try {
    (registerCreateTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerCreateTools:", err);
  }
  try {
    (registerLearnItTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerLearnItTools:", err);
  }
  try {
    (registerSkillStoreTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerSkillStoreTools:", err);
  }
  try {
    (registerToolFactoryTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerToolFactoryTools:", err);
  }
  try {
    (registerMcpRegistryTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerMcpRegistryTools:", err);
  }
  try {
    (registerStoreAppsTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerStoreAppsTools:", err);
  }
  try {
    (registerStoreInstallTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerStoreInstallTools:", err);
  }
  try {
    (registerStoreSearchTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerStoreSearchTools:", err);
  }
  try {
    (registerStoreSkillsTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerStoreSkillsTools:", err);
  }
  try {
    (registerStoreAbTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerStoreAbTools:", err);
  }
  try {
    (registerAgentManagementTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerAgentManagementTools:", err);
  }
  try {
    (registerAgentInboxTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerAgentInboxTools:", err);
  }
  try {
    (registerCapabilitiesTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerCapabilitiesTools:", err);
  }
  try {
    (registerChatTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerChatTools:", err);
  }
  try {
    (registerDirectMessageTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerDirectMessageTools:", err);
  }
  try {
    (registerAiGatewayTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerAiGatewayTools:", err);
  }
  try {
    (registerTtsTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerTtsTools:", err);
  }
  try {
    (registerEmailTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerEmailTools:", err);
  }
  try {
    (registerNewsletterTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerNewsletterTools:", err);
  }
  try {
    (registerNotificationsTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerNotificationsTools:", err);
  }
  try {
    (registerEnvironmentTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerEnvironmentTools:", err);
  }
  try {
    (registerSettingsTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerSettingsTools:", err);
  }
  try {
    (registerBlogTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBlogTools:", err);
  }
  try {
    (registerBazdmegFaqTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBazdmegFaqTools:", err);
  }
  try {
    (registerBazdmegTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBazdmegTools:", err);
  }
  try {
    (registerBazdmegMemoryTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBazdmegMemoryTools:", err);
  }
  try {
    (registerBazdmegWorkflowTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBazdmegWorkflowTools:", err);
  }
  try {
    (registerBazdmegTelemetryTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBazdmegTelemetryTools:", err);
  }
  try {
    (registerBazdmegGatesTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBazdmegGatesTools:", err);
  }
  try {
    (registerBazdmegSkillSyncTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBazdmegSkillSyncTools:", err);
  }
  try {
    (registerReactionsTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerReactionsTools:", err);
  }
  try {
    (registerContextArchitectTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerContextArchitectTools:", err);
  }
  try {
    (registerSandboxTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerSandboxTools:", err);
  }
  try {
    (registerOrchestratorTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerOrchestratorTools:", err);
  }
  try {
    (registerLieDetectorTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerLieDetectorTools:", err);
  }
  try {
    (registerReqInterviewTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerReqInterviewTools:", err);
  }
  try {
    (registerCodebaseExplainTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerCodebaseExplainTools:", err);
  }
  try {
    (registerDecisionsTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerDecisionsTools:", err);
  }
  try {
    (registerSwarmTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerSwarmTools:", err);
  }
  try {
    (registerSwarmMonitoringTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerSwarmMonitoringTools:", err);
  }
  try {
    (registerMcpObservabilityTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerMcpObservabilityTools:", err);
  }
  try {
    (registerSentryBridgeTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerSentryBridgeTools:", err);
  }
  try {
    (registerGitHubAdminTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerGitHubAdminTools:", err);
  }
  try {
    (registerGitHubIssueSearchTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerGitHubIssueSearchTools:", err);
  }
  try {
    (registerAuditTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerAuditTools:", err);
  }
  try {
    (registerCrdtTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerCrdtTools:", err);
  }
  try {
    (registerNetsimTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerNetsimTools:", err);
  }
  try {
    (registerCausalityTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerCausalityTools:", err);
  }
  try {
    (registerBftTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBftTools:", err);
  }
  try {
    (registerSessionTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerSessionTools:", err);
  }
  try {
    (registerCodegenTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerCodegenTools:", err);
  }
  try {
    (registerDiffTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerDiffTools:", err);
  }
  try {
    (registerTestgenTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerTestgenTools:", err);
  }
  try {
    (registerRetroTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerRetroTools:", err);
  }
  try {
    (registerCareerTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerCareerTools:", err);
  }
  try {
    (registerCareerGrowthTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerCareerGrowthTools:", err);
  }
  try {
    (registerEsbuildTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerEsbuildTools:", err);
  }
  try {
    (registerBuildFromGithubTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerBuildFromGithubTools:", err);
  }
  try {
    (registerQuizTools as any)(registry, userId, db, env?.kv, env?.vaultSecret);
  } catch (err) {
    console.error("[MCP] Failed to register registerQuizTools:", err);
  }
}
