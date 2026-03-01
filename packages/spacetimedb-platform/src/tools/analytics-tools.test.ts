import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMockPlatformClient, createMockServer } from "../__test-utils__/index.js";
import type { MockMcpServer, MockPlatformClient } from "../__test-utils__/index.js";
import { registerAnalyticsTools } from "./analytics-tools.js";

describe("analytics-tools", () => {
  let server: MockMcpServer;
  let client: MockPlatformClient;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    client = createMockPlatformClient({ connected: true });
    registerAnalyticsTools(server as unknown as McpServer, client);
  });

  it("registers all analytics tools", () => {
    const toolNames = [...server.handlers.keys()];
    expect(toolNames).toContain("stdb_record_event");
    expect(toolNames).toContain("stdb_query_events");
    expect(toolNames).toContain("stdb_analytics_dashboard");
    expect(toolNames).toContain("stdb_health_check");
    expect(server.tool).toHaveBeenCalledTimes(4);
  });

  // ─── stdb_record_event ───

  describe("stdb_record_event", () => {
    it("records an event", async () => {
      const result = await server.call("stdb_record_event", {
        source: "web", eventType: "page_view", metadataJson: '{"page":"/home"}',
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.recorded).toBe(true);
      expect(parsed.source).toBe("web");
      expect(parsed.eventType).toBe("page_view");
      expect(client.recordEvent).toHaveBeenCalledWith("web", "page_view", '{"page":"/home"}');
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerAnalyticsTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_record_event", {
        source: "x", eventType: "y", metadataJson: "{}",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("NOT_CONNECTED");
    });

    it("returns REDUCER_FAILED on error", async () => {
      client.recordEvent = vi.fn(async () => { throw new Error("Reducer panicked"); });
      const result = await server.call("stdb_record_event", {
        source: "x", eventType: "y", metadataJson: "{}",
      });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("REDUCER_FAILED");
    });

    it("handles non-Error thrown values", async () => {
      client.recordEvent = vi.fn(async () => { throw "string error"; });
      const result = await server.call("stdb_record_event", {
        source: "x", eventType: "y", metadataJson: "{}",
      });
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_query_events ───

  describe("stdb_query_events", () => {
    it("queries all events", async () => {
      client._platformEvents.push(
        { id: 1n, source: "web", eventType: "view", metadataJson: "{}", userIdentity: "u1", timestamp: 1000n },
        { id: 2n, source: "api", eventType: "call", metadataJson: "{}", userIdentity: undefined, timestamp: 2000n },
      );
      const result = await server.call("stdb_query_events", { limit: 100 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
    });

    it("filters by event type", async () => {
      client._platformEvents.push(
        { id: 1n, source: "web", eventType: "view", metadataJson: "{}", userIdentity: undefined, timestamp: 1000n },
        { id: 2n, source: "web", eventType: "click", metadataJson: "{}", userIdentity: undefined, timestamp: 2000n },
      );
      const result = await server.call("stdb_query_events", { eventType: "click", limit: 100 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.events[0].eventType).toBe("click");
    });

    it("filters by source", async () => {
      client._platformEvents.push(
        { id: 1n, source: "web", eventType: "view", metadataJson: "{}", userIdentity: undefined, timestamp: 1000n },
        { id: 2n, source: "api", eventType: "view", metadataJson: "{}", userIdentity: undefined, timestamp: 2000n },
      );
      const result = await server.call("stdb_query_events", { source: "api", limit: 100 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(1);
      expect(parsed.events[0].source).toBe("api");
    });

    it("respects limit", async () => {
      for (let i = 0; i < 5; i++) {
        client._platformEvents.push({
          id: BigInt(i), source: "web", eventType: "view", metadataJson: "{}",
          userIdentity: undefined, timestamp: BigInt(i * 1000),
        });
      }
      const result = await server.call("stdb_query_events", { limit: 2 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerAnalyticsTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_query_events", {});
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_analytics_dashboard ───

  describe("stdb_analytics_dashboard", () => {
    it("returns dashboard summary", async () => {
      client._platformEvents.push(
        { id: 1n, source: "web", eventType: "view", metadataJson: "{}", userIdentity: undefined, timestamp: 1000n },
        { id: 2n, source: "web", eventType: "click", metadataJson: "{}", userIdentity: undefined, timestamp: 2000n },
        { id: 3n, source: "api", eventType: "view", metadataJson: "{}", userIdentity: undefined, timestamp: 3000n },
      );
      const result = await server.call("stdb_analytics_dashboard", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.totalEvents).toBe(3);
      expect(parsed.byType.view).toBe(2);
      expect(parsed.byType.click).toBe(1);
      expect(parsed.bySource.web).toBe(2);
      expect(parsed.bySource.api).toBe(1);
    });

    it("returns empty dashboard when no events", async () => {
      const result = await server.call("stdb_analytics_dashboard", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.totalEvents).toBe(0);
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerAnalyticsTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_analytics_dashboard", {});
      expect(result.isError).toBe(true);
    });
  });

  // ─── stdb_health_check ───

  describe("stdb_health_check", () => {
    it("returns health status", async () => {
      client._healthChecks.push(
        { id: 1n, service: "spacetimedb", status: "healthy", latencyMs: 12, checkedAt: 1000n },
        { id: 2n, service: "r2", status: "healthy", latencyMs: 45, checkedAt: 1000n },
      );
      const result = await server.call("stdb_health_check", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(2);
      expect(parsed.checks[0].service).toBe("spacetimedb");
      expect(parsed.checks[0].latencyMs).toBe(12);
    });

    it("returns empty when no checks", async () => {
      const result = await server.call("stdb_health_check", {});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.count).toBe(0);
    });

    it("returns NOT_CONNECTED when disconnected", async () => {
      const dcClient = createMockPlatformClient({ connected: false });
      const dcServer = createMockServer();
      registerAnalyticsTools(dcServer as unknown as McpServer, dcClient);
      const result = await dcServer.call("stdb_health_check", {});
      expect(result.isError).toBe(true);
    });

    it("returns QUERY_FAILED on error", async () => {
      client.getHealthStatus = vi.fn(() => { throw new Error("DB error"); });
      const result = await server.call("stdb_health_check", {});
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toBe("QUERY_FAILED");
    });
  });
});
