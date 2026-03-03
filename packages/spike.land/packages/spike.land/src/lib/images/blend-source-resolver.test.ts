import { describe, expect, it } from "vitest";
import { getHttpStatusForError } from "./blend-source-resolver";

describe("blend-source-resolver", () => {
  describe("getHttpStatusForError", () => {
    it("should return 404 for NOT_FOUND", () => {
      expect(getHttpStatusForError("NOT_FOUND")).toBe(404);
    });

    it("should return 403 for ACCESS_DENIED", () => {
      expect(getHttpStatusForError("ACCESS_DENIED")).toBe(403);
    });

    it("should return 400 for INVALID_INPUT", () => {
      expect(getHttpStatusForError("INVALID_INPUT")).toBe(400);
    });

    it("should return 500 for FETCH_FAILED", () => {
      expect(getHttpStatusForError("FETCH_FAILED")).toBe(500);
    });

    it("should return 500 for UPLOAD_FAILED", () => {
      expect(getHttpStatusForError("UPLOAD_FAILED")).toBe(500);
    });
  });
});
