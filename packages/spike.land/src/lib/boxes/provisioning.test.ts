import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must come before any imports of the modules under test
// ---------------------------------------------------------------------------

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ default: mockLogger }));

const mockPrisma = vi.hoisted(() => ({
  box: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  workflow: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const mockTriggerWorkflowManually = vi.hoisted(() => vi.fn());

vi.mock("@/lib/workflows/workflow-executor", () => ({
  triggerWorkflowManually: mockTriggerWorkflowManually,
}));

const mockProvisionEC2Box = vi.hoisted(() => vi.fn());

vi.mock("@/lib/boxes/ec2-provisioner", () => ({
  provisionEC2Box: mockProvisionEC2Box,
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import { triggerBoxProvisioning } from "./provisioning";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface WorkspaceRecord {
  id: string;
  isPersonal: boolean;
  name: string;
}

interface WorkspaceMemberRecord {
  workspace: WorkspaceRecord;
}

interface BoxRecord {
  id: string;
  userId: string;
  tier: Record<string, unknown> | null;
  user: {
    workspaceMembers: WorkspaceMemberRecord[];
  };
}

function makeWorkspace(overrides: Partial<WorkspaceRecord> = {}): WorkspaceRecord {
  return {
    id: "ws-1",
    isPersonal: true,
    name: "personal",
    ...overrides,
  };
}

function makeBox(overrides: Partial<BoxRecord> = {}): BoxRecord {
  const defaultBox: BoxRecord = {
    id: "box-1",
    userId: "user-1",
    tier: null,
    user: {
      workspaceMembers: [{ workspace: makeWorkspace({ isPersonal: true }) }],
    },
    ...overrides,
  };
  return defaultBox;
}

function makeWorkflow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "wf-1",
    name: "Provision Box",
    status: "ACTIVE",
    workspaceId: "ws-1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("triggerBoxProvisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no environment variables set
    vi.stubEnv("BOX_EC2_SECURITY_GROUP_ID", "");
    vi.stubEnv("BOX_PROVISIONING_WEBHOOK_URL", "");
    vi.stubEnv("BOX_PROVISIONING_SECRET", "");
    // Default prisma.box.update resolves cleanly
    mockPrisma.box.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // Box not found
  // -------------------------------------------------------------------------

  describe("when box is not found", () => {
    it("logs an error and returns early without updating anything", async () => {
      mockPrisma.box.findUnique.mockResolvedValue(null);

      await triggerBoxProvisioning("missing-box");

      expect(mockLogger.error).toHaveBeenCalledWith("[BoxProvisioning] Box missing-box not found");
      expect(mockPrisma.box.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // EC2 path
  // -------------------------------------------------------------------------

  describe("EC2 provisioning path (BOX_EC2_SECURITY_GROUP_ID set)", () => {
    beforeEach(() => {
      vi.stubEnv("BOX_EC2_SECURITY_GROUP_ID", "sg-12345");
    });

    it("calls provisionEC2Box with the full box record and returns", async () => {
      const box = makeBox();
      mockPrisma.box.findUnique.mockResolvedValue(box);
      mockProvisionEC2Box.mockResolvedValue(undefined);

      await triggerBoxProvisioning("box-1");

      expect(mockProvisionEC2Box).toHaveBeenCalledOnce();
      expect(mockProvisionEC2Box).toHaveBeenCalledWith(box);
      // Should not fall through to webhook or workflow
      expect(mockPrisma.workflow.findFirst).not.toHaveBeenCalled();
    });

    it("does not call the webhook or workflow path even when those env vars are also set", async () => {
      vi.stubEnv("BOX_PROVISIONING_WEBHOOK_URL", "https://example.com/hook");
      const box = makeBox();
      mockPrisma.box.findUnique.mockResolvedValue(box);
      mockProvisionEC2Box.mockResolvedValue(undefined);

      await triggerBoxProvisioning("box-1");

      expect(mockProvisionEC2Box).toHaveBeenCalledOnce();
      expect(mockPrisma.workflow.findFirst).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Webhook path
  // -------------------------------------------------------------------------

  describe("webhook provisioning path (BOX_PROVISIONING_WEBHOOK_URL set)", () => {
    const webhookUrl = "https://provisioner.example.com/provision";

    beforeEach(() => {
      vi.stubEnv("BOX_PROVISIONING_WEBHOOK_URL", webhookUrl);
    });

    it("calls fetch with the correct body and logs success on ok response", async () => {
      const box = makeBox({ tier: { name: "starter" } });
      mockPrisma.box.findUnique.mockResolvedValue(box);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
      vi.stubGlobal("fetch", mockFetch);

      await triggerBoxProvisioning("box-1");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe(webhookUrl);
      expect(calledOptions.method).toBe("POST");

      const body = JSON.parse(calledOptions.body as string) as Record<string, unknown>;
      expect(body).toEqual({
        boxId: "box-1",
        userId: "user-1",
        tier: { name: "starter" },
        action: "PROVISION",
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Successfully triggered provisioning webhook"),
      );
      expect(mockPrisma.box.update).not.toHaveBeenCalled();
    });

    it("includes Authorization header when BOX_PROVISIONING_SECRET is set", async () => {
      vi.stubEnv("BOX_PROVISIONING_SECRET", "super-secret");
      const box = makeBox();
      mockPrisma.box.findUnique.mockResolvedValue(box);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
      vi.stubGlobal("fetch", mockFetch);

      await triggerBoxProvisioning("box-1");

      const [, calledOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = calledOptions.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer super-secret");
    });

    it("does not include Authorization header when BOX_PROVISIONING_SECRET is empty string", async () => {
      vi.stubEnv("BOX_PROVISIONING_SECRET", "");
      const box = makeBox();
      mockPrisma.box.findUnique.mockResolvedValue(box);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
      vi.stubGlobal("fetch", mockFetch);

      await triggerBoxProvisioning("box-1");

      const [, calledOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = calledOptions.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it("defaults secret to empty string when BOX_PROVISIONING_SECRET is not set at all", async () => {
      // Remove the env var entirely so the ?? "" nullish coalescing branch fires
      vi.unstubAllEnvs();
      vi.stubEnv("BOX_PROVISIONING_WEBHOOK_URL", webhookUrl);
      // BOX_PROVISIONING_SECRET is now undefined in process.env
      const box = makeBox();
      mockPrisma.box.findUnique.mockResolvedValue(box);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
      vi.stubGlobal("fetch", mockFetch);

      await triggerBoxProvisioning("box-1");

      const [, calledOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = calledOptions.headers as Record<string, string>;
      // No secret means no Authorization header
      expect(headers.Authorization).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it("calls failBox when response.ok is false", async () => {
      const box = makeBox();
      mockPrisma.box.findUnique.mockResolvedValue(box);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });
      vi.stubGlobal("fetch", mockFetch);

      await triggerBoxProvisioning("box-1");

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Webhook failed: 503 Service Unavailable"),
      );
      expect(mockPrisma.box.update).toHaveBeenCalledWith({
        where: { id: "box-1" },
        data: { status: "ERROR" },
      });
    });

    it("calls failBox when fetch throws an error", async () => {
      const box = makeBox();
      mockPrisma.box.findUnique.mockResolvedValue(box);

      const networkError = new Error("Network error");
      const mockFetch = vi.fn().mockRejectedValue(networkError);
      vi.stubGlobal("fetch", mockFetch);

      await triggerBoxProvisioning("box-1");

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Webhook execution error"),
      );
      expect(mockPrisma.box.update).toHaveBeenCalledWith({
        where: { id: "box-1" },
        data: { status: "ERROR" },
      });
    });

    it("does not call the workflow path after webhook handling", async () => {
      const box = makeBox();
      mockPrisma.box.findUnique.mockResolvedValue(box);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK" });
      vi.stubGlobal("fetch", mockFetch);

      await triggerBoxProvisioning("box-1");

      expect(mockPrisma.workflow.findFirst).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Workflow path
  // -------------------------------------------------------------------------

  describe("workflow provisioning path (fallback)", () => {
    describe("when a personal workspace exists and a matching workflow is found", () => {
      it("calls triggerWorkflowManually with correct arguments and logs success", async () => {
        const box = makeBox({
          user: {
            workspaceMembers: [
              { workspace: makeWorkspace({ id: "ws-personal", isPersonal: true }) },
            ],
          },
        });
        const workflow = makeWorkflow({
          id: "wf-abc",
          name: "Provision Box",
          workspaceId: "ws-personal",
        });
        mockPrisma.box.findUnique.mockResolvedValue(box);
        mockPrisma.workflow.findFirst.mockResolvedValue(workflow);
        mockTriggerWorkflowManually.mockResolvedValue({ success: true });

        await triggerBoxProvisioning("box-1");

        expect(mockPrisma.workflow.findFirst).toHaveBeenCalledWith({
          where: {
            workspaceId: "ws-personal",
            name: "Provision Box",
            status: "ACTIVE",
          },
        });
        expect(mockTriggerWorkflowManually).toHaveBeenCalledWith("wf-abc", "ws-personal", {
          boxId: "box-1",
          userId: "user-1",
          tier: null,
        });
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Triggered workflow"));
        expect(mockPrisma.box.update).not.toHaveBeenCalled();
      });
    });

    describe("when only a non-personal workspace member exists (first fallback)", () => {
      it("uses the first workspace member when no personal workspace exists", async () => {
        const box = makeBox({
          user: {
            workspaceMembers: [{ workspace: makeWorkspace({ id: "ws-team", isPersonal: false }) }],
          },
        });
        const workflow = makeWorkflow({ workspaceId: "ws-team" });
        mockPrisma.box.findUnique.mockResolvedValue(box);
        mockPrisma.workflow.findFirst.mockResolvedValue(workflow);
        mockTriggerWorkflowManually.mockResolvedValue({ success: true });

        await triggerBoxProvisioning("box-1");

        expect(mockPrisma.workflow.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ workspaceId: "ws-team" }) }),
        );
        expect(mockTriggerWorkflowManually).toHaveBeenCalledOnce();
      });
    });

    describe("when triggerWorkflowManually throws", () => {
      it("calls failBox with workflow trigger error", async () => {
        const box = makeBox();
        const workflow = makeWorkflow();
        mockPrisma.box.findUnique.mockResolvedValue(box);
        mockPrisma.workflow.findFirst.mockResolvedValue(workflow);
        mockTriggerWorkflowManually.mockRejectedValue(new Error("Workflow engine crashed"));

        await triggerBoxProvisioning("box-1");

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("Workflow trigger error"),
        );
        expect(mockPrisma.box.update).toHaveBeenCalledWith({
          where: { id: "box-1" },
          data: { status: "ERROR" },
        });
      });
    });

    describe("when no workspace member exists", () => {
      it("calls failBox with 'No provisioning mechanism' message", async () => {
        const box = makeBox({
          user: { workspaceMembers: [] },
        });
        mockPrisma.box.findUnique.mockResolvedValue(box);

        await triggerBoxProvisioning("box-1");

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("No provisioning mechanism"),
        );
        expect(mockPrisma.box.update).toHaveBeenCalledWith({
          where: { id: "box-1" },
          data: { status: "ERROR" },
        });
        expect(mockPrisma.workflow.findFirst).not.toHaveBeenCalled();
      });
    });

    describe("when workspace exists but no matching workflow is found", () => {
      it("calls failBox with 'No provisioning mechanism' message", async () => {
        const box = makeBox({
          user: {
            workspaceMembers: [{ workspace: makeWorkspace({ id: "ws-1", isPersonal: true }) }],
          },
        });
        mockPrisma.box.findUnique.mockResolvedValue(box);
        mockPrisma.workflow.findFirst.mockResolvedValue(null);

        await triggerBoxProvisioning("box-1");

        expect(mockPrisma.workflow.findFirst).toHaveBeenCalledOnce();
        expect(mockTriggerWorkflowManually).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("No provisioning mechanism"),
        );
        expect(mockPrisma.box.update).toHaveBeenCalledWith({
          where: { id: "box-1" },
          data: { status: "ERROR" },
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // failBox: DB update fails silently inside failBox
  // -------------------------------------------------------------------------

  describe("failBox DB update failure", () => {
    it("logs the DB error but does not throw when prisma.box.update fails inside failBox", async () => {
      vi.stubEnv("BOX_PROVISIONING_WEBHOOK_URL", "https://example.com/provision");

      const box = makeBox();
      mockPrisma.box.findUnique.mockResolvedValue(box);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });
      vi.stubGlobal("fetch", mockFetch);

      // Make the DB update inside failBox itself fail
      mockPrisma.box.update.mockRejectedValue(new Error("DB connection lost"));

      await expect(triggerBoxProvisioning("box-1")).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update box status to ERROR"),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Outer try/catch: unhandled error
  // -------------------------------------------------------------------------

  describe("outer error handler", () => {
    it("logs an unhandled error and updates box status to ERROR when findUnique throws", async () => {
      mockPrisma.box.findUnique.mockRejectedValue(new Error("DB catastrophic failure"));
      mockPrisma.box.update.mockResolvedValue({});

      await expect(triggerBoxProvisioning("box-1")).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[BoxProvisioning] Unhandled error during provisioning",
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(mockPrisma.box.update).toHaveBeenCalledWith({
        where: { id: "box-1" },
        data: { status: "ERROR" },
      });
    });

    it("does not throw when outer catch DB update also fails", async () => {
      mockPrisma.box.findUnique.mockRejectedValue(new Error("DB catastrophic failure"));
      mockPrisma.box.update.mockRejectedValue(new Error("Still broken"));

      await expect(triggerBoxProvisioning("box-1")).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[BoxProvisioning] Unhandled error during provisioning",
        expect.objectContaining({ error: expect.any(Error) }),
      );
      // update was attempted but failed silently
      expect(mockPrisma.box.update).toHaveBeenCalledOnce();
    });
  });
});
