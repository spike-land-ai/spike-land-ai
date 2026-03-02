import { describe, expect, it } from "vitest";
import { aiOrchestratorTools } from "./tools";

describe("AI Orchestrator tools", () => {
  it("exports 15 tools", () => {
    expect(aiOrchestratorTools.length).toBe(15);
  });

  it("all tools have valid names starting with swarm_", () => {
    for (const tool of aiOrchestratorTools) {
      expect(tool.name).toMatch(/^swarm_/);
    }
  });

  it("covers swarm and swarm-monitoring categories", () => {
    const categories = new Set(aiOrchestratorTools.map((t) => t.category));
    expect(categories).toContain("swarm");
    expect(categories).toContain("swarm-monitoring");
  });

  it("swarm management tools are workspace tier", () => {
    const swarmTools = aiOrchestratorTools.filter((t) => t.category === "swarm");
    expect(swarmTools.length).toBe(11);
    for (const tool of swarmTools) {
      expect(tool.tier).toBe("workspace");
    }
  });

  it("monitoring tools are free tier and always enabled", () => {
    const monTools = aiOrchestratorTools.filter((t) => t.category === "swarm-monitoring");
    expect(monTools.length).toBe(4);
    for (const tool of monTools) {
      expect(tool.tier).toBe("free");
      expect(tool.alwaysEnabled).toBe(true);
    }
  });

  it("has expected tool names", () => {
    const names = aiOrchestratorTools.map((t) => t.name);
    expect(names).toContain("swarm_list_agents");
    expect(names).toContain("swarm_spawn_agent");
    expect(names).toContain("swarm_stop_agent");
    expect(names).toContain("swarm_broadcast");
    expect(names).toContain("swarm_topology");
    expect(names).toContain("swarm_send_message");
    expect(names).toContain("swarm_read_messages");
    expect(names).toContain("swarm_delegate_task");
    expect(names).toContain("swarm_get_metrics");
    expect(names).toContain("swarm_get_cost");
    expect(names).toContain("swarm_replay");
    expect(names).toContain("swarm_health");
  });
});
