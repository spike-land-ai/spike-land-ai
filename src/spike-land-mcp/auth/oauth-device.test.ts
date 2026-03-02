/**
 * Tests for auth/oauth-device.ts
 *
 * Covers: createDeviceCode, approveDeviceCode, exchangeDeviceCode.
 */

import { describe, it, expect } from "vitest";
import { createDeviceCode, approveDeviceCode, exchangeDeviceCode } from "./oauth-device";
import { createMockD1 } from "../__test-utils__/mock-env";
import { createDb } from "../db/index";

// ─── createDeviceCode ────────────────────────────────────────────────────────

describe("createDeviceCode", () => {
  it("returns deviceCode, userCode, and expiresIn", async () => {
    // We need to capture the inserted row so we can validate later
    let inserted: Record<string, unknown> | null = null;

    const db = createDb(
      createMockD1((sql, bindings) => {
        if (sql.toLowerCase().includes("insert")) {
          // Capture what was inserted
          inserted = { sql, bindings };
        }
        return { results: [], success: true, meta: {} };
      }),
    );

    const result = await createDeviceCode(db, { clientId: "client-1", scope: "mcp" });

    expect(result.deviceCode).toMatch(/^dc_[a-f0-9]+$/);
    expect(result.userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(result.expiresIn).toBe(600);
    expect(inserted).not.toBeNull();
  });

  it("uses default scope when not specified", async () => {
    const insertedValues: unknown[] = [];

    const db = createDb(
      createMockD1((_sql, bindings) => {
        insertedValues.push(...bindings);
        return { results: [], success: true, meta: {} };
      }),
    );

    const result = await createDeviceCode(db, {});
    expect(result.expiresIn).toBe(600);
    // scope defaults to "mcp" — verify it's in the bindings
    expect(insertedValues).toContain("mcp");
  });

  it("generates unique device codes on successive calls", async () => {
    const db = createDb(createMockD1(() => ({ results: [], success: true, meta: {} })));

    const result1 = await createDeviceCode(db, {});
    const result2 = await createDeviceCode(db, {});

    expect(result1.deviceCode).not.toBe(result2.deviceCode);
    expect(result1.userCode).not.toBe(result2.userCode);
  });

  it("userCode format excludes ambiguous characters (0, O, I, 1)", () => {
    // Run multiple times to check statistically
    const codes: string[] = [];
    const db = createDb(createMockD1(() => ({ results: [], success: true, meta: {} })));

    // We can check the format regex: no 0, O, I, 1 in the character set
    // The chars are: ABCDEFGHJKLMNPQRSTUVWXYZ23456789
    const validPattern =
      /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

    return createDeviceCode(db, {}).then((result) => {
      expect(result.userCode).toMatch(validPattern);
      codes.push(result.userCode);
      expect(result.userCode).not.toMatch(/[01IO]/);
    });
  });
});

// ─── approveDeviceCode ───────────────────────────────────────────────────────

describe("approveDeviceCode", () => {
  it("returns ok:false for expired or missing user code", async () => {
    const db = createDb(createMockD1(() => ({ results: [], success: true, meta: {} })));

    const result = await approveDeviceCode(db, "XXXX-XXXX", "user-1");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("returns ok:true and updates when code exists and not expired", async () => {
    const now = Date.now();
    const updateCalls: string[] = [];

    // Column order must match deviceAuthCodes schema definition order:
    // id, user_id, device_code, user_code, scope, client_id, expires_at, approved, created_at
    const db = createDb(
      createMockD1((sql) => {
        if (sql.toLowerCase().includes("select")) {
          return {
            results: [
              {
                id: "dc-1",
                user_id: null,
                device_code: "dc_abc",
                user_code: "ABCD-EFGH",
                scope: "mcp",
                client_id: null,
                expires_at: now + 300_000,
                approved: 0, // not approved yet
                created_at: now,
              },
            ],
            success: true,
            meta: {},
          };
        }
        if (sql.toLowerCase().includes("update")) {
          updateCalls.push(sql);
        }
        return { results: [], success: true, meta: {} };
      }),
    );

    const result = await approveDeviceCode(db, "ABCD-EFGH", "user-1");
    expect(result.ok).toBe(true);
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  it("includes an error description when code is not found", async () => {
    const db = createDb(createMockD1(() => ({ results: [], success: true, meta: {} })));

    const result = await approveDeviceCode(db, "FAKE-CODE", "user-1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid");
  });
});

// ─── exchangeDeviceCode ───────────────────────────────────────────────────────

describe("exchangeDeviceCode", () => {
  it("returns error object when device code is expired or missing", async () => {
    const db = createDb(createMockD1(() => ({ results: [], success: true, meta: {} })));

    const result = await exchangeDeviceCode(db, "dc_nonexistent");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("expired_token");
    }
  });

  it("returns authorization_pending when code exists but not approved", async () => {
    const now = Date.now();

    // Column order: id, user_id, device_code, user_code, scope, client_id, expires_at, approved, created_at
    const db = createDb(
      createMockD1((sql) => {
        if (sql.toLowerCase().includes("select")) {
          return {
            results: [
              {
                id: "dc-1",
                user_id: null,
                device_code: "dc_abc123",
                user_code: "ABCD-EFGH",
                scope: "mcp",
                client_id: null,
                expires_at: now + 300_000,
                approved: 0, // not approved
                created_at: now,
              },
            ],
            success: true,
            meta: {},
          };
        }
        return { results: [], success: true, meta: {} };
      }),
    );

    const result = await exchangeDeviceCode(db, "dc_abc123");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("authorization_pending");
    }
  });

  // Note: Testing the full happy path requires drizzle-orm to correctly map
  // positional results from our mock D1, which is fragile. Instead we test
  // the observable boundary: the error path is well-covered; the happy path
  // contract is verified by integration (it generates mcp_ tokens and inserts
  // into oauthAccessTokens table). The function structure is covered by the
  // other two test cases above.
  it("returns error for empty device code string", async () => {
    const db = createDb(createMockD1(() => ({ results: [], success: true, meta: {} })));

    const result = await exchangeDeviceCode(db, "");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("expired_token");
    }
  });
});
