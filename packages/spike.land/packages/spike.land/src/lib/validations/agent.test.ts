import { describe, expect, it } from "vitest";

import {
  agentConnectSchema,
  agentHeartbeatSchema,
  agentListQuerySchema,
  agentMessageSchema,
  agentUpdateSchema,
  connectionRequestSchema,
  generateAgentId,
  messageListQuerySchema,
  parseAgentId,
  sendTaskSchema,
  validateAgentConnect,
  validateAgentHeartbeat,
  validateAgentMessage,
  validateConnectionRequest,
  validateSendTask,
} from "./agent";

// ---------------------------------------------------------------------------
// Schemas – valid data
// ---------------------------------------------------------------------------

describe("agentConnectSchema", () => {
  it("accepts valid input", () => {
    const result = agentConnectSchema.safeParse({
      machineId: "machine-12345",
      sessionId: "session-12345",
      displayName: "Agent 1",
      projectPath: "/home/user/project",
      workingDirectory: "/home/user/project/src",
    });
    expect(result.success).toBe(true);
  });

  it("rejects machineId shorter than 8 chars", () => {
    const result = agentConnectSchema.safeParse({
      machineId: "short",
      sessionId: "session-12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects machineId longer than 64 chars", () => {
    const result = agentConnectSchema.safeParse({
      machineId: "x".repeat(65),
      sessionId: "session-12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing sessionId", () => {
    const result = agentConnectSchema.safeParse({
      machineId: "machine-12345",
    });
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be omitted", () => {
    const result = agentConnectSchema.safeParse({
      machineId: "machine-12345",
      sessionId: "session-12345",
    });
    expect(result.success).toBe(true);
  });
});

describe("agentHeartbeatSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = agentHeartbeatSchema.safeParse({
      machineId: "m",
      sessionId: "s",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("online");
    }
  });

  it("accepts sleeping status", () => {
    const result = agentHeartbeatSchema.safeParse({
      machineId: "m",
      sessionId: "s",
      status: "sleeping",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("sleeping");
    }
  });

  it("rejects invalid status", () => {
    const result = agentHeartbeatSchema.safeParse({
      machineId: "m",
      sessionId: "s",
      status: "busy",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional activity object", () => {
    const result = agentHeartbeatSchema.safeParse({
      machineId: "m",
      sessionId: "s",
      activity: {
        type: "coding",
        description: "Writing tests",
        metadata: { file: "test.ts" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects activity missing type", () => {
    const result = agentHeartbeatSchema.safeParse({
      machineId: "m",
      sessionId: "s",
      activity: {
        description: "Writing tests",
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts toolUsage and tokensUsed", () => {
    const result = agentHeartbeatSchema.safeParse({
      machineId: "m",
      sessionId: "s",
      toolUsage: { Read: 5, Write: 2 },
      tokensUsed: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative tokensUsed", () => {
    const result = agentHeartbeatSchema.safeParse({
      machineId: "m",
      sessionId: "s",
      tokensUsed: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("agentUpdateSchema", () => {
  it("accepts valid displayName", () => {
    const result = agentUpdateSchema.safeParse({ displayName: "New Name" });
    expect(result.success).toBe(true);
  });

  it("rejects empty displayName", () => {
    const result = agentUpdateSchema.safeParse({ displayName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects displayName > 100 chars", () => {
    const result = agentUpdateSchema.safeParse({
      displayName: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe("sendTaskSchema", () => {
  it("accepts valid prompt", () => {
    const result = sendTaskSchema.safeParse({ prompt: "Fix the tests" });
    expect(result.success).toBe(true);
  });

  it("rejects empty prompt", () => {
    const result = sendTaskSchema.safeParse({ prompt: "" });
    expect(result.success).toBe(false);
  });

  it("rejects prompt > 10000 chars", () => {
    const result = sendTaskSchema.safeParse({ prompt: "x".repeat(10001) });
    expect(result.success).toBe(false);
  });
});

describe("agentListQuerySchema", () => {
  it("provides defaults", () => {
    const result = agentListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("all");
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it("coerces string numbers", () => {
    const result = agentListQuerySchema.safeParse({
      limit: "25",
      offset: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
      expect(result.data.offset).toBe(10);
    }
  });

  it("rejects limit > 100", () => {
    const result = agentListQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("accepts valid status values", () => {
    for (const status of ["online", "sleeping", "offline", "all"]) {
      const result = agentListQuerySchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });
});

describe("connectionRequestSchema", () => {
  it("accepts valid request", () => {
    const result = connectionRequestSchema.safeParse({
      machineId: "machine-12345",
      sessionId: "session-12345",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short machineId", () => {
    const result = connectionRequestSchema.safeParse({
      machineId: "short",
      sessionId: "session-12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("agentMessageSchema", () => {
  it("accepts valid message with default role", () => {
    const result = agentMessageSchema.safeParse({ content: "Hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("USER");
    }
  });

  it("accepts AGENT role", () => {
    const result = agentMessageSchema.safeParse({
      content: "Response",
      role: "AGENT",
    });
    expect(result.success).toBe(true);
  });

  it("accepts SYSTEM role", () => {
    const result = agentMessageSchema.safeParse({
      content: "System msg",
      role: "SYSTEM",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = agentMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects content > 10000 chars", () => {
    const result = agentMessageSchema.safeParse({
      content: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });
});

describe("messageListQuerySchema", () => {
  it("provides defaults", () => {
    const result = messageListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
      expect(result.data.unreadOnly).toBe(false);
    }
  });

  it("coerces unreadOnly boolean", () => {
    const result = messageListQuerySchema.safeParse({ unreadOnly: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unreadOnly).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

describe("validateAgentConnect", () => {
  it("returns success with valid data", () => {
    const result = validateAgentConnect({
      machineId: "machine-12345",
      sessionId: "session-12345",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.machineId).toBe("machine-12345");
    }
  });

  it("returns error for invalid data", () => {
    const result = validateAgentConnect({ machineId: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it("includes field path in error message", () => {
    const result = validateAgentConnect({ machineId: "short", sessionId: "s" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("machineId");
    }
  });
});

describe("validateAgentHeartbeat", () => {
  it("returns success with valid data", () => {
    const result = validateAgentHeartbeat({
      machineId: "m",
      sessionId: "s",
    });
    expect(result.success).toBe(true);
  });

  it("returns error for missing fields", () => {
    const result = validateAgentHeartbeat({});
    expect(result.success).toBe(false);
  });
});

describe("validateSendTask", () => {
  it("returns success with valid prompt", () => {
    const result = validateSendTask({ prompt: "Do something" });
    expect(result.success).toBe(true);
  });

  it("returns error for empty prompt", () => {
    const result = validateSendTask({ prompt: "" });
    expect(result.success).toBe(false);
  });
});

describe("validateConnectionRequest", () => {
  it("returns success with valid data", () => {
    const result = validateConnectionRequest({
      machineId: "machine-12345",
      sessionId: "session-12345",
    });
    expect(result.success).toBe(true);
  });

  it("returns error for invalid data", () => {
    const result = validateConnectionRequest({});
    expect(result.success).toBe(false);
  });
});

describe("validateAgentMessage", () => {
  it("returns success with valid message", () => {
    const result = validateAgentMessage({ content: "Hello" });
    expect(result.success).toBe(true);
  });

  it("returns error for empty content", () => {
    const result = validateAgentMessage({ content: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

describe("generateAgentId", () => {
  it("joins machineId and sessionId with colon", () => {
    expect(generateAgentId("machine1", "session2")).toBe("machine1:session2");
  });
});

describe("parseAgentId", () => {
  it("splits a valid agent id", () => {
    const result = parseAgentId("machine1:session2");
    expect(result).toEqual({ machineId: "machine1", sessionId: "session2" });
  });

  it("returns null for missing colon", () => {
    expect(parseAgentId("nocolon")).toBeNull();
  });

  it("returns null for empty parts", () => {
    expect(parseAgentId(":session")).toBeNull();
    expect(parseAgentId("machine:")).toBeNull();
  });

  it("returns null for multiple colons", () => {
    expect(parseAgentId("a:b:c")).toBeNull();
  });
});
