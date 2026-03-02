import { describe, expect, it } from "vitest";
import { tryCatch } from "./try-catch.js";

describe("tryCatch utility", () => {
  it("returns ok:true and data on success", async () => {
    const p = Promise.resolve("success");
    const result = await tryCatch(p);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("success");
    }
  });

  it("returns ok:false and error on failure with Error object", async () => {
    const err = new Error("failed");
    const p = Promise.reject(err);
    const result = await tryCatch(p);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(err);
    }
  });

  it("returns ok:false and mapped Error on failure with non-Error object", async () => {
    const p = Promise.reject("string error");
    const result = await tryCatch(p);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe("string error");
    }
  });

  it("returns mapped Error on failure with undefined", async () => {
    const p = Promise.reject(undefined);
    const result = await tryCatch(p);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
