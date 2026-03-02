import { describe, expect, it, vi } from "vitest";

const { mockWorkspaceFindUnique, mockWorkspaceUpdate } = vi.hoisted(() => ({
  mockWorkspaceFindUnique: vi.fn(),
  mockWorkspaceUpdate: vi.fn(),
}));

vi.mock("../prisma", () => ({
  default: {
    workspace: {
      findUnique: mockWorkspaceFindUnique,
      update: mockWorkspaceUpdate,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// SmartRoutingSettingsSchema uses @prisma/client InboxSentiment - mock it
vi.mock("@prisma/client", () => ({
  InboxSentiment: {
    POSITIVE: "POSITIVE",
    NEGATIVE: "NEGATIVE",
    NEUTRAL: "NEUTRAL",
    MIXED: "MIXED",
  },
}));

import { getSmartRoutingSettings, updateSmartRoutingSettings } from "./settings";

describe("getSmartRoutingSettings", () => {
  beforeEach(() => mockWorkspaceFindUnique.mockReset());

  it("returns default settings when workspace not found", async () => {
    mockWorkspaceFindUnique.mockResolvedValue(null);
    const result = await getSmartRoutingSettings("ws-1");
    expect(result.enabled).toBe(true);
    expect(result.negativeSentimentThreshold).toBe(-0.3);
  });

  it("returns default settings when workspace has no settings", async () => {
    mockWorkspaceFindUnique.mockResolvedValue({ settings: null });
    const result = await getSmartRoutingSettings("ws-1");
    expect(result.rules).toEqual([]);
    expect(result.autoAnalyzeOnFetch).toBe(true);
  });

  it("returns default settings when inboxRouting key is missing", async () => {
    mockWorkspaceFindUnique.mockResolvedValue({
      settings: { otherKey: "value" },
    });
    const result = await getSmartRoutingSettings("ws-1");
    expect(result.enabled).toBe(true);
  });

  it("returns default settings when stored settings fail Zod validation", async () => {
    mockWorkspaceFindUnique.mockResolvedValue({
      settings: {
        inboxRouting: { enabled: "not-a-boolean" }, // invalid
      },
    });
    const result = await getSmartRoutingSettings("ws-1");
    expect(result.enabled).toBe(true);
  });

  it("returns merged settings when stored settings are valid", async () => {
    const storedSettings = {
      enabled: false,
      autoAnalyzeOnFetch: false,
      negativeSentimentThreshold: -0.5,
      priorityWeights: {
        sentiment: 40,
        urgency: 20,
        followerCount: 15,
        engagement: 15,
        accountTier: 10,
      },
      escalation: {
        enabled: true,
        slaTimeoutMinutes: 30,
        levels: [],
        autoAssign: false,
      },
      rules: [],
    };
    mockWorkspaceFindUnique.mockResolvedValue({
      settings: { inboxRouting: storedSettings },
    });
    const result = await getSmartRoutingSettings("ws-1");
    expect(result.enabled).toBe(false);
    expect(result.negativeSentimentThreshold).toBe(-0.5);
  });
});

describe("updateSmartRoutingSettings", () => {
  beforeEach(() => {
    mockWorkspaceFindUnique.mockReset();
    mockWorkspaceUpdate.mockReset();
  });

  it("merges updates with current settings and persists", async () => {
    // First call: getSmartRoutingSettings → workspace not found → defaults
    mockWorkspaceFindUnique
      .mockResolvedValueOnce(null) // for getSmartRoutingSettings
      .mockResolvedValueOnce({ settings: {} }); // for the update fetch
    mockWorkspaceUpdate.mockResolvedValue({});

    const result = await updateSmartRoutingSettings("ws-1", { enabled: false });
    expect(result.enabled).toBe(false);
    // Other defaults preserved
    expect(result.autoAnalyzeOnFetch).toBe(true);
  });

  it("throws when merged settings fail Zod validation", async () => {
    mockWorkspaceFindUnique.mockResolvedValue(null);

    await expect(
      updateSmartRoutingSettings("ws-1", {
        negativeSentimentThreshold: 99, // out of range -1..1
      }),
    ).rejects.toThrow("Invalid settings provided");
  });

  it("calls workspace.update with the new settings under inboxRouting key", async () => {
    mockWorkspaceFindUnique
      .mockResolvedValueOnce(null) // getSmartRoutingSettings
      .mockResolvedValueOnce({ settings: { someOtherKey: "preserved" } }); // for update fetch
    mockWorkspaceUpdate.mockResolvedValue({});

    await updateSmartRoutingSettings("ws-1", { enabled: false });

    expect(mockWorkspaceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ws-1" },
        data: expect.objectContaining({
          settings: expect.objectContaining({
            someOtherKey: "preserved",
            inboxRouting: expect.objectContaining({ enabled: false }),
          }),
        }),
      }),
    );
  });

  it("returns the new merged settings object", async () => {
    mockWorkspaceFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ settings: {} });
    mockWorkspaceUpdate.mockResolvedValue({});

    const result = await updateSmartRoutingSettings("ws-1", {
      priorityWeights: {
        sentiment: 50,
        urgency: 20,
        followerCount: 10,
        engagement: 10,
        accountTier: 10,
      },
    });
    expect(result.priorityWeights.sentiment).toBe(50);
  });
});
