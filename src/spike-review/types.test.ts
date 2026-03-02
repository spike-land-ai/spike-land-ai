import { describe, expect, it } from "vitest";
import {
  CheckGatesSchema,
  DEFAULT_CONFIG,
  DiffSide,
  FileStatus,
  PostCheckRunSchema,
  PRParamsSchema,
  ReviewDiffSchema,
  ReviewEvent,
  ReviewPRSchema,
  SubmitReviewSchema,
  ValidateCommentTargetSchema,
} from "./types.js";

describe("types", () => {
  describe("enums", () => {
    it("DiffSide has LEFT and RIGHT", () => {
      expect(DiffSide.LEFT).toBe("LEFT");
      expect(DiffSide.RIGHT).toBe("RIGHT");
    });

    it("ReviewEvent has expected values", () => {
      expect(ReviewEvent.APPROVE).toBe("APPROVE");
      expect(ReviewEvent.REQUEST_CHANGES).toBe("REQUEST_CHANGES");
      expect(ReviewEvent.COMMENT).toBe("COMMENT");
    });

    it("FileStatus has expected values", () => {
      expect(FileStatus.ADDED).toBe("added");
      expect(FileStatus.MODIFIED).toBe("modified");
      expect(FileStatus.DELETED).toBe("deleted");
      expect(FileStatus.RENAMED).toBe("renamed");
    });
  });

  describe("DEFAULT_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_CONFIG.confidenceThreshold).toBe(80);
      expect(DEFAULT_CONFIG.autoMerge).toBe(false);
      expect(DEFAULT_CONFIG.ignorePaths).toContain("yarn.lock");
    });
  });

  describe("Zod schemas", () => {
    it("PRParamsSchema validates valid input", () => {
      const result = PRParamsSchema.safeParse({
        owner: "zerdos",
        repo: "spike-land-nextjs",
        prNumber: 42,
      });
      expect(result.success).toBe(true);
    });

    it("PRParamsSchema rejects invalid prNumber", () => {
      const result = PRParamsSchema.safeParse({
        owner: "zerdos",
        repo: "spike-land-nextjs",
        prNumber: -1,
      });
      expect(result.success).toBe(false);
    });

    it("SubmitReviewSchema validates with comments", () => {
      const result = SubmitReviewSchema.safeParse({
        owner: "zerdos",
        repo: "test",
        prNumber: 1,
        body: "LGTM",
        event: "APPROVE",
        comments: [{ path: "src/foo.ts", line: 10, body: "Nit" }],
      });
      expect(result.success).toBe(true);
    });

    it("ReviewDiffSchema validates minimal input", () => {
      const result = ReviewDiffSchema.safeParse({
        diff: "+added line",
      });
      expect(result.success).toBe(true);
    });

    it("CheckGatesSchema validates with optional claudeMdContent", () => {
      const result = CheckGatesSchema.safeParse({
        diff: "+some code",
        claudeMdContent: "# Rules\n- no any",
      });
      expect(result.success).toBe(true);
    });

    it("ValidateCommentTargetSchema validates", () => {
      const result = ValidateCommentTargetSchema.safeParse({
        owner: "zerdos",
        repo: "test",
        prNumber: 1,
        path: "src/foo.ts",
        line: 10,
        side: "RIGHT",
      });
      expect(result.success).toBe(true);
    });

    it("PostCheckRunSchema validates", () => {
      const result = PostCheckRunSchema.safeParse({
        owner: "zerdos",
        repo: "test",
        prNumber: 1,
        headSha: "abc123",
        status: "completed",
        conclusion: "success",
        summary: "All good",
      });
      expect(result.success).toBe(true);
    });

    it("ReviewPRSchema validates with optional fields", () => {
      const result = ReviewPRSchema.safeParse({
        owner: "zerdos",
        repo: "test",
        prNumber: 1,
        customPrompt: "Be extra strict",
      });
      expect(result.success).toBe(true);
    });
  });
});
