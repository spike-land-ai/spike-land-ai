import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  role: text("role").notNull().default("user"), // "user" | "admin" | "super_admin"
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(), // SHA-256 hex of "sk_..." prefix key
    lastUsedAt: integer("last_used_at", { mode: "number" }),
    expiresAt: integer("expires_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("api_keys_user_id_idx").on(t.userId),
    hashIdx: index("api_keys_key_hash_idx").on(t.keyHash),
  }),
);

// ─── OAuth Clients ────────────────────────────────────────────────────────────

export const oauthClients = sqliteTable("oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientSecret: text("client_secret").notNull(),
  redirectUris: text("redirect_uris").notNull().default("[]"), // JSON array
  scope: text("scope").notNull().default("mcp"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

// ─── OAuth Access Tokens ──────────────────────────────────────────────────────

export const oauthAccessTokens = sqliteTable(
  "oauth_access_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => oauthClients.id, {
      onDelete: "cascade",
    }),
    tokenHash: text("token_hash").notNull().unique(), // SHA-256 hex of "mcp_..." token
    scope: text("scope").notNull().default("mcp"),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("oauth_tokens_user_id_idx").on(t.userId),
    hashIdx: index("oauth_tokens_token_hash_idx").on(t.tokenHash),
  }),
);

// ─── Device Auth Codes ────────────────────────────────────────────────────────

export const deviceAuthCodes = sqliteTable(
  "device_auth_codes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    deviceCode: text("device_code").notNull().unique(),
    userCode: text("user_code").notNull().unique(), // 8-char uppercase code shown to user
    scope: text("scope").notNull().default("mcp"),
    clientId: text("client_id"),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    approved: integer("approved", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    deviceCodeIdx: index("device_auth_codes_device_code_idx").on(t.deviceCode),
    userCodeIdx: index("device_auth_codes_user_code_idx").on(t.userCode),
  }),
);

// ─── Workspaces ───────────────────────────────────────────────────────────────

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    plan: text("plan").notNull().default("free"), // "free" | "pro" | "enterprise"
    settings: text("settings").notNull().default("{}"), // JSON
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    ownerIdx: index("workspaces_owner_id_idx").on(t.ownerId),
    slugIdx: index("workspaces_slug_idx").on(t.slug),
  }),
);

// ─── Workspace Members ────────────────────────────────────────────────────────

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // "owner" | "admin" | "member"
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    workspaceIdx: index("workspace_members_workspace_id_idx").on(t.workspaceId),
    userIdx: index("workspace_members_user_id_idx").on(t.userId),
  }),
);

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: text("status").notNull().default("active"), // "active" | "canceled" | "past_due"
    plan: text("plan").notNull().default("free"),
    currentPeriodEnd: integer("current_period_end", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("subscriptions_user_id_idx").on(t.userId),
  }),
);

// ─── Claude Code Agents ───────────────────────────────────────────────────────

export const claudeCodeAgents = sqliteTable(
  "claude_code_agents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    status: text("status").notNull().default("idle"), // "idle" | "running" | "stopped"
    lastActiveAt: integer("last_active_at", { mode: "number" }),
    metadata: text("metadata").notNull().default("{}"), // JSON
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("agents_user_id_idx").on(t.userId),
  }),
);

// ─── Agent Messages ───────────────────────────────────────────────────────────

export const agentMessages = sqliteTable(
  "agent_messages",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => claudeCodeAgents.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant" | "system"
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    agentIdx: index("agent_messages_agent_id_idx").on(t.agentId),
  }),
);

// ─── Permission Requests ──────────────────────────────────────────────────────

export const permissionRequests = sqliteTable(
  "permission_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: text("agent_id").references(() => claudeCodeAgents.id, {
      onDelete: "cascade",
    }),
    permissionType: text("permission_type").notNull(),
    resource: text("resource"),
    status: text("status").notNull().default("pending"), // "pending" | "approved" | "denied"
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("permission_requests_user_id_idx").on(t.userId),
  }),
);

// ─── Vault Secrets ────────────────────────────────────────────────────────────

export const vaultSecrets = sqliteTable(
  "vault_secrets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userKeyIdx: index("vault_secrets_user_key_idx").on(t.userId, t.key),
  }),
);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: text("metadata").notNull().default("{}"), // JSON
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("audit_logs_user_id_idx").on(t.userId),
    actionIdx: index("audit_logs_action_idx").on(t.action),
  }),
);

// ─── Skill Usage Events ───────────────────────────────────────────────────────

export const skillUsageEvents = sqliteTable(
  "skill_usage_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    skillName: text("skill_name").notNull(),
    serverName: text("server_name").notNull().default("spike-land-mcp"),
    category: text("category"),
    outcome: text("outcome").notNull().default("success"), // "success" | "error"
    durationMs: integer("duration_ms"),
    input: text("input").notNull().default("{}"), // JSON
    errorMessage: text("error_message"),
    tokensUsed: integer("tokens_used"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("skill_usage_user_id_idx").on(t.userId),
    skillIdx: index("skill_usage_skill_name_idx").on(t.skillName),
  }),
);

// ─── Tool Call Daily Rollup ─────────────────────────────────────────────────

export const toolCallDaily = sqliteTable(
  "tool_call_daily",
  {
    userId: text("user_id").notNull(),
    toolName: text("tool_name").notNull(),
    serverName: text("server_name").notNull(),
    day: integer("day").notNull(),
    callCount: integer("call_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    totalMs: integer("total_ms").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.toolName, t.serverName, t.day] }),
    userDayIdx: index("idx_tcd_user_day").on(t.userId, t.day),
    toolDayIdx: index("idx_tcd_tool_day").on(t.toolName, t.day),
  }),
);

// ─── Tool User Daily (unique user-tool dedup) ──────────────────────────────

export const toolUserDaily = sqliteTable(
  "tool_user_daily",
  {
    toolName: text("tool_name").notNull(),
    serverName: text("server_name").notNull(),
    userId: text("user_id").notNull(),
    day: integer("day").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.toolName, t.serverName, t.userId, t.day] }),
    toolDayIdx: index("idx_tud_tool_day").on(t.toolName, t.day),
  }),
);

// ─── Direct Messages ──────────────────────────────────────────────────────────

export const directMessages = sqliteTable(
  "direct_messages",
  {
    id: text("id").primaryKey(),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    readAt: integer("read_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    senderIdx: index("direct_messages_sender_id_idx").on(t.senderId),
    recipientIdx: index("direct_messages_recipient_id_idx").on(t.recipientId),
  }),
);

// ─── Reminders ────────────────────────────────────────────────────────────────

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    dueAt: integer("due_at", { mode: "number" }),
    completedAt: integer("completed_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("reminders_user_id_idx").on(t.userId),
  }),
);

// ─── Registered Tools (marketplace) ──────────────────────────────────────────

export const registeredTools = sqliteTable(
  "registered_tools",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    schema: text("schema").notNull().default("{}"), // JSON input schema
    endpoint: text("endpoint"),
    status: text("status").notNull().default("draft"), // "draft" | "published"
    installCount: integer("install_count").notNull().default(0),
    priceCents: integer("price_cents").notNull().default(0),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("registered_tools_user_id_idx").on(t.userId),
    nameIdx: index("registered_tools_name_idx").on(t.name),
  }),
);

// ─── Tool Purchases (marketplace revenue) ───────────────────────────────────

export const toolPurchases = sqliteTable(
  "tool_purchases",
  {
    id: text("id").primaryKey(),
    toolId: text("tool_id").notNull(),
    buyerUserId: text("buyer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerUserId: text("seller_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    platformFeeCents: integer("platform_fee_cents").notNull(),
    sellerEarningsCents: integer("seller_earnings_cents").notNull(),
    status: text("status").notNull().default("completed"),
    createdAt: text("created_at"),
  },
  (t) => ({
    buyerIdx: index("idx_tool_purchases_buyer").on(t.buyerUserId),
    sellerIdx: index("idx_tool_purchases_seller").on(t.sellerUserId),
    toolIdx: index("idx_tool_purchases_tool").on(t.toolId),
  }),
);

// ─── WhatsApp Links ──────────────────────────────────────────────────────────

export const whatsappLinks = sqliteTable(
  "whatsapp_links",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phoneHash: text("phone_hash").notNull(), // SHA-256 of E.164
    verifiedAt: integer("verified_at", { mode: "number" }),
    linkCode: text("link_code"),
    linkCodeExpiresAt: integer("link_code_expires_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    phoneHashIdx: uniqueIndex("whatsapp_links_phone_hash_idx").on(t.phoneHash),
    userIdx: index("whatsapp_links_user_id_idx").on(t.userId),
  }),
);

// ─── User API Key Vault ──────────────────────────────────────────────────────

export const userApiKeyVault = sqliteTable(
  "user_api_key_vault",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "anthropic" | "openai" | "google"
    encryptedKey: text("encrypted_key").notNull(), // AES-GCM envelope
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userProviderIdx: uniqueIndex("user_api_key_vault_user_provider_idx").on(t.userId, t.provider),
  }),
);

// ─── Access Grants ───────────────────────────────────────────────────────────

export const accessGrants = sqliteTable(
  "access_grants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    grantType: text("grant_type").notNull(), // "bug_bounty" | "referral" | "admin"
    tier: text("tier").notNull(), // "pro" | "business"
    reason: text("reason").notNull(),
    referenceId: text("reference_id"),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("access_grants_user_id_idx").on(t.userId),
    userExpiresIdx: index("access_grants_user_expires_idx").on(t.userId, t.expiresAt),
  }),
);

// ─── WhatsApp Message Log ────────────────────────────────────────────────────

export const whatsappMessageLog = sqliteTable(
  "whatsapp_message_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    phoneHash: text("phone_hash").notNull(),
    direction: text("direction").notNull(), // "inbound" | "outbound"
    command: text("command"),
    toolName: text("tool_name"),
    status: text("status").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("whatsapp_message_log_user_id_idx").on(t.userId),
    phoneHashIdx: index("whatsapp_message_log_phone_hash_idx").on(t.phoneHash),
  }),
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  oauthAccessTokens: many(oauthAccessTokens),
  workspaces: many(workspaces),
  workspaceMembers: many(workspaceMembers),
  agents: many(claudeCodeAgents),
  permissionRequests: many(permissionRequests),
  vaultSecrets: many(vaultSecrets),
  auditLogs: many(auditLogs),
  skillUsageEvents: many(skillUsageEvents),
  sentMessages: many(directMessages, { relationName: "sender" }),
  receivedMessages: many(directMessages, { relationName: "recipient" }),
  reminders: many(reminders),
  registeredTools: many(registeredTools),
  toolPurchases: many(toolPurchases),
  whatsappLinks: many(whatsappLinks),
  userApiKeys: many(userApiKeyVault),
  accessGrants: many(accessGrants),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  agents: many(claudeCodeAgents),
  vaultSecrets: many(vaultSecrets),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const claudeCodeAgentsRelations = relations(claudeCodeAgents, ({ one, many }) => ({
  user: one(users, {
    fields: [claudeCodeAgents.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [claudeCodeAgents.workspaceId],
    references: [workspaces.id],
  }),
  messages: many(agentMessages),
  permissionRequests: many(permissionRequests),
}));

export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
  agent: one(claudeCodeAgents, {
    fields: [agentMessages.agentId],
    references: [claudeCodeAgents.id],
  }),
}));

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  sender: one(users, {
    fields: [directMessages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  recipient: one(users, {
    fields: [directMessages.recipientId],
    references: [users.id],
    relationName: "recipient",
  }),
}));

export const vaultSecretsRelations = relations(vaultSecrets, ({ one }) => ({
  user: one(users, { fields: [vaultSecrets.userId], references: [users.id] }),
  workspace: one(workspaces, {
    fields: [vaultSecrets.workspaceId],
    references: [workspaces.id],
  }),
}));

export const registeredToolsRelations = relations(registeredTools, ({ one, many }) => ({
  user: one(users, {
    fields: [registeredTools.userId],
    references: [users.id],
  }),
  purchases: many(toolPurchases),
}));

export const toolPurchasesRelations = relations(toolPurchases, ({ one }) => ({
  tool: one(registeredTools, {
    fields: [toolPurchases.toolId],
    references: [registeredTools.id],
  }),
  buyer: one(users, {
    fields: [toolPurchases.buyerUserId],
    references: [users.id],
    relationName: "buyer",
  }),
  seller: one(users, {
    fields: [toolPurchases.sellerUserId],
    references: [users.id],
    relationName: "seller",
  }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, { fields: [reminders.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const skillUsageEventsRelations = relations(skillUsageEvents, ({ one }) => ({
  user: one(users, {
    fields: [skillUsageEvents.userId],
    references: [users.id],
  }),
}));

export const whatsappLinksRelations = relations(whatsappLinks, ({ one }) => ({
  user: one(users, { fields: [whatsappLinks.userId], references: [users.id] }),
}));

export const userApiKeyVaultRelations = relations(userApiKeyVault, ({ one }) => ({
  user: one(users, { fields: [userApiKeyVault.userId], references: [users.id] }),
}));

export const accessGrantsRelations = relations(accessGrants, ({ one }) => ({
  user: one(users, { fields: [accessGrants.userId], references: [users.id] }),
}));
