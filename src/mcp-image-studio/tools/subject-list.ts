import { z } from "zod";
import { errorResult, jsonResult } from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const subjectListTool = imageProcedure
  .tool("subject_list", "List all your registered subjects for consistent generation", {
    limit: z
      .number()
      .max(100)
      .describe("Maximum number of subjects to return. Defaults to 20")
      .optional(),
  })
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;

    if (!deps.db.subjectFindMany) {
      return errorResult("NOT_SUPPORTED", "Subject listing not supported in this environment");
    }

    const result = await tryCatch(deps.db.subjectFindMany({ userId }));

    if (!result.ok) {
      return errorResult("SUBJECT_LIST_FAILED", "Failed to list subjects");
    }

    const list = (result.data ?? []).map((s) => ({
      id: s.id,
      label: s.label,
      type: s.type,
      description: s.description,
      created_at: s.createdAt.toISOString(),
    }));

    return jsonResult({ subjects: list.slice(0, input.limit ?? 20) });
  });

export const subjectList = subjectListTool.handler;
export const SubjectListInputSchema = z.object(subjectListTool.inputSchema);
export type SubjectListInput = Parameters<typeof subjectList>[0];
