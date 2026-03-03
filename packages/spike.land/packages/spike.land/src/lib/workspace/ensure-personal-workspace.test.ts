import { describe, expect, it, vi } from "vitest";

const { mockTransaction, mockWorkspaceFindFirst, mockWorkspaceCreate } = vi.hoisted(() => {
  const mockWorkspaceFindFirst = vi.fn();
  const mockWorkspaceCreate = vi.fn();
  const mockTransaction = vi.fn();
  return { mockTransaction, mockWorkspaceFindFirst, mockWorkspaceCreate };
});

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mockTransaction,
  },
}));

import { ensurePersonalWorkspace } from "./ensure-personal-workspace";

describe("ensurePersonalWorkspace", () => {
  beforeEach(() => {
    mockTransaction.mockReset();
    mockWorkspaceFindFirst.mockReset();
    mockWorkspaceCreate.mockReset();

    // Default: transaction executes the callback with a mock tx object
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        workspace: {
          findFirst: mockWorkspaceFindFirst,
          create: mockWorkspaceCreate,
        },
      });
    });
  });

  it("returns the existing workspace ID when personal workspace already exists", async () => {
    mockWorkspaceFindFirst.mockResolvedValue({ id: "existing-ws-id" });
    const result = await ensurePersonalWorkspace("user-1", "Alice");
    expect(result).toBe("existing-ws-id");
    expect(mockWorkspaceCreate).not.toHaveBeenCalled();
  });

  it("creates a workspace when no personal workspace exists", async () => {
    mockWorkspaceFindFirst.mockResolvedValue(null);
    mockWorkspaceCreate.mockResolvedValue({ id: "new-ws-id" });

    const result = await ensurePersonalWorkspace("user-1", "Alice");

    expect(result).toBe("new-ws-id");
    expect(mockWorkspaceCreate).toHaveBeenCalledOnce();
  });

  it("creates workspace with correct user name in name field", async () => {
    mockWorkspaceFindFirst.mockResolvedValue(null);
    mockWorkspaceCreate.mockResolvedValue({ id: "ws-abc" });

    await ensurePersonalWorkspace("user-2", "Bob");

    expect(mockWorkspaceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Bob's Workspace",
          isPersonal: true,
        }),
      }),
    );
  });

  it("uses 'User' as fallback name when userName is null", async () => {
    mockWorkspaceFindFirst.mockResolvedValue(null);
    mockWorkspaceCreate.mockResolvedValue({ id: "ws-null" });

    await ensurePersonalWorkspace("user-3", null);

    expect(mockWorkspaceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "User's Workspace",
        }),
      }),
    );
  });

  it("uses 'User' as fallback name when userName is undefined", async () => {
    mockWorkspaceFindFirst.mockResolvedValue(null);
    mockWorkspaceCreate.mockResolvedValue({ id: "ws-undef" });

    await ensurePersonalWorkspace("user-4");

    expect(mockWorkspaceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "User's Workspace",
        }),
      }),
    );
  });

  it("creates workspace with OWNER role for the user", async () => {
    mockWorkspaceFindFirst.mockResolvedValue(null);
    mockWorkspaceCreate.mockResolvedValue({ id: "ws-owner" });

    await ensurePersonalWorkspace("user-5", "Carol");

    expect(mockWorkspaceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          members: {
            create: expect.objectContaining({
              userId: "user-5",
              role: "OWNER",
            }),
          },
        }),
      }),
    );
  });

  it("slug includes userId", async () => {
    mockWorkspaceFindFirst.mockResolvedValue(null);
    mockWorkspaceCreate.mockResolvedValue({ id: "ws-slug" });

    await ensurePersonalWorkspace("user-slug-test", "Dave");

    const call = mockWorkspaceCreate.mock.calls[0]![0];
    expect(call.data.slug).toContain("user-slug-test");
  });

  it("queries for existing workspace with correct userId and isPersonal=true", async () => {
    mockWorkspaceFindFirst.mockResolvedValue({ id: "found-ws" });

    await ensurePersonalWorkspace("query-user");

    expect(mockWorkspaceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPersonal: true,
          members: { some: { userId: "query-user" } },
          deletedAt: null,
        }),
      }),
    );
  });
});
