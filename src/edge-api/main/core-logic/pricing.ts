/**
 * Shared pricing constants for Stripe checkout flows.
 */

export const VALID_LOOKUP_KEYS = new Set([
  "pro_monthly",
  "pro_annual",
  "business_monthly",
  "business_annual",
  "migration_blog_42000",
  "migration_script_100000",
  "migration_mcp_1000000",
]);

export const CREDIT_PACKS = [
  { credits: 500, priceCents: 500, lookupKey: "credits_500" },
  { credits: 2500, priceCents: 2000, lookupKey: "credits_2500" },
  { credits: 7500, priceCents: 5000, lookupKey: "credits_7500" },
] as const;

export const SERVICE_PRODUCTS: Record<
  string,
  { lookupKey: string; successPath: string; label: string }
> = {
  app_builder: {
    lookupKey: "app_builder_1997",
    successPath: "/build?success=1",
    label: "AI App Builder",
  },
  workshop_seat: {
    lookupKey: "workshop_seat_497",
    successPath: "/workshop?success=1",
    label: "MCP Workshop (Seat)",
  },
  workshop_team: {
    lookupKey: "workshop_team_1997",
    successPath: "/workshop?success=1",
    label: "MCP Workshop (Team)",
  },
  migration_blog: {
    lookupKey: "migration_blog_42000",
    successPath: "/migrate?success=blog",
    label: "Next.js Migration Blog Post",
  },
  migration_script: {
    lookupKey: "migration_script_100000",
    successPath: "/migrate?success=script",
    label: "Next.js Migration Script",
  },
  migration_mcp: {
    lookupKey: "migration_mcp_1000000",
    successPath: "/migrate?success=mcp",
    label: "Next.js Migration MCP Server",
  },
};
