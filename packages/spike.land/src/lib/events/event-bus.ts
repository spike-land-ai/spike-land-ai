/**
 * Internal Event Bus for Workflow Triggers
 *
 * This module provides a pub/sub system for internal platform events
 * that can trigger workflow executions.
 */

import type { WorkflowEventType } from "@prisma/client";

/**
 * Event payload structure for workflow events
 */
export interface WorkflowEvent {
  type: WorkflowEventType;
  workspaceId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: WorkflowEvent) => Promise<void>;

/**
 * Event subscription with filter support
 */
interface EventSubscription {
  id: string;
  eventType: WorkflowEventType;
  workspaceId?: string; // Optional: filter by workspace
  handler: EventHandler;
}

/**
 * Simple in-memory event bus for workflow triggers
 *
 * Note: For production scalability, consider using:
 * - Redis Pub/Sub
 * - AWS SNS/SQS
 * - Google Cloud Pub/Sub
 * - Kafka
 */
class EventBus {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventTypeIndex: Map<WorkflowEventType, Set<string>> = new Map();

  /**
   * Subscribe to events of a specific type
   *
   * @param eventType - The type of event to subscribe to
   * @param handler - The handler function to call when the event is emitted
   * @param workspaceId - Optional workspace filter
   * @returns Subscription ID for unsubscribing
   */
  subscribe(
    eventType: WorkflowEventType,
    handler: EventHandler,
    workspaceId?: string,
  ): string {
    const id = crypto.randomUUID();
    const subscription: EventSubscription = {
      id,
      eventType,
      ...(workspaceId !== undefined ? { workspaceId } : {}),
      handler,
    };

    this.subscriptions.set(id, subscription);

    // Add to event type index for faster lookup
    if (!this.eventTypeIndex.has(eventType)) {
      this.eventTypeIndex.set(eventType, new Set());
    }
    this.eventTypeIndex.get(eventType)!.add(id);

    return id;
  }

  /**
   * Unsubscribe from events
   *
   * @param subscriptionId - The subscription ID returned from subscribe()
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.subscriptions.delete(subscriptionId);
      this.eventTypeIndex.get(subscription.eventType)?.delete(subscriptionId);
    }
  }

  /**
   * Emit an event to all subscribers
   *
   * @param event - The event to emit
   * @returns Array of results from all handlers (for error tracking)
   */
  async emit(
    event: WorkflowEvent,
  ): Promise<Array<{ subscriptionId: string; error?: Error; }>> {
    const results: Array<{ subscriptionId: string; error?: Error; }> = [];

    // Get subscriptions for this event type
    const subscriptionIds = this.eventTypeIndex.get(event.type);
    if (!subscriptionIds) {
      return results;
    }

    // Process all subscriptions
    const promises = Array.from(subscriptionIds).map(async subscriptionId => {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        return { subscriptionId };
      }

      // Check workspace filter
      if (
        subscription.workspaceId
        && subscription.workspaceId !== event.workspaceId
      ) {
        return { subscriptionId };
      }

      try {
        await subscription.handler(event);
        return { subscriptionId };
      } catch (error) {
        return {
          subscriptionId,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    });

    const settledResults = await Promise.all(promises);
    results.push(...settledResults);

    return results;
  }

  /**
   * Get count of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get count of subscriptions for a specific event type
   */
  getSubscriptionCountByType(eventType: WorkflowEventType): number {
    return this.eventTypeIndex.get(eventType)?.size ?? 0;
  }

  /**
   * Clear all subscriptions (useful for testing)
   */
  clear(): void {
    this.subscriptions.clear();
    this.eventTypeIndex.clear();
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Export class for testing
export { EventBus };

// ============================================================================
// Helper functions for emitting common events
// ============================================================================

/**
 * Emit a mention received event
 */
export async function emitMentionReceived(
  workspaceId: string,
  data: {
    platform: string;
    accountId: string;
    mentionId: string;
    authorId?: string;
    authorName?: string;
    content?: string;
  },
): Promise<void> {
  await eventBus.emit({
    type: "MENTION_RECEIVED",
    workspaceId,
    timestamp: new Date(),
    data,
  });
}

/**
 * Emit an engagement threshold event
 */
export async function emitEngagementThreshold(
  workspaceId: string,
  data: {
    postId: string;
    platform: string;
    metric: string;
    threshold: number;
    currentValue: number;
  },
): Promise<void> {
  await eventBus.emit({
    type: "ENGAGEMENT_THRESHOLD",
    workspaceId,
    timestamp: new Date(),
    data,
  });
}

/**
 * Emit a follower milestone event
 */
export async function emitFollowerMilestone(
  workspaceId: string,
  data: {
    accountId: string;
    platform: string;
    milestone: number;
    currentCount: number;
  },
): Promise<void> {
  await eventBus.emit({
    type: "FOLLOWER_MILESTONE",
    workspaceId,
    timestamp: new Date(),
    data,
  });
}

/**
 * Emit a crisis detected event
 */
export async function emitCrisisDetected(
  workspaceId: string,
  data: {
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    affectedAccounts?: string[];
    detectionSource: string;
  },
): Promise<void> {
  await eventBus.emit({
    type: "CRISIS_DETECTED",
    workspaceId,
    timestamp: new Date(),
    data,
  });
}

/**
 * Emit a post published event
 */
export async function emitPostPublished(
  workspaceId: string,
  data: {
    postId: string;
    platform: string;
    accountId: string;
    externalId?: string;
  },
): Promise<void> {
  await eventBus.emit({
    type: "POST_PUBLISHED",
    workspaceId,
    timestamp: new Date(),
    data,
  });
}

/**
 * Emit an inbox item received event
 */
export async function emitInboxItemReceived(
  workspaceId: string,
  data: {
    inboxItemId: string;
    platform: string;
    accountId: string;
    itemType: string;
    authorId?: string;
  },
): Promise<void> {
  await eventBus.emit({
    type: "INBOX_ITEM_RECEIVED",
    workspaceId,
    timestamp: new Date(),
    data,
  });
}
