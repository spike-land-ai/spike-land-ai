import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveWorkspace = vi.hoisted(() => vi.fn());
const mockSafeToolCall = vi.hoisted(() =>
  vi.fn((_name: string, handler: () => Promise<unknown>) => handler())
);
const mockTextResult = vi.hoisted(() =>
  vi.fn((text: string) => ({ content: [{ type: "text", text }] }))
);

vi.mock("../tool-helpers", () => ({
  resolveWorkspace: mockResolveWorkspace,
  safeToolCall: mockSafeToolCall,
  textResult: mockTextResult,
}));

import { workspaceScopedHandler } from "./workspace-scoped";

function getText(result: unknown): string {
  return (result as { content: Array<{ text: string; }>; }).content[0]!.text;
}

describe("workspaceScopedHandler", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve workspace and call inner handler on success", async () => {
    const workspace = {
      id: "ws-1",
      slug: "my-workspace",
      name: "My Workspace",
      subscriptionTier: "FREE" as const,
    };
    mockResolveWorkspace.mockResolvedValue(workspace);

    const innerHandler = vi.fn(
      async (
        _input: { workspace_slug: string; },
        ws: {
          id: string;
          slug: string;
          name: string;
          subscriptionTier: string;
        },
      ) => ({
        content: [{ type: "text" as const, text: `Workspace: ${ws.name}` }],
      }),
    );

    const handler = workspaceScopedHandler(
      { toolName: "my_tool" },
      userId,
      innerHandler,
    );

    const result = await handler({ workspace_slug: "my-workspace" });

    expect(mockResolveWorkspace).toHaveBeenCalledWith(userId, "my-workspace");
    expect(innerHandler).toHaveBeenCalledWith({
      workspace_slug: "my-workspace",
    }, workspace);
    expect(getText(result)).toBe("Workspace: My Workspace");
  });

  it("should wrap the call with safeToolCall using the toolName", async () => {
    mockResolveWorkspace.mockResolvedValue({
      id: "ws-1",
      slug: "test",
      name: "Test",
      subscriptionTier: "FREE",
    });

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));

    const handler = workspaceScopedHandler(
      { toolName: "custom_tool_name" },
      userId,
      innerHandler,
    );

    await handler({ workspace_slug: "test" });

    expect(mockSafeToolCall).toHaveBeenCalledWith(
      "custom_tool_name",
      expect.any(Function),
    );
  });

  it("should return tier error when requiredTier does not match", async () => {
    mockResolveWorkspace.mockResolvedValue({
      id: "ws-1",
      slug: "my-workspace",
      name: "My Workspace",
      subscriptionTier: "FREE",
    });

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "should not reach" }],
    }));

    const handler = workspaceScopedHandler(
      { toolName: "pro_tool", requiredTier: "PRO" as unknown as "FREE" },
      userId,
      innerHandler,
    );

    const result = await handler({ workspace_slug: "my-workspace" });

    expect(innerHandler).not.toHaveBeenCalled();
    expect(getText(result)).toContain("TIER_REQUIRED");
    expect(getText(result)).toContain("PRO");
    expect(getText(result)).toContain("FREE");
  });

  it("should allow access when requiredTier matches workspace tier", async () => {
    mockResolveWorkspace.mockResolvedValue({
      id: "ws-1",
      slug: "pro-workspace",
      name: "Pro Workspace",
      subscriptionTier: "PRO",
    });

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "pro access granted" }],
    }));

    const handler = workspaceScopedHandler(
      { toolName: "pro_tool", requiredTier: "PRO" as unknown as "FREE" },
      userId,
      innerHandler,
    );

    const result = await handler({ workspace_slug: "pro-workspace" });

    expect(innerHandler).toHaveBeenCalled();
    expect(getText(result)).toBe("pro access granted");
  });

  it("should skip tier check when requiredTier is not specified", async () => {
    mockResolveWorkspace.mockResolvedValue({
      id: "ws-1",
      slug: "any-workspace",
      name: "Any Workspace",
      subscriptionTier: "FREE",
    });

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "no tier check" }],
    }));

    const handler = workspaceScopedHandler(
      { toolName: "generic_tool" },
      userId,
      innerHandler,
    );

    const result = await handler({ workspace_slug: "any-workspace" });

    expect(innerHandler).toHaveBeenCalled();
    expect(getText(result)).toBe("no tier check");
  });

  it("should propagate workspace resolution errors via safeToolCall", async () => {
    const error = new Error(
      "Workspace 'nonexistent' not found or you are not a member.",
    );
    mockResolveWorkspace.mockRejectedValue(error);

    // Override safeToolCall to propagate errors like the real one does
    mockSafeToolCall.mockImplementationOnce(
      async (_name: string, handler: () => Promise<unknown>) => {
        try {
          return await handler();
        } catch {
          return {
            content: [{ type: "text", text: "Error: WORKSPACE_NOT_FOUND" }],
            isError: true,
          };
        }
      },
    );

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "should not reach" }],
    }));

    const handler = workspaceScopedHandler(
      { toolName: "my_tool" },
      userId,
      innerHandler,
    );

    const result = await handler({ workspace_slug: "nonexistent" });

    expect(innerHandler).not.toHaveBeenCalled();
    expect(getText(result)).toContain("WORKSPACE_NOT_FOUND");
  });

  it("should pass the input through to the inner handler", async () => {
    const workspace = {
      id: "ws-1",
      slug: "test",
      name: "Test",
      subscriptionTier: "FREE" as const,
    };
    mockResolveWorkspace.mockResolvedValue(workspace);

    const innerHandler = vi.fn(async (
      input: { workspace_slug: string; query: string; },
    ) => ({
      content: [{ type: "text" as const, text: input.query }],
    }));

    const handler = workspaceScopedHandler(
      { toolName: "search_tool" },
      userId,
      innerHandler,
    );

    await handler({ workspace_slug: "test", query: "hello world" });

    expect(innerHandler).toHaveBeenCalledWith(
      { workspace_slug: "test", query: "hello world" },
      workspace,
    );
  });

  it("should return a function that can be called repeatedly", async () => {
    mockResolveWorkspace.mockResolvedValue({
      id: "ws-1",
      slug: "test",
      name: "Test",
      subscriptionTier: "FREE",
    });

    let count = 0;
    const innerHandler = vi.fn(async () => {
      count++;
      return { content: [{ type: "text" as const, text: `call-${count}` }] };
    });

    const handler = workspaceScopedHandler(
      { toolName: "multi_tool" },
      userId,
      innerHandler,
    );

    const r1 = await handler({ workspace_slug: "test" });
    const r2 = await handler({ workspace_slug: "test" });

    expect(getText(r1)).toBe("call-1");
    expect(getText(r2)).toBe("call-2");
    expect(innerHandler).toHaveBeenCalledTimes(2);
  });
});
