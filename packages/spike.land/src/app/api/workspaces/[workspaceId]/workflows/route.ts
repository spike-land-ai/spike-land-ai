/**
 * Workflow List/Create API
 *
 * GET /api/workspaces/[workspaceId]/workflows - List workflows
 * POST /api/workspaces/[workspaceId]/workflows - Create a new workflow
 */

import { auth } from "@/lib/auth";
import { requireWorkspaceMembership } from "@/lib/permissions/workspace-middleware";
import { tryCatch } from "@/lib/try-catch";
import {
  createWorkflow,
  listWorkflows,
} from "@/lib/workflows/workflow-service";
import type { WorkflowStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { WorkflowStepData } from "@/types/workflow";

interface RouteParams {
  params: Promise<{ workspaceId: string; }>;
}

const stepSchema = z.object({
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

const createWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  steps: z.array(stepSchema).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * GET /api/workspaces/[workspaceId]/workflows
 *
 * List all workflows in a workspace.
 *
 * Query params:
 * - status: Filter by workflow status (DRAFT, ACTIVE, ARCHIVED)
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { workspaceId } = await params;

  // Check membership (any role can view workflows)
  const { error: authError } = await tryCatch(
    requireWorkspaceMembership(session, workspaceId),
  );

  if (authError) {
    const status = authError.message.includes("Unauthorized") ? 401 : 403;
    return NextResponse.json({ error: authError.message }, { status });
  }

  // Parse query params
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const queryValidation = listQuerySchema.safeParse(searchParams);

  if (!queryValidation.success) {
    return NextResponse.json(
      { error: queryValidation.error.issues[0]?.message || "Invalid query" },
      { status: 400 },
    );
  }

  const { status, page, pageSize } = queryValidation.data;

  // Fetch workflows
  const workflowStatus = status as WorkflowStatus | undefined;
  const { data: result, error: fetchError } = await tryCatch(
    listWorkflows(workspaceId, {
      ...(workflowStatus !== undefined ? { status: workflowStatus } : {}),
      page,
      pageSize,
    }),
  );

  if (fetchError) {
    logger.error("Failed to list workflows:", fetchError);
    return NextResponse.json(
      { error: "Failed to list workflows" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    workflows: result.workflows,
    total: result.total,
    page,
    pageSize,
  });
}

/**
 * POST /api/workspaces/[workspaceId]/workflows
 *
 * Create a new workflow.
 *
 * Body:
 * - name: Workflow name (required)
 * - description: Workflow description (optional)
 * - steps: Initial workflow steps (optional)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { workspaceId } = await params;

  // Check membership
  const { data: membership, error: authError } = await tryCatch(
    requireWorkspaceMembership(session, workspaceId),
  );

  if (authError) {
    const status = authError.message.includes("Unauthorized") ? 401 : 403;
    return NextResponse.json({ error: authError.message }, { status });
  }

  // Parse and validate body
  const { data: body, error: parseError } = await tryCatch(request.json());

  if (parseError) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = createWorkflowSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  // Create workflow
  const { name: wfCreateName, description: wfCreateDesc, steps: wfCreateSteps } = validation.data;
  const { data: workflow, error: createError } = await tryCatch(
    createWorkflow(workspaceId, membership!.userId, {
      name: wfCreateName,
      ...(wfCreateDesc !== undefined ? { description: wfCreateDesc } : {}),
      ...(wfCreateSteps !== undefined ? { steps: wfCreateSteps as WorkflowStepData[] } : {}),
    }),
  );

  if (createError) {
    logger.error("Failed to create workflow:", createError);
    // Check if it's a validation error
    if (createError.message.startsWith("Invalid workflow:")) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 },
    );
  }

  return NextResponse.json({ workflow }, { status: 201 });
}
