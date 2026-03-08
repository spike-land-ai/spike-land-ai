CREATE TABLE `agent_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`displayName` text NOT NULL,
	`capabilities` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`messageId` text NOT NULL,
	`note` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bookmarks_user_id_idx` ON `bookmarks` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_userId_messageId_unique` ON `bookmarks` (`userId`,`messageId`);--> statement-breakpoint
CREATE TABLE `channel_members` (
	`channelId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`isMuted` integer DEFAULT false NOT NULL,
	`notifyPreference` text DEFAULT 'all' NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`channelId`, `userId`),
	FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`type` text NOT NULL,
	`createdBy` text NOT NULL,
	`isArchived` integer DEFAULT false NOT NULL,
	`metadata` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `channels_workspace_id_idx` ON `channels` (`workspaceId`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channelId` text NOT NULL,
	`userId` text NOT NULL,
	`threadId` text,
	`content` text NOT NULL,
	`contentType` text DEFAULT 'text' NOT NULL,
	`editedAt` integer,
	`deletedAt` integer,
	`replyCount` integer DEFAULT 0 NOT NULL,
	`reactionSummary` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_channel_id_idx` ON `messages` (`channelId`);--> statement-breakpoint
CREATE INDEX `messages_thread_id_idx` ON `messages` (`threadId`);--> statement-breakpoint
CREATE INDEX `messages_user_id_idx` ON `messages` (`userId`);--> statement-breakpoint
CREATE TABLE `pins` (
	`id` text PRIMARY KEY NOT NULL,
	`channelId` text NOT NULL,
	`messageId` text NOT NULL,
	`pinnedBy` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pins_channelId_messageId_unique` ON `pins` (`channelId`,`messageId`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`messageId` text NOT NULL,
	`userId` text NOT NULL,
	`emoji` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reactions_message_id_idx` ON `reactions` (`messageId`);--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_messageId_userId_emoji_unique` ON `reactions` (`messageId`,`userId`,`emoji`);--> statement-breakpoint
CREATE TABLE `read_cursors` (
	`userId` text NOT NULL,
	`channelId` text NOT NULL,
	`lastReadMessageId` text NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `channelId`),
	FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `slash_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`command` text NOT NULL,
	`handlerUrl` text,
	`handlerAgentId` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slash_commands_workspaceId_command_unique` ON `slash_commands` (`workspaceId`,`command`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`channelId` text NOT NULL,
	`type` text NOT NULL,
	`url` text,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhooks_workspace_id_idx` ON `webhooks` (`workspaceId`);