import prisma from "../src/lib/prisma";
import { answerQuestion, startTraversal } from "../src/lib/avl-profile/traversal";

async function main() {
  console.log("Resetting tree...");
  await prisma.avlTraversalSession.deleteMany();
  await prisma.avlUserProfile.deleteMany();
  await prisma.avlProfileNode.deleteMany();
  await prisma.avlProfileTree.deleteMany();

  console.log("Seeding fake users...");

  for (let i = 1; i <= 20; i++) {
    const userId = `fake_user_${i}`;
    console.log(`\n--- Seeding User: ${userId} ---`);

    // Ensure user exists in the DB
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        name: `Fake User ${i}`,
      },
    });

    let result = await startTraversal(userId, "default");

    while (result.status === "QUESTION" || result.status === "COLLISION") {
      if (result.status === "QUESTION" && result.sessionId) {
        // Randomly answer yes or no
        const yes = Math.random() > 0.5;
        console.log(`Q: ${result.question} -> ${yes ? "YES" : "NO"}`);
        result = await answerQuestion(userId, result.sessionId, yes);
      } else {
        break;
      }
    }

    if (result.status === "ASSIGNED") {
      console.log(`Assigned to leaf! Tags: ${result.profile?.derivedTags.join(", ")}`);
    } else if (result.status === "ALREADY_PROFILED") {
      console.log(`Already profiled!`);
    } else {
      console.log(`Ended in status: ${result.status}`);
    }
  }
}

main().catch(console.error);
