import { describe, it, expect } from "vitest";
import { user, session, account, verification } from "./schema";
import { getTableConfig } from "drizzle-orm/sqlite-core";

describe("mcp-auth Drizzle schema", () => {
  describe("user table", () => {
    it("has correct table name", () => {
      const config = getTableConfig(user);
      expect(config.name).toBe("user");
    });

    it("has updatedAt column with correct column name", () => {
      const config = getTableConfig(user);
      const updatedAtCol = config.columns.find(c => c.name === "updatedAt");
      expect(updatedAtCol).toBeDefined();
      // Ensure updatedAt is NOT accidentally mapped to "createdAt"
      expect(updatedAtCol!.name).toBe("updatedAt");
    });

    it("has all required columns", () => {
      const config = getTableConfig(user);
      const columnNames = config.columns.map(c => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("name");
      expect(columnNames).toContain("email");
      expect(columnNames).toContain("emailVerified");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
      expect(columnNames).toContain("role");
    });
  });

  describe("session table", () => {
    it("has correct table name", () => {
      const config = getTableConfig(session);
      expect(config.name).toBe("session");
    });

    it("has updatedAt column with correct column name", () => {
      const config = getTableConfig(session);
      const updatedAtCol = config.columns.find(c => c.name === "updatedAt");
      expect(updatedAtCol).toBeDefined();
      expect(updatedAtCol!.name).toBe("updatedAt");
    });

    it("has token column with unique constraint", () => {
      const config = getTableConfig(session);
      const tokenCol = config.columns.find(c => c.name === "token");
      expect(tokenCol).toBeDefined();
      expect(tokenCol!.isUnique).toBe(true);
    });
  });

  describe("account table", () => {
    it("has correct table name", () => {
      const config = getTableConfig(account);
      expect(config.name).toBe("account");
    });

    it("has updatedAt column with correct column name", () => {
      const config = getTableConfig(account);
      const updatedAtCol = config.columns.find(c => c.name === "updatedAt");
      expect(updatedAtCol).toBeDefined();
      expect(updatedAtCol!.name).toBe("updatedAt");
    });

    it("has all required columns for Better Auth", () => {
      const config = getTableConfig(account);
      const columnNames = config.columns.map(c => c.name);
      expect(columnNames).toContain("accountId");
      expect(columnNames).toContain("providerId");
      expect(columnNames).toContain("userId");
      expect(columnNames).toContain("password");
    });
  });

  describe("verification table", () => {
    it("has correct table name", () => {
      const config = getTableConfig(verification);
      expect(config.name).toBe("verification");
    });

    it("has updatedAt column with correct column name", () => {
      const config = getTableConfig(verification);
      const updatedAtCol = config.columns.find(c => c.name === "updatedAt");
      expect(updatedAtCol).toBeDefined();
      expect(updatedAtCol!.name).toBe("updatedAt");
    });
  });
});
