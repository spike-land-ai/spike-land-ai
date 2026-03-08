import { describe, it, expect } from "vitest";
import { createDb } from "../db/db-index";

describe("db-index", () => {
  it("creates a db instance", () => {
    const mockD1 = {} as D1Database;
    const db = createDb(mockD1);
    expect(db).toBeDefined();
  });
});
