import { describe, expect, it } from "vitest";
import { createMockRegistry } from "../__test-utils__/mock-registry";
import { sessionTools } from "./session";
import { getJsonData, getText } from "../__test-utils__/assertions";

describe("session tools", () => {
  const registry = createMockRegistry(sessionTools);

  it("should create a session", async () => {
    const result = await registry.call("session_create", {
      name: "Test Session",
      description: "Sample",
    });
    const text = getText(result);
    expect(text).toContain("Session Test Session created");

    const data = getJsonData<{ id: string; status: string; }>(result);
    const sessionId = data.id;
    expect(sessionId).toBeDefined();
    expect(data.status).toBe("planning");
  });

  it("should assign roles and list sessions", async () => {
    const result = await registry.call("session_create", {
      name: "x",
      description: "y",
    });
    const data = getJsonData<{ id: string; }>(result);
    const sessionId = data.id;

    await registry.call("session_assign_role", {
      session_id: sessionId,
      role: "coder",
      agent_id: "agent-1",
    });

    const getRes = await registry.call("session_get", {
      session_id: sessionId,
    });
    const getData = getJsonData<
      { roles: Array<{ role: string; agentId: string; }>; }
    >(getRes);
    expect(getData.roles[0]!.role).toBe("coder");
    expect(getData.roles[0]!.agentId).toBe("agent-1");

    const listRes = await registry.call("session_list", { status: "planning" });
    expect(getText(listRes)).toContain("Found");
  });

  it("should add an event", async () => {
    const createRes = await registry.call("session_create", {
      name: "evt",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);
    const sessionId = createData.id;

    const result = await registry.call("session_log_event", {
      session_id: sessionId,
      type: "milestone",
      message: "First step done",
    });
    expect(getText(result)).toContain("Event logged");
  });

  it("should update session status", async () => {
    const createRes = await registry.call("session_create", {
      name: "status",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);

    const result = await registry.call("session_update_status", {
      session_id: createData.id,
      status: "coding",
    });
    expect(getText(result)).toContain("status updated to coding");
  });

  it("should get session metrics", async () => {
    const createRes = await registry.call("session_create", {
      name: "metrics",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);

    const result = await registry.call("session_get_metrics", {
      session_id: createData.id,
    });
    expect(getText(result)).toContain("Metrics for session");
    const data = getJsonData<{ totalTokensIn: number; }>(result);
    expect(data.totalTokensIn).toBe(0);
  });

  it("should close a session", async () => {
    const createRes = await registry.call("session_create", {
      name: "close",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);

    const result = await registry.call("session_close", {
      session_id: createData.id,
      summary: "All done",
    });
    expect(getText(result)).toContain("closed");
    const data = getJsonData<{ status: string; completedAt: string; }>(result);
    expect(data.status).toBe("completed");
    expect(data.completedAt).toBeDefined();
  });

  it("should error on missing session in get", async () => {
    const result = await registry.call("session_get", {
      session_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing session in assign_role", async () => {
    const result = await registry.call("session_assign_role", {
      session_id: "nonexistent",
      role: "coder",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing session in log_event", async () => {
    const result = await registry.call("session_log_event", {
      session_id: "nonexistent",
      type: "x",
      message: "y",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing session in update_status", async () => {
    const result = await registry.call("session_update_status", {
      session_id: "nonexistent",
      status: "coding",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing session in get_metrics", async () => {
    const result = await registry.call("session_get_metrics", {
      session_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing session in close", async () => {
    const result = await registry.call("session_close", {
      session_id: "nonexistent",
      summary: "done",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should reassign an existing role", async () => {
    const createRes = await registry.call("session_create", {
      name: "reassign",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);

    await registry.call("session_assign_role", {
      session_id: createData.id,
      role: "coder",
      agent_id: "agent-1",
    });

    await registry.call("session_assign_role", {
      session_id: createData.id,
      role: "coder",
      agent_id: "agent-2",
    });

    const getRes = await registry.call("session_get", {
      session_id: createData.id,
    });
    const getData = getJsonData<
      { roles: Array<{ role: string; agentId: string; }>; }
    >(getRes);
    expect(getData.roles).toHaveLength(1);
    expect(getData.roles[0]!.agentId).toBe("agent-2");
  });

  it("should create session with custom config", async () => {
    const result = await registry.call("session_create", {
      name: "Custom Config",
      description: "test",
      config: {
        maxIterations: 10,
        timeoutMs: 60000,
        autoDispatch: true,
        requireReview: false,
      },
    });
    const data = getJsonData<
      { config: { maxIterations: number; autoDispatch: boolean; }; }
    >(result);
    expect(data.config.maxIterations).toBe(10);
    expect(data.config.autoDispatch).toBe(true);
  });

  it("should list sessions without filter", async () => {
    const result = await registry.call("session_list", {});
    expect(getText(result)).toContain("Found");
  });

  it("should assign extended roles (16 agent roles)", async () => {
    const createRes = await registry.call("session_create", {
      name: "roles16",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);
    const sid = createData.id;

    const extendedRoles = [
      "tester",
      "architect",
      "security_analyst",
      "devops",
      "tech_lead",
      "documenter",
      "qa_engineer",
      "product_manager",
      "ux_designer",
      "data_engineer",
      "performance_engineer",
      "integration_tester",
      "release_manager",
    ];

    for (const role of extendedRoles) {
      const res = await registry.call("session_assign_role", {
        session_id: sid,
        role,
        agent_id: `agent-${role}`,
      });
      expect(getText(res)).toContain(`Role ${role} assigned`);
    }

    const getRes = await registry.call("session_get", { session_id: sid });
    const getData = getJsonData<{ roles: Array<{ role: string; }>; }>(getRes);
    expect(getData.roles).toHaveLength(extendedRoles.length);
  });

  it("should dispatch a task to an assigned role", async () => {
    const createRes = await registry.call("session_create", {
      name: "dispatch",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);
    const sid = createData.id;

    await registry.call("session_assign_role", {
      session_id: sid,
      role: "coder",
      agent_id: "agent-coder",
    });

    const result = await registry.call("session_dispatch_task", {
      session_id: sid,
      role: "coder",
      task: "Implement login form",
      priority: "high",
      context: ["src/auth.ts"],
    });

    expect(getText(result)).toContain("Task dispatched to coder");
    const data = getJsonData<
      { taskId: string; role: string; priority: string; context: string[]; }
    >(result);
    expect(data.role).toBe("coder");
    expect(data.priority).toBe("high");
    expect(data.context).toEqual(["src/auth.ts"]);
    expect(data.taskId).toBeDefined();
  });

  it("should error on dispatch to missing session", async () => {
    const result = await registry.call("session_dispatch_task", {
      session_id: "nonexistent",
      role: "coder",
      task: "Do something",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should reassign existing role without explicit agent_id (auto-generate)", async () => {
    const createRes = await registry.call("session_create", {
      name: "auto-agent",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);

    // First assignment with explicit agent_id
    await registry.call("session_assign_role", {
      session_id: createData.id,
      role: "coder",
      agent_id: "agent-1",
    });

    // Reassign same role WITHOUT agent_id — triggers auto-generation on existing role (line 159)
    await registry.call("session_assign_role", {
      session_id: createData.id,
      role: "coder",
    });

    const getRes = await registry.call("session_get", {
      session_id: createData.id,
    });
    const getData = getJsonData<
      { roles: Array<{ role: string; agentId: string; }>; }
    >(getRes);
    expect(getData.roles).toHaveLength(1);
    // Should have auto-generated agent ID (starts with "agent-")
    expect(getData.roles[0]!.agentId).toMatch(/^agent-/);
    expect(getData.roles[0]!.agentId).not.toBe("agent-1");
  });

  it("should dispatch task without context parameter", async () => {
    const createRes = await registry.call("session_create", {
      name: "no-ctx",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);

    await registry.call("session_assign_role", {
      session_id: createData.id,
      role: "coder",
      agent_id: "agent-coder",
    });

    const result = await registry.call("session_dispatch_task", {
      session_id: createData.id,
      role: "coder",
      task: "Build feature",
    });

    const data = getJsonData<{ context: string[]; }>(result);
    expect(data.context).toEqual([]);
  });

  it("should error on dispatch to unassigned role", async () => {
    const createRes = await registry.call("session_create", {
      name: "no-role",
      description: "test",
    });
    const createData = getJsonData<{ id: string; }>(createRes);

    const result = await registry.call("session_dispatch_task", {
      session_id: createData.id,
      role: "reviewer",
      task: "Review code",
    });
    expect(getText(result)).toContain("not assigned");
  });
});
