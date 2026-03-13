/**
 * Tool Registration Manifest
 *
 * Complete manifest of all tool modules for spike-land-mcp.
 * Each module is statically imported to ensure optimal bundling
 * via esbuild for Cloudflare Workers.
 */

import type { ToolRegistry } from "../../lazy-imports/registry";
import type { DrizzleDB } from "../../db/db/db-index.ts";

export interface ToolRegistrationEnv {
  kv?: KVNamespace | undefined;
  vaultSecret?: string | undefined;
  mcpInternalSecret?: string | undefined;
  spikeEdge?: Fetcher | undefined;
  spaAssets?: R2Bucket | undefined;
  geminiApiKey?: string | undefined;
  anthropicApiKey?: string | undefined;
  openaiApiKey?: string | undefined;
  elevenLabsApiKey?: string | undefined;
}

// ─── Static Imports ───
import { registerGatewayMetaTools } from "../../db/tools/gateway-meta";
import { registerAuthTools } from "../../db/tools/auth";
import { registerWorkspacesTools } from "../../db/tools/workspaces";
import { registerBillingTools } from "../../db/tools/billing";
import { registerVaultTools } from "../../db/tools/vault";
import { registerStorageTools } from "../tools/storage";
import { registerBoxesTools } from "../tools/boxes";
import { registerRemindersTools } from "../../db/tools/reminders";
import { registerPermissionsTools } from "../../db/tools/permissions";
import { registerMarketplaceTools } from "../../db/tools/marketplace";
import { registerBootstrapTools } from "../../db/tools/bootstrap";
import { registerAppsTools } from "../tools/apps";
import { registerArborTools } from "../tools/arbor";
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
import { registerExperimentEvaluatorTools } from "../tools/store/experiment-evaluator";
import { registerAgentManagementTools } from "../../db/tools/agent-management";
import { registerAgentInboxTools } from "../../db/tools/agent-inbox";
import { registerCapabilitiesTools } from "../../db/tools/capabilities";
import { registerChatTools } from "../tools/chat";
import { registerDirectMessageTools } from "../../db/tools/direct-message";
import { registerAiGatewayTools } from "../tools/ai-gateway";
import { registerBusinessPlanAnalyzerTools } from "../tools/business-plan-analyzer";
import { registerTtsTools } from "../tools/tts";
import { registerEmailTools } from "../tools/communication-tools";
import { registerNewsletterTools } from "../tools/communication-tools";
import { registerNotificationsTools } from "../tools/communication-tools";
import { registerEnvironmentTools } from "../tools/configuration-tools";
import { registerSettingsTools } from "../../db/tools/settings";
import { registerBlogTools } from "../tools/blog";
import { registerBazdmegFaqTools } from "../tools/bazdmeg/faq";
import { registerBazdmegTools } from "../tools/bazdmeg/bazdmeg-index.ts";
import { registerBazdmegMemoryTools } from "../tools/bazdmeg/memory";
import { registerBazdmegWorkflowTools } from "../tools/bazdmeg/workflow";
import { registerBazdmegTelemetryTools } from "../../db/tools/bazdmeg/telemetry";
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
import { registerSwarmTools } from "../../db/tools/swarm";
import { registerSwarmMonitoringTools } from "../../db/tools/swarm-monitoring";
import { registerMcpObservabilityTools } from "../../db/tools/mcp-observability";
import { registerErrorQueryTools } from "../../db/tools/error-query";
import { registerGitHubAdminTools } from "../tools/github-admin";
import { registerGitHubIssueSearchTools } from "../tools/github-issue-search";
import { registerAuditTools } from "../../db/tools/audit";
import { registerCrdtTools } from "../tools/crdt";
import { registerNetsimTools } from "../tools/netsim";
import { registerCachePurgeTools } from "../tools/cache-purge";
import { registerPlatformHealthTools } from "../tools/platform-health";
import { registerCausalityTools } from "../tools/causality";
import { registerBftTools } from "../tools/bft";
import { registerSessionTools } from "../tools/session";
import { registerCodegenTools } from "../tools/codegen";
import { registerDiffTools } from "../tools/diff";
import { registerTestgenTools } from "../tools/testgen";
import { registerRetroTools } from "../tools/retro";
import { registerCareerTools } from "../tools/career/career-index.ts";
import { registerCareerGrowthTools } from "../tools/career/growth";
import { registerEsbuildTools } from "../tools/esbuild";
import { registerBuildFromGithubTools } from "../tools/build-from-github";
import { registerQuizTools } from "../tools/quiz";
import { registerBugbookFeedbackTools } from "../tools/bugbook-feedback";
import { registerByokTools } from "../../db/tools/byok";
import { registerBeUniqTools } from "../tools/persona/beuniq";
import { registerPlanGeneratorTools } from "../../db/tools/persona/plan-generator";
import { registerAuditQuestionnaireTools } from "../../db/tools/persona/audit-questionnaire";

/**
 * Safely invoke a zero-argument thunk, catching and logging errors.
 * Each call site wraps the concrete register call in an arrow function so
 * the helper never needs to forward variadic unknown arguments through a
 * type-erased function reference.
 */
let registrationFailures: string[] = [];

function safeRegister(label: string, thunk: () => void): void {
  try {
    thunk();
  } catch (err) {
    registrationFailures.push(label);
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
): Promise<{ failedCount: number; failedModules: string[] }> {
  registrationFailures = [];
  safeRegister("registerGatewayMetaTools", () =>
    registerGatewayMetaTools(registry, userId, db, env?.kv, env?.spikeEdge, env?.mcpInternalSecret),
  );
  safeRegister("registerAuthTools", () => registerAuthTools(registry, userId, db));
  safeRegister("registerWorkspacesTools", () => registerWorkspacesTools(registry, userId, db));
  safeRegister("registerBillingTools", () =>
    registerBillingTools(registry, userId, db, env?.spikeEdge),
  );
  safeRegister("registerVaultTools", () =>
    registerVaultTools(registry, userId, db, env?.kv, env?.vaultSecret),
  );
  safeRegister("registerStorageTools", () =>
    registerStorageTools(registry, userId, db, env?.spaAssets),
  );
  safeRegister("registerBoxesTools", () => registerBoxesTools(registry, userId, db));
  safeRegister("registerRemindersTools", () => registerRemindersTools(registry, userId, db));
  safeRegister("registerPermissionsTools", () => registerPermissionsTools(registry, userId, db));
  safeRegister("registerMarketplaceTools", () => registerMarketplaceTools(registry, userId, db));
  safeRegister("registerBootstrapTools", () => registerBootstrapTools(registry, userId, db));
  safeRegister("registerAppsTools", () => registerAppsTools(registry, userId, db));
  safeRegister("registerArborTools", () => registerArborTools(registry, userId, db));
  safeRegister("registerArenaTools", () => registerArenaTools(registry, userId, db));
  safeRegister("registerCreateTools", () => registerCreateTools(registry, userId, db));
  safeRegister("registerLearnItTools", () => registerLearnItTools(registry, userId, db));
  safeRegister("registerSkillStoreTools", () => registerSkillStoreTools(registry, userId, db));
  safeRegister("registerToolFactoryTools", () => registerToolFactoryTools(registry, userId, db));
  safeRegister("registerMcpRegistryTools", () => registerMcpRegistryTools(registry, userId, db));
  safeRegister("registerStoreAppsTools", () => registerStoreAppsTools(registry, userId, db));
  safeRegister("registerStoreInstallTools", () => registerStoreInstallTools(registry, userId, db));
  safeRegister("registerStoreSearchTools", () => registerStoreSearchTools(registry, userId, db));
  safeRegister("registerStoreSkillsTools", () => registerStoreSkillsTools(registry, userId, db));
  safeRegister("registerStoreAbTools", () => registerStoreAbTools(registry, userId, db));
  safeRegister("registerExperimentEvaluatorTools", () =>
    registerExperimentEvaluatorTools(registry, userId, db),
  );
  safeRegister("registerAgentManagementTools", () =>
    registerAgentManagementTools(registry, userId, db),
  );
  safeRegister("registerAgentInboxTools", () => registerAgentInboxTools(registry, userId, db));
  safeRegister("registerCapabilitiesTools", () => registerCapabilitiesTools(registry, userId, db));
  safeRegister("registerChatTools", () =>
    registerChatTools(registry, userId, db, {
      ANTHROPIC_API_KEY: env?.anthropicApiKey ?? "",
    }),
  );
  safeRegister("registerDirectMessageTools", () =>
    registerDirectMessageTools(registry, userId, db),
  );
  safeRegister("registerAiGatewayTools", () =>
    registerAiGatewayTools(registry, userId, db, {
      ANTHROPIC_API_KEY: env?.anthropicApiKey ?? "",
      OPENAI_API_KEY: env?.openaiApiKey ?? "",
      GEMINI_API_KEY: env?.geminiApiKey ?? "",
    }),
  );
  safeRegister("registerBusinessPlanAnalyzerTools", () =>
    registerBusinessPlanAnalyzerTools(registry, userId, db, {
      ANTHROPIC_API_KEY: env?.anthropicApiKey ?? "",
    }),
  );
  safeRegister("registerTtsTools", () =>
    registerTtsTools(registry, userId, db, {
      ELEVENLABS_API_KEY: env?.elevenLabsApiKey ?? "",
    }),
  );
  safeRegister("registerEmailTools", () => registerEmailTools(registry, userId, db));
  safeRegister("registerNewsletterTools", () => registerNewsletterTools(registry, userId, db));
  safeRegister("registerNotificationsTools", () =>
    registerNotificationsTools(registry, userId, db),
  );
  safeRegister("registerEnvironmentTools", () => registerEnvironmentTools(registry, userId, db));
  safeRegister("registerSettingsTools", () => registerSettingsTools(registry, userId, db));
  safeRegister("registerBlogTools", () => registerBlogTools(registry, userId, db));
  safeRegister("registerBazdmegFaqTools", () => registerBazdmegFaqTools(registry, userId, db));
  safeRegister("registerBazdmegTools", () => registerBazdmegTools(registry, userId, db));
  safeRegister("registerBazdmegMemoryTools", () =>
    registerBazdmegMemoryTools(registry, userId, db),
  );
  safeRegister("registerBazdmegWorkflowTools", () =>
    registerBazdmegWorkflowTools(registry, userId, db, env),
  );
  safeRegister("registerBazdmegTelemetryTools", () =>
    registerBazdmegTelemetryTools(registry, userId, db),
  );
  safeRegister("registerBazdmegGatesTools", () => registerBazdmegGatesTools(registry, userId, db));
  safeRegister("registerBazdmegSkillSyncTools", () =>
    registerBazdmegSkillSyncTools(registry, userId, db),
  );
  safeRegister("registerReactionsTools", () => registerReactionsTools(registry, userId, db));
  safeRegister("registerContextArchitectTools", () =>
    registerContextArchitectTools(registry, userId, db),
  );
  safeRegister("registerSandboxTools", () => registerSandboxTools(registry, userId, db));
  safeRegister("registerOrchestratorTools", () => registerOrchestratorTools(registry, userId, db));
  safeRegister("registerLieDetectorTools", () => registerLieDetectorTools(registry, userId, db));
  safeRegister("registerReqInterviewTools", () => registerReqInterviewTools(registry, userId, db));
  safeRegister("registerCodebaseExplainTools", () =>
    registerCodebaseExplainTools(registry, userId, db),
  );
  safeRegister("registerDecisionsTools", () => registerDecisionsTools(registry, userId, db));
  safeRegister("registerSwarmTools", () => registerSwarmTools(registry, userId, db));
  safeRegister("registerSwarmMonitoringTools", () =>
    registerSwarmMonitoringTools(registry, userId, db),
  );
  safeRegister("registerMcpObservabilityTools", () =>
    registerMcpObservabilityTools(registry, userId, db),
  );
  safeRegister("registerErrorQueryTools", () => registerErrorQueryTools(registry, userId, db));
  safeRegister("registerGitHubAdminTools", () => registerGitHubAdminTools(registry, userId, db));
  safeRegister("registerGitHubIssueSearchTools", () =>
    registerGitHubIssueSearchTools(registry, userId, db),
  );
  safeRegister("registerAuditTools", () => registerAuditTools(registry, userId, db));
  safeRegister("registerCrdtTools", () => registerCrdtTools(registry, userId, db));
  safeRegister("registerNetsimTools", () => registerNetsimTools(registry, userId, db));
  safeRegister("registerCausalityTools", () => registerCausalityTools(registry, userId, db));
  safeRegister("registerBftTools", () => registerBftTools(registry, userId, db));
  safeRegister("registerSessionTools", () => registerSessionTools(registry, userId, db));
  safeRegister("registerCodegenTools", () => registerCodegenTools(registry, userId, db));
  safeRegister("registerDiffTools", () => registerDiffTools(registry, userId, db));
  safeRegister("registerTestgenTools", () => registerTestgenTools(registry, userId, db));
  safeRegister("registerRetroTools", () => registerRetroTools(registry, userId, db));
  safeRegister("registerCareerTools", () => registerCareerTools(registry, userId, db));
  safeRegister("registerCareerGrowthTools", () => registerCareerGrowthTools(registry, userId, db));
  safeRegister("registerEsbuildTools", () => registerEsbuildTools(registry, userId, db));
  safeRegister("registerBuildFromGithubTools", () =>
    registerBuildFromGithubTools(registry, userId, db),
  );
  safeRegister("registerQuizTools", () => registerQuizTools(registry, userId, db, env));
  safeRegister("registerCachePurgeTools", () =>
    registerCachePurgeTools(registry, userId, db, env?.spikeEdge, env?.mcpInternalSecret),
  );
  safeRegister("registerPlatformHealthTools", () =>
    registerPlatformHealthTools(registry, userId, db, env?.spikeEdge),
  );
  safeRegister("registerBugbookFeedbackTools", () =>
    registerBugbookFeedbackTools(registry, userId, db, env?.spikeEdge, env?.mcpInternalSecret),
  );
  safeRegister("registerByokTools", () =>
    registerByokTools(registry, userId, db, env?.kv, env?.vaultSecret),
  );
  safeRegister("registerBeUniqTools", () => registerBeUniqTools(registry, userId, db));
  safeRegister("registerPlanGeneratorTools", () =>
    registerPlanGeneratorTools(registry, userId, db),
  );
  safeRegister("registerAuditQuestionnaireTools", () =>
    registerAuditQuestionnaireTools(registry, userId, db),
  );

  if (registrationFailures.length > 0) {
    console.warn(
      `[MCP] ${registrationFailures.length} tool module(s) failed to register: ${registrationFailures.join(", ")}`,
    );
  }

  return { failedCount: registrationFailures.length, failedModules: [...registrationFailures] };
}
