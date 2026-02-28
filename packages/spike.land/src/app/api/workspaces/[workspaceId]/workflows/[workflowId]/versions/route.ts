/**
 * Workflow Versions API
 *
 * POST /api/workspaces/[workspaceId]/workflows/[workflowId]/versions - Create a new version
 * POST /api/workspaces/[workspaceId]/workflows/[workflowId]/versions?action=publish&versionId=xxx - Publish a version
 */

import { auth } from "@/lib/auth";
import { requireWorkspaceMembership } from "@/lib/permissions/workspace-middleware";
import { tryCatch } from "@/lib/try-catch";
import {
  createWorkflowVersion,
  publishWorkflowVersion,
} from "@/lib/workflows/workflow-service";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { WorkflowStepData } from "@/types/workflow";

interface RouteParams {
  params: Promise<{ workspaceId: string; workflowId: string; }>;
}

const stepSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Step name is required"),
  type: z.enum(["TRIGGER", "ACTION", "CONDITION"]),
  sequence: z.number().int().nonnegative().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  dependencies: z.array(z.string()).optional(),
  parentStepId: z.string().nullable().optional(),
  branchType: z.enum(["IF_TRUE", "IF_FALSE", "SWITCH_CASE", "DEFAULT"])
    .nullable().optional(),
  branchCondition: z.string().nullable().optional(),
});

const createVersionSchema = z.object({
  description: z.string().max(500, "Description too long").optional(),
  steps: z.array(stepSchema).min(1, "At least one step is required"),
});

const publishSchema = z.object({
  versionId: z.string().min(1, "Version ID is required"),
});

/**
 * POST /api/workspaces/[workspaceId]/workflows/[workflowId]/versions
 *
 * Create a new workflow version or publish an existing one.
 *
 * Query params:
 * - action=publish: Publish the specified version (requires versionId in body)
 *
 * Body (for create):
 * - description: Version description (optional)
 * - steps: Array of workflow steps (required)
 *
 * Body (for publish):
 * - versionId: ID of the version to publish
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { workspaceId, workflowId } = await params;

  // Check membership
  const { error: authError } = await tryCatch(
    requireWorkspaceMembership(session, workspaceId),
  );

  if (authError) {
    const status = authError.message.includes("Unauthorized") ? 401 : 403;
    return NextResponse.json({ error: authError.message }, { status });
  }

  const action = request.nextUrl.searchParams.get("action");

  // Parse body
  const { data: body, error: parseError } = await tryCatch(request.json());

  if (parseError) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Handle publish action
  if (action === "publish") {
    const validation = publishSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }

    const { data: version, error: publishError } = await tryCatch(
      publishWorkflowVersion(
        workflowId,
        workspaceId,
        validation.data.versionId,
      ),
    );

    if (publishError) {
      if (
        publishError.message === "Workflow not found"
        || publishError.message === "Version not found"
      ) {
        return NextResponse.json(
          { error: publishError.message },
          { status: 404 },
        );
      }
      if (publishError.message.startsWith("Cannot publish workflow:")) {
        return NextResponse.json(
          { error: publishError.message },
          { status: 400 },
        );
      }
      logger.error("Failed to publish version:", publishError);
      return NextResponse.json(
        { error: "Failed to publish version" },
        { status: 500 },
      );
    }

    return NextResponse.json({ version });
  }

  // Handle create version
  const validation = createVersionSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const { description: versionDesc, steps } = validation.data;
  const { data: version, error: createError } = await tryCatch(
    createWorkflowVersion(workflowId, workspaceId, {
      ...(versionDesc !== undefined ? { description: versionDesc } : {}),
      steps: steps as WorkflowStepData[],
    }),
  );

  if (createError) {
    if (createError.message === "Workflow not found") {
      return NextResponse.json({ error: "Workflow not found" }, {
        status: 404,
      });
    }
    if (createError.message.startsWith("Invalid workflow:")) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }
    logger.error("Failed to create version:", createError);
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 },
    );
  }

  return NextResponse.json({ version }, { status: 201 });
}
