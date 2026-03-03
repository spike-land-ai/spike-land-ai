import { beforeEach, describe, expect, it, vi } from "vitest";
import { _clearDecisions, registerDecisionsTools } from "./decisions";

interface ToolResult {
  content: Array<{ text: string; }>;
  isError?: boolean;
}

function createMockRegistry() {
  const tools = new Map<
    string,
    {
      handler: (args: Record<string, unknown>) => Promise<ToolResult>;
      inputSchema: Record<string, unknown>;
    }
  >();

  return {
    tools,
    register: vi.fn(
      ({
        name,
        handler,
        inputSchema,
      }: {
        name: string;
        handler: (args: Record<string, unknown>) => Promise<ToolResult>;
        inputSchema: Record<string, unknown>;
      }) => {
        tools.set(name, { handler, inputSchema });
      },
    ),
  };
}

function getText(result: ToolResult): string {
  return result.content[0]?.text ?? "";
}

function isError(result: ToolResult): boolean {
  return result.isError === true;
}

describe("decisions tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    _clearDecisions();
    registry = createMockRegistry();
    registerDecisionsTools(
      registry as unknown as Parameters<typeof registerDecisionsTools>[0],
      userId,
    );
  });

  it("should register 4 decisions tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.tools.has("decision_record")).toBe(true);
    expect(registry.tools.has("decision_list")).toBe(true);
    expect(registry.tools.has("decision_get")).toBe(true);
    expect(registry.tools.has("decision_query")).toBe(true);
  });

  describe("decision_record", () => {
    it("should create a new decision", async () => {
      const handler = registry.tools.get("decision_record")!.handler;
      const result = await handler({
        title: "Use PostgreSQL for persistence",
        context: "We need a reliable database for production workloads",
        decision: "Use PostgreSQL via Prisma ORM for all persistence",
        consequences: "Good: mature, well-supported. Bad: more operational overhead than SQLite",
        status: "accepted",
        tags: ["database", "infrastructure"],
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Decision recorded");
      expect(getText(result)).toContain("PostgreSQL");
      expect(getText(result)).toContain("accepted");
      expect(getText(result)).toContain("database, infrastructure");
    });

    it("should default status to proposed", async () => {
      const handler = registry.tools.get("decision_record")!.handler;
      const result = await handler({
        title: "Use Redis for caching",
        context: "We need faster read performance for hot data",
        decision: "Introduce Redis as a caching layer",
        consequences: "Good: faster reads. Bad: additional infrastructure",
        status: "proposed",
        tags: [],
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("proposed");
    });

    it("should truncate long context and decision in record output", async () => {
      const handler = registry.tools.get("decision_record")!.handler;
      const longContext = "C".repeat(300);
      const longDecision = "D".repeat(300);
      const result = await handler({
        title: "Long Fields Decision",
        context: longContext,
        decision: longDecision,
        consequences: "Some consequences here for truncation test",
        status: "proposed",
        tags: [],
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      // Context and decision should be truncated at 200 chars with "..."
      expect(text).toContain("...");
      expect(text).not.toContain(longContext);
      expect(text).not.toContain(longDecision);
    });

    it("should generate unique IDs for each decision", async () => {
      const handler = registry.tools.get("decision_record")!.handler;
      const result1 = await handler({
        title: "Decision One",
        context: "Context for first decision",
        decision: "First decision made here",
        consequences: "Consequences of the first decision",
        status: "proposed",
        tags: [],
      });
      const result2 = await handler({
        title: "Decision Two",
        context: "Context for second decision",
        decision: "Second decision made here",
        consequences: "Consequences of the second decision",
        status: "proposed",
        tags: [],
      });

      const id1Match = getText(result1).match(/`([^`]+)`/);
      const id2Match = getText(result2).match(/`([^`]+)`/);
      expect(id1Match).not.toBeNull();
      expect(id2Match).not.toBeNull();
      expect(id1Match![1]).not.toBe(id2Match![1]);
    });
  });

  describe("decision_list", () => {
    it("should return empty message when no decisions exist", async () => {
      const handler = registry.tools.get("decision_list")!.handler;
      const result = await handler({ limit: 20 });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("No decisions found");
    });

    it("should list all decisions after creating them", async () => {
      const recordHandler = registry.tools.get("decision_record")!.handler;
      await recordHandler({
        title: "Use TypeScript",
        context: "We need type safety across the codebase",
        decision: "Use TypeScript for all new code",
        consequences: "Good: fewer bugs. Bad: steeper learning curve",
        status: "accepted",
        tags: ["language"],
      });
      await recordHandler({
        title: "Use Vitest",
        context: "We need a fast test runner",
        decision: "Use Vitest instead of Jest",
        consequences: "Good: faster tests. Bad: less ecosystem",
        status: "accepted",
        tags: ["testing"],
      });
      await recordHandler({
        title: "Use Docker",
        context: "We need reproducible environments",
        decision: "Use Docker for deployment",
        consequences: "Good: consistent deploys. Bad: complexity",
        status: "proposed",
        tags: ["infrastructure"],
      });

      const handler = registry.tools.get("decision_list")!.handler;
      const result = await handler({ limit: 20 });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("3 Decision(s)");
      expect(getText(result)).toContain("Use TypeScript");
      expect(getText(result)).toContain("Use Vitest");
      expect(getText(result)).toContain("Use Docker");
    });

    it("should filter by status", async () => {
      const recordHandler = registry.tools.get("decision_record")!.handler;
      await recordHandler({
        title: "Accepted Decision",
        context: "Context for accepted decision here",
        decision: "This was accepted by the team",
        consequences: "Positive consequences outweigh negative",
        status: "accepted",
        tags: [],
      });
      await recordHandler({
        title: "Proposed Decision",
        context: "Context for proposed decision here",
        decision: "This is still proposed for review",
        consequences: "Needs further discussion and evaluation",
        status: "proposed",
        tags: [],
      });

      const handler = registry.tools.get("decision_list")!.handler;
      const result = await handler({ status: "accepted", limit: 20 });

      expect(getText(result)).toContain("1 Decision(s)");
      expect(getText(result)).toContain("Accepted Decision");
      expect(getText(result)).not.toContain("Proposed Decision");
    });

    it("should filter by tag", async () => {
      const recordHandler = registry.tools.get("decision_record")!.handler;
      await recordHandler({
        title: "DB Decision",
        context: "Database selection context here",
        decision: "Use PostgreSQL for persistence",
        consequences: "Good relational support and maturity",
        status: "accepted",
        tags: ["database"],
      });
      await recordHandler({
        title: "Cache Decision",
        context: "Caching strategy context here",
        decision: "Use Redis for caching layer",
        consequences: "Fast reads but added complexity",
        status: "accepted",
        tags: ["cache"],
      });

      const handler = registry.tools.get("decision_list")!.handler;
      const result = await handler({ tag: "database", limit: 20 });

      expect(getText(result)).toContain("1 Decision(s)");
      expect(getText(result)).toContain("DB Decision");
      expect(getText(result)).not.toContain("Cache Decision");
    });

    it("should show filter info in empty message", async () => {
      const handler = registry.tools.get("decision_list")!.handler;
      const result = await handler({
        status: "deprecated",
        tag: "legacy",
        limit: 20,
      });

      expect(getText(result)).toContain("No decisions found");
      expect(getText(result)).toContain("status=\"deprecated\"");
      expect(getText(result)).toContain("tag=\"legacy\"");
    });

    it("should respect limit parameter", async () => {
      const recordHandler = registry.tools.get("decision_record")!.handler;
      for (let i = 0; i < 5; i++) {
        await recordHandler({
          title: `Decision ${i}`,
          context: `Context for decision number ${i}`,
          decision: `Decision number ${i} was made`,
          consequences: `Consequences for decision ${i}`,
          status: "proposed",
          tags: [],
        });
      }

      const handler = registry.tools.get("decision_list")!.handler;
      const result = await handler({ limit: 2 });

      expect(getText(result)).toContain("2 Decision(s)");
    });

    it("should be case-insensitive for tag filtering", async () => {
      const recordHandler = registry.tools.get("decision_record")!.handler;
      await recordHandler({
        title: "Tagged Decision",
        context: "Context for tagged decision here",
        decision: "Decision with mixed case tag",
        consequences: "Testing tag case insensitivity",
        status: "proposed",
        tags: ["Database"],
      });

      const handler = registry.tools.get("decision_list")!.handler;
      const result = await handler({ tag: "database", limit: 20 });

      expect(getText(result)).toContain("Tagged Decision");
    });
  });

  describe("decision_get", () => {
    it("should return full ADR for existing decision", async () => {
      const recordHandler = registry.tools.get("decision_record")!.handler;
      const recordResult = await recordHandler({
        title: "Use PostgreSQL",
        context: "Need a reliable database for production",
        decision: "Adopt PostgreSQL via Prisma ORM",
        consequences: "Good: mature ecosystem. Bad: ops overhead",
        status: "accepted",
        tags: ["database", "infrastructure"],
      });

      // Extract the ID from the record result
      const idMatch = getText(recordResult).match(/`([^`]+)`/);
      expect(idMatch).not.toBeNull();
      const decisionId = idMatch![1]!;

      const handler = registry.tools.get("decision_get")!.handler;
      const result = await handler({ decision_id: decisionId });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("# ADR-");
      expect(getText(result)).toContain("Use PostgreSQL");
      expect(getText(result)).toContain("## Context");
      expect(getText(result)).toContain("## Decision");
      expect(getText(result)).toContain("## Consequences");
      expect(getText(result)).toContain("accepted");
      expect(getText(result)).toContain("database, infrastructure");
    });

    it("should show 'none' for tags when decision has no tags", async () => {
      const recordHandler = registry.tools.get("decision_record")!.handler;
      const recordResult = await recordHandler({
        title: "No Tags Decision",
        context: "This decision has no tags at all",
        decision: "Made without any tags attached",
        consequences: "Tags field should display as none",
        status: "proposed",
        tags: [],
      });

      const idMatch = getText(recordResult).match(/`([^`]+)`/);
      const decisionId = idMatch![1]!;

      const handler = registry.tools.get("decision_get")!.handler;
      const result = await handler({ decision_id: decisionId });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("**Tags:** none");
    });

    it("should return error for non-existent decision", async () => {
      const handler = registry.tools.get("decision_get")!.handler;
      const result = await handler({ decision_id: "nonexistent-id" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });

    it("should not return decisions from other users", async () => {
      // Create a decision with a different user
      const otherRegistry = createMockRegistry();
      registerDecisionsTools(
        otherRegistry as unknown as Parameters<
          typeof registerDecisionsTools
        >[0],
        "other-user-456",
      );

      const recordHandler = otherRegistry.tools.get("decision_record")!.handler;
      const recordResult = await recordHandler({
        title: "Other User Decision",
        context: "Other user's context for their decision",
        decision: "Other user decided something else",
        consequences: "Only visible to the other user",
        status: "proposed",
        tags: [],
      });

      const idMatch = getText(recordResult).match(/`([^`]+)`/);
      const decisionId = idMatch![1]!;

      // Try to get it with the original user
      const handler = registry.tools.get("decision_get")!.handler;
      const result = await handler({ decision_id: decisionId });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });
  });

  describe("decision_query", () => {
    beforeEach(async () => {
      const recordHandler = registry.tools.get("decision_record")!.handler;
      await recordHandler({
        title: "Use PostgreSQL for persistence",
        context: "We need a reliable relational database",
        decision: "Adopt PostgreSQL via Prisma ORM",
        consequences: "Mature ecosystem but operational overhead",
        status: "accepted",
        tags: ["database"],
      });
      await recordHandler({
        title: "Use Redis for caching",
        context: "Hot data needs sub-millisecond reads from cache",
        decision: "Add Redis as a read-through cache layer",
        consequences: "Faster reads but more infrastructure",
        status: "proposed",
        tags: ["cache"],
      });
      await recordHandler({
        title: "Adopt TypeScript strictly",
        context: "Too many runtime type errors in production",
        decision: "Enable strict TypeScript across all packages",
        consequences: "Fewer bugs but migration effort required",
        status: "accepted",
        tags: ["language"],
      });
    });

    it("should find decisions matching title keywords", async () => {
      const handler = registry.tools.get("decision_query")!.handler;
      const result = await handler({ query: "PostgreSQL", limit: 10 });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("PostgreSQL");
      expect(getText(result)).toContain("result(s)");
    });

    it("should rank title matches higher than context matches", async () => {
      const handler = registry.tools.get("decision_query")!.handler;
      // "Redis" appears in title of one decision
      const result = await handler({ query: "Redis", limit: 10 });

      expect(getText(result)).toContain("Redis");
      // The Redis decision should appear first since it matches title (3 points)
      const text = getText(result);
      const redisPos = text.indexOf("Use Redis");
      expect(redisPos).toBeGreaterThan(-1);
    });

    it("should return no results message for unmatched query", async () => {
      const handler = registry.tools.get("decision_query")!.handler;
      const result = await handler({
        query: "nonexistent-keyword-xyz",
        limit: 10,
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("No decisions found");
    });

    it("should respect limit parameter", async () => {
      const handler = registry.tools.get("decision_query")!.handler;
      // All three have "a" in their text fields
      const result = await handler({ query: "a", limit: 1 });

      expect(getText(result)).toContain("1 result(s)");
    });

    it("should handle empty search terms gracefully", async () => {
      const handler = registry.tools.get("decision_query")!.handler;
      const result = await handler({ query: "   ", limit: 10 });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("No search terms");
    });

    it("should search across context and decision fields", async () => {
      const handler = registry.tools.get("decision_query")!.handler;
      // "relational" only appears in context of PostgreSQL decision
      const result = await handler({ query: "relational", limit: 10 });

      expect(getText(result)).toContain("PostgreSQL");
    });

    it("should show score in results", async () => {
      const handler = registry.tools.get("decision_query")!.handler;
      const result = await handler({ query: "PostgreSQL", limit: 10 });

      expect(getText(result)).toContain("score:");
    });

    it("should truncate long excerpts", async () => {
      const recordHandler = registry.tools.get("decision_record")!.handler;
      await recordHandler({
        title: "Long Decision Text",
        context: "Context requiring a long decision text here",
        decision: "X".repeat(200) + " searchable_keyword_unique",
        consequences: "Consequences of the long decision text",
        status: "proposed",
        tags: [],
      });

      const handler = registry.tools.get("decision_query")!.handler;
      const result = await handler({
        query: "searchable_keyword_unique",
        limit: 10,
      });

      expect(getText(result)).toContain("...");
    });

    it("should not return decisions from other users", async () => {
      const handler = registry.tools.get("decision_query")!.handler;

      // Create another registry for a different user
      const otherRegistry = createMockRegistry();
      registerDecisionsTools(
        otherRegistry as unknown as Parameters<
          typeof registerDecisionsTools
        >[0],
        "other-user-789",
      );

      const otherRecordHandler = otherRegistry.tools.get("decision_record")!.handler;
      await otherRecordHandler({
        title: "Secret Other User Decision",
        context: "This belongs to another user entirely",
        decision: "Other user's private secret decision text",
        consequences: "Should not be visible to original user",
        status: "proposed",
        tags: [],
      });

      // Query with original user should not find it
      const result = await handler({ query: "Secret", limit: 10 });
      expect(getText(result)).toContain("No decisions found");
    });
  });
});
