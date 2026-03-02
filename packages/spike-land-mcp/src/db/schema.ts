import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
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
    clientId: text("client_id").references(() => oauthClients.id, { onDelete: "cascade" }),
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
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
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
    agentId: text("agent_id").references(() => claudeCodeAgents.id, { onDelete: "cascade" }),
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
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
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
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
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
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    skillName: text("skill_name").notNull(),
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
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    userIdx: index("registered_tools_user_id_idx").on(t.userId),
    nameIdx: index("registered_tools_name_idx").on(t.name),
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
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const claudeCodeAgentsRelations = relations(claudeCodeAgents, ({ one, many }) => ({
  user: one(users, { fields: [claudeCodeAgents.userId], references: [users.id] }),
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
  workspace: one(workspaces, { fields: [vaultSecrets.workspaceId], references: [workspaces.id] }),
}));

export const registeredToolsRelations = relations(registeredTools, ({ one }) => ({
  user: one(users, { fields: [registeredTools.userId], references: [users.id] }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, { fields: [reminders.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const skillUsageEventsRelations = relations(skillUsageEvents, ({ one }) => ({
  user: one(users, { fields: [skillUsageEvents.userId], references: [users.id] }),
}));
