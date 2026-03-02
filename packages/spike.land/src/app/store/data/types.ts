/** Get the MCP server endpoint URL for a store app. */
export const getAppMcpUrl = (slug: string): string => `/api/mcp/apps/${slug}`;

export interface McpTool {
  name: string;
  category: string;
  description: string;
}

export interface AppFeature {
  title: string;
  description: string;
  icon: string;
}

export type AppCategory =
  | "creative"
  | "productivity"
  | "developer"
  | "communication"
  | "lifestyle"
  | "ai-agents";

export type CardVariant = "blue" | "fuchsia" | "green" | "purple" | "orange" | "pink";

export type PricingModel = "free" | "freemium" | "paid";

export type AppPermission =
  | "auth-required"
  | "human-verified"
  | "admin-only"
  | "subscription-required"
  | "public";

export interface StoreApp {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  longDescription: string;
  category: AppCategory;
  cardVariant: CardVariant;
  icon: string;
  coverImageUrl?: string;
  screenshotUrls?: string[];
  appUrl?: string;
  mcpServerUrl?: string;
  isFeatured: boolean;
  isFirstParty: boolean;
  toolCount: number;
  tags: string[];
  color: string;
  mcpTools: McpTool[];
  features: AppFeature[];
  codespaceId?: string;
  isCodespaceNative?: boolean;
  rating?: number;
  ratingCount?: number;
  installCount?: number;
  isNew?: boolean;
  isBeta?: boolean;
  version?: string;
  publishedAt?: string;
  updatedAt?: string;
  videoUrl?: string;
  pricing?: PricingModel;
  isAdminOnly?: boolean;
  permissions?: AppPermission[];
}
