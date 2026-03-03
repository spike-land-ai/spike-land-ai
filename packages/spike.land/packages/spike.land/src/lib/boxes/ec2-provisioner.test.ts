/**
 * Comprehensive tests for ec2-provisioner.ts
 *
 * Strategy:
 * - All external dependencies are mocked via vi.hoisted + vi.mock
 * - fake timers eliminate real 5 s sleep delays
 * - Every branch of provisionEC2Box and createCloudflareTunnel is exercised
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock factories – must be declared before any vi.mock() calls
// ---------------------------------------------------------------------------

const mockPrismaBox = vi.hoisted(() => ({
  update: vi.fn(),
  findUnique: vi.fn(),
}));

const mockPrisma = vi.hoisted(() => ({
  box: mockPrismaBox,
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

/** Mutable holder so individual tests can swap out the implementation. */
const mockEC2Send = vi.hoisted(() => vi.fn());

const mockGetEC2Client = vi.hoisted(() => vi.fn(() => ({ send: mockEC2Send })));

const mockGetEC2Config = vi.hoisted(() =>
  vi.fn(() => ({
    region: "eu-west-2",
    amiId: "ami-12345678",
    instanceType: "t4g.small",
    keyName: "my-key",
    securityGroupId: "sg-abc",
    subnetId: "subnet-xyz",
  }))
);

const mockGetInstanceStatus = vi.hoisted(() => vi.fn());

const mockGenerateUserData = vi.hoisted(() => vi.fn(() => "dXNlci1kYXRh"));

// ---------------------------------------------------------------------------
// vi.mock() registrations
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({ default: mockLogger }));
vi.mock("./ec2-client", () => ({
  getEC2Client: mockGetEC2Client,
  getEC2Config: mockGetEC2Config,
}));
vi.mock("./ec2-actions", () => ({
  getInstanceStatus: mockGetInstanceStatus,
}));
vi.mock("./user-data-template", () => ({
  generateUserData: mockGenerateUserData,
}));

// RunInstancesCommand is a class – we just need it to be constructable and
// carry the input so we can inspect ec2.send() calls.
vi.mock("@aws-sdk/client-ec2", () => ({
  RunInstancesCommand: class RunInstancesCommand {
    public input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

// ---------------------------------------------------------------------------
// Import SUT after all mocks are registered
// ---------------------------------------------------------------------------

import { provisionEC2Box } from "./ec2-provisioner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal box object that satisfies BoxForProvisioning */
const makeBox = () => ({
  id: "box-test-id",
  name: "Test Box",
  userId: "user-test-id",
});

/** Default Cloudflare environment variables */
const CF_ENV = {
  CLOUDFLARE_ACCOUNT_ID: "cf-acct-123",
  CLOUDFLARE_API_TOKEN: "cf-token-abc",
};

/** Build a successful fetch response stub for the Cloudflare tunnel creation */
function makeCFCreateResponse() {
  return {
    ok: true,
    text: vi.fn().mockResolvedValue(""),
    json: vi.fn().mockResolvedValue({
      result: { id: "tunnel-id-999", token: "tunnel-token-abc" },
    }),
  };
}

/** Build a successful fetch response stub for the tunnel configuration PUT */
function makeCFConfigResponse() {
  return {
    ok: true,
    text: vi.fn().mockResolvedValue(""),
    json: vi.fn().mockResolvedValue({}),
  };
}

/** Successful RunInstances result */
const GOOD_RUN_RESULT = {
  Instances: [{ InstanceId: "i-0abc123" }],
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("provisionEC2Box", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Snapshot and restore env for every test
    originalEnv = { ...process.env };

    // Set default happy-path environment
    process.env.BOX_VNC_TOKEN_SECRET = "vnc-secret-value";
    Object.assign(process.env, CF_ENV);

    // Default: fetch resolves successfully for both CF calls
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeCFCreateResponse())
      .mockResolvedValueOnce(makeCFConfigResponse());
    vi.stubGlobal("fetch", fetchMock);

    // crypto.getRandomValues – fill with deterministic bytes
    vi.stubGlobal("crypto", {
      getRandomValues: (buf: Uint8Array) => {
        buf.fill(0xab);
        return buf;
      },
    });

    // Default EC2 send: RunInstances succeeds
    mockEC2Send.mockResolvedValue(GOOD_RUN_RESULT);

    // Default prisma.box.update resolves
    mockPrismaBox.update.mockResolvedValue({});

    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Missing BOX_VNC_TOKEN_SECRET
  // -------------------------------------------------------------------------
  describe("when BOX_VNC_TOKEN_SECRET env var is missing", () => {
    it("calls failBox and returns early without touching EC2 or Cloudflare", async () => {
      delete process.env.BOX_VNC_TOKEN_SECRET;

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await promise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("BOX_VNC_TOKEN_SECRET"),
      );
      // prisma.box.update must be called to set status=ERROR
      expect(mockPrismaBox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: box.id },
          data: { status: "ERROR" },
        }),
      );
      // EC2 must never be reached
      expect(mockEC2Send).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Cloudflare – missing account/token env vars
  // -------------------------------------------------------------------------
  describe("when Cloudflare credentials are missing", () => {
    it("fails box with tunnel error when CLOUDFLARE_ACCOUNT_ID is absent", async () => {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;

      const box = makeBox();
      await provisionEC2Box(box);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("CLOUDFLARE_ACCOUNT_ID"),
      );
      // failBox is then called a second time for tunnel failure
      expect(mockPrismaBox.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "ERROR" } }),
      );
      expect(mockEC2Send).not.toHaveBeenCalled();
    });

    it("fails box with tunnel error when CLOUDFLARE_API_TOKEN is absent", async () => {
      delete process.env.CLOUDFLARE_API_TOKEN;

      const box = makeBox();
      await provisionEC2Box(box);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("CLOUDFLARE_API_TOKEN"),
      );
      expect(mockEC2Send).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Cloudflare tunnel creation – fetch throws (network error)
  // -------------------------------------------------------------------------
  describe("when Cloudflare fetch throws a network error", () => {
    it("logs error and fails the box", async () => {
      const networkError = new Error("ECONNREFUSED");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(networkError));

      const box = makeBox();
      await provisionEC2Box(box);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create Cloudflare tunnel"),
        undefined,
        expect.objectContaining({ body: expect.any(String) }),
      );
      expect(mockPrismaBox.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "ERROR" } }),
      );
      expect(mockEC2Send).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Cloudflare tunnel creation – non-ok HTTP response
  // -------------------------------------------------------------------------
  describe("when Cloudflare returns a non-ok response", () => {
    it("logs the response body and fails the box", async () => {
      const badResponse = {
        ok: false,
        text: vi.fn().mockResolvedValue("Unauthorized"),
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(badResponse));

      const box = makeBox();
      await provisionEC2Box(box);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create Cloudflare tunnel"),
        undefined,
        expect.objectContaining({ body: "Unauthorized" }),
      );
      expect(mockEC2Send).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Cloudflare tunnel configuration fetch throws (now fatal — aborts provisioning)
  // -------------------------------------------------------------------------
  describe("when Cloudflare tunnel configuration PUT throws", () => {
    it("logs the config error and aborts provisioning", async () => {
      const configError = new Error("PUT timeout");
      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce(makeCFCreateResponse()) // create OK
          .mockRejectedValueOnce(configError), // config throws
      );

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to configure tunnel"),
        configError,
      );
      // Tunnel config failure is now fatal — EC2 should NOT have been called
      expect(mockEC2Send).not.toHaveBeenCalled();
      // Box should be marked as ERROR
      expect(mockPrismaBox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ERROR" }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. EC2 config error (getEC2Config throws)
  // -------------------------------------------------------------------------
  describe("when getEC2Config throws", () => {
    it("fails the box with the config error message", async () => {
      const cfgError = new Error("Missing BOX_EC2_AMI_ID");
      mockGetEC2Config.mockImplementationOnce(() => {
        throw cfgError;
      });

      const box = makeBox();
      await provisionEC2Box(box);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("EC2 config error"),
      );
      expect(mockPrismaBox.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "ERROR" } }),
      );
      expect(mockEC2Send).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 7. RunInstances fails (ec2.send throws)
  // -------------------------------------------------------------------------
  describe("when RunInstancesCommand throws", () => {
    it("fails the box and does not start polling", async () => {
      mockEC2Send.mockRejectedValueOnce(new Error("InvalidAMI"));

      const box = makeBox();
      await provisionEC2Box(box);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("EC2 RunInstances failed"),
      );
      expect(mockPrismaBox.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "ERROR" } }),
      );
      expect(mockGetInstanceStatus).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 8. RunInstances returns no instances (empty Instances array)
  // -------------------------------------------------------------------------
  describe("when RunInstances returns an empty Instances list", () => {
    it("fails the box and does not start polling", async () => {
      mockEC2Send.mockResolvedValueOnce({ Instances: [] });

      const box = makeBox();
      await provisionEC2Box(box);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("EC2 RunInstances failed"),
      );
      expect(mockGetInstanceStatus).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 9. RunInstances returns undefined Instances
  // -------------------------------------------------------------------------
  describe("when RunInstances returns undefined Instances", () => {
    it("fails the box and does not start polling", async () => {
      mockEC2Send.mockResolvedValueOnce({});

      const box = makeBox();
      await provisionEC2Box(box);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("EC2 RunInstances failed"),
      );
      expect(mockGetInstanceStatus).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 10. DB save error after launch (non-fatal – provisioning continues)
  // -------------------------------------------------------------------------
  describe("when saving instance ID to DB fails", () => {
    it("logs the error and continues to poll", async () => {
      const dbError = new Error("DB write error");

      // First update (save instanceId) rejects; subsequent updates resolve
      mockPrismaBox.update
        .mockRejectedValueOnce(dbError)
        .mockResolvedValue({});

      // Instance goes straight to running on first poll
      mockGetInstanceStatus.mockResolvedValue({
        state: "running",
        publicIp: "1.2.3.4",
        privateIp: "10.0.0.1",
      });

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to save instance ID to DB"),
        dbError,
      );
      // Polling must have happened
      expect(mockGetInstanceStatus).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 11. Poll loop: getInstanceStatus returns null (continue to next attempt)
  // -------------------------------------------------------------------------
  describe("when getInstanceStatus returns null for a few attempts then running", () => {
    it("continues polling until instance reaches running state", async () => {
      mockGetInstanceStatus
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          state: "running",
          publicIp: "5.5.5.5",
          privateIp: "10.0.0.5",
        });

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockGetInstanceStatus).toHaveBeenCalledTimes(3);
      // Final update should mark box as RUNNING
      expect(mockPrismaBox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "RUNNING" }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 12. Poll loop: instance terminates unexpectedly
  // -------------------------------------------------------------------------
  describe("when instance terminates during polling", () => {
    it("calls failBox immediately upon detecting terminated state", async () => {
      mockGetInstanceStatus.mockResolvedValue({
        state: "terminated",
        publicIp: null,
        privateIp: null,
      });

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("terminated unexpectedly"),
      );
      expect(mockPrismaBox.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "ERROR" } }),
      );
    });

    it("also fails box when state is shutting-down", async () => {
      mockGetInstanceStatus.mockResolvedValue({
        state: "shutting-down",
        publicIp: null,
        privateIp: null,
      });

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("terminated unexpectedly"),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 13. Poll loop: timeout (exceeds MAX_POLL_ATTEMPTS = 60)
  // -------------------------------------------------------------------------
  describe("when instance never reaches running state within 60 attempts", () => {
    it("calls failBox with a timeout message after exhausting all attempts", async () => {
      // Always return a pending state so we exhaust all 60 attempts
      mockGetInstanceStatus.mockResolvedValue({
        state: "pending",
        publicIp: null,
        privateIp: null,
      });

      const box = makeBox();
      const promise = provisionEC2Box(box);
      // Advance all pending timers (60 * 5000 ms worth of sleeps)
      await vi.runAllTimersAsync();
      await promise;

      expect(mockGetInstanceStatus).toHaveBeenCalledTimes(60);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("did not reach running state within timeout"),
      );
      expect(mockPrismaBox.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "ERROR" } }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 14. Full success path
  // -------------------------------------------------------------------------
  describe("happy path: instance reaches running state on first poll", () => {
    it("logs RUNNING, calls all mocks in order, and resolves", async () => {
      const instanceStatus = {
        state: "running",
        publicIp: "203.0.113.10",
        privateIp: "172.16.0.5",
      };
      mockGetInstanceStatus.mockResolvedValue(instanceStatus);

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      // Cloudflare create fetch was called
      const fetchMock = vi.mocked(global.fetch);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("cfd_tunnel"),
        expect.objectContaining({ method: "POST" }),
      );

      // EC2 RunInstances was called with correct tags
      expect(mockEC2Send).toHaveBeenCalledTimes(1);

      // generateUserData was called with the VNC secret and tunnel token
      expect(mockGenerateUserData).toHaveBeenCalledWith(
        "vnc-secret-value",
        "tunnel-token-abc",
      );

      // First prisma.box.update: save instanceId + STARTING
      expect(mockPrismaBox.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: box.id },
          data: expect.objectContaining({
            ec2InstanceId: "i-0abc123",
            status: "STARTING",
          }),
        }),
      );

      // Second prisma.box.update: set RUNNING with IPs
      expect(mockPrismaBox.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: box.id },
          data: expect.objectContaining({
            status: "RUNNING",
            publicIp: instanceStatus.publicIp,
            privateIp: instanceStatus.privateIp,
          }),
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("is now RUNNING"),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 15. DB update error when marking as RUNNING
  // -------------------------------------------------------------------------
  describe("when the final DB update to RUNNING fails", () => {
    it("logs the update error without re-failing the box", async () => {
      const updateError = new Error("Unique constraint violation");

      mockGetInstanceStatus.mockResolvedValue({
        state: "running",
        publicIp: "1.1.1.1",
        privateIp: "10.0.0.2",
      });

      // First update (save instanceId): resolve; second update (RUNNING): reject
      mockPrismaBox.update
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(updateError);

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update box as RUNNING"),
        updateError,
      );
      // The function should return without calling failBox again
      // (no extra update with ERROR status)
      const errorStatusCalls = mockPrismaBox.update.mock.calls.filter(
        ([arg]) => arg?.data?.status === "ERROR",
      );
      expect(errorStatusCalls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 16. Tunnel URL is used as connectionUrl in final update
  // -------------------------------------------------------------------------
  describe("connectionUrl", () => {
    it("sets connectionUrl in the RUNNING update and tunnelUrl in the STARTING update", async () => {
      mockGetInstanceStatus.mockResolvedValue({
        state: "running",
        publicIp: "9.9.9.9",
        privateIp: "192.168.1.1",
      });

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      const expectedTunnelUrl = "https://tunnel-id-999.cfargotunnel.com";

      // First update (save instanceId / STARTING) carries tunnelUrl
      expect(mockPrismaBox.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            tunnelUrl: expectedTunnelUrl,
          }),
        }),
      );

      // Second update (RUNNING) carries connectionUrl
      expect(mockPrismaBox.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            connectionUrl: expectedTunnelUrl,
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 17. crypto.getRandomValues is called to generate the tunnel secret
  // -------------------------------------------------------------------------
  describe("tunnel secret generation", () => {
    it("invokes crypto.getRandomValues to produce a 32-byte secret", async () => {
      const getRandomValuesSpy = vi.spyOn(crypto, "getRandomValues");

      mockGetInstanceStatus.mockResolvedValue({
        state: "running",
        publicIp: "8.8.8.8",
        privateIp: "10.0.0.8",
      });

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      expect(getRandomValuesSpy).toHaveBeenCalledWith(
        expect.any(Uint8Array),
      );
      const callArg = getRandomValuesSpy.mock.calls[0]?.[0] as Uint8Array | undefined;
      expect(callArg).toBeDefined();
      expect(callArg!).toHaveLength(32);
    });
  });

  // -------------------------------------------------------------------------
  // 18. Box tags are set correctly in RunInstances command
  // -------------------------------------------------------------------------
  describe("EC2 instance tags", () => {
    it("tags the instance with BoxId, UserId, Name and ManagedBy", async () => {
      mockGetInstanceStatus.mockResolvedValue({
        state: "running",
        publicIp: "2.2.2.2",
        privateIp: "10.0.0.2",
      });

      const box = makeBox();
      const promise = provisionEC2Box(box);
      await vi.runAllTimersAsync();
      await promise;

      const sendArg = mockEC2Send.mock.calls[0]?.[0] as
        | {
          input: { TagSpecifications: Array<{ Tags: Array<{ Key: string; Value: string; }>; }>; };
        }
        | undefined;
      expect(sendArg).toBeDefined();
      const tags = sendArg!.input.TagSpecifications[0]!.Tags as Array<
        { Key: string; Value: string; }
      >;

      expect(tags).toEqual(
        expect.arrayContaining([
          { Key: "BoxId", Value: box.id },
          { Key: "UserId", Value: box.userId },
          { Key: "Name", Value: `box-${box.id}` },
          { Key: "ManagedBy", Value: "spike-land-boxes" },
        ]),
      );
    });
  });
});
