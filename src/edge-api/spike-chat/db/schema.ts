/* v8 ignore start */
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: text("type").notNull(), // public, private, dm
  createdBy: text("createdBy").notNull(),
  isArchived: integer("isArchived", { mode: "boolean" }).default(false).notNull(),
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("createdAt").notNull(),
});

export const channelMembers = sqliteTable("channel_members", {
  channelId: text("channelId").notNull().references(() => channels.id),
  userId: text("userId").notNull(),
  role: text("role").notNull().default("member"),
  isMuted: integer("isMuted", { mode: "boolean" }).default(false).notNull(),
  notifyPreference: text("notifyPreference").notNull().default("all"),
  joinedAt: integer("createdAt").notNull(),
}, (t) => ({
  unq: unique().on(t.channelId, t.userId),
}));

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(), // ULID
  channelId: text("channelId").notNull().references(() => channels.id),
  userId: text("userId").notNull(),
  threadId: text("threadId"),
  content: text("content").notNull(),
  contentType: text("contentType").notNull().default("text"),
  editedAt: integer("editedAt"),
  deletedAt: integer("deletedAt"),
  replyCount: integer("replyCount").default(0).notNull(),
  reactionSummary: text("reactionSummary", { mode: "json" }),
  createdAt: integer("createdAt").notNull(),
});

export const reactions = sqliteTable("reactions", {
  id: text("id").primaryKey(),
  messageId: text("messageId").notNull().references(() => messages.id),
  userId: text("userId").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: integer("createdAt").notNull(),
}, (t) => ({
  unq: unique().on(t.messageId, t.userId, t.emoji),
}));

export const readCursors = sqliteTable("read_cursors", {
  userId: text("userId").notNull(),
  channelId: text("channelId").notNull().references(() => channels.id),
  lastReadMessageId: text("lastReadMessageId").notNull(),
  updatedAt: integer("updatedAt").notNull(),
}, (t) => ({
  unq: unique().on(t.userId, t.channelId),
}));

export const pins = sqliteTable("pins", {
  id: text("id").primaryKey(),
  channelId: text("channelId").notNull().references(() => channels.id),
  messageId: text("messageId").notNull().references(() => messages.id),
  pinnedBy: text("pinnedBy").notNull(),
  createdAt: integer("createdAt").notNull(),
}, (t) => ({
  unq: unique().on(t.channelId, t.messageId),
}));

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  messageId: text("messageId").notNull().references(() => messages.id),
  note: text("note"),
  createdAt: integer("createdAt").notNull(),
}, (t) => ({
  unq: unique().on(t.userId, t.messageId),
}));

export const webhooks = sqliteTable("webhooks", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull(),
  channelId: text("channelId").notNull().references(() => channels.id),
  type: text("type").notNull(), // inbound, outbound
  url: text("url"),
  token: text("token").notNull(),
  createdAt: integer("createdAt").notNull(),
});

export const agentProfiles = sqliteTable("agent_profiles", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull(),
  displayName: text("displayName").notNull(),
  capabilities: text("capabilities", { mode: "json" }),
  createdAt: integer("createdAt").notNull(),
});

export const slashCommands = sqliteTable("slash_commands", {
  id: text("id").primaryKey(),
  workspaceId: text("workspaceId").notNull(),
  command: text("command").notNull(),
  handlerUrl: text("handlerUrl"),
  handlerAgentId: text("handlerAgentId"),
  createdAt: integer("createdAt").notNull(),
}, (t) => ({
  unq: unique().on(t.workspaceId, t.command),
}));
