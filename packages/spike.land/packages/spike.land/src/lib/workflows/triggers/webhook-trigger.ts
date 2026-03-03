/**
 * Webhook Trigger Service
 *
 * Handles webhook-based workflow triggers with HMAC signature verification.
 */

import prisma from "@/lib/prisma";
import type {
  CreateWebhookInput,
  UpdateWebhookInput,
  WorkflowWebhookData,
} from "@/types/workflow";
import crypto from "crypto";
import { safeEncryptToken } from "@/lib/crypto/token-encryption";

/**
 * Generate a secure random token for webhook URLs
 */
function generateWebhookToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a webhook trigger for a workflow
 */
export async function createWebhookTrigger(
  workflowId: string,
  workspaceId: string,
  input: CreateWebhookInput,
): Promise<WorkflowWebhookData> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const webhookToken = generateWebhookToken();
  const secretEncrypted = input.secret ? safeEncryptToken(input.secret) : null;

  const webhook = await prisma.workflowWebhook.create({
    data: {
      workflowId,
      webhookToken,
      secretEncrypted,
      secretHash: null, // No longer using hash
    },
  });

  return mapWebhookToData(webhook);
}

/**
 * Update a webhook trigger
 */
export async function updateWebhookTrigger(
  webhookId: string,
  workflowId: string,
  workspaceId: string,
  input: UpdateWebhookInput,
): Promise<WorkflowWebhookData> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Verify webhook exists
  const existing = await prisma.workflowWebhook.findFirst({
    where: { id: webhookId, workflowId },
  });

  if (!existing) {
    throw new Error("Webhook not found");
  }

  const updateData: {
    webhookToken?: string;
    secretEncrypted?: string | null;
    secretHash?: null;
    isActive?: boolean;
  } = {};

  if (input.regenerateToken) {
    updateData.webhookToken = generateWebhookToken();
  }

  if (input.secret !== undefined) {
    updateData.secretEncrypted = input.secret
      ? safeEncryptToken(input.secret)
      : null;
    updateData.secretHash = null; // Ensure hash is cleared when updating secret
  }

  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }

  const webhook = await prisma.workflowWebhook.update({
    where: { id: webhookId },
    data: updateData,
  });

  return mapWebhookToData(webhook);
}

/**
 * Delete a webhook trigger
 */
export async function deleteWebhookTrigger(
  webhookId: string,
  workflowId: string,
  workspaceId: string,
): Promise<void> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  // Verify webhook exists
  const existing = await prisma.workflowWebhook.findFirst({
    where: { id: webhookId, workflowId },
  });

  if (!existing) {
    throw new Error("Webhook not found");
  }

  await prisma.workflowWebhook.delete({
    where: { id: webhookId },
  });
}

/**
 * Get all webhook triggers for a workflow
 */
export async function getWorkflowWebhooks(
  workflowId: string,
  workspaceId: string,
): Promise<WorkflowWebhookData[]> {
  // Verify workflow exists and belongs to workspace
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const webhooks = await prisma.workflowWebhook.findMany({
    where: { workflowId },
    orderBy: { createdAt: "asc" },
  });

  return webhooks.map(mapWebhookToData);
}

/**
 * Find a webhook by its token
 */
export async function findWebhookByToken(
  token: string,
): Promise<
  {
    webhookId: string;
    workflowId: string;
    workspaceId: string;
    secretHash: string | null;
    secretEncrypted: string | null;
    isActive: boolean;
    workflowStatus: string;
  } | null
> {
  const webhook = await prisma.workflowWebhook.findUnique({
    where: { webhookToken: token },
    include: {
      workflow: {
        select: {
          workspaceId: true,
          status: true,
        },
      },
    },
  });

  if (!webhook) return null;

  return {
    webhookId: webhook.id,
    workflowId: webhook.workflowId,
    workspaceId: webhook.workflow.workspaceId,
    secretHash: webhook.secretHash,
    secretEncrypted: webhook.secretEncrypted,
    isActive: webhook.isActive,
    workflowStatus: webhook.workflow.status,
  };
}

/**
 * Mark a webhook as having been triggered
 */
export async function markWebhookTriggered(webhookId: string): Promise<void> {
  await prisma.workflowWebhook.update({
    where: { id: webhookId },
    data: {
      lastTriggeredAt: new Date(),
    },
  });
}

/**
 * Verify a webhook request
 *
 * @param token - The webhook token from the URL
 * @param payload - The raw request body
 * @param signature - The signature from the X-Webhook-Signature header (optional)
 * @returns Verification result with webhook details
 */
export async function verifyWebhookRequest(
  token: string,
  _payload: string,
  _signature?: string,
): Promise<{
  valid: boolean;
  error?: string;
  webhook?: {
    webhookId: string;
    workflowId: string;
    workspaceId: string;
  };
}> {
  // Find webhook by token
  const webhookData = await findWebhookByToken(token);

  if (!webhookData) {
    return { valid: false, error: "Webhook not found" };
  }

  if (!webhookData.isActive) {
    return { valid: false, error: "Webhook is disabled" };
  }

  if (webhookData.workflowStatus !== "ACTIVE") {
    return { valid: false, error: "Workflow is not active" };
  }

  // NOTE: HMAC verification is now performed in the API route using the raw secret decrypted from secretEncrypted.
  // This function remains for basic status checks.

  return {
    valid: true,
    webhook: {
      webhookId: webhookData.webhookId,
      workflowId: webhookData.workflowId,
      workspaceId: webhookData.workspaceId,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a webhook URL from a token
 */
export function buildWebhookUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spike.land";
  return `${baseUrl}/api/webhooks/${token}`;
}

/**
 * Generate an HMAC-SHA256 signature for a payload
 */
export function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify an HMAC-SHA256 signature using timing-safe comparison
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = generateSignature(payload, secret);
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

function mapWebhookToData(webhook: {
  id: string;
  workflowId: string;
  webhookToken: string;
  secretHash: string | null;
  secretEncrypted?: string | null;
  isActive: boolean;
  lastTriggeredAt: Date | null;
}): WorkflowWebhookData {
  return {
    id: webhook.id,
    workflowId: webhook.workflowId,
    webhookToken: webhook.webhookToken,
    webhookUrl: buildWebhookUrl(webhook.webhookToken),
    hasSecret: !!webhook.secretHash || !!webhook.secretEncrypted,
    isActive: webhook.isActive,
    lastTriggeredAt: webhook.lastTriggeredAt,
  };
}
