/**
 * Tests for workflow-service.ts
 *
 * Covers:
 * - listWorkflows: pagination, status filtering, mapping
 * - getWorkflow: found / not-found
 * - createWorkflow: with/without steps, validation errors
 * - updateWorkflow: found / not-found, partial updates
 * - deleteWorkflow: found / not-found
 * - createWorkflowVersion: versioning, validation errors
 * - publishWorkflowVersion: validation, unpublish old, update status
 * - getWorkflowRuns: pagination, status filtering
 * - getWorkflowRun: found / not-found
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Prisma mock (must be hoisted before imports) ────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  workflow: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  workflowVersion: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  workflowRun: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

// ── Validator mock ────────────────────────────────────────────────────────────
vi.mock("./workflow-validator", () => ({
  validateWorkflow: vi.fn(),
  validateForPublish: vi.fn(),
}));

import { validateForPublish, validateWorkflow } from "./workflow-validator";

import {
  createWorkflow,
  createWorkflowVersion,
  deleteWorkflow,
  getWorkflow,
  getWorkflowRun,
  getWorkflowRuns,
  listWorkflows,
  publishWorkflowVersion,
  updateWorkflow,
} from "./workflow-service";

import type {
  CreateVersionInput,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowStepData,
} from "@/types/workflow";

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockValidateWorkflow = vi.mocked(validateWorkflow);
const mockValidateForPublish = vi.mocked(validateForPublish);

function makeStep(id: string, name: string): WorkflowStepData {
  return {
    id,
    name,
    type: "ACTION",
    config: {},
    sequence: 0,
    dependencies: [],
    parentStepId: null,
    branchType: null,
    branchCondition: null,
  };
}

function makePrismaStep(id: string, name: string) {
  return {
    id,
    name,
    type: "ACTION",
    sequence: 0,
    config: {},
    dependencies: [],
    parentStepId: null,
    branchType: null,
    branchCondition: null,
  };
}

function makePrismaVersion(
  id: string,
  version: number,
  steps: ReturnType<typeof makePrismaStep>[] = [],
) {
  return {
    id,
    version,
    description: null,
    isPublished: false,
    publishedAt: null,
    steps,
  };
}

function makePrismaWorkflow(
  id: string,
  name: string,
  versions: ReturnType<typeof makePrismaVersion>[] = [],
) {
  return {
    id,
    name,
    description: null,
    status: "DRAFT",
    workspaceId: "ws-1",
    createdById: "user-1",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    versions,
    createdBy: { id: "user-1", name: "Test User" },
  };
}

function makePrismaRun(id: string, status: string = "COMPLETED") {
  return {
    id,
    workflowId: "wf-1",
    status,
    startedAt: new Date("2025-01-01"),
    endedAt: new Date("2025-01-01"),
    logs: [],
  };
}

// ── listWorkflows ─────────────────────────────────────────────────────────────

describe("listWorkflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped workflows and total count", async () => {
    const prismaWorkflows = [makePrismaWorkflow("wf-1", "My Workflow")];
    mockPrisma.workflow.findMany.mockResolvedValue(prismaWorkflows);
    mockPrisma.workflow.count.mockResolvedValue(1);

    const result = await listWorkflows("ws-1");

    expect(result.total).toBe(1);
    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0]!.id).toBe("wf-1");
    expect(result.workflows[0]!.name).toBe("My Workflow");
    expect(result.workflows[0]!.workspaceId).toBe("ws-1");
  });

  it("applies default pagination (page=1, pageSize=20)", async () => {
    mockPrisma.workflow.findMany.mockResolvedValue([]);
    mockPrisma.workflow.count.mockResolvedValue(0);

    await listWorkflows("ws-1");

    expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it("applies custom pagination", async () => {
    mockPrisma.workflow.findMany.mockResolvedValue([]);
    mockPrisma.workflow.count.mockResolvedValue(0);

    await listWorkflows("ws-1", { page: 3, pageSize: 10 });

    expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it("filters by status when provided", async () => {
    mockPrisma.workflow.findMany.mockResolvedValue([]);
    mockPrisma.workflow.count.mockResolvedValue(0);

    await listWorkflows("ws-1", { status: "ACTIVE" });

    expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });

  it("does not include status in where clause when not provided", async () => {
    mockPrisma.workflow.findMany.mockResolvedValue([]);
    mockPrisma.workflow.count.mockResolvedValue(0);

    await listWorkflows("ws-1");

    const callArgs = mockPrisma.workflow.findMany.mock.calls[0]![0]!;
    expect(callArgs.where).not.toHaveProperty("status");
  });

  it("maps version steps correctly", async () => {
    const steps = [makePrismaStep("step-1", "Step One")];
    const version = makePrismaVersion("ver-1", 1, steps);
    const workflow = makePrismaWorkflow("wf-1", "WF", [version]);
    mockPrisma.workflow.findMany.mockResolvedValue([workflow]);
    mockPrisma.workflow.count.mockResolvedValue(1);

    const result = await listWorkflows("ws-1");

    expect(result.workflows[0]!.versions?.[0]?.steps).toHaveLength(1);
    expect(result.workflows[0]!.versions?.[0]?.steps?.[0]?.name).toBe("Step One");
  });

  it("returns empty array when no workflows exist", async () => {
    mockPrisma.workflow.findMany.mockResolvedValue([]);
    mockPrisma.workflow.count.mockResolvedValue(0);

    const result = await listWorkflows("ws-1");
    expect(result.workflows).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ── getWorkflow ───────────────────────────────────────────────────────────────

describe("getWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns WorkflowData when workflow is found", async () => {
    const workflow = makePrismaWorkflow("wf-1", "Found Workflow", [
      makePrismaVersion("v1", 1, [makePrismaStep("s1", "Step 1")]),
    ]);
    mockPrisma.workflow.findFirst.mockResolvedValue(workflow);

    const result = await getWorkflow("wf-1", "ws-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("wf-1");
    expect(result?.name).toBe("Found Workflow");
    expect(result?.versions?.[0]?.steps?.[0]?.name).toBe("Step 1");
  });

  it("returns null when workflow is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    const result = await getWorkflow("wf-missing", "ws-1");

    expect(result).toBeNull();
  });

  it("queries with correct workflowId and workspaceId", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    await getWorkflow("wf-42", "ws-99");

    expect(mockPrisma.workflow.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wf-42", workspaceId: "ws-99" },
      }),
    );
  });
});

// ── createWorkflow ────────────────────────────────────────────────────────────

describe("createWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateWorkflow.mockReturnValue({ valid: true, errors: [], warnings: [] });
  });

  it("creates workflow without steps", async () => {
    const created = makePrismaWorkflow("wf-new", "New WF");
    mockPrisma.workflow.create.mockResolvedValue(created);

    const input: CreateWorkflowInput = { name: "New WF" };
    const result = await createWorkflow("ws-1", "user-1", input);

    expect(result.id).toBe("wf-new");
    expect(result.name).toBe("New WF");
    expect(mockValidateWorkflow).not.toHaveBeenCalled();
  });

  it("creates workflow with steps and validates them", async () => {
    const steps = [makeStep("s1", "Step 1")];
    const created = makePrismaWorkflow("wf-with-steps", "WF With Steps", [
      makePrismaVersion("v1", 1, [makePrismaStep("s1", "Step 1")]),
    ]);
    mockPrisma.workflow.create.mockResolvedValue(created);

    const input: CreateWorkflowInput = { name: "WF With Steps", steps };
    const result = await createWorkflow("ws-1", "user-1", input);

    expect(mockValidateWorkflow).toHaveBeenCalledWith(steps);
    expect(result.id).toBe("wf-with-steps");
    expect(result.versions?.[0]?.steps).toHaveLength(1);
  });

  it("throws validation error when steps are invalid", async () => {
    mockValidateWorkflow.mockReturnValue({
      valid: false,
      errors: [{ code: "MISSING_NAME", message: "Step name is required" }],
      warnings: [],
    });

    const input: CreateWorkflowInput = {
      name: "Bad Workflow",
      steps: [makeStep("s1", "")],
    };

    await expect(createWorkflow("ws-1", "user-1", input)).rejects.toThrow("Invalid workflow");
    await expect(createWorkflow("ws-1", "user-1", input)).rejects.toThrow("Step name is required");
  });

  it("creates workflow with initial DRAFT status", async () => {
    const created = makePrismaWorkflow("wf-draft", "Draft WF");
    mockPrisma.workflow.create.mockResolvedValue(created);

    await createWorkflow("ws-1", "user-1", { name: "Draft WF" });

    expect(mockPrisma.workflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT" }),
      }),
    );
  });

  it("sets correct workspaceId and createdById", async () => {
    const created = makePrismaWorkflow("wf-x", "WF X");
    mockPrisma.workflow.create.mockResolvedValue(created);

    await createWorkflow("ws-abc", "user-xyz", { name: "WF X" });

    expect(mockPrisma.workflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "ws-abc",
          createdById: "user-xyz",
        }),
      }),
    );
  });

  it("creates version 1 for initial workflow", async () => {
    const created = makePrismaWorkflow("wf-v1", "WF");
    mockPrisma.workflow.create.mockResolvedValue(created);

    await createWorkflow("ws-1", "user-1", { name: "WF" });

    const callData = mockPrisma.workflow.create.mock.calls[0]![0]!.data;
    expect(callData.versions.create.version).toBe(1);
    expect(callData.versions.create.description).toBe("Initial version");
  });
});

// ── updateWorkflow ────────────────────────────────────────────────────────────

describe("updateWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when workflow is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    const input: UpdateWorkflowInput = { name: "New Name" };
    await expect(updateWorkflow("wf-missing", "ws-1", input)).rejects.toThrow("Workflow not found");
  });

  it("updates workflow name", async () => {
    const existing = makePrismaWorkflow("wf-1", "Old Name");
    const updated = makePrismaWorkflow("wf-1", "New Name");
    mockPrisma.workflow.findFirst.mockResolvedValue(existing);
    mockPrisma.workflow.update.mockResolvedValue(updated);

    const result = await updateWorkflow("wf-1", "ws-1", { name: "New Name" });

    expect(result.name).toBe("New Name");
    expect(mockPrisma.workflow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wf-1" },
        data: expect.objectContaining({ name: "New Name" }),
      }),
    );
  });

  it("updates workflow status", async () => {
    const existing = makePrismaWorkflow("wf-1", "My WF");
    const updated = { ...makePrismaWorkflow("wf-1", "My WF"), status: "ACTIVE" };
    mockPrisma.workflow.findFirst.mockResolvedValue(existing);
    mockPrisma.workflow.update.mockResolvedValue(updated);

    const result = await updateWorkflow("wf-1", "ws-1", { status: "ACTIVE" });

    expect(result.status).toBe("ACTIVE");
  });

  it("updates description (including null to clear it)", async () => {
    const existing = makePrismaWorkflow("wf-1", "My WF");
    const updated = { ...makePrismaWorkflow("wf-1", "My WF"), description: null };
    mockPrisma.workflow.findFirst.mockResolvedValue(existing);
    mockPrisma.workflow.update.mockResolvedValue(updated);

    await updateWorkflow("wf-1", "ws-1", { description: null });

    expect(mockPrisma.workflow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: null }),
      }),
    );
  });

  it("does not include undefined fields in update data", async () => {
    const existing = makePrismaWorkflow("wf-1", "My WF");
    const updated = makePrismaWorkflow("wf-1", "My WF");
    mockPrisma.workflow.findFirst.mockResolvedValue(existing);
    mockPrisma.workflow.update.mockResolvedValue(updated);

    await updateWorkflow("wf-1", "ws-1", {});

    const updateData = mockPrisma.workflow.update.mock.calls[0]![0]!.data;
    expect(updateData).not.toHaveProperty("name");
    expect(updateData).not.toHaveProperty("description");
    expect(updateData).not.toHaveProperty("status");
  });
});

// ── deleteWorkflow ────────────────────────────────────────────────────────────

describe("deleteWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when workflow is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    await expect(deleteWorkflow("wf-missing", "ws-1")).rejects.toThrow("Workflow not found");
  });

  it("deletes the workflow when it exists", async () => {
    const existing = makePrismaWorkflow("wf-1", "To Delete");
    mockPrisma.workflow.findFirst.mockResolvedValue(existing);
    mockPrisma.workflow.delete.mockResolvedValue(existing);

    await deleteWorkflow("wf-1", "ws-1");

    expect(mockPrisma.workflow.delete).toHaveBeenCalledWith({
      where: { id: "wf-1" },
    });
  });

  it("returns void (undefined) on success", async () => {
    const existing = makePrismaWorkflow("wf-1", "To Delete");
    mockPrisma.workflow.findFirst.mockResolvedValue(existing);
    mockPrisma.workflow.delete.mockResolvedValue(existing);

    const result = await deleteWorkflow("wf-1", "ws-1");
    expect(result).toBeUndefined();
  });
});

// ── createWorkflowVersion ─────────────────────────────────────────────────────

describe("createWorkflowVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateWorkflow.mockReturnValue({ valid: true, errors: [], warnings: [] });
  });

  it("throws when workflow is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    const input: CreateVersionInput = { steps: [] };
    await expect(createWorkflowVersion("wf-missing", "ws-1", input)).rejects.toThrow(
      "Workflow not found",
    );
  });

  it("throws when steps are invalid", async () => {
    mockValidateWorkflow.mockReturnValue({
      valid: false,
      errors: [{ code: "MISSING_NAME", message: "Step name is required" }],
      warnings: [],
    });

    const workflow = {
      ...makePrismaWorkflow("wf-1", "My WF"),
      versions: [makePrismaVersion("v1", 3)],
    };
    mockPrisma.workflow.findFirst.mockResolvedValue(workflow);

    const input: CreateVersionInput = { steps: [makeStep("s1", "")] };
    await expect(createWorkflowVersion("wf-1", "ws-1", input)).rejects.toThrow("Invalid workflow");
  });

  it("increments version number from latest version", async () => {
    const workflow = {
      ...makePrismaWorkflow("wf-1", "My WF"),
      versions: [makePrismaVersion("v3", 3)],
    };
    mockPrisma.workflow.findFirst.mockResolvedValue(workflow);

    const newVersion = makePrismaVersion("v4", 4, [makePrismaStep("s1", "Step")]);
    mockPrisma.workflowVersion.create.mockResolvedValue(newVersion);

    const input: CreateVersionInput = { steps: [makeStep("s1", "Step")] };
    await createWorkflowVersion("wf-1", "ws-1", input);

    expect(mockPrisma.workflowVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 4 }),
      }),
    );
  });

  it("starts at version 1 when no versions exist yet", async () => {
    const workflow = { ...makePrismaWorkflow("wf-1", "My WF"), versions: [] };
    mockPrisma.workflow.findFirst.mockResolvedValue(workflow);

    const newVersion = makePrismaVersion("v1", 1);
    mockPrisma.workflowVersion.create.mockResolvedValue(newVersion);

    const input: CreateVersionInput = { steps: [makeStep("s1", "Step")] };
    await createWorkflowVersion("wf-1", "ws-1", input);

    expect(mockPrisma.workflowVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 1 }),
      }),
    );
  });

  it("returns mapped version data with steps", async () => {
    const workflow = {
      ...makePrismaWorkflow("wf-1", "My WF"),
      versions: [makePrismaVersion("v1", 1)],
    };
    mockPrisma.workflow.findFirst.mockResolvedValue(workflow);

    const newVersion = makePrismaVersion("v2", 2, [makePrismaStep("s1", "My Step")]);
    mockPrisma.workflowVersion.create.mockResolvedValue(newVersion);

    const input: CreateVersionInput = {
      description: "v2 desc",
      steps: [makeStep("s1", "My Step")],
    };
    const result = await createWorkflowVersion("wf-1", "ws-1", input);

    expect(result.version).toBe(2);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.name).toBe("My Step");
  });

  it("stores step sequence using index when sequence is not specified", async () => {
    const workflow = { ...makePrismaWorkflow("wf-1", "My WF"), versions: [] };
    mockPrisma.workflow.findFirst.mockResolvedValue(workflow);
    mockPrisma.workflowVersion.create.mockResolvedValue(makePrismaVersion("v1", 1));

    const stepsInput: WorkflowStepData[] = [
      { id: "s1", name: "First", type: "ACTION", config: {} },
      { id: "s2", name: "Second", type: "ACTION", config: {} },
    ];
    const input: CreateVersionInput = { steps: stepsInput };
    await createWorkflowVersion("wf-1", "ws-1", input);

    const createData = mockPrisma.workflowVersion.create.mock.calls[0]![0]!.data;
    expect(createData.steps.create[0].sequence).toBe(0);
    expect(createData.steps.create[1].sequence).toBe(1);
  });
});

// ── publishWorkflowVersion ────────────────────────────────────────────────────

describe("publishWorkflowVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateForPublish.mockReturnValue({ valid: true, errors: [], warnings: [] });
  });

  it("throws when workflow is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    await expect(publishWorkflowVersion("wf-missing", "ws-1", "ver-1")).rejects.toThrow(
      "Workflow not found",
    );
  });

  it("throws when version is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowVersion.findFirst.mockResolvedValue(null);

    await expect(publishWorkflowVersion("wf-1", "ws-1", "ver-missing")).rejects.toThrow(
      "Version not found",
    );
  });

  it("throws when validation for publish fails", async () => {
    mockValidateForPublish.mockReturnValue({
      valid: false,
      errors: [
        {
          code: "NO_TRIGGER_FOR_PUBLISH",
          message: "Workflow must have at least one trigger",
        },
      ],
      warnings: [],
    });

    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowVersion.findFirst.mockResolvedValue(
      makePrismaVersion("ver-1", 1, [makePrismaStep("s1", "Action")]),
    );

    await expect(publishWorkflowVersion("wf-1", "ws-1", "ver-1")).rejects.toThrow(
      "Cannot publish workflow",
    );
    await expect(publishWorkflowVersion("wf-1", "ws-1", "ver-1")).rejects.toThrow(
      "Workflow must have at least one trigger",
    );
  });

  it("unpublishes existing versions before publishing new one", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowVersion.findFirst.mockResolvedValue(
      makePrismaVersion("ver-2", 2, [makePrismaStep("s1", "Step")]),
    );
    const publishedVersion = {
      ...makePrismaVersion("ver-2", 2),
      isPublished: true,
      publishedAt: new Date(),
    };
    mockPrisma.workflowVersion.update.mockResolvedValue(publishedVersion);
    mockPrisma.workflowVersion.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.workflow.update.mockResolvedValue({});

    await publishWorkflowVersion("wf-1", "ws-1", "ver-2");

    expect(mockPrisma.workflowVersion.updateMany).toHaveBeenCalledWith({
      where: { workflowId: "wf-1", isPublished: true },
      data: { isPublished: false },
    });
  });

  it("marks the version as published and sets publishedAt", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowVersion.findFirst.mockResolvedValue(
      makePrismaVersion("ver-1", 1, [makePrismaStep("s1", "Step")]),
    );
    const publishedVersion = {
      ...makePrismaVersion("ver-1", 1, [makePrismaStep("s1", "Step")]),
      isPublished: true,
      publishedAt: new Date("2025-06-01"),
    };
    mockPrisma.workflowVersion.update.mockResolvedValue(publishedVersion);
    mockPrisma.workflowVersion.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.workflow.update.mockResolvedValue({});

    const result = await publishWorkflowVersion("wf-1", "ws-1", "ver-1");

    expect(mockPrisma.workflowVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ver-1" },
        data: expect.objectContaining({ isPublished: true }),
      }),
    );
    expect(result.isPublished).toBe(true);
  });

  it("updates workflow status to ACTIVE after publishing", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowVersion.findFirst.mockResolvedValue(
      makePrismaVersion("ver-1", 1, [makePrismaStep("s1", "Step")]),
    );
    const publishedVersion = {
      ...makePrismaVersion("ver-1", 1),
      isPublished: true,
      publishedAt: new Date(),
    };
    mockPrisma.workflowVersion.update.mockResolvedValue(publishedVersion);
    mockPrisma.workflowVersion.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.workflow.update.mockResolvedValue({});

    await publishWorkflowVersion("wf-1", "ws-1", "ver-1");

    expect(mockPrisma.workflow.update).toHaveBeenCalledWith({
      where: { id: "wf-1" },
      data: { status: "ACTIVE" },
    });
  });

  it("returns version data with steps mapped correctly", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    const steps = [makePrismaStep("s1", "Step One"), makePrismaStep("s2", "Step Two")];
    mockPrisma.workflowVersion.findFirst.mockResolvedValue(makePrismaVersion("ver-1", 1, steps));
    const publishedVersion = {
      ...makePrismaVersion("ver-1", 1, steps),
      isPublished: true,
      publishedAt: new Date(),
    };
    mockPrisma.workflowVersion.update.mockResolvedValue(publishedVersion);
    mockPrisma.workflowVersion.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.workflow.update.mockResolvedValue({});

    const result = await publishWorkflowVersion("wf-1", "ws-1", "ver-1");

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]!.name).toBe("Step One");
    expect(result.steps[1]!.name).toBe("Step Two");
  });
});

// ── getWorkflowRuns ───────────────────────────────────────────────────────────

describe("getWorkflowRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when workflow is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    await expect(getWorkflowRuns("wf-missing", "ws-1")).rejects.toThrow("Workflow not found");
  });

  it("returns runs and total count", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findMany.mockResolvedValue([
      makePrismaRun("run-1"),
      makePrismaRun("run-2"),
    ]);
    mockPrisma.workflowRun.count.mockResolvedValue(2);

    const result = await getWorkflowRuns("wf-1", "ws-1");

    expect(result.total).toBe(2);
    expect(result.runs).toHaveLength(2);
    expect(result.runs[0]!.id).toBe("run-1");
  });

  it("applies default pagination (page=1, pageSize=20)", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findMany.mockResolvedValue([]);
    mockPrisma.workflowRun.count.mockResolvedValue(0);

    await getWorkflowRuns("wf-1", "ws-1");

    expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it("applies custom pagination", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findMany.mockResolvedValue([]);
    mockPrisma.workflowRun.count.mockResolvedValue(0);

    await getWorkflowRuns("wf-1", "ws-1", { page: 2, pageSize: 5 });

    expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it("filters by status when provided", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findMany.mockResolvedValue([]);
    mockPrisma.workflowRun.count.mockResolvedValue(0);

    await getWorkflowRuns("wf-1", "ws-1", { status: "FAILED" });

    expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("maps run logs correctly", async () => {
    const runWithLogs = {
      ...makePrismaRun("run-1"),
      logs: [
        {
          stepId: "s1",
          stepStatus: "COMPLETED",
          message: "Step done",
          metadata: { key: "val" },
          timestamp: new Date("2025-01-01"),
        },
      ],
    };
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findMany.mockResolvedValue([runWithLogs]);
    mockPrisma.workflowRun.count.mockResolvedValue(1);

    const result = await getWorkflowRuns("wf-1", "ws-1");

    expect(result.runs[0]!.logs).toHaveLength(1);
    expect(result.runs[0]!.logs[0]!.stepId).toBe("s1");
    expect(result.runs[0]!.logs[0]!.message).toBe("Step done");
  });

  it("maps null stepId to undefined in logs", async () => {
    const runWithNullLog = {
      ...makePrismaRun("run-1"),
      logs: [
        {
          stepId: null,
          stepStatus: null,
          message: "Workflow started",
          metadata: null,
          timestamp: new Date(),
        },
      ],
    };
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findMany.mockResolvedValue([runWithNullLog]);
    mockPrisma.workflowRun.count.mockResolvedValue(1);

    const result = await getWorkflowRuns("wf-1", "ws-1");

    expect(result.runs[0]!.logs[0]!.stepId).toBeUndefined();
  });
});

// ── getWorkflowRun ────────────────────────────────────────────────────────────

describe("getWorkflowRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when workflow is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    await expect(getWorkflowRun("run-1", "wf-missing", "ws-1")).rejects.toThrow(
      "Workflow not found",
    );
  });

  it("returns null when run is not found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findFirst.mockResolvedValue(null);

    const result = await getWorkflowRun("run-missing", "wf-1", "ws-1");

    expect(result).toBeNull();
  });

  it("returns WorkflowRunData when run is found", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findFirst.mockResolvedValue(makePrismaRun("run-1", "COMPLETED"));

    const result = await getWorkflowRun("run-1", "wf-1", "ws-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("run-1");
    expect(result?.status).toBe("COMPLETED");
    expect(result?.workflowId).toBe("wf-1");
  });

  it("queries run with correct runId and workflowId", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findFirst.mockResolvedValue(null);

    await getWorkflowRun("run-42", "wf-99", "ws-1");

    // The first findFirst call is to verify workflow ownership
    expect(mockPrisma.workflowRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-42", workflowId: "wf-99" },
      }),
    );
  });

  it("includes logs in returned run data", async () => {
    const runWithLogs = {
      ...makePrismaRun("run-1"),
      logs: [
        {
          stepId: "s1",
          stepStatus: "RUNNING",
          message: "Processing",
          metadata: null,
          timestamp: new Date("2025-03-01"),
        },
      ],
    };
    mockPrisma.workflow.findFirst.mockResolvedValue(makePrismaWorkflow("wf-1", "My WF"));
    mockPrisma.workflowRun.findFirst.mockResolvedValue(runWithLogs);

    const result = await getWorkflowRun("run-1", "wf-1", "ws-1");

    expect(result?.logs).toHaveLength(1);
    expect(result?.logs[0]!.stepStatus).toBe("RUNNING");
    expect(result?.logs[0]!.message).toBe("Processing");
  });
});
