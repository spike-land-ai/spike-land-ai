import { RunInstancesCommand } from "@aws-sdk/client-ec2";

import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { BoxStatus } from "@prisma/client";
import { getInstanceStatus } from "./ec2-actions";
import { getEC2Client, getEC2Config } from "./ec2-client";
import { generateUserData } from "./user-data-template";

const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BoxForProvisioning {
  id: string;
  name: string;
  userId: string;
}

/**
 * Create a Cloudflare Tunnel for the box and return the tunnel token + URL.
 */
async function createCloudflareTunnel(
  boxId: string,
): Promise<{ tunnelToken: string; tunnelUrl: string } | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    logger.error("[EC2Provisioner] Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN");
    return null;
  }

  const tunnelName = `box-${boxId}`;

  // Generate a random secret for the tunnel
  const secretBytes = new Uint8Array(32);
  crypto.getRandomValues(secretBytes);
  const tunnelSecret = Buffer.from(secretBytes).toString("base64");

  // Create tunnel via Cloudflare API
  const { data: createResp, error: createErr } = await tryCatch(
    fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: tunnelName,
        tunnel_secret: tunnelSecret,
      }),
    }),
  );

  if (createErr || !createResp.ok) {
    const body = createResp ? await createResp.text() : createErr?.toString();
    logger.error("[EC2Provisioner] Failed to create Cloudflare tunnel", undefined, {
      body: String(body),
    });
    return null;
  }

  const createBody = (await createResp.json()) as {
    result: { id: string; token: string };
  };

  const tunnelId = createBody.result.id;
  const tunnelToken = createBody.result.token;

  // Configure tunnel to point to the local proxy
  const { error: configErr } = await tryCatch(
    fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: {
            ingress: [
              {
                service: "http://localhost:8080",
              },
            ],
          },
        }),
      },
    ),
  );

  if (configErr) {
    logger.error("[EC2Provisioner] Failed to configure tunnel", configErr);
    return null;
  }

  const tunnelUrl = `https://${tunnelId}.cfargotunnel.com`;

  return { tunnelToken, tunnelUrl };
}

/**
 * Provision a new EC2 instance for a box.
 *
 * 1. Creates a Cloudflare Tunnel
 * 2. Launches an EC2 instance with user-data that sets up noVNC + token proxy + cloudflared
 * 3. Polls until the instance is running
 * 4. Updates the box record with instance details
 */
export async function provisionEC2Box(box: BoxForProvisioning): Promise<void> {
  const failBox = async (reason: string) => {
    logger.error(`[EC2Provisioner] ${reason}`);
    await tryCatch(
      prisma.box.update({
        where: { id: box.id },
        data: { status: BoxStatus.ERROR },
      }),
    );
  };

  // Get VNC token secret
  const vncTokenSecret = process.env.BOX_VNC_TOKEN_SECRET;
  if (!vncTokenSecret) {
    await failBox("BOX_VNC_TOKEN_SECRET is not configured");
    return;
  }

  // Create Cloudflare Tunnel
  const tunnel = await createCloudflareTunnel(box.id);
  if (!tunnel) {
    await failBox("Failed to create Cloudflare tunnel");
    return;
  }

  // Get EC2 config
  let config;
  try {
    config = getEC2Config();
  } catch (err) {
    await failBox(`EC2 config error: ${err}`);
    return;
  }

  // Generate user-data
  const userData = generateUserData(vncTokenSecret, tunnel.tunnelToken);

  // Launch instance
  const ec2 = getEC2Client();
  const { data: runResult, error: runError } = await tryCatch(
    ec2.send(
      new RunInstancesCommand({
        ImageId: config.amiId,
        InstanceType: config.instanceType as "t4g.small",
        MinCount: 1,
        MaxCount: 1,
        KeyName: config.keyName,
        SecurityGroupIds: [config.securityGroupId],
        SubnetId: config.subnetId,
        UserData: userData,
        MetadataOptions: {
          HttpTokens: "required",
          HttpPutResponseHopLimit: 1,
          HttpEndpoint: "enabled",
        },
        TagSpecifications: [
          {
            ResourceType: "instance",
            Tags: [
              { Key: "Name", Value: `box-${box.id}` },
              { Key: "BoxId", Value: box.id },
              { Key: "UserId", Value: box.userId },
              { Key: "ManagedBy", Value: "spike-land-boxes" },
            ],
          },
        ],
      }),
    ),
  );

  if (runError || !runResult.Instances?.[0]) {
    await failBox(`EC2 RunInstances failed: ${runError}`);
    return;
  }

  const instanceId = runResult.Instances[0].InstanceId!;
  logger.info(`[EC2Provisioner] Launched instance ${instanceId} for box ${box.id}`);

  // Store instance ID and tunnel URL immediately
  const { error: saveError } = await tryCatch(
    prisma.box.update({
      where: { id: box.id },
      data: {
        ec2InstanceId: instanceId,
        ec2Region: config.region,
        tunnelUrl: tunnel.tunnelUrl,
        status: BoxStatus.STARTING,
      },
    }),
  );

  if (saveError) {
    logger.error("[EC2Provisioner] Failed to save instance ID to DB", saveError);
  }

  // Poll until running
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const status = await getInstanceStatus(instanceId);
    if (!status) continue;

    if (status.state === "running") {
      // Update box with final details
      const { error: updateError } = await tryCatch(
        prisma.box.update({
          where: { id: box.id },
          data: {
            status: BoxStatus.RUNNING,
            publicIp: status.publicIp,
            privateIp: status.privateIp,
            connectionUrl: tunnel.tunnelUrl,
          },
        }),
      );

      if (updateError) {
        logger.error("[EC2Provisioner] Failed to update box as RUNNING", updateError);
      } else {
        logger.info(`[EC2Provisioner] Box ${box.id} is now RUNNING at ${tunnel.tunnelUrl}`);
      }
      return;
    }

    if (status.state === "terminated" || status.state === "shutting-down") {
      await failBox(`Instance ${instanceId} terminated unexpectedly`);
      return;
    }
  }

  await failBox(`Instance ${instanceId} did not reach running state within timeout`);
}
