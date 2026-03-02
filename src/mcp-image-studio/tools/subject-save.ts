import { z } from "zod";
import {
  asImageId,
  errorResult,
  IMG_DEFAULTS,
  jsonResult,
  SUBJECT_TYPE_VALUES,
  toolEvent,
} from "../types.js";
import { tryCatch } from "./try-catch.js";
import { imageProcedure } from "../tool-builder/image-middleware.js";

export const subjectSaveTool = imageProcedure
  .tool(
    "subject_save",
    "Register a character or object from an existing image for consistent generation later",
    {
      image_id: z.string().describe("Source image ID containing the subject"),
      label: z.string().describe("Human-readable label for the subject (e.g. 'my cat')"),
      type: z.enum(SUBJECT_TYPE_VALUES).describe("Subject type: character or object").optional(),
      description: z
        .string()
        .describe("Optional description for more accurate references")
        .optional(),
    },
  )
  .handler(async ({ input: input, ctx: ctx }) => {
    const { userId, deps } = ctx;
    const { image_id, label, type = IMG_DEFAULTS.subjectType, description } = input;

    if (!deps.db.subjectCreate) {
      return errorResult("NOT_SUPPORTED", "Subject registration not supported in this environment");
    }

    const imageId = asImageId(image_id);
    const resolveResult = await tryCatch(deps.resolvers.resolveImage(imageId));
    if (!resolveResult.ok) {
      return errorResult("IMAGE_NOT_FOUND", resolveResult.error.message);
    }
    if (!resolveResult.data) {
      return errorResult("IMAGE_NOT_FOUND", "Image not found");
    }

    const subjectResult = await tryCatch(
      deps.db.subjectCreate({
        userId,
        imageId,
        label,
        type,
        description: description ?? null,
      }),
    );

    if (!subjectResult.ok || !subjectResult.data) {
      return errorResult("REGISTER_FAILED", "Failed to register subject");
    }

    const subject = subjectResult.data;

    ctx.notify?.(
      toolEvent("subject:created", subject.id, { label: subject.label, type: subject.type }),
    );

    return jsonResult({
      subject_id: subject.id,
      label: subject.label,
      type: subject.type,
      status: "REGISTERED",
    });
  });

export const subjectSave = subjectSaveTool.handler;
export const SubjectSaveInputSchema = z.object(subjectSaveTool.inputSchema);
export type SubjectSaveInput = Parameters<typeof subjectSave>[0];
