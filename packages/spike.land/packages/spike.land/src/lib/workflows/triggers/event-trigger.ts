/**
 * Event Trigger Service
 *
 * Handles event-based workflow triggers with filter support.
 */

import { eventBus, type WorkflowEvent } from "@/lib/events/event-bus";
import prisma from "@/lib/prisma";
import type {
  CreateEventSubscriptionInput,
  UpdateEventSubscriptionInput,
  WorkflowEventSubscriptionData,
} from "@/types/workflow";
import type { Prisma, WorkflowEventType } from "@prisma/client";

/**
 * Check if an event matches the filter configuration
 *
 * @param event - The event to check
 * @param filterConfig - The filter configuration
 * @returns Whether the event matches the filter
 */
export function matchesFilter(
  event: WorkflowEvent,
  filterConfig: Record<string, unknown> | null | undefined,
): boolean {
  if (!filterConfig || Object.keys(filterConfig).length === 0) {
    return true; // No filter means match all
  }

  // Check each filter condition
  for (const [key, expectedValue] of Object.entries(filterConfig)) {
    const actualValue = event.data[key];

    // Handle different comparison types
    if (typeof expectedValue === "object" && expectedValue !== null) {
      const filter = expectedValue as Record<string, unknown>;

      // Greater than
      if ("$gt" in filter && typeof actualValue === "number") {
        if (actualValue <= (filter.$gt as number)) return false;
      }

      // Greater than or equal
      if ("$gte" in filter && typeof actualValue === "number") {
        if (actualValue < (filter.$gte as number)) return false;
      }

      // Less than
      if ("$lt" in filter && typeof actualValue === "number") {
        if (actualValue >= (filter.$lt as number)) return false;
      }

      // Less than or equal
      if ("$lte" in filter && typeof actualValue === "number") {
        if (actualValue > (filter.$lte as number)) return false;
      }

      // In array
      if ("$in" in filter && Array.isArray(filter.$in)) {
        if (!filter.$in.includes(actualValue)) return false;
      }

      // Not in array
      if ("$nin" in filter && Array.isArray(filter.$nin)) {
        if (filter.$nin.includes(actualValue)) return false;
      }

      // Regex match (for strings)
      if ("$regex" in filter && typeof actualValue === "string") {
        const regex = new RegExp(filter.$regex as string);
        if (!regex.test(actualValue)) return false;
      }

      // Exists check
      if ("$exists" in filter) {
        const shouldExist = filter.$exists as boolean;
        const doesExist = actualValue !== undefined && actualValue !== null;
        if (shouldExist !== doesExist) return false;
      }
    } else {
      // Simple equality check
      if (actualValue !== expectedValue) return false;
    }
  }

  return true;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create an event subscription for a workflow
 */
export async function createEventSubscription(
  workflowId: string,
  workspaceId: string,
  input: CreateEventSubscriptionInput,
): Promise<WorkflowEventSubscriptionData> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Check if subscription already exists for this event type
  const existing = await prisma.workflowEventSubscription.findUnique({
    where: {
      workflowId_eventType: {
        workflowId,
        eventType: input.eventType,
      },
    },
  });

  if (existing) {
    throw new Error(`Subscription for ${input.eventType} already exists`);
  }

  const subscription = await prisma.workflowEventSubscription.create({
    data: {
      workflowId,
      eventType: input.eventType,
      filterConfig: (input.filterConfig ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });

  return mapSubscriptionToData(subscription);
}

/**
 * Update an event subscription
 */
export async function updateEventSubscription(
  subscriptionId: string,
  workflowId: string,
  workspaceId: string,
  input: UpdateEventSubscriptionInput,
): Promise<WorkflowEventSubscriptionData> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Verify subscription exists
  const existing = await prisma.workflowEventSubscription.findFirst({
    where: { id: subscriptionId, workflowId },
  });

  if (!existing) {
    throw new Error("Subscription not found");
  }

  const subscription = await prisma.workflowEventSubscription.update({
    where: { id: subscriptionId },
    data: {
      ...(input.filterConfig !== undefined && {
        filterConfig: input.filterConfig as Prisma.InputJsonValue | undefined,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  return mapSubscriptionToData(subscription);
}

/**
 * Delete an event subscription
 */
export async function deleteEventSubscription(
  subscriptionId: string,
  workflowId: string,
  workspaceId: string,
): Promise<void> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Verify subscription exists
  const existing = await prisma.workflowEventSubscription.findFirst({
    where: { id: subscriptionId, workflowId },
  });

  if (!existing) {
    throw new Error("Subscription not found");
  }

  await prisma.workflowEventSubscription.delete({
    where: { id: subscriptionId },
  });
}

/**
 * Get all event subscriptions for a workflow
 */
export async function getWorkflowEventSubscriptions(
  workflowId: string,
  workspaceId: string,
): Promise<WorkflowEventSubscriptionData[]> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const subscriptions = await prisma.workflowEventSubscription.findMany({
    where: { workflowId },
    orderBy: { createdAt: "asc" },
  });

  return subscriptions.map(mapSubscriptionToData);
}

/**
 * Find all subscriptions that should be triggered by an event
 */
export async function findMatchingSubscriptions(
  event: WorkflowEvent,
): Promise<
  Array<{
    subscriptionId: string;
    workflowId: string;
    workspaceId: string;
  }>
> {
  // Find all active subscriptions for this event type in this workspace
  const subscriptions = await prisma.workflowEventSubscription.findMany({
    where: {
      eventType: event.type,
      isActive: true,
      workflow: {
        workspaceId: event.workspaceId,
        status: "ACTIVE",
      },
    },
    include: {
      workflow: {
        select: {
          workspaceId: true,
        },
      },
    },
  });

  // Filter by filter config
  return subscriptions
    .filter(sub => matchesFilter(event, sub.filterConfig as Record<string, unknown> | null))
    .map(sub => ({
      subscriptionId: sub.id,
      workflowId: sub.workflowId,
      workspaceId: sub.workflow.workspaceId,
    }));
}

// ============================================================================
// Event Bus Integration
// ============================================================================

// Map to track active event bus subscriptions
const eventBusSubscriptions = new Map<string, string[]>();

/**
 * Register event subscriptions for a workflow
 *
 * Note: In production, this would typically be done at application startup
 * for all active workflows, or when a workflow is published.
 */
export async function registerWorkflowEventSubscriptions(
  workflowId: string,
  workspaceId: string,
  executor: (
    workflowId: string,
    event: WorkflowEvent,
    subscriptionId: string,
  ) => Promise<void>,
): Promise<void> {
  // First unregister any existing subscriptions
  unregisterWorkflowEventSubscriptions(workflowId);

  // Get all active subscriptions for this workflow
  const subscriptions = await prisma.workflowEventSubscription.findMany({
    where: {
      workflowId,
      isActive: true,
    },
  });

  const busSubscriptionIds: string[] = [];

  for (const subscription of subscriptions) {
    const busSubId = eventBus.subscribe(
      subscription.eventType,
      async (event: WorkflowEvent) => {
        // Check filter
        if (
          !matchesFilter(
            event,
            subscription.filterConfig as Record<string, unknown> | null,
          )
        ) {
          return;
        }

        // Execute workflow
        await executor(workflowId, event, subscription.id);
      },
      workspaceId,
    );

    busSubscriptionIds.push(busSubId);
  }

  eventBusSubscriptions.set(workflowId, busSubscriptionIds);
}

/**
 * Unregister event subscriptions for a workflow
 */
export function unregisterWorkflowEventSubscriptions(workflowId: string): void {
  const busSubscriptionIds = eventBusSubscriptions.get(workflowId);
  if (busSubscriptionIds) {
    for (const id of busSubscriptionIds) {
      eventBus.unsubscribe(id);
    }
    eventBusSubscriptions.delete(workflowId);
  }
}

/**
 * Initialize event subscriptions for all active workflows
 *
 * This should be called at application startup.
 */
export async function initializeEventSubscriptions(
  executor: (
    workflowId: string,
    event: WorkflowEvent,
    subscriptionId: string,
  ) => Promise<void>,
): Promise<void> {
  // Get all active workflows with event subscriptions
  const workflows = await prisma.workflow.findMany({
    where: {
      status: "ACTIVE",
      eventSubscriptions: {
        some: {
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      workspaceId: true,
    },
  });

  for (const workflow of workflows) {
    await registerWorkflowEventSubscriptions(
      workflow.id,
      workflow.workspaceId,
      executor,
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapSubscriptionToData(subscription: {
  id: string;
  workflowId: string;
  eventType: WorkflowEventType;
  filterConfig: unknown;
  isActive: boolean;
}): WorkflowEventSubscriptionData {
  return {
    id: subscription.id,
    workflowId: subscription.workflowId,
    eventType: subscription.eventType,
    filterConfig: subscription.filterConfig as
      | Record<string, unknown>
      | undefined,
    isActive: subscription.isActive,
  };
}
