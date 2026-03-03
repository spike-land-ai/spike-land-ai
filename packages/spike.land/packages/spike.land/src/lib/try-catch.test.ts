import { describe, expect, it } from "vitest";
import { tryCatch, tryCatchSync } from "./try-catch";

describe("tryCatch (async)", () => {
  it("returns { data, error: null } on success", async () => {
    const { data, error } = await tryCatch(Promise.resolve(42));
    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  it("returns { data: null, error } on rejection", async () => {
    const err = new Error("oops");
    const { data, error } = await tryCatch(Promise.reject(err));
    expect(data).toBeNull();
    expect(error).toBe(err);
  });

  it("works with string resolution", async () => {
    const { data, error } = await tryCatch(Promise.resolve("hello"));
    expect(data).toBe("hello");
    expect(error).toBeNull();
  });

  it("works with object resolution", async () => {
    const obj = { id: 1, name: "test" };
    const { data, error } = await tryCatch(Promise.resolve(obj));
    expect(data).toEqual(obj);
    expect(error).toBeNull();
  });

  it("works with null resolution", async () => {
    const { data, error } = await tryCatch(Promise.resolve(null));
    expect(data).toBeNull();
    expect(error).toBeNull();
  });

  it("captures non-Error rejections", async () => {
    const { data, error } = await tryCatch(Promise.reject("string error"));
    expect(data).toBeNull();
    expect(error).toBe("string error");
  });

  it("captures rejected numeric value", async () => {
    const { data, error } = await tryCatch(Promise.reject(404));
    expect(data).toBeNull();
    expect(error).toBe(404);
  });

  it("preserves error message from thrown Error", async () => {
    const { error } = await tryCatch(
      Promise.reject(new TypeError("type mismatch")),
    );
    expect((error as TypeError).message).toBe("type mismatch");
  });
});

describe("tryCatchSync (sync)", () => {
  it("returns { data, error: null } on success", () => {
    const { data, error } = tryCatchSync(() => 42);
    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  it("returns { data: null, error } when function throws", () => {
    const err = new Error("sync error");
    const { data, error } = tryCatchSync(() => {
      throw err;
    });
    expect(data).toBeNull();
    expect(error).toBe(err);
  });

  it("works with string return", () => {
    const { data } = tryCatchSync(() => "hello");
    expect(data).toBe("hello");
  });

  it("works with object return", () => {
    const { data } = tryCatchSync(() => ({ key: "value" }));
    expect(data).toEqual({ key: "value" });
  });

  it("captures non-Error throws", () => {
    const { data, error } = tryCatchSync(() => {
      throw "string throw";
    });
    expect(data).toBeNull();
    expect(error).toBe("string throw");
  });

  it("returns null data when null is returned", () => {
    const { data, error } = tryCatchSync(() => null);
    expect(data).toBeNull();
    expect(error).toBeNull();
  });
});
