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
import { registerBugbookFeedbackTools } from "../tools/bugbook-feedback";
import { registerByokTools } from "../tools/byok";

/**
 * Safely call a register function, catching and logging errors.
 * Uses a generic call signature to avoid `as any` on each invocation.
 */
function safeRegister(
  fn: (...args: never[]) => void,
  label: string,
  ...args: unknown[]
): void {
  try {
    (fn as (...a: unknown[]) => void)(...args);
  } catch (err) {
    console.error(`[MCP] Failed to register ${label}:`, err);
  }
}

/**
 * Register all tool modules.
 */
export async function registerAllTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
  env?: ToolRegistrationEnv,
): Promise<void> {
  safeRegister(registerGatewayMetaTools, "registerGatewayMetaTools", registry, userId, db);
  safeRegister(registerAuthTools, "registerAuthTools", registry, userId, db);
  safeRegister(registerWorkspacesTools, "registerWorkspacesTools", registry, userId, db);
  safeRegister(registerBillingTools, "registerBillingTools", registry, userId, db);
  safeRegister(registerVaultTools, "registerVaultTools", registry, userId, db, env?.kv, env?.vaultSecret);
  safeRegister(registerStorageTools, "registerStorageTools", registry, userId, db);
  safeRegister(registerBoxesTools, "registerBoxesTools", registry, userId, db);
  safeRegister(registerRemindersTools, "registerRemindersTools", registry, userId, db);
  safeRegister(registerPermissionsTools, "registerPermissionsTools", registry, userId, db);
  safeRegister(registerMarketplaceTools, "registerMarketplaceTools", registry, userId, db);
  safeRegister(registerBootstrapTools, "registerBootstrapTools", registry, userId, db);
  safeRegister(registerAppsTools, "registerAppsTools", registry, userId, db);
  safeRegister(registerArenaTools, "registerArenaTools", registry, userId, db);
  safeRegister(registerCreateTools, "registerCreateTools", registry, userId, db);
  safeRegister(registerLearnItTools, "registerLearnItTools", registry, userId, db);
  safeRegister(registerSkillStoreTools, "registerSkillStoreTools", registry, userId, db);
  safeRegister(registerToolFactoryTools, "registerToolFactoryTools", registry, userId, db);
  safeRegister(registerMcpRegistryTools, "registerMcpRegistryTools", registry, userId, db);
  safeRegister(registerStoreAppsTools, "registerStoreAppsTools", registry, userId, db);
  safeRegister(registerStoreInstallTools, "registerStoreInstallTools", registry, userId, db);
  safeRegister(registerStoreSearchTools, "registerStoreSearchTools", registry, userId, db);
  safeRegister(registerStoreSkillsTools, "registerStoreSkillsTools", registry, userId, db);
  safeRegister(registerStoreAbTools, "registerStoreAbTools", registry, userId, db);
  safeRegister(registerAgentManagementTools, "registerAgentManagementTools", registry, userId, db);
  safeRegister(registerAgentInboxTools, "registerAgentInboxTools", registry, userId, db);
  safeRegister(registerCapabilitiesTools, "registerCapabilitiesTools", registry, userId, db);
  safeRegister(registerChatTools, "registerChatTools", registry, userId, db);
  safeRegister(registerDirectMessageTools, "registerDirectMessageTools", registry, userId, db);
  safeRegister(registerAiGatewayTools, "registerAiGatewayTools", registry, userId, db);
  safeRegister(registerTtsTools, "registerTtsTools", registry, userId, db);
  safeRegister(registerEmailTools, "registerEmailTools", registry, userId, db);
  safeRegister(registerNewsletterTools, "registerNewsletterTools", registry, userId, db);
  safeRegister(registerNotificationsTools, "registerNotificationsTools", registry, userId, db);
  safeRegister(registerEnvironmentTools, "registerEnvironmentTools", registry, userId, db);
  safeRegister(registerSettingsTools, "registerSettingsTools", registry, userId, db);
  safeRegister(registerBlogTools, "registerBlogTools", registry, userId, db);
  safeRegister(registerBazdmegFaqTools, "registerBazdmegFaqTools", registry, userId, db);
  safeRegister(registerBazdmegTools, "registerBazdmegTools", registry, userId, db);
  safeRegister(registerBazdmegMemoryTools, "registerBazdmegMemoryTools", registry, userId, db);
  safeRegister(registerBazdmegWorkflowTools, "registerBazdmegWorkflowTools", registry, userId, db);
  safeRegister(registerBazdmegTelemetryTools, "registerBazdmegTelemetryTools", registry, userId, db);
  safeRegister(registerBazdmegGatesTools, "registerBazdmegGatesTools", registry, userId, db);
  safeRegister(registerBazdmegSkillSyncTools, "registerBazdmegSkillSyncTools", registry, userId, db);
  safeRegister(registerReactionsTools, "registerReactionsTools", registry, userId, db);
  safeRegister(registerContextArchitectTools, "registerContextArchitectTools", registry, userId, db);
  safeRegister(registerSandboxTools, "registerSandboxTools", registry, userId, db);
  safeRegister(registerOrchestratorTools, "registerOrchestratorTools", registry, userId, db);
  safeRegister(registerLieDetectorTools, "registerLieDetectorTools", registry, userId, db);
  safeRegister(registerReqInterviewTools, "registerReqInterviewTools", registry, userId, db);
  safeRegister(registerCodebaseExplainTools, "registerCodebaseExplainTools", registry, userId, db);
  safeRegister(registerDecisionsTools, "registerDecisionsTools", registry, userId, db);
  safeRegister(registerSwarmTools, "registerSwarmTools", registry, userId, db);
  safeRegister(registerSwarmMonitoringTools, "registerSwarmMonitoringTools", registry, userId, db);
  safeRegister(registerMcpObservabilityTools, "registerMcpObservabilityTools", registry, userId, db);
  safeRegister(registerSentryBridgeTools, "registerSentryBridgeTools", registry, userId, db);
  safeRegister(registerGitHubAdminTools, "registerGitHubAdminTools", registry, userId, db);
  safeRegister(registerGitHubIssueSearchTools, "registerGitHubIssueSearchTools", registry, userId, db);
  safeRegister(registerAuditTools, "registerAuditTools", registry, userId, db);
  safeRegister(registerCrdtTools, "registerCrdtTools", registry, userId, db);
  safeRegister(registerNetsimTools, "registerNetsimTools", registry, userId, db);
  safeRegister(registerCausalityTools, "registerCausalityTools", registry, userId, db);
  safeRegister(registerBftTools, "registerBftTools", registry, userId, db);
  safeRegister(registerSessionTools, "registerSessionTools", registry, userId, db);
  safeRegister(registerCodegenTools, "registerCodegenTools", registry, userId, db);
  safeRegister(registerDiffTools, "registerDiffTools", registry, userId, db);
  safeRegister(registerTestgenTools, "registerTestgenTools", registry, userId, db);
  safeRegister(registerRetroTools, "registerRetroTools", registry, userId, db);
  safeRegister(registerCareerTools, "registerCareerTools", registry, userId, db);
  safeRegister(registerCareerGrowthTools, "registerCareerGrowthTools", registry, userId, db);
  safeRegister(registerEsbuildTools, "registerEsbuildTools", registry, userId, db);
  safeRegister(registerBuildFromGithubTools, "registerBuildFromGithubTools", registry, userId, db);
  safeRegister(registerQuizTools, "registerQuizTools", registry, userId, db, env);
  safeRegister(registerBugbookFeedbackTools, "registerBugbookFeedbackTools", registry, userId, db);
  safeRegister(registerByokTools, "registerByokTools", registry, userId, db, env?.kv, env?.vaultSecret);
}
