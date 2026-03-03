import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock factories (must run before any imports)
// ---------------------------------------------------------------------------

const mockSend = vi.hoisted(() => vi.fn());

const mockEC2Client = vi.hoisted(() => ({
  send: mockSend,
}));

const mockGetEC2Client = vi.hoisted(() => vi.fn(() => mockEC2Client));

const mockPrisma = vi.hoisted(() => ({
  box: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("./ec2-client", () => ({
  getEC2Client: mockGetEC2Client,
}));

vi.mock("@aws-sdk/client-ec2", () => {
  class DescribeInstancesCommand {
    constructor(public input: unknown) {}
  }
  class StartInstancesCommand {
    constructor(public input: unknown) {}
  }
  class StopInstancesCommand {
    constructor(public input: unknown) {}
  }
  class RebootInstancesCommand {
    constructor(public input: unknown) {}
  }
  class TerminateInstancesCommand {
    constructor(public input: unknown) {}
  }
  return {
    DescribeInstancesCommand,
    StartInstancesCommand,
    StopInstancesCommand,
    RebootInstancesCommand,
    TerminateInstancesCommand,
  };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/logger", () => ({ default: mockLogger }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  getInstanceStatus,
  restartBoxInstance,
  startBoxInstance,
  stopBoxInstance,
  syncBoxStatus,
  terminateBoxInstance,
} from "./ec2-actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDescribeResponse(
  state: string,
  publicIp?: string,
  privateIp?: string,
) {
  return {
    Reservations: [
      {
        Instances: [
          {
            State: { Name: state },
            PublicIpAddress: publicIp,
            PrivateIpAddress: privateIp,
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ec2-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  describe("getInstanceStatus", () => {
    it("returns status with IPs when instance exists", async () => {
      mockSend.mockResolvedValueOnce(
        makeDescribeResponse("running", "1.2.3.4", "10.0.0.1"),
      );

      const result = await getInstanceStatus("i-abc123");

      expect(result).toEqual({
        state: "running",
        publicIp: "1.2.3.4",
        privateIp: "10.0.0.1",
      });
      expect(mockGetEC2Client).toHaveBeenCalledOnce();
    });

    it("returns status with null IPs when addresses are absent", async () => {
      mockSend.mockResolvedValueOnce(makeDescribeResponse("stopped"));

      const result = await getInstanceStatus("i-abc123");

      expect(result).toEqual({
        state: "stopped",
        publicIp: null,
        privateIp: null,
      });
    });

    it("falls back to 'unknown' when State.Name is undefined", async () => {
      mockSend.mockResolvedValueOnce({
        Reservations: [{ Instances: [{}] }],
      });

      const result = await getInstanceStatus("i-abc123");

      expect(result).toEqual({
        state: "unknown",
        publicIp: null,
        privateIp: null,
      });
    });

    it("returns null and logs when EC2 call throws", async () => {
      const err = new Error("EC2 unavailable");
      mockSend.mockRejectedValueOnce(err);

      const result = await getInstanceStatus("i-abc123");

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EC2] Failed to describe instance",
        err,
        { instanceId: "i-abc123" },
      );
    });

    it("returns null when Reservations array is empty", async () => {
      mockSend.mockResolvedValueOnce({ Reservations: [] });

      const result = await getInstanceStatus("i-abc123");

      expect(result).toBeNull();
    });

    it("returns null when Reservations is undefined", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await getInstanceStatus("i-abc123");

      expect(result).toBeNull();
    });

    it("returns null when Instances array is empty", async () => {
      mockSend.mockResolvedValueOnce({
        Reservations: [{ Instances: [] }],
      });

      const result = await getInstanceStatus("i-abc123");

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe("startBoxInstance", () => {
    it("returns true and logs info on success", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await startBoxInstance("i-start1");

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[EC2] Started instance i-start1",
      );
    });

    it("returns false and logs error when EC2 call throws", async () => {
      const err = new Error("start failed");
      mockSend.mockRejectedValueOnce(err);

      const result = await startBoxInstance("i-start1");

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EC2] Failed to start instance",
        err,
        { instanceId: "i-start1" },
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("stopBoxInstance", () => {
    it("returns true and logs info on success", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await stopBoxInstance("i-stop1");

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[EC2] Stopped instance i-stop1",
      );
    });

    it("returns false and logs error when EC2 call throws", async () => {
      const err = new Error("stop failed");
      mockSend.mockRejectedValueOnce(err);

      const result = await stopBoxInstance("i-stop1");

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EC2] Failed to stop instance",
        err,
        { instanceId: "i-stop1" },
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("restartBoxInstance", () => {
    it("returns true and logs info on success", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await restartBoxInstance("i-reboot1");

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[EC2] Rebooted instance i-reboot1",
      );
    });

    it("returns false and logs error when EC2 call throws", async () => {
      const err = new Error("reboot failed");
      mockSend.mockRejectedValueOnce(err);

      const result = await restartBoxInstance("i-reboot1");

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EC2] Failed to reboot instance",
        err,
        { instanceId: "i-reboot1" },
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("terminateBoxInstance", () => {
    it("returns true and logs info on success", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await terminateBoxInstance("i-term1");

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[EC2] Terminated instance i-term1",
      );
    });

    it("returns false and logs error when EC2 call throws", async () => {
      const err = new Error("terminate failed");
      mockSend.mockRejectedValueOnce(err);

      const result = await terminateBoxInstance("i-term1");

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EC2] Failed to terminate instance",
        err,
        { instanceId: "i-term1" },
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("syncBoxStatus", () => {
    it("returns early when prisma.box.findUnique throws (boxError)", async () => {
      mockPrisma.box.findUnique.mockRejectedValueOnce(new Error("DB down"));

      await syncBoxStatus("box-1");

      expect(mockSend).not.toHaveBeenCalled();
      expect(mockPrisma.box.update).not.toHaveBeenCalled();
    });

    it("returns early when box is not found (null)", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce(null);

      await syncBoxStatus("box-1");

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns early when box has no ec2InstanceId", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: null,
        status: "RUNNING",
      });

      await syncBoxStatus("box-1");

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns early when getInstanceStatus returns null (EC2 error)", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "RUNNING",
      });
      // EC2 send throws -> getInstanceStatus returns null
      mockSend.mockRejectedValueOnce(new Error("EC2 error"));

      await syncBoxStatus("box-1");

      expect(mockPrisma.box.update).not.toHaveBeenCalled();
    });

    it("returns early when EC2 state has no matching BoxStatus mapping", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "RUNNING",
      });
      mockSend.mockResolvedValueOnce(
        makeDescribeResponse("some-unknown-state", "1.2.3.4", "10.0.0.1"),
      );

      await syncBoxStatus("box-1");

      expect(mockPrisma.box.update).not.toHaveBeenCalled();
    });

    it("updates with STARTING status for 'pending' EC2 state", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "CREATING",
      });
      mockSend.mockResolvedValueOnce(
        makeDescribeResponse("pending", "1.2.3.4", "10.0.0.1"),
      );
      mockPrisma.box.update.mockResolvedValueOnce({});

      await syncBoxStatus("box-1");

      expect(mockPrisma.box.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "box-1" },
          data: expect.objectContaining({ status: "STARTING" }),
        }),
      );
    });

    it("updates with RUNNING status and sets IPs for 'running' EC2 state", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "STARTING",
      });
      mockSend.mockResolvedValueOnce(
        makeDescribeResponse("running", "5.6.7.8", "10.0.0.2"),
      );
      mockPrisma.box.update.mockResolvedValueOnce({});

      await syncBoxStatus("box-1");

      expect(mockPrisma.box.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "RUNNING",
            publicIp: "5.6.7.8",
            privateIp: "10.0.0.2",
          }),
        }),
      );
    });

    it("updates with STOPPING status for 'stopping' EC2 state", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "RUNNING",
      });
      mockSend.mockResolvedValueOnce(makeDescribeResponse("stopping"));
      mockPrisma.box.update.mockResolvedValueOnce({});

      await syncBoxStatus("box-1");

      expect(mockPrisma.box.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "STOPPING" }),
        }),
      );
    });

    it("updates with STOPPING status for 'shutting-down' EC2 state", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "RUNNING",
      });
      mockSend.mockResolvedValueOnce(makeDescribeResponse("shutting-down"));
      mockPrisma.box.update.mockResolvedValueOnce({});

      await syncBoxStatus("box-1");

      expect(mockPrisma.box.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "STOPPING" }),
        }),
      );
    });

    it("clears IPs when EC2 state is 'stopped'", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "STOPPING",
      });
      // Even if EC2 returns IPs, they must be cleared for STOPPED
      mockSend.mockResolvedValueOnce(
        makeDescribeResponse("stopped", "1.2.3.4", "10.0.0.1"),
      );
      mockPrisma.box.update.mockResolvedValueOnce({});

      await syncBoxStatus("box-1");

      expect(mockPrisma.box.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "STOPPED",
            publicIp: null,
            privateIp: null,
          }),
        }),
      );
    });

    it("clears IPs when EC2 state is 'terminated'", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "STOPPING",
      });
      mockSend.mockResolvedValueOnce(
        makeDescribeResponse("terminated", "1.2.3.4", "10.0.0.1"),
      );
      mockPrisma.box.update.mockResolvedValueOnce({});

      await syncBoxStatus("box-1");

      expect(mockPrisma.box.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "TERMINATED",
            publicIp: null,
            privateIp: null,
          }),
        }),
      );
    });

    it("does not include publicIp/privateIp in updateData when they are null (non-stopped state)", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "STARTING",
      });
      // running state but no IPs returned
      mockSend.mockResolvedValueOnce(makeDescribeResponse("running"));
      mockPrisma.box.update.mockResolvedValueOnce({});

      await syncBoxStatus("box-1");

      const updateCall = mockPrisma.box.update.mock.calls[0]?.[0] as
        | { data: Record<string, unknown>; }
        | undefined;
      expect(updateCall).toBeDefined();
      expect(updateCall!.data).not.toHaveProperty("publicIp");
      expect(updateCall!.data).not.toHaveProperty("privateIp");
      expect(updateCall!.data.status).toBe("RUNNING");
    });

    it("logs error when prisma.box.update throws", async () => {
      mockPrisma.box.findUnique.mockResolvedValueOnce({
        ec2InstanceId: "i-abc",
        status: "STARTING",
      });
      mockSend.mockResolvedValueOnce(makeDescribeResponse("running"));
      const updateErr = new Error("update failed");
      mockPrisma.box.update.mockRejectedValueOnce(updateErr);

      await syncBoxStatus("box-1");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[EC2] Failed to sync box status",
        updateErr,
        { boxId: "box-1" },
      );
    });
  });
});
