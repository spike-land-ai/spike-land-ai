/**
 * Billing Service — pure data retrieval and formatting for billing tools.
 */

import { and, eq } from "drizzle-orm";
import type { DrizzleDB } from "../db/db-index.ts";
import { subscriptions, workspaceMembers, workspaces } from "../db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SubscriptionData {
  plan: string;
  status: string;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: number | null;
}

export interface WorkspaceData {
  id: string;
  name: string;
  plan: string;
}

export interface ActiveSubscription {
  id: string;
  status: string;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: number | null;
}

export interface PlanDefinition {
  name: string;
  tier: "free" | "pro" | "business";
  price: number;
  features: string[];
}

// ─── Plan Constants ──────────────────────────────────────────────────────────

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    name: "Free",
    tier: "free",
    price: 0,
    features: [
      "Up to 5 apps",
      "25 vault secrets",
      "Basic AI tools",
      "Community support",
    ],
  },
  {
    name: "Pro",
    tier: "pro",
    price: 29,
    features: [
      "Unlimited apps",
      "500 vault secrets",
      "Priority AI models",
      "Advanced analytics",
      "Email support",
    ],
  },
  {
    name: "Business",
    tier: "business",
    price: 99,
    features: [
      "Everything in Pro",
      "Team workspaces with RBAC",
      "Full audit logs (90-day retention)",
      "Dedicated support",
      "Custom integrations",
    ],
  },
];

// ─── Data Retrieval ──────────────────────────────────────────────────────────

export async function getBillingStatus(
  db: DrizzleDB,
  userId: string,
): Promise<{ subscription: SubscriptionData | null; workspaces: WorkspaceData[] }> {
  const sub = await db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const userWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      plan: workspaces.plan,
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaces.id),
        eq(workspaceMembers.userId, userId),
      ),
    );

  return {
    subscription: sub[0] ?? null,
    workspaces: userWorkspaces,
  };
}

export async function getActiveSubscription(
  db: DrizzleDB,
  userId: string,
): Promise<ActiveSubscription | null> {
  const sub = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
      ),
    )
    .limit(1);

  return sub[0] ?? null;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatBillingStatus(data: {
  subscription: SubscriptionData | null;
  workspaces: WorkspaceData[];
}): string {
  let text = `**Billing Status**\n\n`;

  if (data.subscription) {
    const s = data.subscription;
    text += `### Subscription\n`;
    text += `**Plan:** ${s.plan}\n`;
    text += `**Status:** ${s.status}\n`;
    text += `**Active Stripe Subscription:** ${s.stripeSubscriptionId ? "Yes" : "No"}\n`;
    if (s.currentPeriodEnd) {
      text += `**Current Period End:** ${new Date(s.currentPeriodEnd).toISOString()}\n`;
    }
  } else {
    text += `### Subscription\n`;
    text += `**Plan:** free\n`;
    text += `**Status:** No active subscription\n`;
  }

  if (data.workspaces.length > 0) {
    text += `\n### Workspaces (${data.workspaces.length})\n\n`;
    for (const ws of data.workspaces) {
      text += `**${ws.name}** (${ws.id})\n`;
      text += `- Plan: ${ws.plan}\n\n`;
    }
  }

  return text;
}

export function formatPlanList(): string {
  let text = `**spike.land Plans**\n\n`;

  for (const plan of PLAN_DEFINITIONS) {
    const priceLabel = plan.price === 0 ? "" : ` — $${plan.price}/month`;
    text += `### ${plan.name}${priceLabel}\n`;
    for (const feature of plan.features) {
      text += `- ${feature}\n`;
    }
    text += `\n`;
  }

  text += `Use \`billing_create_checkout\` with tier "pro" or "business" to subscribe.`;
  return text;
}

export function formatCancellationPreview(sub: ActiveSubscription): string {
  const endDate = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toISOString().split("T")[0]
    : "end of current period";
  return (
    `**Cancellation Preview**\n\n` +
    `Your subscription will be canceled. Access continues until **${endDate}**.\n\n` +
    `To proceed, call again with \`confirm: true\`.`
  );
}

export function formatCancellationConfirm(sub: ActiveSubscription): string {
  const endDate = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toISOString().split("T")[0]
    : "end of current period";
  return (
    `**Subscription Canceled**\n\n` +
    `Your subscription has been canceled. You'll retain access until **${endDate}**.\n\n` +
    `To resubscribe, use \`billing_create_checkout\`.`
  );
}
