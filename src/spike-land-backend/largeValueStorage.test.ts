import { beforeEach, describe, expect, it, vi } from "vitest";
import { LargeValueStorage } from "../src/largeValueStorage";

function makeR2Object(text: string) {
  return {
    text: vi.fn().mockResolvedValue(text),
    json: vi.fn().mockImplementation(() => Promise.resolve(JSON.parse(text))),
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    body: null,
    bodyUsed: false,
    checksums: {},
    etag: "e",
    httpEtag: "he",
    key: "k",
    size: text.length,
    uploaded: new Date(),
    version: "v",
    writeHttpMetadata: vi.fn(),
  };
}

describe("LargeValueStorage", () => {
  let mockStorage: Record<string, ReturnType<typeof vi.fn>>;
  let mockR2: Record<string, ReturnType<typeof vi.fn>>;
  let lvs: LargeValueStorage;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage = {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    mockR2 = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    lvs = new LargeValueStorage(
      mockStorage as unknown as DurableObjectStorage,
      mockR2 as unknown as R2Bucket,
      "test-do-id",
    );
  });

  describe("put + get — small values", () => {
    it("stores a small string directly in DO storage", async () => {
      await lvs.put("key1", "hello");

      expect(mockStorage.put).toHaveBeenCalledWith("key1", "hello");
      expect(mockR2.put).not.toHaveBeenCalled();
    });

    it("stores a small object directly in DO storage", async () => {
      const obj = { foo: "bar", num: 42 };
      await lvs.put("key1", obj);

      expect(mockStorage.put).toHaveBeenCalledWith("key1", obj);
      expect(mockR2.put).not.toHaveBeenCalled();
    });

    it("round-trips a small string via get", async () => {
      mockStorage.get.mockResolvedValue("hello");

      const result = await lvs.get<string>("key1");
      expect(result).toBe("hello");
      expect(mockR2.get).not.toHaveBeenCalled();
    });

    it("round-trips a small object via get", async () => {
      const obj = { foo: "bar" };
      mockStorage.get.mockResolvedValue(obj);

      const result = await lvs.get<typeof obj>("key1");
      expect(result).toEqual(obj);
      expect(mockR2.get).not.toHaveBeenCalled();
    });
  });

  describe("put + get — large values", () => {
    const largeString = "x".repeat(70_000); // >64 KiB

    it("stores a large string in R2 and puts pointer in DO", async () => {
      await lvs.put("big_key", largeString);

      expect(mockR2.put).toHaveBeenCalledWith("do_test-do-id/big_key", largeString);
      expect(mockStorage.put).toHaveBeenCalledWith("big_key", {
        __r2_ref: true,
        key: "do_test-do-id/big_key",
        originalType: "string",
      });
    });

    it("round-trips a large string via get (pointer resolution)", async () => {
      mockStorage.get.mockResolvedValue({
        __r2_ref: true,
        key: "do_test-do-id/big_key",
        originalType: "string",
      });
      mockR2.get.mockResolvedValue(makeR2Object(largeString));

      const result = await lvs.get<string>("big_key");
      expect(result).toBe(largeString);
      expect(mockR2.get).toHaveBeenCalledWith("do_test-do-id/big_key");
    });

    it("stores a large object in R2 as JSON", async () => {
      const largeObj = { data: "y".repeat(70_000) };
      const serialized = JSON.stringify(largeObj);

      await lvs.put("big_obj", largeObj);

      expect(mockR2.put).toHaveBeenCalledWith("do_test-do-id/big_obj", serialized);
      expect(mockStorage.put).toHaveBeenCalledWith("big_obj", {
        __r2_ref: true,
        key: "do_test-do-id/big_obj",
        originalType: "object",
      });
    });

    it("round-trips a large object via get (pointer resolution + JSON parse)", async () => {
      const largeObj = { data: "y".repeat(70_000) };
      const serialized = JSON.stringify(largeObj);

      mockStorage.get.mockResolvedValue({
        __r2_ref: true,
        key: "do_test-do-id/big_obj",
        originalType: "object",
      });
      mockR2.get.mockResolvedValue(makeR2Object(serialized));

      const result = await lvs.get<typeof largeObj>("big_obj");
      expect(result).toEqual(largeObj);
    });
  });

  describe("backward compatibility", () => {
    it("returns plain string values from DO without pointer resolution", async () => {
      mockStorage.get.mockResolvedValue("plain value");

      const result = await lvs.get<string>("old_key");
      expect(result).toBe("plain value");
      expect(mockR2.get).not.toHaveBeenCalled();
    });

    it("returns plain object values from DO without pointer resolution", async () => {
      const obj = { codeSpace: "test", messages: [] };
      mockStorage.get.mockResolvedValue(obj);

      const result = await lvs.get<typeof obj>("old_key");
      expect(result).toEqual(obj);
      expect(mockR2.get).not.toHaveBeenCalled();
    });
  });

  describe("get — missing values", () => {
    it("returns undefined for missing key", async () => {
      mockStorage.get.mockResolvedValue(undefined);

      const result = await lvs.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("returns undefined for null storage value", async () => {
      mockStorage.get.mockResolvedValue(null);

      const result = await lvs.get("null_key");
      expect(result).toBeUndefined();
    });

    it("returns undefined when R2 object is missing (stale pointer)", async () => {
      mockStorage.get.mockResolvedValue({
        __r2_ref: true,
        key: "do_test-do-id/stale_key",
        originalType: "string",
      });
      mockR2.get.mockResolvedValue(null);

      const result = await lvs.get<string>("stale_key");
      expect(result).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("deletes from both DO and R2 when pointer exists", async () => {
      mockStorage.get.mockResolvedValue({
        __r2_ref: true,
        key: "do_test-do-id/del_key",
        originalType: "string",
      });

      await lvs.delete("del_key");

      expect(mockR2.delete).toHaveBeenCalledWith("do_test-do-id/del_key");
      expect(mockStorage.delete).toHaveBeenCalledWith("del_key");
    });

    it("deletes from DO only when no pointer exists", async () => {
      mockStorage.get.mockResolvedValue("plain value");

      await lvs.delete("plain_key");

      expect(mockR2.delete).not.toHaveBeenCalled();
      expect(mockStorage.delete).toHaveBeenCalledWith("plain_key");
    });

    it("deletes from DO when key doesn't exist (no-op for R2)", async () => {
      mockStorage.get.mockResolvedValue(undefined);

      await lvs.delete("missing_key");

      expect(mockR2.delete).not.toHaveBeenCalled();
      expect(mockStorage.delete).toHaveBeenCalledWith("missing_key");
    });
  });

  describe("putDirect / getDirect", () => {
    it("putDirect stores directly in DO without size check", async () => {
      await lvs.putDirect("version_count", 42);

      expect(mockStorage.put).toHaveBeenCalledWith("version_count", 42);
      expect(mockR2.put).not.toHaveBeenCalled();
    });

    it("getDirect reads from DO without pointer resolution", async () => {
      mockStorage.get.mockResolvedValue(42);

      const result = await lvs.getDirect<number>("version_count");
      expect(result).toBe(42);
      expect(mockR2.get).not.toHaveBeenCalled();
    });

    it("getDirect returns undefined for missing keys", async () => {
      mockStorage.get.mockResolvedValue(undefined);

      const result = await lvs.getDirect<number>("missing");
      expect(result).toBeUndefined();
    });
  });

  describe("stale R2 cleanup on small put", () => {
    it("fires-and-forgets R2 delete when putting a small value", async () => {
      await lvs.put("key1", "small");

      // Should attempt to clean up potential stale R2 key
      expect(mockR2.delete).toHaveBeenCalledWith("do_test-do-id/key1");
    });

    it("does not fail if R2 cleanup fails", async () => {
      mockR2.delete.mockRejectedValue(new Error("R2 error"));

      // Should not throw
      await lvs.put("key1", "small");
      expect(mockStorage.put).toHaveBeenCalledWith("key1", "small");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", async () => {
      await lvs.put("empty", "");
      expect(mockStorage.put).toHaveBeenCalledWith("empty", "");
      expect(mockR2.put).not.toHaveBeenCalled();
    });

    it("handles multi-byte UTF-8 correctly (byte size vs char count)", async () => {
      // Each emoji \u{1F600} is 4 UTF-8 bytes but 2 JS chars (surrogate pair)
      // 16385 emojis = 65540 bytes > 64 KiB threshold, but only 32770 JS chars
      const multiByteStr = "\u{1F600}".repeat(16_385);
      expect(multiByteStr.length).toBe(32_770); // JS char count (2 per emoji)
      // byte size is 65540 which exceeds 64 KiB

      await lvs.put("emoji", multiByteStr);

      expect(mockR2.put).toHaveBeenCalledWith("do_test-do-id/emoji", multiByteStr);
    });

    it("stores value exactly at threshold in DO (not R2)", async () => {
      const exactStr = "a".repeat(THRESHOLD_VALUE);
      await lvs.put("exact", exactStr);

      expect(mockStorage.put).toHaveBeenCalledWith("exact", exactStr);
      expect(mockR2.put).not.toHaveBeenCalled();
    });

    it("stores value 1 byte over threshold in R2", async () => {
      const overStr = "a".repeat(THRESHOLD_VALUE + 1);
      await lvs.put("over", overStr);

      expect(mockR2.put).toHaveBeenCalledWith("do_test-do-id/over", overStr);
    });
  });
});

// Expose threshold for edge case tests
const THRESHOLD_VALUE = 64 * 1024;
