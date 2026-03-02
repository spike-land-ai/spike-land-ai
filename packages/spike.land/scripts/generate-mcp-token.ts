import { generateTokenPair } from "../src/lib/mcp/oauth/token-service";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("Finding user...");
  const user = await prisma.user.findFirst({
    where: { email: "zoltan.erdos@spike.land" },
  });
  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  console.log("Generating token...");
  const tokenRecord = await generateTokenPair(user.id, "spike-cli-agent", "mcp");
  // SECURITY: Write token only to stderr so it is not captured in shell
  // command substitution or piped into logs. Callers should redirect stderr.
  process.stderr.write("TOKEN=" + tokenRecord.accessToken + "\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
