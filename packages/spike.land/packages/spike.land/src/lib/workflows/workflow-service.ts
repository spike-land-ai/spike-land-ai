import prisma from "@/lib/prisma";
import type {
  CreateVersionInput,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowData,
  WorkflowRunData,
  WorkflowRunLogEntry,
  WorkflowStepData,
  WorkflowVersionData,
} from "@/types/workflow";
import type {
  BranchType,
  Prisma,
  Workflow,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowStep,
  WorkflowStepType,
  WorkflowVersion,
} from "@prisma/client";
import { validateForPublish, validateWorkflow } from "./workflow-validator";

/**
 * Lists all workflows for a workspace
 */
export async function listWorkflows(
  workspaceId: string,
  options: {
    status?: WorkflowStatus;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ workflows: WorkflowData[]; total: number; }> {
  const { status, page = 1, pageSize = 20 } = options;
  const skip = (page - 1) * pageSize;

  const where = {
    workspaceId,
    ...(status && { status }),
  };

  const [workflows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: {
            steps: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.workflow.count({ where }),
  ]);

  return {
    workflows: workflows.map(mapWorkflowToData),
    total,
  };
}

/**
 * Gets a single workflow by ID
 */
export async function getWorkflow(
  workflowId: string,
  workspaceId: string,
): Promise<WorkflowData | null> {
  const workflow = await prisma.workflow.findFirst({
    where: {
      id: workflowId,
      workspaceId,
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        include: {
          steps: {
            orderBy: { sequence: "asc" },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return workflow ? mapWorkflowToData(workflow) : null;
}

/**
 * Creates a new workflow
 */
export async function createWorkflow(
  workspaceId: string,
  createdById: string,
  input: CreateWorkflowInput,
): Promise<WorkflowData> {
  const { name, description, steps = [] } = input;

  // Validate steps if provided
  if (steps.length > 0) {
    const validation = validateWorkflow(steps);
    if (!validation.valid) {
      throw new Error(
        `Invalid workflow: ${validation.errors.map(e => e.message).join(", ")}`,
      );
    }
  }

  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      workspaceId,
      createdById,
      status: "DRAFT",
      versions: {
        create: {
          version: 1,
          description: "Initial version",
          steps: {
            create: steps.map((step, index) => ({
              name: step.name,
              type: step.type,
              sequence: step.sequence ?? index,
              config: step.config as Prisma.InputJsonValue,
              dependencies: (step.dependencies ?? []) as Prisma.InputJsonValue,
              parentStepId: step.parentStepId ?? null,
              branchType: step.branchType ?? null,
              branchCondition: step.branchCondition ?? null,
            })),
          },
        },
      },
    },
    include: {
      versions: {
        include: {
          steps: {
            orderBy: { sequence: "asc" },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return mapWorkflowToData(workflow);
}

/**
 * Updates an existing workflow
 */
export async function updateWorkflow(
  workflowId: string,
  workspaceId: string,
  input: UpdateWorkflowInput,
): Promise<WorkflowData> {
  // Verify workflow exists and belongs to workspace
  const existing = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!existing) {
    throw new Error("Workflow not found");
  }

  const workflow = await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined
        && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        include: {
          steps: {
            orderBy: { sequence: "asc" },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return mapWorkflowToData(workflow);
}

/**
 * Deletes a workflow
 */
export async function deleteWorkflow(
  workflowId: string,
  workspaceId: string,
): Promise<void> {
  // Verify workflow exists and belongs to workspace
  const existing = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!existing) {
    throw new Error("Workflow not found");
  }

  await prisma.workflow.delete({
    where: { id: workflowId },
  });
}

/**
 * Creates a new version of a workflow
 */
export async function createWorkflowVersion(
  workflowId: string,
  workspaceId: string,
  input: CreateVersionInput,
): Promise<WorkflowVersionData> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Validate steps
  const validation = validateWorkflow(input.steps);
  if (!validation.valid) {
    throw new Error(
      `Invalid workflow: ${validation.errors.map(e => e.message).join(", ")}`,
    );
  }

  const nextVersion = (workflow.versions[0]?.version ?? 0) + 1;

  const version = await prisma.workflowVersion.create({
    data: {
      workflowId,
      version: nextVersion,
      description: input.description,
      steps: {
        create: input.steps.map((step, index) => ({
          name: step.name,
          type: step.type,
          sequence: step.sequence ?? index,
          config: step.config as Prisma.InputJsonValue,
          dependencies: (step.dependencies ?? []) as Prisma.InputJsonValue,
          parentStepId: step.parentStepId ?? null,
          branchType: step.branchType ?? null,
          branchCondition: step.branchCondition ?? null,
        })),
      },
    },
    include: {
      steps: {
        orderBy: { sequence: "asc" },
      },
    },
  });

  return mapVersionToData(version);
}

/**
 * Publishes a workflow version
 */
export async function publishWorkflowVersion(
  workflowId: string,
  workspaceId: string,
  versionId: string,
): Promise<WorkflowVersionData> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const version = await prisma.workflowVersion.findFirst({
    where: { id: versionId, workflowId },
    include: {
      steps: {
        orderBy: { sequence: "asc" },
      },
    },
  });

  if (!version) {
    throw new Error("Version not found");
  }

  // Validate for publishing
  const steps = version.steps.map(mapStepToData);
  const validation = validateForPublish(steps);
  if (!validation.valid) {
    throw new Error(
      `Cannot publish workflow: ${validation.errors.map(e => e.message).join(", ")}`,
    );
  }

  // Unpublish any currently published version
  await prisma.workflowVersion.updateMany({
    where: {
      workflowId,
      isPublished: true,
    },
    data: {
      isPublished: false,
    },
  });

  // Publish this version
  const published = await prisma.workflowVersion.update({
    where: { id: versionId },
    data: {
      isPublished: true,
      publishedAt: new Date(),
    },
    include: {
      steps: {
        orderBy: { sequence: "asc" },
      },
    },
  });

  // Update workflow status to ACTIVE
  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: "ACTIVE" },
  });

  return mapVersionToData(published);
}

/**
 * Gets workflow runs
 */
export async function getWorkflowRuns(
  workflowId: string,
  workspaceId: string,
  options: {
    status?: WorkflowRunStatus;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ runs: WorkflowRunData[]; total: number; }> {
  const { status, page = 1, pageSize = 20 } = options;
  const skip = (page - 1) * pageSize;

  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const where = {
    workflowId,
    ...(status && { status }),
  };

  const [runs, total] = await Promise.all([
    prisma.workflowRun.findMany({
      where,
      include: {
        logs: {
          orderBy: { timestamp: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.workflowRun.count({ where }),
  ]);

  return {
    runs: runs.map(mapRunToData),
    total,
  };
}

/**
 * Gets a single workflow run
 */
export async function getWorkflowRun(
  runId: string,
  workflowId: string,
  workspaceId: string,
): Promise<WorkflowRunData | null> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const run = await prisma.workflowRun.findFirst({
    where: {
      id: runId,
      workflowId,
    },
    include: {
      logs: {
        orderBy: { timestamp: "asc" },
      },
    },
  });

  return run ? mapRunToData(run) : null;
}

// Helper function to map Prisma workflow to WorkflowData
type WorkflowWithRelations = Workflow & {
  versions: (WorkflowVersion & { steps: WorkflowStep[]; })[];
  createdBy: { id: string; name: string | null; };
};

function mapWorkflowToData(workflow: WorkflowWithRelations): WorkflowData {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    workspaceId: workflow.workspaceId,
    createdById: workflow.createdById,
    versions: workflow.versions.map(mapVersionToData),
  };
}

// Helper function to map Prisma version to WorkflowVersionData
type VersionWithSteps = WorkflowVersion & { steps: WorkflowStep[]; };

function mapVersionToData(version: VersionWithSteps): WorkflowVersionData {
  return {
    id: version.id,
    version: version.version,
    description: version.description,
    isPublished: version.isPublished,
    publishedAt: version.publishedAt,
    steps: version.steps.map(mapStepToData),
  };
}

// Helper function to map Prisma step to WorkflowStepData
function mapStepToData(step: WorkflowStep): WorkflowStepData {
  return {
    id: step.id,
    name: step.name,
    type: step.type as WorkflowStepType,
    sequence: step.sequence,
    config: step.config as Record<string, unknown>,
    dependencies: step.dependencies as string[] | undefined,
    parentStepId: step.parentStepId,
    branchType: step.branchType as BranchType | null,
    branchCondition: step.branchCondition,
  };
}

// Helper function to map Prisma run to WorkflowRunData
type RunWithLogs = WorkflowRun & {
  logs: Array<{
    stepId: string | null;
    stepStatus: string | null;
    message: string;
    metadata: unknown;
    timestamp: Date;
  }>;
};

function mapRunToData(run: RunWithLogs): WorkflowRunData {
  return {
    id: run.id,
    workflowId: run.workflowId,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    logs: run.logs.map(log => ({
      stepId: log.stepId ?? undefined,
      stepStatus: log.stepStatus as WorkflowRunLogEntry["stepStatus"],
      message: log.message,
      metadata: log.metadata as Record<string, unknown> | undefined,
      timestamp: log.timestamp,
    })),
  };
}
