/**
 * Event Trigger Service Tests
 *
 * Tests for event filter matching, database CRUD operations, and
 * event bus integration.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted() so variables are available inside vi.mock() factory closures
const {
  mockWorkflowFindFirst,
  mockWorkflowFindMany,
  mockWorkflowEventSubscriptionCreate,
  mockWorkflowEventSubscriptionUpdate,
  mockWorkflowEventSubscriptionDelete,
  mockWorkflowEventSubscriptionFindFirst,
  mockWorkflowEventSubscriptionFindMany,
  mockWorkflowEventSubscriptionFindUnique,
  mockEventBusSubscribe,
  mockEventBusUnsubscribe,
} = vi.hoisted(() => ({
  mockWorkflowFindFirst: vi.fn(),
  mockWorkflowFindMany: vi.fn(),
  mockWorkflowEventSubscriptionCreate: vi.fn(),
  mockWorkflowEventSubscriptionUpdate: vi.fn(),
  mockWorkflowEventSubscriptionDelete: vi.fn(),
  mockWorkflowEventSubscriptionFindFirst: vi.fn(),
  mockWorkflowEventSubscriptionFindMany: vi.fn(),
  mockWorkflowEventSubscriptionFindUnique: vi.fn(),
  mockEventBusSubscribe: vi.fn().mockReturnValue("bus-sub-id"),
  mockEventBusUnsubscribe: vi.fn(),
}));

// Mock Prisma before importing the module under test
vi.mock("@/lib/prisma", () => ({
  default: {
    workflow: {
      findFirst: mockWorkflowFindFirst,
      findMany: mockWorkflowFindMany,
    },
    workflowEventSubscription: {
      create: mockWorkflowEventSubscriptionCreate,
      update: mockWorkflowEventSubscriptionUpdate,
      delete: mockWorkflowEventSubscriptionDelete,
      findFirst: mockWorkflowEventSubscriptionFindFirst,
      findMany: mockWorkflowEventSubscriptionFindMany,
      findUnique: mockWorkflowEventSubscriptionFindUnique,
    },
  },
}));

// Mock the event bus
vi.mock("@/lib/events/event-bus", () => ({
  eventBus: {
    subscribe: mockEventBusSubscribe,
    unsubscribe: mockEventBusUnsubscribe,
  },
}));

import { eventBus } from "@/lib/events/event-bus";
import type { WorkflowEvent } from "@/lib/events/event-bus";
import {
  createEventSubscription,
  deleteEventSubscription,
  findMatchingSubscriptions,
  getWorkflowEventSubscriptions,
  initializeEventSubscriptions,
  matchesFilter,
  registerWorkflowEventSubscriptions,
  unregisterWorkflowEventSubscriptions,
  updateEventSubscription,
} from "./event-trigger";

const mockEventBus = vi.mocked(eventBus);

// ============================================================================
// Test helpers
// ============================================================================

function makeEvent(overrides: Partial<WorkflowEvent> = {}): WorkflowEvent {
  return {
    type: "POST_PUBLISHED" as WorkflowEvent["type"],
    workspaceId: "ws-1",
    timestamp: new Date(),
    data: {},
    ...overrides,
  };
}

function makeSubscription(
  overrides: Partial<{
    id: string;
    workflowId: string;
    eventType: WorkflowEvent["type"];
    filterConfig: unknown;
    isActive: boolean;
    createdAt: Date;
  }> = {},
) {
  return {
    id: "sub-1",
    workflowId: "wf-1",
    eventType: "POST_PUBLISHED" as WorkflowEvent["type"],
    filterConfig: null,
    isActive: true,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeWorkflow(
  overrides: Partial<{
    id: string;
    workspaceId: string;
    status: string;
  }> = {},
) {
  return {
    id: "wf-1",
    workspaceId: "ws-1",
    status: "ACTIVE",
    ...overrides,
  };
}

// ============================================================================
// matchesFilter
// ============================================================================

describe("matchesFilter", () => {
  it("returns true when filterConfig is null", () => {
    const event = makeEvent({ data: { status: "published" } });
    expect(matchesFilter(event, null)).toBe(true);
  });

  it("returns true when filterConfig is undefined", () => {
    const event = makeEvent({ data: { status: "published" } });
    expect(matchesFilter(event, undefined)).toBe(true);
  });

  it("returns true when filterConfig is empty object", () => {
    const event = makeEvent({ data: { status: "published" } });
    expect(matchesFilter(event, {})).toBe(true);
  });

  it("matches simple equality filter", () => {
    const event = makeEvent({ data: { status: "published" } });
    expect(matchesFilter(event, { status: "published" })).toBe(true);
    expect(matchesFilter(event, { status: "draft" })).toBe(false);
  });

  it("returns false when event data key is missing", () => {
    const event = makeEvent({ data: {} });
    expect(matchesFilter(event, { status: "published" })).toBe(false);
  });

  it("handles $gt filter", () => {
    const event = makeEvent({ data: { count: 10 } });
    expect(matchesFilter(event, { count: { $gt: 5 } })).toBe(true);
    expect(matchesFilter(event, { count: { $gt: 10 } })).toBe(false);
    expect(matchesFilter(event, { count: { $gt: 15 } })).toBe(false);
  });

  it("handles $gte filter", () => {
    const event = makeEvent({ data: { count: 10 } });
    expect(matchesFilter(event, { count: { $gte: 10 } })).toBe(true);
    expect(matchesFilter(event, { count: { $gte: 11 } })).toBe(false);
  });

  it("handles $lt filter", () => {
    const event = makeEvent({ data: { count: 10 } });
    expect(matchesFilter(event, { count: { $lt: 15 } })).toBe(true);
    expect(matchesFilter(event, { count: { $lt: 10 } })).toBe(false);
  });

  it("handles $lte filter", () => {
    const event = makeEvent({ data: { count: 10 } });
    expect(matchesFilter(event, { count: { $lte: 10 } })).toBe(true);
    expect(matchesFilter(event, { count: { $lte: 9 } })).toBe(false);
  });

  it("handles $in filter", () => {
    const event = makeEvent({ data: { status: "published" } });
    expect(matchesFilter(event, { status: { $in: ["published", "draft"] } })).toBe(true);
    expect(matchesFilter(event, { status: { $in: ["archived"] } })).toBe(false);
  });

  it("handles $nin filter", () => {
    const event = makeEvent({ data: { status: "published" } });
    expect(matchesFilter(event, { status: { $nin: ["archived"] } })).toBe(true);
    expect(matchesFilter(event, { status: { $nin: ["published"] } })).toBe(false);
  });

  it("handles $regex filter", () => {
    const event = makeEvent({ data: { title: "Hello World" } });
    expect(matchesFilter(event, { title: { $regex: "^Hello" } })).toBe(true);
    expect(matchesFilter(event, { title: { $regex: "^World" } })).toBe(false);
  });

  it("handles $exists: true filter", () => {
    const eventWith = makeEvent({ data: { tag: "breaking" } });
    const eventWithout = makeEvent({ data: {} });
    expect(matchesFilter(eventWith, { tag: { $exists: true } })).toBe(true);
    expect(matchesFilter(eventWithout, { tag: { $exists: true } })).toBe(false);
  });

  it("handles $exists: false filter", () => {
    const eventWith = makeEvent({ data: { tag: "breaking" } });
    const eventWithout = makeEvent({ data: {} });
    expect(matchesFilter(eventWith, { tag: { $exists: false } })).toBe(false);
    expect(matchesFilter(eventWithout, { tag: { $exists: false } })).toBe(true);
  });

  it("handles multiple filter conditions (all must match)", () => {
    const event = makeEvent({ data: { status: "published", count: 5 } });
    expect(matchesFilter(event, { status: "published", count: { $gte: 5 } })).toBe(true);
    expect(matchesFilter(event, { status: "published", count: { $gt: 10 } })).toBe(false);
  });

  it("ignores $gt filter when value is not a number", () => {
    const event = makeEvent({ data: { tag: "hello" } });
    // When actual value is not a number, $gt check is skipped so it doesn't return false
    expect(matchesFilter(event, { tag: { $gt: 5 } })).toBe(true);
  });
});

// ============================================================================
// createEventSubscription
// ============================================================================

describe("createEventSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an event subscription successfully", async () => {
    const sub = makeSubscription();
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindUnique.mockResolvedValue(null);
    mockWorkflowEventSubscriptionCreate.mockResolvedValue(sub);

    const result = await createEventSubscription("wf-1", "ws-1", {
      eventType: "POST_PUBLISHED" as WorkflowEvent["type"],
    });

    expect(result.id).toBe("sub-1");
    expect(result.workflowId).toBe("wf-1");
    expect(result.eventType).toBe("POST_PUBLISHED");
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(
      createEventSubscription("missing", "ws-1", {
        eventType: "POST_PUBLISHED" as WorkflowEvent["type"],
      }),
    ).rejects.toThrow("Workflow not found");
  });

  it("throws when subscription for the event type already exists", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindUnique.mockResolvedValue(makeSubscription());

    await expect(
      createEventSubscription("wf-1", "ws-1", {
        eventType: "POST_PUBLISHED" as WorkflowEvent["type"],
      }),
    ).rejects.toThrow("Subscription for POST_PUBLISHED already exists");
  });

  it("creates subscription with filterConfig", async () => {
    const sub = makeSubscription({ filterConfig: { status: "published" } });
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindUnique.mockResolvedValue(null);
    mockWorkflowEventSubscriptionCreate.mockResolvedValue(sub);

    await createEventSubscription("wf-1", "ws-1", {
      eventType: "POST_PUBLISHED" as WorkflowEvent["type"],
      filterConfig: { status: "published" },
    });

    const createCall = mockWorkflowEventSubscriptionCreate.mock.calls[0]?.[0];
    expect(createCall?.data.filterConfig).toEqual({ status: "published" });
  });
});

// ============================================================================
// updateEventSubscription
// ============================================================================

describe("updateEventSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a subscription successfully", async () => {
    const updated = makeSubscription({ filterConfig: { count: { $gt: 5 } } });
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindFirst.mockResolvedValue(makeSubscription());
    mockWorkflowEventSubscriptionUpdate.mockResolvedValue(updated);

    const result = await updateEventSubscription("sub-1", "wf-1", "ws-1", {
      filterConfig: { count: { $gt: 5 } },
    });

    expect(result.filterConfig).toEqual({ count: { $gt: 5 } });
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(updateEventSubscription("sub-1", "wf-1", "ws-1", {})).rejects.toThrow(
      "Workflow not found",
    );
  });

  it("throws when subscription is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindFirst.mockResolvedValue(null);

    await expect(updateEventSubscription("missing", "wf-1", "ws-1", {})).rejects.toThrow(
      "Subscription not found",
    );
  });

  it("updates isActive flag", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindFirst.mockResolvedValue(makeSubscription());
    mockWorkflowEventSubscriptionUpdate.mockResolvedValue(makeSubscription({ isActive: false }));

    const result = await updateEventSubscription("sub-1", "wf-1", "ws-1", {
      isActive: false,
    });

    expect(result.isActive).toBe(false);
  });
});

// ============================================================================
// deleteEventSubscription
// ============================================================================

describe("deleteEventSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a subscription successfully", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindFirst.mockResolvedValue(makeSubscription());
    mockWorkflowEventSubscriptionDelete.mockResolvedValue(makeSubscription());

    await expect(deleteEventSubscription("sub-1", "wf-1", "ws-1")).resolves.toBeUndefined();

    expect(mockWorkflowEventSubscriptionDelete).toHaveBeenCalledWith({
      where: { id: "sub-1" },
    });
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(deleteEventSubscription("sub-1", "wf-1", "ws-1")).rejects.toThrow(
      "Workflow not found",
    );
  });

  it("throws when subscription is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindFirst.mockResolvedValue(null);

    await expect(deleteEventSubscription("missing", "wf-1", "ws-1")).rejects.toThrow(
      "Subscription not found",
    );
  });
});

// ============================================================================
// getWorkflowEventSubscriptions
// ============================================================================

describe("getWorkflowEventSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all subscriptions for a workflow", async () => {
    const subs = [
      makeSubscription({ id: "s1" }),
      makeSubscription({ id: "s2", eventType: "USER_JOINED" as WorkflowEvent["type"] }),
    ];
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue(subs);

    const result = await getWorkflowEventSubscriptions("wf-1", "ws-1");

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("s1");
    expect(result[1]?.id).toBe("s2");
  });

  it("returns empty array when there are no subscriptions", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue([]);

    const result = await getWorkflowEventSubscriptions("wf-1", "ws-1");
    expect(result).toEqual([]);
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(getWorkflowEventSubscriptions("missing", "ws-1")).rejects.toThrow(
      "Workflow not found",
    );
  });
});

// ============================================================================
// findMatchingSubscriptions
// ============================================================================

describe("findMatchingSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching subscriptions for an event", async () => {
    const dbSubs = [
      {
        ...makeSubscription(),
        filterConfig: null,
        workflow: { workspaceId: "ws-1" },
      },
    ];
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue(dbSubs);

    const event = makeEvent({ type: "POST_PUBLISHED" as WorkflowEvent["type"] });
    const result = await findMatchingSubscriptions(event);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      subscriptionId: "sub-1",
      workflowId: "wf-1",
      workspaceId: "ws-1",
    });
  });

  it("filters out subscriptions whose filterConfig does not match event data", async () => {
    const dbSubs = [
      {
        ...makeSubscription(),
        filterConfig: { status: "published" },
        workflow: { workspaceId: "ws-1" },
      },
    ];
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue(dbSubs);

    // Event data has status: "draft" which does NOT match the filter
    const event = makeEvent({ data: { status: "draft" } });
    const result = await findMatchingSubscriptions(event);

    expect(result).toHaveLength(0);
  });

  it("includes subscriptions when filterConfig matches event data", async () => {
    const dbSubs = [
      {
        ...makeSubscription(),
        filterConfig: { status: "published" },
        workflow: { workspaceId: "ws-1" },
      },
    ];
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue(dbSubs);

    const event = makeEvent({ data: { status: "published" } });
    const result = await findMatchingSubscriptions(event);

    expect(result).toHaveLength(1);
  });

  it("returns empty array when no subscriptions match", async () => {
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue([]);

    const event = makeEvent();
    const result = await findMatchingSubscriptions(event);
    expect(result).toEqual([]);
  });
});

// ============================================================================
// registerWorkflowEventSubscriptions / unregisterWorkflowEventSubscriptions
// ============================================================================

describe("registerWorkflowEventSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventBus.subscribe.mockReturnValue("bus-sub-id");
  });

  it("subscribes to the event bus for each active subscription", async () => {
    const subs = [
      makeSubscription({ id: "s1", eventType: "POST_PUBLISHED" as WorkflowEvent["type"] }),
      makeSubscription({ id: "s2", eventType: "USER_JOINED" as WorkflowEvent["type"] }),
    ];
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue(subs);

    const executor = vi.fn();
    await registerWorkflowEventSubscriptions("wf-1", "ws-1", executor);

    expect(mockEventBus.subscribe).toHaveBeenCalledTimes(2);
  });

  it("calls executor when event matches subscription filter", async () => {
    const sub = makeSubscription({ filterConfig: null });
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue([sub]);

    let capturedHandler: ((event: WorkflowEvent) => Promise<void>) | null = null;
    mockEventBus.subscribe.mockImplementation((_type, handler) => {
      capturedHandler = handler;
      return "bus-sub-id";
    });

    const executor = vi.fn().mockResolvedValue(undefined);
    await registerWorkflowEventSubscriptions("wf-1", "ws-1", executor);

    const event = makeEvent();
    await capturedHandler!(event);

    expect(executor).toHaveBeenCalledWith("wf-1", event, "sub-1");
  });

  it("does NOT call executor when event does not match filter", async () => {
    const sub = makeSubscription({ filterConfig: { status: "published" } });
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue([sub]);

    let capturedHandler: ((event: WorkflowEvent) => Promise<void>) | null = null;
    mockEventBus.subscribe.mockImplementation((_type, handler) => {
      capturedHandler = handler;
      return "bus-sub-id";
    });

    const executor = vi.fn().mockResolvedValue(undefined);
    await registerWorkflowEventSubscriptions("wf-1", "ws-1", executor);

    const event = makeEvent({ data: { status: "draft" } });
    await capturedHandler!(event);

    expect(executor).not.toHaveBeenCalled();
  });
});

describe("unregisterWorkflowEventSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventBus.subscribe.mockReturnValue("bus-sub-id");
  });

  it("unsubscribes all registered bus subscriptions", async () => {
    const sub = makeSubscription();
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue([sub]);

    const executor = vi.fn();
    await registerWorkflowEventSubscriptions("wf-1", "ws-1", executor);

    unregisterWorkflowEventSubscriptions("wf-1");

    expect(mockEventBus.unsubscribe).toHaveBeenCalledWith("bus-sub-id");
  });

  it("does nothing when no subscriptions are registered for workflow", () => {
    // Should not throw
    expect(() => unregisterWorkflowEventSubscriptions("nonexistent")).not.toThrow();
    expect(mockEventBus.unsubscribe).not.toHaveBeenCalled();
  });
});

// ============================================================================
// initializeEventSubscriptions
// ============================================================================

describe("initializeEventSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventBus.subscribe.mockReturnValue("bus-sub-id");
  });

  it("registers subscriptions for all active workflows", async () => {
    const workflows = [makeWorkflow({ id: "wf-1" }), makeWorkflow({ id: "wf-2" })];
    mockWorkflowFindMany.mockResolvedValue(workflows);
    mockWorkflowEventSubscriptionFindMany.mockResolvedValue([]);

    const executor = vi.fn();
    await initializeEventSubscriptions(executor);

    // findMany called once for active workflows query + once per workflow for subscriptions
    expect(mockWorkflowFindMany).toHaveBeenCalledTimes(1);
    expect(mockWorkflowEventSubscriptionFindMany).toHaveBeenCalledTimes(2);
  });

  it("does nothing when there are no active workflows", async () => {
    mockWorkflowFindMany.mockResolvedValue([]);

    const executor = vi.fn();
    await initializeEventSubscriptions(executor);

    expect(mockWorkflowEventSubscriptionFindMany).not.toHaveBeenCalled();
  });
});
