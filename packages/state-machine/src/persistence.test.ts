/**
 * Persistence Tests
 *
 * Tests shareMachine and getSharedMachine by mocking the Prisma client
 * via vi.mock so no real DB connection is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the Prisma module that persistence.ts loads via dynamic import
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn();
const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    stateMachine: {
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}));

import { shareMachine, getSharedMachine } from "./persistence.js";
import type { MachineExport } from "./types.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeMachineInstance() {
  return {
    definition: {
      id: "machine-1",
      name: "Test Machine",
      initial: "idle",
      states: {},
      transitions: [],
      context: { count: 0 },
      userId: "user-1",
    },
    currentStates: ["idle"],
    context: { count: 0 },
    history: {},
    transitionLog: [],
    initialContext: { count: 0 },
  };
}

function makePrismaRecord(
  overrides: Partial<{
    id: string;
    shareToken: string;
    definition: unknown;
    currentStates: string[];
    context: unknown;
    history: unknown;
    transitionLog: unknown;
  }> = {},
) {
  return {
    id: "db-id-1",
    shareToken: "abc123token",
    definition: {
      id: "machine-1",
      name: "Test Machine",
      initial: "idle",
      states: {},
      transitions: [],
      context: {},
      userId: "user-1",
    },
    currentStates: ["idle"],
    context: { count: 0 },
    history: {},
    transitionLog: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// shareMachine
// ---------------------------------------------------------------------------

describe("shareMachine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new record when no existing machine found", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});

    const instance = makeMachineInstance();
    const token = await shareMachine("user-1", instance);

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(mockUpsert).toHaveBeenCalledOnce();
    const upsertCall = mockUpsert.mock.calls[0]![0];
    expect(upsertCall.create.userId).toBe("user-1");
    expect(upsertCall.create.name).toBe("Test Machine");
    expect(upsertCall.create.isPublic).toBe(true);
  });

  it("reuses existing share token when machine already exists", async () => {
    const existingToken = "existing-token-xyz";
    mockFindFirst.mockResolvedValue(makePrismaRecord({ shareToken: existingToken }));
    mockUpsert.mockResolvedValue({});

    const instance = makeMachineInstance();
    const token = await shareMachine("user-1", instance);

    expect(token).toBe(existingToken);
    expect(mockUpsert).toHaveBeenCalledOnce();
    const upsertCall = mockUpsert.mock.calls[0]![0];
    expect(upsertCall.create.shareToken).toBe(existingToken);
  });

  it("passes serialized definition, context, history, and transitionLog", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});

    const instance = {
      ...makeMachineInstance(),
      context: { count: 5, label: "test" },
      history: { parent: ["child1"] },
      transitionLog: [
        {
          timestamp: 1000,
          event: "GO",
          fromStates: ["idle"],
          toStates: ["active"],
          beforeContext: { count: 5 },
          afterContext: { count: 5 },
          actionsExecuted: [],
        },
      ],
    };

    await shareMachine("user-1", instance);

    const upsertCall = mockUpsert.mock.calls[0]![0];
    expect(upsertCall.create.context).toEqual({ count: 5, label: "test" });
    expect(upsertCall.create.history).toEqual({ parent: ["child1"] });
    expect(upsertCall.create.transitionLog).toHaveLength(1);
  });

  it("searches for existing machine by userId and name", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});

    await shareMachine("user-42", makeMachineInstance());

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-42",
        forkedFrom: null,
        name: "Test Machine",
      },
    });
  });

  it("sets isPublic to true in both create and upsert update", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});

    await shareMachine("user-1", makeMachineInstance());

    const upsertCall = mockUpsert.mock.calls[0]![0];
    expect(upsertCall.create.isPublic).toBe(true);
    expect(upsertCall.update.isPublic).toBe(true);
  });

  it("update payload does not include shareToken or userId", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});

    await shareMachine("user-1", makeMachineInstance());

    const upsertCall = mockUpsert.mock.calls[0]![0];
    expect(upsertCall.update.shareToken).toBeUndefined();
    expect(upsertCall.update.userId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getSharedMachine
// ---------------------------------------------------------------------------

describe("getSharedMachine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a MachineExport for a valid token", async () => {
    const record = makePrismaRecord();
    mockFindUnique.mockResolvedValue(record);

    const result = await getSharedMachine("abc123token");

    expect(result).toBeDefined();
    expect((result as MachineExport).currentStates).toEqual(["idle"]);
    expect((result as MachineExport).context).toEqual({ count: 0 });
    expect(Array.isArray((result as MachineExport).transitionLog)).toBe(true);
  });

  it("throws when the token is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(getSharedMachine("bad-token")).rejects.toThrow("Shared state machine not found");
  });

  it("queries by shareToken", async () => {
    const record = makePrismaRecord({ shareToken: "my-token" });
    mockFindUnique.mockResolvedValue(record);

    await getSharedMachine("my-token");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { shareToken: "my-token" },
    });
  });

  it("defaults context to empty object when null in DB", async () => {
    const record = { ...makePrismaRecord(), context: null };
    mockFindUnique.mockResolvedValue(record);

    const result = await getSharedMachine("token");
    expect((result as MachineExport).context).toEqual({});
  });

  it("defaults history to empty object when null in DB", async () => {
    const record = { ...makePrismaRecord(), history: null };
    mockFindUnique.mockResolvedValue(record);

    const result = await getSharedMachine("token");
    expect((result as MachineExport).history).toEqual({});
  });

  it("defaults transitionLog to empty array when null in DB", async () => {
    const record = { ...makePrismaRecord(), transitionLog: null };
    mockFindUnique.mockResolvedValue(record);

    const result = await getSharedMachine("token");
    expect(Array.isArray((result as MachineExport).transitionLog)).toBe(true);
    expect((result as MachineExport).transitionLog).toHaveLength(0);
  });

  it("deep-clones definition via JSON roundtrip", async () => {
    const definition = {
      id: "m1",
      name: "Deep Clone Test",
      initial: "s1",
      states: { s1: { id: "s1", type: "atomic", children: [], entryActions: [], exitActions: [] } },
      transitions: [],
      context: {},
      userId: "u1",
    };
    const record = { ...makePrismaRecord(), definition };
    mockFindUnique.mockResolvedValue(record);

    const result = await getSharedMachine("token");
    expect((result as MachineExport).definition.name).toBe("Deep Clone Test");
  });
});
