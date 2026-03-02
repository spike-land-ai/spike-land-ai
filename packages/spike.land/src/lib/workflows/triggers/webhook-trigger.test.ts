/**
 * Webhook Trigger Service Tests
 *
 * Tests for webhook CRUD operations, token generation, HMAC signature
 * verification, and request validation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted() so variables are available inside vi.mock() factory closures
const {
  mockWorkflowFindFirst,
  mockWorkflowWebhookCreate,
  mockWorkflowWebhookUpdate,
  mockWorkflowWebhookDelete,
  mockWorkflowWebhookFindFirst,
  mockWorkflowWebhookFindMany,
  mockWorkflowWebhookFindUnique,
} = vi.hoisted(() => ({
  mockWorkflowFindFirst: vi.fn(),
  mockWorkflowWebhookCreate: vi.fn(),
  mockWorkflowWebhookUpdate: vi.fn(),
  mockWorkflowWebhookDelete: vi.fn(),
  mockWorkflowWebhookFindFirst: vi.fn(),
  mockWorkflowWebhookFindMany: vi.fn(),
  mockWorkflowWebhookFindUnique: vi.fn(),
}));

// Mock Prisma before importing the module under test
vi.mock("@/lib/prisma", () => ({
  default: {
    workflow: {
      findFirst: mockWorkflowFindFirst,
    },
    workflowWebhook: {
      create: mockWorkflowWebhookCreate,
      update: mockWorkflowWebhookUpdate,
      delete: mockWorkflowWebhookDelete,
      findFirst: mockWorkflowWebhookFindFirst,
      findMany: mockWorkflowWebhookFindMany,
      findUnique: mockWorkflowWebhookFindUnique,
    },
  },
}));

// Mock token encryption
vi.mock("@/lib/crypto/token-encryption", () => ({
  safeEncryptToken: vi.fn((token: string) => `encrypted:${token}`),
}));

import { safeEncryptToken } from "@/lib/crypto/token-encryption";
import {
  buildWebhookUrl,
  createWebhookTrigger,
  deleteWebhookTrigger,
  findWebhookByToken,
  generateSignature,
  getWorkflowWebhooks,
  markWebhookTriggered,
  updateWebhookTrigger,
  verifySignature,
  verifyWebhookRequest,
} from "./webhook-trigger";

const mockSafeEncryptToken = vi.mocked(safeEncryptToken);

// ============================================================================
// Test helpers
// ============================================================================

function makeWebhook(
  overrides: Partial<{
    id: string;
    workflowId: string;
    webhookToken: string;
    secretHash: string | null;
    secretEncrypted: string | null;
    isActive: boolean;
    lastTriggeredAt: Date | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: "webhook-1",
    workflowId: "wf-1",
    webhookToken: "abc123token",
    secretHash: null,
    secretEncrypted: null,
    isActive: true,
    lastTriggeredAt: null,
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
// buildWebhookUrl
// ============================================================================

describe("buildWebhookUrl", () => {
  it("builds a webhook URL with the provided token", () => {
    const url = buildWebhookUrl("mytoken123");
    expect(url).toContain("mytoken123");
    expect(url).toContain("/api/webhooks/");
  });

  it("uses NEXT_PUBLIC_APP_URL env var when set", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    const url = buildWebhookUrl("tok");
    expect(url).toBe("https://example.com/api/webhooks/tok");
    if (original !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = original;
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  it("falls back to spike.land when env var is not set", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const url = buildWebhookUrl("tok");
    expect(url).toBe("https://spike.land/api/webhooks/tok");
    if (original !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = original;
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });
});

// ============================================================================
// generateSignature / verifySignature
// ============================================================================

describe("generateSignature", () => {
  it("generates a hex string signature", () => {
    const sig = generateSignature("hello world", "mysecret");
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  it("produces different signatures for different payloads", () => {
    const sig1 = generateSignature("payload1", "secret");
    const sig2 = generateSignature("payload2", "secret");
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures for different secrets", () => {
    const sig1 = generateSignature("payload", "secret1");
    const sig2 = generateSignature("payload", "secret2");
    expect(sig1).not.toBe(sig2);
  });

  it("produces deterministic output for the same inputs", () => {
    const sig1 = generateSignature("payload", "secret");
    const sig2 = generateSignature("payload", "secret");
    expect(sig1).toBe(sig2);
  });
});

describe("verifySignature", () => {
  it("returns true for a valid signature", () => {
    const payload = "test payload";
    const secret = "mysecret";
    const signature = generateSignature(payload, secret);
    expect(verifySignature(payload, signature, secret)).toBe(true);
  });

  it("returns false for an incorrect signature", () => {
    expect(verifySignature("payload", "wrongsig", "secret")).toBe(false);
  });

  it("returns false when signatures have different lengths", () => {
    const sig = generateSignature("payload", "secret");
    // Truncate the signature so lengths differ
    expect(verifySignature("payload", sig.slice(0, 10), "secret")).toBe(false);
  });

  it("returns false for tampered payload", () => {
    const payload = "original payload";
    const secret = "mysecret";
    const signature = generateSignature(payload, secret);
    expect(verifySignature("tampered payload", signature, secret)).toBe(false);
  });
});

// ============================================================================
// createWebhookTrigger
// ============================================================================

describe("createWebhookTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a webhook trigger without a secret", async () => {
    const webhook = makeWebhook();
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookCreate.mockResolvedValue(webhook);

    const result = await createWebhookTrigger("wf-1", "ws-1", {});

    expect(result.id).toBe("webhook-1");
    expect(result.workflowId).toBe("wf-1");
    expect(result.hasSecret).toBe(false);
    expect(result.webhookUrl).toContain("abc123token");
  });

  it("creates a webhook trigger with a secret", async () => {
    const webhook = makeWebhook({ secretEncrypted: "encrypted:mysecret" });
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookCreate.mockResolvedValue(webhook);

    const result = await createWebhookTrigger("wf-1", "ws-1", { secret: "mysecret" });

    expect(mockSafeEncryptToken).toHaveBeenCalledWith("mysecret");
    expect(result.hasSecret).toBe(true);
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(createWebhookTrigger("missing", "ws-1", {})).rejects.toThrow("Workflow not found");
  });

  it("generates a unique webhookToken for each webhook", async () => {
    const webhook1 = makeWebhook({ webhookToken: "token-aaa" });
    const webhook2 = makeWebhook({ webhookToken: "token-bbb" });
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookCreate.mockResolvedValueOnce(webhook1).mockResolvedValueOnce(webhook2);

    const r1 = await createWebhookTrigger("wf-1", "ws-1", {});
    const r2 = await createWebhookTrigger("wf-1", "ws-1", {});

    expect(r1.webhookToken).not.toBe(r2.webhookToken);
  });
});

// ============================================================================
// updateWebhookTrigger
// ============================================================================

describe("updateWebhookTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates isActive flag", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindFirst.mockResolvedValue(makeWebhook());
    mockWorkflowWebhookUpdate.mockResolvedValue(makeWebhook({ isActive: false }));

    const result = await updateWebhookTrigger("webhook-1", "wf-1", "ws-1", {
      isActive: false,
    });

    expect(result.isActive).toBe(false);
  });

  it("regenerates token when regenerateToken: true", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindFirst.mockResolvedValue(makeWebhook());
    mockWorkflowWebhookUpdate.mockResolvedValue(makeWebhook({ webhookToken: "newtoken" }));

    await updateWebhookTrigger("webhook-1", "wf-1", "ws-1", {
      regenerateToken: true,
    });

    const updateData = mockWorkflowWebhookUpdate.mock.calls[0]?.[0]?.data;
    expect(updateData?.webhookToken).toBeDefined();
  });

  it("does not regenerate token when regenerateToken is not set", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindFirst.mockResolvedValue(makeWebhook());
    mockWorkflowWebhookUpdate.mockResolvedValue(makeWebhook());

    await updateWebhookTrigger("webhook-1", "wf-1", "ws-1", { isActive: true });

    const updateData = mockWorkflowWebhookUpdate.mock.calls[0]?.[0]?.data;
    expect(updateData?.webhookToken).toBeUndefined();
  });

  it("updates secret when provided", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindFirst.mockResolvedValue(makeWebhook());
    mockWorkflowWebhookUpdate.mockResolvedValue(
      makeWebhook({ secretEncrypted: "encrypted:newsecret" }),
    );

    await updateWebhookTrigger("webhook-1", "wf-1", "ws-1", { secret: "newsecret" });

    expect(mockSafeEncryptToken).toHaveBeenCalledWith("newsecret");
  });

  it("clears secret when empty string is provided", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindFirst.mockResolvedValue(makeWebhook());
    mockWorkflowWebhookUpdate.mockResolvedValue(makeWebhook({ secretEncrypted: null }));

    await updateWebhookTrigger("webhook-1", "wf-1", "ws-1", { secret: "" });

    const updateData = mockWorkflowWebhookUpdate.mock.calls[0]?.[0]?.data;
    expect(updateData?.secretEncrypted).toBeNull();
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(updateWebhookTrigger("webhook-1", "wf-1", "ws-1", {})).rejects.toThrow(
      "Workflow not found",
    );
  });

  it("throws when webhook is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindFirst.mockResolvedValue(null);

    await expect(updateWebhookTrigger("missing", "wf-1", "ws-1", {})).rejects.toThrow(
      "Webhook not found",
    );
  });
});

// ============================================================================
// deleteWebhookTrigger
// ============================================================================

describe("deleteWebhookTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a webhook trigger successfully", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindFirst.mockResolvedValue(makeWebhook());
    mockWorkflowWebhookDelete.mockResolvedValue(makeWebhook());

    await expect(deleteWebhookTrigger("webhook-1", "wf-1", "ws-1")).resolves.toBeUndefined();

    expect(mockWorkflowWebhookDelete).toHaveBeenCalledWith({
      where: { id: "webhook-1" },
    });
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(deleteWebhookTrigger("webhook-1", "wf-1", "ws-1")).rejects.toThrow(
      "Workflow not found",
    );
  });

  it("throws when webhook is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindFirst.mockResolvedValue(null);

    await expect(deleteWebhookTrigger("missing", "wf-1", "ws-1")).rejects.toThrow(
      "Webhook not found",
    );
  });
});

// ============================================================================
// getWorkflowWebhooks
// ============================================================================

describe("getWorkflowWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all webhooks for a workflow", async () => {
    const webhooks = [
      makeWebhook({ id: "w1", webhookToken: "t1" }),
      makeWebhook({ id: "w2", webhookToken: "t2" }),
    ];
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindMany.mockResolvedValue(webhooks);

    const result = await getWorkflowWebhooks("wf-1", "ws-1");

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("w1");
    expect(result[1]?.id).toBe("w2");
  });

  it("maps hasSecret correctly based on secretHash and secretEncrypted", async () => {
    const webhooks = [
      makeWebhook({ id: "w1", secretHash: "hash123", secretEncrypted: null }),
      makeWebhook({ id: "w2", secretHash: null, secretEncrypted: "enc123" }),
      makeWebhook({ id: "w3", secretHash: null, secretEncrypted: null }),
    ];
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindMany.mockResolvedValue(webhooks);

    const result = await getWorkflowWebhooks("wf-1", "ws-1");

    expect(result[0]?.hasSecret).toBe(true); // secretHash set
    expect(result[1]?.hasSecret).toBe(true); // secretEncrypted set
    expect(result[2]?.hasSecret).toBe(false); // neither set
  });

  it("returns empty array when there are no webhooks", async () => {
    mockWorkflowFindFirst.mockResolvedValue(makeWorkflow());
    mockWorkflowWebhookFindMany.mockResolvedValue([]);

    const result = await getWorkflowWebhooks("wf-1", "ws-1");
    expect(result).toEqual([]);
  });

  it("throws when workflow is not found", async () => {
    mockWorkflowFindFirst.mockResolvedValue(null);

    await expect(getWorkflowWebhooks("missing", "ws-1")).rejects.toThrow("Workflow not found");
  });
});

// ============================================================================
// findWebhookByToken
// ============================================================================

describe("findWebhookByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns webhook data when found", async () => {
    const dbWebhook = {
      ...makeWebhook(),
      workflow: { workspaceId: "ws-1", status: "ACTIVE" },
    };
    mockWorkflowWebhookFindUnique.mockResolvedValue(dbWebhook);

    const result = await findWebhookByToken("abc123token");

    expect(result).not.toBeNull();
    expect(result?.webhookId).toBe("webhook-1");
    expect(result?.workflowId).toBe("wf-1");
    expect(result?.workspaceId).toBe("ws-1");
    expect(result?.isActive).toBe(true);
    expect(result?.workflowStatus).toBe("ACTIVE");
  });

  it("returns null when webhook is not found", async () => {
    mockWorkflowWebhookFindUnique.mockResolvedValue(null);

    const result = await findWebhookByToken("nonexistent");
    expect(result).toBeNull();
  });
});

// ============================================================================
// markWebhookTriggered
// ============================================================================

describe("markWebhookTriggered", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates lastTriggeredAt", async () => {
    mockWorkflowWebhookUpdate.mockResolvedValue(makeWebhook());

    await markWebhookTriggered("webhook-1");

    expect(mockWorkflowWebhookUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "webhook-1" },
        data: expect.objectContaining({
          lastTriggeredAt: expect.any(Date),
        }),
      }),
    );
  });
});

// ============================================================================
// verifyWebhookRequest
// ============================================================================

describe("verifyWebhookRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid: true for an active webhook with an active workflow", async () => {
    const dbWebhook = {
      ...makeWebhook(),
      workflow: { workspaceId: "ws-1", status: "ACTIVE" },
    };
    mockWorkflowWebhookFindUnique.mockResolvedValue(dbWebhook);

    const result = await verifyWebhookRequest("abc123token", "payload");

    expect(result.valid).toBe(true);
    expect(result.webhook).toEqual({
      webhookId: "webhook-1",
      workflowId: "wf-1",
      workspaceId: "ws-1",
    });
  });

  it("returns valid: false when webhook token is not found", async () => {
    mockWorkflowWebhookFindUnique.mockResolvedValue(null);

    const result = await verifyWebhookRequest("nonexistent", "payload");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Webhook not found");
  });

  it("returns valid: false when webhook is disabled", async () => {
    const dbWebhook = {
      ...makeWebhook({ isActive: false }),
      workflow: { workspaceId: "ws-1", status: "ACTIVE" },
    };
    mockWorkflowWebhookFindUnique.mockResolvedValue(dbWebhook);

    const result = await verifyWebhookRequest("abc123token", "payload");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Webhook is disabled");
  });

  it("returns valid: false when workflow is not active", async () => {
    const dbWebhook = {
      ...makeWebhook(),
      workflow: { workspaceId: "ws-1", status: "DRAFT" },
    };
    mockWorkflowWebhookFindUnique.mockResolvedValue(dbWebhook);

    const result = await verifyWebhookRequest("abc123token", "payload");

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Workflow is not active");
  });

  it("ignores optional signature parameter (basic check only)", async () => {
    const dbWebhook = {
      ...makeWebhook(),
      workflow: { workspaceId: "ws-1", status: "ACTIVE" },
    };
    mockWorkflowWebhookFindUnique.mockResolvedValue(dbWebhook);

    // Passing a signature should not cause failure – verification is done in the API route
    const result = await verifyWebhookRequest("abc123token", "payload", "somesig");

    expect(result.valid).toBe(true);
  });
});
