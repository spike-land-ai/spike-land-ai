import { beforeEach, describe, expect, it, vi } from "vitest";

const MockEC2Client = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-ec2", () => ({
  EC2Client: MockEC2Client,
}));

import { getEC2Client, getEC2Config } from "./ec2-client";

describe("ec2-client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.BOX_EC2_REGION;
    delete process.env.BOX_EC2_AMI_ID;
    delete process.env.BOX_EC2_INSTANCE_TYPE;
    delete process.env.BOX_EC2_KEY_NAME;
    delete process.env.BOX_EC2_SECURITY_GROUP_ID;
    delete process.env.BOX_EC2_SUBNET_ID;
    // Reset the global singleton between tests
    global.__ec2Client = undefined;
  });

  describe("getEC2Client", () => {
    describe("development mode", () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = "development";
      });

      it("returns a new EC2Client instance on each call (no singleton)", () => {
        const instance1 = getEC2Client();
        const instance2 = getEC2Client();

        expect(MockEC2Client).toHaveBeenCalledTimes(2);
        // Each call constructs a fresh instance rather than caching
        expect(instance1).not.toBe(instance2);
      });

      it("creates client with default region when BOX_EC2_REGION is not set", () => {
        getEC2Client();

        expect(MockEC2Client).toHaveBeenCalledWith({ region: "eu-west-2" });
      });

      it("creates client with BOX_EC2_REGION when env var is set", () => {
        process.env.BOX_EC2_REGION = "us-east-1";

        getEC2Client();

        expect(MockEC2Client).toHaveBeenCalledWith({ region: "us-east-1" });
      });

      it("does not write to global.__ec2Client", () => {
        getEC2Client();

        expect(global.__ec2Client).toBeUndefined();
      });
    });

    describe("production mode", () => {
      beforeEach(() => {
        (process.env as Record<string, string>).NODE_ENV = "production";
      });

      it("returns the same instance on subsequent calls (singleton)", () => {
        const instance1 = getEC2Client();
        const instance2 = getEC2Client();

        expect(MockEC2Client).toHaveBeenCalledTimes(1);
        expect(instance1).toBe(instance2);
      });

      it("stores the instance on global.__ec2Client", () => {
        const instance = getEC2Client();

        expect(global.__ec2Client).toBe(instance);
      });

      it("reuses an existing global.__ec2Client without constructing a new one", () => {
        // Simulate an already-cached singleton
        const existingInstance = {} as InstanceType<typeof MockEC2Client>;
        global.__ec2Client = existingInstance;

        const result = getEC2Client();

        expect(MockEC2Client).not.toHaveBeenCalled();
        expect(result).toBe(existingInstance);
      });

      it("creates client with default region when BOX_EC2_REGION is not set", () => {
        getEC2Client();

        expect(MockEC2Client).toHaveBeenCalledWith({ region: "eu-west-2" });
      });

      it("creates client with BOX_EC2_REGION when env var is set", () => {
        process.env.BOX_EC2_REGION = "ap-southeast-1";

        getEC2Client();

        expect(MockEC2Client).toHaveBeenCalledWith({ region: "ap-southeast-1" });
      });
    });
  });

  describe("getEC2Config", () => {
    const validEnv = {
      BOX_EC2_AMI_ID: "ami-0abc123456789",
      BOX_EC2_SECURITY_GROUP_ID: "sg-0abc123456789",
      BOX_EC2_SUBNET_ID: "subnet-0abc123456789",
    };

    beforeEach(() => {
      Object.assign(process.env, validEnv);
    });

    describe("success cases", () => {
      it("returns config with all required fields when all env vars are set", () => {
        const config = getEC2Config();

        expect(config).toEqual({
          region: "eu-west-2",
          amiId: "ami-0abc123456789",
          instanceType: "t4g.small",
          keyName: undefined,
          securityGroupId: "sg-0abc123456789",
          subnetId: "subnet-0abc123456789",
        });
      });

      it("uses default instanceType of t4g.small when BOX_EC2_INSTANCE_TYPE is not set", () => {
        const config = getEC2Config();

        expect(config.instanceType).toBe("t4g.small");
      });

      it("uses custom instanceType from BOX_EC2_INSTANCE_TYPE env var", () => {
        process.env.BOX_EC2_INSTANCE_TYPE = "t3.medium";

        const config = getEC2Config();

        expect(config.instanceType).toBe("t3.medium");
      });

      it("uses BOX_EC2_REGION when env var is set", () => {
        process.env.BOX_EC2_REGION = "us-west-2";

        const config = getEC2Config();

        expect(config.region).toBe("us-west-2");
      });

      it("uses default region eu-west-2 when BOX_EC2_REGION is not set", () => {
        const config = getEC2Config();

        expect(config.region).toBe("eu-west-2");
      });

      it("includes keyName from BOX_EC2_KEY_NAME when set", () => {
        process.env.BOX_EC2_KEY_NAME = "my-keypair";

        const config = getEC2Config();

        expect(config.keyName).toBe("my-keypair");
      });

      it("includes keyName as undefined when BOX_EC2_KEY_NAME is not set", () => {
        const config = getEC2Config();

        expect(config.keyName).toBeUndefined();
      });
    });

    describe("error cases", () => {
      it("throws when BOX_EC2_AMI_ID is missing", () => {
        delete process.env.BOX_EC2_AMI_ID;

        expect(() => getEC2Config()).toThrowError(
          "EC2 provisioning requires BOX_EC2_AMI_ID, BOX_EC2_SECURITY_GROUP_ID, and BOX_EC2_SUBNET_ID",
        );
      });

      it("throws when BOX_EC2_SECURITY_GROUP_ID is missing", () => {
        delete process.env.BOX_EC2_SECURITY_GROUP_ID;

        expect(() => getEC2Config()).toThrowError(
          "EC2 provisioning requires BOX_EC2_AMI_ID, BOX_EC2_SECURITY_GROUP_ID, and BOX_EC2_SUBNET_ID",
        );
      });

      it("throws when BOX_EC2_SUBNET_ID is missing", () => {
        delete process.env.BOX_EC2_SUBNET_ID;

        expect(() => getEC2Config()).toThrowError(
          "EC2 provisioning requires BOX_EC2_AMI_ID, BOX_EC2_SECURITY_GROUP_ID, and BOX_EC2_SUBNET_ID",
        );
      });

      it("throws when all required env vars are missing", () => {
        delete process.env.BOX_EC2_AMI_ID;
        delete process.env.BOX_EC2_SECURITY_GROUP_ID;
        delete process.env.BOX_EC2_SUBNET_ID;

        expect(() => getEC2Config()).toThrowError(
          "EC2 provisioning requires BOX_EC2_AMI_ID, BOX_EC2_SECURITY_GROUP_ID, and BOX_EC2_SUBNET_ID",
        );
      });

      it("throws an instance of Error when required env vars are missing", () => {
        delete process.env.BOX_EC2_AMI_ID;

        expect(() => getEC2Config()).toThrow(Error);
      });
    });
  });
});
