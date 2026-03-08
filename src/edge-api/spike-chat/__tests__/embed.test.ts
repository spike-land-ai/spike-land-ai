import { describe, it, expect, vi } from "vitest";
import { embedRouter } from "../api/routes/embed";
import * as dbIndex from "../db/db-index";

vi.mock("../db/db-index", () => ({
  createDb: vi.fn()
}));

describe("embedRouter", () => {
  it("renders embed HTML", async () => {
    // Mock the DB response
    (dbIndex.createDb as ReturnType<typeof vi.fn>).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => {
            // we can return a mock that is an array for channel and has an orderBy/limit chain for messages
            const result: Array<Record<string, unknown>> & { orderBy?: unknown } = [{ id: "chan1", workspaceId: "workspace-1", slug: "channel-1" }];
            result.orderBy = () => ({
              limit: () => [
                { id: "msg1", content: "hello", userId: "visitor-1", createdAt: 123 },
                { id: "msg2", content: "hello2", userId: "user-1", createdAt: 124 }
              ]
            });
            return result;
          }
        })
      })
    });

    const env = { DB: {} };
    const res = await embedRouter.fetch(new Request("http://localhost/workspace-1/channel-1"), env as unknown as Record<string, unknown>);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Spike Chat - channel-1");
    expect(text).toContain("hello");
  });

  it("renders embed HTML when channel not found", async () => {
    (dbIndex.createDb as ReturnType<typeof vi.fn>).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => {
            const result: Array<Record<string, unknown>> = [];
            return result;
          }
        })
      })
    });

    const env = { DB: {} };
    const res = await embedRouter.fetch(new Request("http://localhost/workspace-1/channel-2"), env as unknown as Record<string, unknown>);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Spike Chat - channel-2");
    expect(text).toContain("Welcome to #channel-2. This is the start of the channel.");
  });
});
