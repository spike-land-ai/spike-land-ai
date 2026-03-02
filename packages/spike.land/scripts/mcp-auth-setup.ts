import prisma from "../src/lib/prisma";
import { createCapabilityToken } from "../src/lib/agents/capability-token-service";
import { saveTokens } from "@spike-land-ai/spike-cli/auth/token-store";

async function main() {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "test-agent@spike.land",
        name: "Test Agent",
      },
    });
  }

  let agent = await prisma.claudeCodeAgent.findFirst();
  if (!agent) {
    agent = await prisma.claudeCodeAgent.create({
      data: {
        id: "test-agent-id",
        name: "Test Agent",
        status: "IDLE",
        userId: user.id,
      },
    });
  }

  const { rawToken } = await createCapabilityToken({
    agentId: agent.id,
    grantedByUserId: user.id,
    allowedTools: ["*"],
    allowedCategories: ["*"],
    deniedTools: [],
    workspaceIds: [],
    maxTokenBudget: 1000000,
    maxApiCalls: 10000,
  });

  // SECURITY: Do not log the raw token value to stdout where it could be
  // captured by log aggregators or shell pipelines. Confirm creation only.
  console.log("Capability token created successfully (value omitted from logs).");

  await saveTokens({
    clientId: "agent-test",
    accessToken: rawToken,
    baseUrl: "http://localhost:3000",
  });

  console.log("Saved token to ~/.spike/auth.json");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
