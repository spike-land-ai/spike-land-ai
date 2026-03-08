export interface AppConfig {
  chat?: {
    enabled: boolean;
    defaultChannels?: Array<{ name: string; slug: string; type: string }>;
    agents?: Array<{ id: string; displayName: string; autoJoinChannels?: string[] }>;
    features?: {
      threads?: boolean;
      reactions?: boolean;
      guestAccess?: boolean;
      guestRateLimit?: number;
      retentionDays?: number | null;
    };
  };
}

export interface WsAttachment {
  userId: string;
  displayName: string;
  channelId: string;
  isBot: boolean;
}
