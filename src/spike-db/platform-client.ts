import { SpikeDbClient, ClientTable } from "./client/index.js";
import type { SpikeDbClientOptions } from "./client/index.js";
import { platformDatabase } from "./platform-schema.js";

// ---------------------------------------------------------------------------
// Row types inferred from platform schema
// ---------------------------------------------------------------------------

export interface UserRow {
  identity: string;
  handle: string;
  displayName: string;
  email: string;
  role: string;
  avatarUrl: string;
  online: boolean;
  lastSeen: number;
  createdAt: number;
}

export interface AgentRow {
  identity: string;
  displayName: string;
  capabilities: string[];
  online: boolean;
  lastSeen: number;
}

export interface AgentMessageRow {
  id: number;
  fromAgent: string;
  toAgent: string;
  content: string;
  timestamp: number;
  delivered: boolean;
}

export interface AlbumRow {
  id: number;
  handle: string;
  userIdentity: string;
  name: string;
  description: string | null;
  coverImageId: string | null;
  privacy: string;
  defaultTier: string;
  shareToken: string | null;
  sortOrder: number;
  pipelineId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AlbumImageRow {
  id: number;
  albumId: number;
  imageId: string;
  sortOrder: number;
  addedAt: number;
}

export interface AppRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  ownerIdentity: string;
  status: string;
  r2CodeKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppMessageRow {
  id: number;
  appId: number;
  role: string;
  content: string;
  createdAt: number;
}

export interface AppVersionRow {
  id: number;
  appId: number;
  version: number;
  codeHash: string;
  changeDescription: string;
  createdBy: string;
  createdAt: number;
}

export interface CodeSessionRow {
  codeSpace: string;
  code: string;
  html: string;
  css: string;
  transpiled: string;
  messagesJson: string;
  lastUpdatedBy: string;
  updatedAt: number;
}

export interface CreditsRow {
  userIdentity: string;
  balance: number;
  updatedAt: number;
}

export interface DirectMessageRow {
  id: number;
  fromIdentity: string;
  toIdentity: string;
  content: string;
  readStatus: boolean;
  createdAt: number;
}

export interface EnhancementJobRow {
  id: string;
  imageId: string;
  userIdentity: string;
  tier: string;
  creditsCost: number;
  status: string;
  enhancedUrl: string | null;
  enhancedR2Key: string | null;
  enhancedWidth: number | null;
  enhancedHeight: number | null;
  enhancedSizeBytes: number | null;
  errorMessage: string | null;
  retryCount: number;
  metadataJson: string | null;
  processingStartedAt: number | null;
  processingCompletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface GenerationJobRow {
  id: string;
  userIdentity: string;
  jobType: string;
  tier: string;
  creditsCost: number;
  status: string;
  prompt: string;
  inputImageUrl: string | null;
  outputImageUrl: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  outputSizeBytes: number | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface HealthCheckRow {
  id: number;
  service: string;
  status: string;
  latencyMs: number;
  checkedAt: number;
}

export interface ImageRow {
  id: string;
  userIdentity: string;
  name: string;
  description: string | null;
  originalUrl: string;
  originalR2Key: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  originalFormat: string;
  isPublic: boolean;
  viewCount: number;
  tags: string[];
  shareToken: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface McpTaskRow {
  id: number;
  toolName: string;
  argumentsJson: string;
  requesterIdentity: string;
  providerIdentity: string | null;
  status: string;
  resultJson: string | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface OauthLinkRow {
  id: number;
  userIdentity: string;
  provider: string;
  providerAccountId: string;
  createdAt: number;
}

export interface PageRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PageBlockRow {
  id: number;
  pageId: number;
  blockType: string;
  contentJson: string;
  sortOrder: number;
}

export interface PipelineRow {
  id: string;
  userIdentity: string | null;
  name: string;
  description: string | null;
  visibility: string;
  shareToken: string | null;
  tier: string;
  analysisConfigJson: string | null;
  autoCropConfigJson: string | null;
  promptConfigJson: string | null;
  generationConfigJson: string | null;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlatformEventRow {
  id: number;
  source: string;
  eventType: string;
  metadataJson: string;
  userIdentity: string | null;
  timestamp: number;
}

export interface RegisteredToolRow {
  id: number;
  name: string;
  description: string;
  inputSchema: string;
  providerIdentity: string;
  category: string;
  createdAt: number;
}

export interface SubjectRow {
  id: number;
  userIdentity: string;
  imageId: string;
  label: string;
  subjectType: string;
  description: string | null;
  createdAt: number;
}

export interface ToolUsageRow {
  id: number;
  toolName: string;
  userIdentity: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
}

export interface UserToolPreferenceRow {
  id: number;
  userIdentity: string;
  toolName: string;
  enabled: boolean;
  customConfig: string;
}

// ---------------------------------------------------------------------------
// PlatformClient — typed wrapper around SpikeDbClient
// ---------------------------------------------------------------------------

export class PlatformClient extends SpikeDbClient {
  constructor(options: Omit<SpikeDbClientOptions, "schema">) {
    super({ ...options, schema: platformDatabase });
  }

  // --- Table accessors ---

  get user(): ClientTable<UserRow> {
    return this.table("user");
  }

  get agent(): ClientTable<AgentRow> {
    return this.table("agent");
  }

  get agentMessage(): ClientTable<AgentMessageRow> {
    return this.table("agent_message");
  }

  get album(): ClientTable<AlbumRow> {
    return this.table("album");
  }

  get albumImage(): ClientTable<AlbumImageRow> {
    return this.table("album_image");
  }

  get app(): ClientTable<AppRow> {
    return this.table("app");
  }

  get appMessage(): ClientTable<AppMessageRow> {
    return this.table("app_message");
  }

  get appVersion(): ClientTable<AppVersionRow> {
    return this.table("app_version");
  }

  get codeSession(): ClientTable<CodeSessionRow> {
    return this.table("code_session");
  }

  get credits(): ClientTable<CreditsRow> {
    return this.table("credits");
  }

  get directMessage(): ClientTable<DirectMessageRow> {
    return this.table("direct_message");
  }

  get enhancementJob(): ClientTable<EnhancementJobRow> {
    return this.table("enhancement_job");
  }

  get generationJob(): ClientTable<GenerationJobRow> {
    return this.table("generation_job");
  }

  get healthCheck(): ClientTable<HealthCheckRow> {
    return this.table("health_check");
  }

  get image(): ClientTable<ImageRow> {
    return this.table("image");
  }

  get mcpTask(): ClientTable<McpTaskRow> {
    return this.table("mcp_task");
  }

  get oauthLink(): ClientTable<OauthLinkRow> {
    return this.table("oauth_link");
  }

  get page(): ClientTable<PageRow> {
    return this.table("page");
  }

  get pageBlock(): ClientTable<PageBlockRow> {
    return this.table("page_block");
  }

  get pipeline(): ClientTable<PipelineRow> {
    return this.table("pipeline");
  }

  get platformEvent(): ClientTable<PlatformEventRow> {
    return this.table("platform_event");
  }

  get registeredTool(): ClientTable<RegisteredToolRow> {
    return this.table("registered_tool");
  }

  get subject(): ClientTable<SubjectRow> {
    return this.table("subject");
  }

  get toolUsage(): ClientTable<ToolUsageRow> {
    return this.table("tool_usage");
  }

  get userToolPreference(): ClientTable<UserToolPreferenceRow> {
    return this.table("user_tool_preference");
  }

  // --- Typed reducer methods ---

  async registerUser(handle: string, displayName: string, email: string): Promise<void> {
    return this.callReducer("register_user", handle, displayName, email);
  }

  async updateProfile(displayName: string, email: string): Promise<void> {
    return this.callReducer("update_profile", displayName, email);
  }

  async sendDm(toIdentity: string, content: string): Promise<void> {
    return this.callReducer("send_dm", toIdentity, content);
  }

  async markDmRead(messageId: number): Promise<void> {
    return this.callReducer("mark_dm_read", messageId);
  }

  async registerAgent(displayName: string, capabilities: string[]): Promise<void> {
    return this.callReducer("register_agent", displayName, capabilities);
  }

  async unregisterAgent(): Promise<void> {
    return this.callReducer("unregister_agent");
  }

  async sendAgentMessage(toAgent: string, content: string): Promise<void> {
    return this.callReducer("send_agent_message", toAgent, content);
  }

  async markAgentMessageDelivered(messageId: number): Promise<void> {
    return this.callReducer("mark_agent_message_delivered", messageId);
  }

  async createApp(slug: string, name: string, description: string, r2CodeKey: string): Promise<void> {
    return this.callReducer("create_app", slug, name, description, r2CodeKey);
  }

  async updateApp(appId: number, name: string, description: string): Promise<void> {
    return this.callReducer("update_app", appId, name, description);
  }

  async deleteApp(appId: number): Promise<void> {
    return this.callReducer("delete_app", appId);
  }

  async restoreApp(appId: number): Promise<void> {
    return this.callReducer("restore_app", appId);
  }

  async updateAppStatus(appId: number, status: string): Promise<void> {
    return this.callReducer("update_app_status", appId, status);
  }

  async createPage(slug: string, title: string, description: string): Promise<void> {
    return this.callReducer("create_page", slug, title, description);
  }

  async updatePage(pageId: number, title: string, description: string): Promise<void> {
    return this.callReducer("update_page", pageId, title, description);
  }

  async deletePage(pageId: number): Promise<void> {
    return this.callReducer("delete_page", pageId);
  }

  async sendAppMessage(appId: number, role: string, content: string): Promise<void> {
    return this.callReducer("send_app_message", appId, role, content);
  }

  async registerTool(name: string, description: string, inputSchema: string, category: string): Promise<void> {
    return this.callReducer("register_tool", name, description, inputSchema, category);
  }

  async recordPlatformEvent(source: string, eventType: string, metadataJson: string): Promise<void> {
    return this.callReducer("record_platform_event", source, eventType, metadataJson);
  }

  async recordHealthCheck(service: string, status: string, latencyMs: number): Promise<void> {
    return this.callReducer("record_health_check", service, status, latencyMs);
  }
}
