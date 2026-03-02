import { describe, it, expect } from "vitest";
import { loadEnabledCategories, saveEnabledCategories } from "./categories";
import { mockKV } from "../__test-utils__/mock-env";

describe("Category persistence", () => {
  it("returns empty array when no data", async () => {
    const kv = mockKV();
    const result = await loadEnabledCategories("user1", kv);
    expect(result).toEqual([]);
  });

  it("saves and loads categories", async () => {
    const kv = mockKV();
    await saveEnabledCategories("user1", ["swarm", "vault", "workspaces"], kv);
    const result = await loadEnabledCategories("user1", kv);
    expect(result).toEqual(["swarm", "vault", "workspaces"]);
  });

  it("isolates different users", async () => {
    const kv = mockKV();
    await saveEnabledCategories("user1", ["swarm"], kv);
    await saveEnabledCategories("user2", ["vault"], kv);
    expect(await loadEnabledCategories("user1", kv)).toEqual(["swarm"]);
    expect(await loadEnabledCategories("user2", kv)).toEqual(["vault"]);
  });

  it("handles corrupted data gracefully", async () => {
    const kv = mockKV();
    await kv.put("mcp:enabled-categories:user1", "not-valid-json{{{");
    const result = await loadEnabledCategories("user1", kv);
    expect(result).toEqual([]);
  });

  it("filters out non-string values", async () => {
    const kv = mockKV();
    await kv.put(
      "mcp:enabled-categories:user1",
      JSON.stringify(["valid", 123, null, "also-valid"]),
    );
    const result = await loadEnabledCategories("user1", kv);
    expect(result).toEqual(["valid", "also-valid"]);
  });
});
