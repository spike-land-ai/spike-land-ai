import { describe, expect, it } from "vitest";
import { MessageType } from "./types";

describe("codespace types", () => {
  describe("MessageType enum", () => {
    it("should have TEXT value", () => {
      expect(MessageType.TEXT).toBe("text");
    });

    it("should have COMMAND value", () => {
      expect(MessageType.COMMAND).toBe("command");
    });

    it("should have STATUS value", () => {
      expect(MessageType.STATUS).toBe("status");
    });

    it("should have ERROR value", () => {
      expect(MessageType.ERROR).toBe("error");
    });

    it("should have exactly 4 members", () => {
      const values = Object.values(MessageType);
      expect(values).toHaveLength(4);
    });
  });
});
