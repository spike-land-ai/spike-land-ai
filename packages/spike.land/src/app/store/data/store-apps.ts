export type {
  AppCategory,
  AppFeature,
  CardVariant,
  McpTool,
  PricingModel,
  StoreApp,
} from "./types";

import { AI_AGENTS_APPS } from "./apps-ai-agents";
import { COMMUNICATION_APPS } from "./apps-communication";
import { CREATIVE_APPS } from "./apps-creative";
import { DEVELOPER_APPS } from "./apps-developer";
import { LIFESTYLE_APPS } from "./apps-lifestyle";
import { PRODUCTIVITY_APPS } from "./apps-productivity";
import type { PricingModel, StoreApp } from "./types";

export const STORE_CATEGORIES = [
  { id: "all", label: "All Apps", icon: "LayoutGrid" },
  { id: "creative", label: "Creative", icon: "Palette" },
  { id: "productivity", label: "Productivity", icon: "Target" },
  { id: "developer", label: "Developer", icon: "Code" },
  { id: "communication", label: "Communication", icon: "Users" },
  { id: "lifestyle", label: "Lifestyle", icon: "Heart" },
  { id: "ai-agents", label: "AI Agents", icon: "Bot" },
] as const;

const ALL_APPS: StoreApp[] = [
  ...CREATIVE_APPS,
  ...PRODUCTIVITY_APPS,
  ...DEVELOPER_APPS,
  ...COMMUNICATION_APPS,
  ...LIFESTYLE_APPS,
  ...AI_AGENTS_APPS,
];

/** Public apps (excludes admin-only). Used by the store UI. */
export const STORE_APPS: StoreApp[] = ALL_APPS.filter((app) => !app.isAdminOnly);

/** Get an app by slug (includes admin-only apps for direct access). */
export function getAppBySlug(slug: string): StoreApp | undefined {
  return ALL_APPS.find((app) => app.slug === slug);
}

export function getAppsByCategory(category: string): StoreApp[] {
  if (category === "all") return STORE_APPS;
  return STORE_APPS.filter((app) => app.category === category);
}

export function getFeaturedApps(): StoreApp[] {
  return STORE_APPS.filter((app) => app.isFeatured);
}

export function getNewApps(): StoreApp[] {
  return STORE_APPS.filter((app) => app.isNew === true);
}

export function getAppsByPricing(pricing: PricingModel): StoreApp[] {
  return STORE_APPS.filter((app) => (app.pricing ?? "free") === pricing);
}

export function getTopRatedApps(limit = 10): StoreApp[] {
  return STORE_APPS.filter((app) => app.rating !== undefined)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit);
}

export function getMostInstalledApps(limit = 10): StoreApp[] {
  return STORE_APPS.filter((app) => app.installCount !== undefined)
    .sort((a, b) => (b.installCount ?? 0) - (a.installCount ?? 0))
    .slice(0, limit);
}

export function getStoreStats(): {
  appCount: number;
  toolCount: number;
  developerCount: number;
  categoryCount: number;
} {
  return {
    appCount: STORE_APPS.length,
    toolCount: STORE_APPS.reduce((sum, app) => sum + app.toolCount, 0),
    developerCount: Math.ceil(STORE_APPS.length * 0.6),
    categoryCount: STORE_CATEGORIES.length - 1,
  };
}
