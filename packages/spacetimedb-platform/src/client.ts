/**
 * SpacetimeDB Platform Client Interface
 *
 * Wraps the SpacetimeDB TypeScript SDK connection lifecycle.
 * Designed for dependency injection — tests can replace with a mock.
 */

import type {
  Agent,
  AgentMessage,
  App,
  AppMessage,
  AppVersion,
  ConnectionState,
  DirectMessage,
  HealthCheck,
  OAuthLink,
  Page,
  PlatformEvent,
  Task,
  ToolEntry,
  ToolUsage,
  User,
  UserToolPreference,
} from "./types.js";

// ─── Client Interface ───

export interface SpacetimePlatformClient {
  // ─── Connection ───

  getState(): ConnectionState;
  connect(uri: string, moduleName: string, token?: string): Promise<ConnectionState>;
  disconnect(): void;

  // ─── Users ───

  registerUser(handle: string, displayName: string, email: string): Promise<void>;
  getUser(identity: string): User | undefined;
  listUsers(onlineOnly?: boolean): User[];
  updateProfile(fields: { displayName?: string; email?: string }): Promise<void>;

  // ─── OAuth ───

  linkOAuth(provider: string, providerAccountId: string): Promise<void>;
  getOAuthLinks(userIdentity: string): OAuthLink[];

  // ─── Tools ───

  searchTools(query?: string, category?: string): ToolEntry[];
  getToolEntry(name: string): ToolEntry | undefined;
  listCategories(): string[];
  enableTool(name: string): Promise<void>;
  disableTool(name: string): Promise<void>;
  recordToolUsage(toolName: string, durationMs: number, success: boolean): Promise<void>;
  getToolUsageStats(toolName?: string): ToolUsage[];

  // ─── User Tool Preferences ───

  getUserToolPreferences(userIdentity: string): UserToolPreference[];

  // ─── Apps ───

  createApp(slug: string, name: string, description: string, r2CodeKey: string): Promise<void>;
  getApp(slugOrId: string | bigint): App | undefined;
  listApps(ownerIdentity?: string): App[];
  updateAppStatus(appId: bigint, status: string): Promise<void>;
  deleteApp(appId: bigint): Promise<void>;
  restoreApp(appId: bigint): Promise<void>;
  createAppVersion(appId: bigint, version: string, codeHash: string, changeDescription: string): Promise<void>;
  listAppVersions(appId: bigint): AppVersion[];
  sendAppMessage(appId: bigint, role: string, content: string): Promise<void>;
  getAppMessages(appId: bigint): AppMessage[];

  // ─── Content ───

  createPage(slug: string, title: string, description: string): Promise<void>;
  getPage(slug: string): Page | undefined;
  updatePage(slug: string, fields: { title?: string; description?: string }): Promise<void>;
  deletePage(slug: string): Promise<void>;
  createBlock(pageId: bigint, blockType: string, contentJson: string, sortOrder: number): Promise<void>;
  updateBlock(blockId: bigint, fields: { contentJson?: string; sortOrder?: number }): Promise<void>;
  deleteBlock(blockId: bigint): Promise<void>;
  reorderBlocks(pageId: bigint, blockIds: bigint[]): Promise<void>;

  // ─── Direct Messages ───

  sendDM(toIdentity: string, content: string): Promise<void>;
  listDMs(withIdentity?: string): DirectMessage[];
  markDMRead(messageId: bigint): Promise<void>;

  // ─── Agents ───

  registerAgent(displayName: string, capabilities: string[]): Promise<void>;
  listAgents(onlineOnly?: boolean): Agent[];
  sendAgentMessage(toAgent: string, content: string): Promise<void>;
  getAgentMessages(onlyUndelivered?: boolean): AgentMessage[];
  markAgentMessageDelivered(messageId: bigint): Promise<void>;

  // ─── Tasks ───

  createTask(description: string, priority?: number, context?: string): Promise<void>;
  listTasks(statusFilter?: string): Task[];
  claimTask(taskId: bigint): Promise<void>;
  completeTask(taskId: bigint): Promise<void>;

  // ─── Analytics ───

  recordEvent(source: string, eventType: string, metadataJson: string, userIdentity?: string): Promise<void>;
  queryEvents(filters: { source?: string; eventType?: string; userIdentity?: string }): PlatformEvent[];
  getHealthStatus(): HealthCheck[];
}
