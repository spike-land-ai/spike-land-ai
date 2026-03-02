import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowEventType } from "@prisma/client";
import {
  emitCrisisDetected,
  emitEngagementThreshold,
  emitFollowerMilestone,
  emitInboxItemReceived,
  emitMentionReceived,
  emitPostPublished,
  EventBus,
  eventBus,
  type WorkflowEvent,
} from "./event-bus";

describe("events/event-bus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    eventBus.clear();
  });

  describe("EventBus class", () => {
    it("should subscribe and receive events", async () => {
      const handler = vi.fn();
      bus.subscribe("MENTION_RECEIVED" as WorkflowEventType, handler);

      const event: WorkflowEvent = {
        type: "MENTION_RECEIVED" as WorkflowEventType,
        workspaceId: "ws-1",
        timestamp: new Date(),
        data: { platform: "twitter" },
      };

      await bus.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it("should not call handler for different event types", async () => {
      const handler = vi.fn();
      bus.subscribe("MENTION_RECEIVED" as WorkflowEventType, handler);

      await bus.emit({
        type: "POST_PUBLISHED" as WorkflowEventType,
        workspaceId: "ws-1",
        timestamp: new Date(),
        data: {},
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should filter by workspace when specified", async () => {
      const handler = vi.fn();
      bus.subscribe("MENTION_RECEIVED" as WorkflowEventType, handler, "ws-1");

      // Different workspace - should not fire
      await bus.emit({
        type: "MENTION_RECEIVED" as WorkflowEventType,
        workspaceId: "ws-other",
        timestamp: new Date(),
        data: {},
      });

      expect(handler).not.toHaveBeenCalled();

      // Same workspace - should fire
      await bus.emit({
        type: "MENTION_RECEIVED" as WorkflowEventType,
        workspaceId: "ws-1",
        timestamp: new Date(),
        data: {},
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should unsubscribe correctly", async () => {
      const handler = vi.fn();
      const subId = bus.subscribe("POST_PUBLISHED" as WorkflowEventType, handler);

      bus.unsubscribe(subId);

      await bus.emit({
        type: "POST_PUBLISHED" as WorkflowEventType,
        workspaceId: "ws-1",
        timestamp: new Date(),
        data: {},
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle handler errors gracefully", async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error("Handler broke"));
      bus.subscribe("CRISIS_DETECTED" as WorkflowEventType, failingHandler);

      const results = await bus.emit({
        type: "CRISIS_DETECTED" as WorkflowEventType,
        workspaceId: "ws-1",
        timestamp: new Date(),
        data: {},
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.error).toBeDefined();
      expect(results[0]!.error?.message).toBe("Handler broke");
    });

    it("should handle non-Error throws", async () => {
      const failingHandler = vi.fn().mockRejectedValue("string error");
      bus.subscribe("CRISIS_DETECTED" as WorkflowEventType, failingHandler);

      const results = await bus.emit({
        type: "CRISIS_DETECTED" as WorkflowEventType,
        workspaceId: "ws-1",
        timestamp: new Date(),
        data: {},
      });

      expect(results[0]!.error?.message).toBe("string error");
    });

    it("should return empty array when no subscribers for event type", async () => {
      const results = await bus.emit({
        type: "FOLLOWER_MILESTONE" as WorkflowEventType,
        workspaceId: "ws-1",
        timestamp: new Date(),
        data: {},
      });

      expect(results).toEqual([]);
    });

    it("should track subscription counts", () => {
      bus.subscribe("MENTION_RECEIVED" as WorkflowEventType, vi.fn());
      bus.subscribe("MENTION_RECEIVED" as WorkflowEventType, vi.fn());
      bus.subscribe("POST_PUBLISHED" as WorkflowEventType, vi.fn());

      expect(bus.getSubscriptionCount()).toBe(3);
      expect(bus.getSubscriptionCountByType("MENTION_RECEIVED" as WorkflowEventType)).toBe(2);
      expect(bus.getSubscriptionCountByType("POST_PUBLISHED" as WorkflowEventType)).toBe(1);
      expect(bus.getSubscriptionCountByType("CRISIS_DETECTED" as WorkflowEventType)).toBe(0);
    });

    it("should clear all subscriptions", () => {
      bus.subscribe("MENTION_RECEIVED" as WorkflowEventType, vi.fn());
      bus.subscribe("POST_PUBLISHED" as WorkflowEventType, vi.fn());

      bus.clear();

      expect(bus.getSubscriptionCount()).toBe(0);
    });

    it("should support multiple handlers for the same event type", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.subscribe("MENTION_RECEIVED" as WorkflowEventType, handler1);
      bus.subscribe("MENTION_RECEIVED" as WorkflowEventType, handler2);

      await bus.emit({
        type: "MENTION_RECEIVED" as WorkflowEventType,
        workspaceId: "ws-1",
        timestamp: new Date(),
        data: {},
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should ignore unsubscribe for non-existent subscription", () => {
      // Should not throw
      bus.unsubscribe("non-existent-id");
      expect(bus.getSubscriptionCount()).toBe(0);
    });
  });

  describe("helper emit functions", () => {
    it("emitMentionReceived should emit correct event type", async () => {
      const handler = vi.fn();
      eventBus.subscribe("MENTION_RECEIVED" as WorkflowEventType, handler);

      await emitMentionReceived("ws-1", {
        platform: "twitter",
        accountId: "acc-1",
        mentionId: "m-1",
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "MENTION_RECEIVED",
          workspaceId: "ws-1",
        }),
      );
    });

    it("emitEngagementThreshold should emit correct event type", async () => {
      const handler = vi.fn();
      eventBus.subscribe("ENGAGEMENT_THRESHOLD" as WorkflowEventType, handler);

      await emitEngagementThreshold("ws-1", {
        postId: "p-1",
        platform: "instagram",
        metric: "likes",
        threshold: 1000,
        currentValue: 1500,
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("emitFollowerMilestone should emit correct event type", async () => {
      const handler = vi.fn();
      eventBus.subscribe("FOLLOWER_MILESTONE" as WorkflowEventType, handler);

      await emitFollowerMilestone("ws-1", {
        accountId: "acc-1",
        platform: "linkedin",
        milestone: 10000,
        currentCount: 10100,
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("emitCrisisDetected should emit correct event type", async () => {
      const handler = vi.fn();
      eventBus.subscribe("CRISIS_DETECTED" as WorkflowEventType, handler);

      await emitCrisisDetected("ws-1", {
        severity: "high",
        description: "Negative PR storm",
        detectionSource: "sentiment-analysis",
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("emitPostPublished should emit correct event type", async () => {
      const handler = vi.fn();
      eventBus.subscribe("POST_PUBLISHED" as WorkflowEventType, handler);

      await emitPostPublished("ws-1", {
        postId: "p-1",
        platform: "facebook",
        accountId: "acc-1",
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("emitInboxItemReceived should emit correct event type", async () => {
      const handler = vi.fn();
      eventBus.subscribe("INBOX_ITEM_RECEIVED" as WorkflowEventType, handler);

      await emitInboxItemReceived("ws-1", {
        inboxItemId: "item-1",
        platform: "twitter",
        accountId: "acc-1",
        itemType: "dm",
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
