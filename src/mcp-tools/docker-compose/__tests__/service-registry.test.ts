import { describe, it, expect, vi, beforeEach } from "vitest";
import http from "node:http";
import { ServiceRegistry } from "../core-logic/service-registry.js";

vi.mock("node:http", () => {
  const mockRequest = vi.fn();
  return {
    default: { request: mockRequest },
    request: mockRequest,
  };
});

function setupMockResponse(data: unknown, statusCode = 200) {
  const mockReq = {
    on: vi.fn(),
    end: vi.fn(),
  };

  (http.request as ReturnType<typeof vi.fn>).mockImplementation(
    (_opts: unknown, callback: (res: unknown) => void) => {
      const body = JSON.stringify(data);
      const res = {
        statusCode,
        on: vi.fn((event: string, handler: (chunk?: Buffer) => void) => {
          if (event === "data") handler(Buffer.from(body));
          if (event === "end") handler();
        }),
      };
      callback(res);
      return mockReq;
    },
  );

  return mockReq;
}

describe("ServiceRegistry", () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ServiceRegistry("/var/run/docker.sock");
  });

  describe("listServices", () => {
    it("parses Docker containers into ServiceInfo", async () => {
      const containers = [
        {
          Id: "abc123def456789",
          Names: ["/spike-edge"],
          State: "running",
          Labels: {
            "spike.service": "spike-edge",
            "spike.subdomain": "api",
            "spike.port": "8787",
            "spike.type": "worker",
          },
          Ports: [{ PrivatePort: 8787, PublicPort: 8787, Type: "tcp" }],
        },
        {
          Id: "def456789abc123",
          Names: ["/spike-app"],
          State: "running",
          Labels: {
            "spike.service": "spike-app",
            "spike.subdomain": "app",
            "spike.port": "5173",
            "spike.type": "frontend",
          },
          Ports: [{ PrivatePort: 5173, Type: "tcp" }],
        },
      ];

      setupMockResponse(containers);

      const services = await registry.listServices();
      expect(services).toHaveLength(2);
      expect(services[0]).toEqual({
        name: "spike-edge",
        subdomain: "api",
        port: 8787,
        type: "worker",
        status: "running",
        containerId: "abc123def456",
      });
      expect(services[1]).toEqual({
        name: "spike-app",
        subdomain: "app",
        port: 5173,
        type: "frontend",
        status: "running",
        containerId: "def456789abc",
      });
    });

    it("maps exited state correctly", async () => {
      const containers = [
        {
          Id: "abc123def456789",
          Names: ["/stopped-svc"],
          State: "exited",
          Labels: {
            "spike.service": "stopped-svc",
            "spike.subdomain": "stopped",
            "spike.port": "3000",
            "spike.type": "backend",
          },
          Ports: [],
        },
      ];

      setupMockResponse(containers);

      const services = await registry.listServices();
      expect(services[0].status).toBe("exited");
    });

    it("falls back to container name when labels are missing", async () => {
      const containers = [
        {
          Id: "abc123def456789",
          Names: ["/my-container"],
          State: "running",
          Labels: { "spike.service": "" },
          Ports: [{ PrivatePort: 80, Type: "tcp" }],
        },
      ];

      setupMockResponse(containers);

      const services = await registry.listServices();
      expect(services[0].name).toBe("my-container");
    });

    it("throws on Docker API error", async () => {
      setupMockResponse({ message: "error" }, 500);

      await expect(registry.listServices()).rejects.toThrow("Docker API");
    });
  });
});
