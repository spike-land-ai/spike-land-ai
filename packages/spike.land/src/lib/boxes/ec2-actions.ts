import {
  DescribeInstancesCommand,
  RebootInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";

import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { BoxStatus } from "@prisma/client";
import { getEC2Client } from "./ec2-client";

export interface InstanceStatus {
  state: string;
  publicIp: string | null;
  privateIp: string | null;
}

export async function getInstanceStatus(instanceId: string): Promise<InstanceStatus | null> {
  const ec2 = getEC2Client();
  const { data, error } = await tryCatch(
    ec2.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] })),
  );

  if (error) {
    logger.error("[EC2] Failed to describe instance", error, { instanceId });
    return null;
  }

  const instance = data.Reservations?.[0]?.Instances?.[0];
  if (!instance) return null;

  return {
    state: instance.State?.Name ?? "unknown",
    publicIp: instance.PublicIpAddress ?? null,
    privateIp: instance.PrivateIpAddress ?? null,
  };
}

export async function startBoxInstance(instanceId: string): Promise<boolean> {
  const ec2 = getEC2Client();
  const { error } = await tryCatch(
    ec2.send(new StartInstancesCommand({ InstanceIds: [instanceId] })),
  );

  if (error) {
    logger.error("[EC2] Failed to start instance", error, { instanceId });
    return false;
  }

  logger.info(`[EC2] Started instance ${instanceId}`);
  return true;
}

export async function stopBoxInstance(instanceId: string): Promise<boolean> {
  const ec2 = getEC2Client();
  const { error } = await tryCatch(
    ec2.send(new StopInstancesCommand({ InstanceIds: [instanceId] })),
  );

  if (error) {
    logger.error("[EC2] Failed to stop instance", error, { instanceId });
    return false;
  }

  logger.info(`[EC2] Stopped instance ${instanceId}`);
  return true;
}

export async function restartBoxInstance(instanceId: string): Promise<boolean> {
  const ec2 = getEC2Client();
  const { error } = await tryCatch(
    ec2.send(new RebootInstancesCommand({ InstanceIds: [instanceId] })),
  );

  if (error) {
    logger.error("[EC2] Failed to reboot instance", error, { instanceId });
    return false;
  }

  logger.info(`[EC2] Rebooted instance ${instanceId}`);
  return true;
}

export async function terminateBoxInstance(instanceId: string): Promise<boolean> {
  const ec2 = getEC2Client();
  const { error } = await tryCatch(
    ec2.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] })),
  );

  if (error) {
    logger.error("[EC2] Failed to terminate instance", error, { instanceId });
    return false;
  }

  logger.info(`[EC2] Terminated instance ${instanceId}`);
  return true;
}

/**
 * Sync a box's status/IPs with its actual EC2 instance state.
 */
export async function syncBoxStatus(boxId: string): Promise<void> {
  const { data: box, error: boxError } = await tryCatch(
    prisma.box.findUnique({
      where: { id: boxId },
      select: { ec2InstanceId: true, status: true },
    }),
  );

  if (boxError || !box?.ec2InstanceId) return;

  const status = await getInstanceStatus(box.ec2InstanceId);
  if (!status) return;

  const ec2ToBoxStatus: Record<string, BoxStatus> = {
    pending: BoxStatus.STARTING,
    running: BoxStatus.RUNNING,
    stopping: BoxStatus.STOPPING,
    stopped: BoxStatus.STOPPED,
    "shutting-down": BoxStatus.STOPPING,
    terminated: BoxStatus.TERMINATED,
  };

  const newStatus = ec2ToBoxStatus[status.state];
  if (!newStatus) return;

  const updateData: Record<string, unknown> = { status: newStatus };
  if (status.publicIp) updateData.publicIp = status.publicIp;
  if (status.privateIp) updateData.privateIp = status.privateIp;

  // Clear IPs when instance stops/terminates
  if (newStatus === BoxStatus.STOPPED || newStatus === BoxStatus.TERMINATED) {
    updateData.publicIp = null;
    updateData.privateIp = null;
  }

  const { error: updateError } = await tryCatch(
    prisma.box.update({
      where: { id: boxId },
      data: updateData,
    }),
  );

  if (updateError) {
    logger.error("[EC2] Failed to sync box status", updateError, { boxId });
  }
}
