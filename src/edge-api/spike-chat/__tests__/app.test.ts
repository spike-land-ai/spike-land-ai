import { describe, it, expect } from "vitest";
import app from "../api/app";

describe("app", () => {
  it("responds to /", async () => {
    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("spike-chat API is running");
  });
});
