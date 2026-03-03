import { logger } from "@/lib/errors/structured-logger";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { enqueueMessage } from "@/lib/upstash";

/**
 * Ensures the user exists in the database.
 */
export async function ensureUserExists(session: {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
}): Promise<{ success: boolean; userId: string; }> {
  const { user } = session;
  const { data: existingUser, error: findError } = await tryCatch(
    prisma.user.findUnique({ where: { id: user.id }, select: { id: true } }),
  );

  if (findError) {
    logger.error(
      "Error checking user existence",
      findError instanceof Error ? findError : undefined,
      { route: "/api/apps" },
    );
    return { success: false, userId: user.id };
  }
  if (existingUser) return { success: true, userId: existingUser.id };

  logger.warn("User authenticated but not in database, creating now", {
    userId: user.id,
    route: "/api/apps",
  });
  const { data: newUser, error: createError } = await tryCatch(
    prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      select: { id: true },
    }),
  );

  if (createError) {
    const isUniqueViolation = (createError as { code?: string; }).code === "P2002"
      || String(createError.message || "").includes("Unique constraint");
    if (user.email && isUniqueViolation) {
      const { data: userByEmail } = await tryCatch(
        prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        }),
      );
      if (userByEmail) {
        logger.warn("User found by email with different ID", {
          foundId: userByEmail.id,
          expectedId: user.id,
          route: "/api/apps",
        });
        return { success: true, userId: userByEmail.id };
      }
    }
    logger.error(
      "Error creating user",
      createError instanceof Error ? createError : undefined,
      { route: "/api/apps" },
    );
    return { success: false, userId: user.id };
  }
  return { success: true, userId: newUser.id };
}

export function generateAppName(): string {
  const ADJECTIVES = [
    "swift",
    "bright",
    "cosmic",
    "digital",
    "clever",
    "stellar",
    "nimble",
    "sleek",
    "vibrant",
    "dynamic",
    "agile",
    "bold",
    "smart",
    "rapid",
    "fresh",
  ];
  const NOUNS = [
    "forge",
    "spark",
    "wave",
    "pulse",
    "flow",
    "nexus",
    "orbit",
    "prism",
    "grid",
    "core",
    "hub",
    "vault",
    "bridge",
    "beacon",
    "studio",
  ];
  const VERBS = [
    "launch",
    "build",
    "craft",
    "sync",
    "boost",
    "stream",
    "dash",
    "snap",
    "blend",
    "shift",
    "link",
    "push",
    "rise",
    "glow",
    "zoom",
  ];
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
  return `${adj}-${noun}-${verb}`;
}

export function generateSlug(): string {
  const name = generateAppName();
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${name}-${suffix}`;
}

export function mapMonetizationModelToEnum(
  model: string,
): "FREE" | "FREEMIUM" | "SUBSCRIPTION" | "ONE_TIME" | "USAGE_BASED" {
  const mapping: Record<
    string,
    "FREE" | "FREEMIUM" | "SUBSCRIPTION" | "ONE_TIME" | "USAGE_BASED"
  > = {
    "free": "FREE",
    "freemium": "FREEMIUM",
    "subscription": "SUBSCRIPTION",
    "one-time": "ONE_TIME",
    "usage-based": "USAGE_BASED",
  };
  return mapping[model] || "FREE";
}

export async function createAppFromPrompt(
  userId: string,
  data: {
    prompt: string;
    imageIds?: string[];
    codespaceId?: string;
    templateId?: string;
    workspaceId?: string;
    linkedCampaign?: string;
  },
) {
  const slug = data.codespaceId ? data.codespaceId : generateSlug();
  const { data: existingApp } = await tryCatch(
    prisma.app.findFirst({
      where: { OR: [{ codespaceId: slug }, { slug: slug }] },
      select: { id: true, userId: true, deletedAt: true },
    }),
  );

  if (existingApp) {
    if (existingApp.userId === userId) {
      if (existingApp.deletedAt) {
        return {
          error:
            "An app with this name exists in your bin. Please restore or permanently delete it first.",
          status: 409,
        };
      }
      return {
        error: "You already have an app with this name. Please use a different name.",
        status: 409,
      };
    }
    return {
      error: "This codespace name is already taken. Please choose a different name.",
      status: 409,
    };
  }

  const name = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const { data: result, error: createError } = await tryCatch(
    prisma.$transaction(async tx => {
      const app = await tx.app.create({
        data: {
          name,
          slug,
          userId,
          status: "WAITING",
          codespaceId: slug,
          codespaceUrl: `/api/codespace/${slug}/embed`,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          codespaceId: true,
          codespaceUrl: true,
          createdAt: true,
        },
      });

      await tx.appStatusHistory.create({
        data: {
          appId: app.id,
          status: "WAITING",
          message: "App created with initial prompt",
        },
      });

      let messageContent = data.prompt;
      if (data.templateId) {
        const { getTemplateById } = await import("@/lib/apps/templates");
        const template = getTemplateById(data.templateId);
        if (template) {
          messageContent =
            `I'd like to start with this template code:\n\n\`\`\`tsx\n${template.code}\n\`\`\`\n\n${data.prompt}`;
        }
      }

      const message = await tx.appMessage.create({
        data: { appId: app.id, role: "USER", content: messageContent },
      });

      if (data.imageIds && data.imageIds.length > 0) {
        await tx.appImage.updateMany({
          where: { id: { in: data.imageIds } },
          data: { appId: app.id },
        });

        const validImages = await tx.appImage.findMany({
          where: { id: { in: data.imageIds }, appId: app.id },
          select: { id: true },
        });

        if (validImages.length > 0) {
          await tx.appAttachment.createMany({
            data: validImages.map(img => ({
              messageId: message.id,
              imageId: img.id,
            })),
          });
        }
      }

      if (data.workspaceId) {
        const workspace = await tx.workspace.findFirst({
          where: { id: data.workspaceId, members: { some: { userId } } },
          select: { id: true },
        });

        if (workspace) {
          let purpose: string | null = null;
          if (data.templateId) {
            const { getTemplateById } = await import("@/lib/apps/templates");
            const template = getTemplateById(data.templateId);
            if (template) purpose = template.purpose;
          }

          await tx.workspaceApp.create({
            data: {
              workspaceId: data.workspaceId,
              appId: app.id,
              purpose,
              linkedCampaign: data.linkedCampaign || null,
            },
          });
        }
      }

      return { app, messageId: message.id };
    }),
  );

  if (createError || !result) {
    logger.error(
      "Error creating app from prompt",
      createError instanceof Error ? createError : undefined,
      { route: "/api/apps" },
    );
    return { error: "Internal server error", status: 500 };
  }

  const { error: enqueueError } = await tryCatch(
    enqueueMessage(result.app.id, result.messageId),
  );
  if (enqueueError) {
    logger.error(
      "[App Creation] Failed to enqueue message",
      enqueueError instanceof Error ? enqueueError : undefined,
      { appId: result.app.id, route: "/api/apps" },
    );
  }

  return { data: result.app, status: 201 };
}

export async function getApps(userId: string, showCurated: boolean) {
  if (showCurated) {
    const { data: curatedApps, error: curatedError } = await tryCatch(
      prisma.app.findMany({
        where: { isCurated: true, isPublic: true, status: "LIVE" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          codespaceUrl: true,
          status: true,
          createdAt: true,
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
    if (curatedError) {
      logger.error(
        "Error fetching curated apps",
        curatedError instanceof Error ? curatedError : undefined,
        { route: "/api/apps" },
      );
      return { error: "Internal server error", status: 500 };
    }
    return { data: curatedApps, status: 200 };
  }

  const { data: apps, error: fetchError } = await tryCatch(
    prisma.app.findMany({
      where: { userId, status: { notIn: ["ARCHIVED"] } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        codespaceId: true,
        codespaceUrl: true,
        isCurated: true,
        isPublic: true,
        lastAgentActivity: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true, images: true } },
        messages: {
          where: { isRead: false, role: "AGENT" },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  );

  if (fetchError) {
    logger.error(
      "Error fetching apps",
      fetchError instanceof Error ? fetchError : undefined,
      { route: "/api/apps" },
    );
    return { error: "Internal server error", status: 500 };
  }

  const appsWithUnread = apps.map(app => ({
    ...app,
    unreadCount: app.messages.length,
    messages: undefined,
  }));

  return { data: appsWithUnread, status: 200 };
}

export async function createLegacyApp(
  userId: string,
  data: {
    name: string;
    description: string;
    codespaceId?: string;
    requirements: string;
    monetizationModel: string;
  },
) {
  const codespaceUrl = data.codespaceId
    ? `/api/codespace/${data.codespaceId}/embed`
    : undefined;

  const { data: app, error: createError } = await tryCatch(
    prisma.app.create({
      data: {
        name: data.name,
        description: data.description,
        userId,
        status: "PROMPTING",
        ...(data.codespaceId && { codespaceId: data.codespaceId }),
        codespaceUrl,
        requirements: {
          create: {
            description: data.requirements,
            priority: "MEDIUM",
            status: "PENDING",
          },
        },
        monetizationModels: {
          create: {
            type: mapMonetizationModelToEnum(data.monetizationModel),
            features: [],
          },
        },
      },
      include: {
        requirements: true,
        monetizationModels: true,
        messages: true,
        statusHistory: true,
      },
    }),
  );

  if (createError || !app) {
    logger.error(
      "Error creating app",
      createError instanceof Error ? createError : undefined,
      { route: "/api/apps" },
    );
    return { error: "Internal server error", status: 500 };
  }

  return { data: app, status: 201 };
}
