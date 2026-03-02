import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

import { getE2EDatabaseUrl } from "./lib/db-protection";

// Load .env.local first, then .env
// Use quiet: true to suppress verbose logging
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * Database Seed Script
 *
 * Creates initial test data for development.
 *
 * SAFETY: This script has production database protection.
 * It will refuse to run against production databases.
 * See prisma/lib/db-protection.ts for details.
 */

// Get connection string with production protection
const connectionString = getE2EDatabaseUrl();

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/**
 * Generate a URL-safe slug from a name with an optional suffix
 */
function generateSlug(name: string, suffix?: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return suffix ? `${base}-${suffix}` : base;
}

async function main() {
  console.log("Starting database seed...");

  // Example: Create a test user
  const testUser = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
    },
  });

  console.log("Created test user:", testUser);

  // Create personal workspace for test user
  const testUserWorkspaceSlug = `test-user-workspace`;
  const testUserWorkspace = await prisma.workspace.upsert({
    where: { slug: testUserWorkspaceSlug },
    update: {},
    create: {
      name: "Test User's Workspace",
      slug: testUserWorkspaceSlug,
      description: "Default workspace for test user",
      isPersonal: true,
      members: {
        create: {
          userId: testUser.id,
          role: "OWNER",
          joinedAt: new Date(),
        },
      },
    },
  });

  console.log("Created test user workspace:", testUserWorkspace.slug);

  // Create personal workspaces for all existing users without workspaces
  const usersWithoutWorkspaces = await prisma.user.findMany({
    where: {
      workspaceMembers: {
        none: {},
      },
      NOT: {
        id: testUser.id, // Skip test user, already handled above
      },
    },
    select: { id: true, name: true, email: true },
  });

  console.log(`Found ${usersWithoutWorkspaces.length} users without workspaces`);

  for (const user of usersWithoutWorkspaces) {
    const workspaceName = user.name ? `${user.name}'s Workspace` : "Personal Workspace";

    // Generate unique slug using user ID suffix
    const slug = generateSlug(user.name || "personal", user.id.slice(-8));

    await prisma.workspace.create({
      data: {
        name: workspaceName,
        slug: slug,
        isPersonal: true,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
            joinedAt: new Date(),
          },
        },
      },
    });

    console.log(`Created workspace "${workspaceName}" for user ${user.email || user.id}`);
  }

  // Example: Create sample apps
  const sampleApps = await Promise.all([
    prisma.app.upsert({
      where: { id: "sample-app-1" },
      update: {},
      create: {
        id: "sample-app-1",
        name: "Todo App",
        description: "A simple todo application",
        userId: testUser.id,
        status: "LIVE",
        requirements: {
          create: [
            {
              description: "User can add new tasks",
              priority: "HIGH",
              status: "COMPLETED",
            },
            {
              description: "User can mark tasks as complete",
              priority: "HIGH",
              status: "COMPLETED",
            },
            {
              description: "User can filter tasks by status",
              priority: "MEDIUM",
              status: "IN_PROGRESS",
            },
          ],
        },
        monetizationModels: {
          create: {
            type: "FREE",
            features: ["Basic task management", "Up to 10 tasks"],
          },
        },
      },
    }),
    prisma.app.upsert({
      where: { id: "sample-app-2" },
      update: {},
      create: {
        id: "sample-app-2",
        name: "Note Taking App",
        description: "A feature-rich note taking application",
        userId: testUser.id,
        status: "PROMPTING",
        requirements: {
          create: [
            {
              description: "Rich text editor support",
              priority: "CRITICAL",
              status: "IN_PROGRESS",
            },
            {
              description: "Markdown support",
              priority: "HIGH",
              status: "PENDING",
            },
          ],
        },
        monetizationModels: {
          create: [
            {
              type: "FREEMIUM",
              features: ["Up to 5 notes", "Basic formatting"],
            },
            {
              type: "SUBSCRIPTION",
              price: 9.99,
              subscriptionInterval: "MONTHLY",
              features: ["Unlimited notes", "Advanced formatting", "Cloud sync", "Collaboration"],
            },
          ],
        },
      },
    }),
  ]);

  console.log("Created sample apps:", sampleApps.length);

  console.log("Database seed completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error during database seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
