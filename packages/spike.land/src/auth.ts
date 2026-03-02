/**
 * Better Auth Configuration
 *
 * This file replaces NextAuth and sets up the better-auth instance.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink, createAuthEndpoint } from "better-auth/plugins";
import { z } from "zod";
import { bootstrapAdminIfNeeded } from "@/lib/auth/bootstrap-admin";
import { completeQRAuth } from "@/lib/auth/qr-auth-service";
import { logger } from "@/lib/errors/structured-logger";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";
import { sendEmail } from "@/lib/email/client";
import prisma from "@/lib/prisma";
import { attributeConversion } from "@/lib/tracking/attribution";
import { tryCatch } from "@/lib/try-catch";
import { ensurePersonalWorkspace } from "@/lib/workspace/ensure-personal-workspace";
import { UserRole } from "@prisma/client";
import { secureCompare } from "@/lib/security/timing";
import { createStableUserId } from "./auth.config";
import { cookies, headers } from "next/headers";

const isProduction = process.env.NODE_ENV === "production" && process.env.APP_ENV === "production";

export const authInstance = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      role: { type: "string" }, // store role in User model via better-auth
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60, // 1 minute
    },
  },
  emailAndPassword: {
    enabled: true,
    // Use the default better-auth password flow.
    // For migrated passwords, better-auth might require users to reset their password
    // if using a totally different mechanism, but better-auth uses bcrypt under the hood!
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
    },
    google: {
      clientId: process.env.GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_SECRET || "",
    },
    facebook: {
      clientId: process.env.AUTH_FACEBOOK_ID || "",
      clientSecret: process.env.AUTH_FACEBOOK_SECRET || "",
    },
    apple: {
      clientId: process.env.AUTH_APPLE_ID || "",
      clientSecret: process.env.AUTH_APPLE_SECRET || "",
    },
  },
  plugins: [
    nextCookies(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const host = new URL(url).host;
        await sendEmail({
          to: email,
          subject: `Sign in to ${host}`,
          react: MagicLinkEmail({ url, host }),
        });
      },
      expiresIn: 10 * 60, // 10 minutes
    }),
    {
      id: "qr-auth",
      endpoints: {
        signInQR: createAuthEndpoint(
          "/sign-in/qr",
          {
            method: "POST",
            // Zod v4 (project) body schema cast to satisfy better-auth's Zod v3 types
            body: z.object({
              qrHash: z.string(),
              qrOneTimeCode: z.string(),
            }) as unknown as Parameters<typeof createAuthEndpoint>[1] extends { body?: infer B }
              ? B
              : never,
            use: [],
          },
          async (ctx: {
            body: { qrHash: string; qrOneTimeCode: string };
            json: (data: unknown, opts?: { status: number }) => unknown;
            request: Request;
            context: {
              internalAdapter: {
                createSession: (userId: string, request: Request) => Promise<{ token: string }>;
              };
            };
            setCookie: (
              name: string,
              value: string,
              opts: Record<string, unknown>,
            ) => Promise<void>;
          }) => {
            const { qrHash, qrOneTimeCode } = ctx.body;
            if (!qrHash || !qrOneTimeCode) {
              return ctx.json({ error: "Missing required fields" }, { status: 400 });
            }

            const userId = await completeQRAuth(qrHash, qrOneTimeCode);
            if (!userId) {
              return ctx.json({ error: "Invalid QR code" }, { status: 401 });
            }

            const { data: user, error } = await tryCatch(
              prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, name: true, image: true, role: true },
              }),
            );
            if (error || !user) {
              return ctx.json({ error: "User not found" }, { status: 401 });
            }

            // Create the session in the database
            const session = await ctx.context.internalAdapter.createSession(user.id, ctx.request);

            // Set the session cookie
            const cookieName = isProduction
              ? "__Secure-better-auth.session_token"
              : "better-auth.session_token";

            await ctx.setCookie(cookieName, session.token, {
              httpOnly: true,
              secure: isProduction,
              sameSite: "lax",
              path: "/",
            });

            return ctx.json({
              session,
              user: {
                id: user.id,
                email: user.email || "",
                name: user.name || "",
                image: user.image || "",
                role: user.role,
              },
            });
          },
        ) as unknown as ReturnType<typeof createAuthEndpoint>,
      },
    },
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          user.id = createStableUserId(user.email);
          return { data: user };
        },
        after: async (user) => {
          logger.info("New user created via better-auth", {
            userId: user.id,
            route: "/api/auth",
          });

          // Ensure personal workspace exists
          const { error: workspaceError } = await tryCatch(
            ensurePersonalWorkspace(user.id, user.name || undefined),
          );
          if (workspaceError) {
            logger.error(
              "Failed to ensure personal workspace",
              workspaceError instanceof Error ? workspaceError : undefined,
            );
          }

          // Bootstrap admin for first user
          const { error: bootstrapError } = await tryCatch(bootstrapAdminIfNeeded(user.id));
          if (bootstrapError) {
            logger.error(
              "Failed to bootstrap admin",
              bootstrapError instanceof Error ? bootstrapError : undefined,
            );
          }

          // Track signup conversion
          const { error: attributionError } = await tryCatch(
            attributeConversion(user.id, "SIGNUP"),
          );
          if (attributionError) {
            logger.error(
              "Failed to track signup attribution",
              attributionError instanceof Error ? attributionError : undefined,
            );
          }
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          logger.info("User signed in via better-auth", {
            userId: session.userId,
            route: "/api/auth",
          });
        },
      },
    },
  },
  logger: {
    disabled: process.env.NODE_ENV === "production",
    level: "debug",
  },
});

/**
 * Helper to create mock session for E2E testing.
 * Extracts user info from cookies or uses defaults.
 */
async function getMockE2ESession() {
  const { data: cookieStore } = await tryCatch(cookies());
  const roleValue = cookieStore?.get("e2e-user-role")?.value;
  const validRoles = Object.values(UserRole);
  let role = validRoles.includes(roleValue as UserRole) ? (roleValue as UserRole) : UserRole.USER;
  const email = cookieStore?.get("e2e-user-email")?.value || "test@example.com";
  const name = cookieStore?.get("e2e-user-name")?.value || "Test User";

  let id = "test-user-id";
  if (email === "admin@example.com") {
    id = "admin-user-id";
    role = UserRole.ADMIN;
  } else if (email === "newuser@example.com" || email === "no-orders@example.com") {
    id = "new-user-id";
  }

  return {
    user: {
      id,
      name,
      email,
      image: null,
      role,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: "mock-session-id",
      userId: id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      token: "mock-session-token",
      ipAddress: "127.0.0.1",
      userAgent: "E2E-Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

/**
 * Auth wrapper for server-side usage
 */
export const auth = async () => {
  if (process.env.E2E_BYPASS_AUTH === "true") {
    const { data: cookieStore } = await tryCatch(cookies());
    if (cookieStore) {
      const sessionToken = cookieStore.get("better-auth.session_token")?.value;
      if (sessionToken === "mock-session-token") {
        return getMockE2ESession();
      }
    }
    return null;
  }

  const { data: headersList } = await tryCatch(headers());
  const e2eBypassSecret = process.env.E2E_BYPASS_SECRET;

  if (!isProduction && e2eBypassSecret && headersList) {
    const bypassHeader = headersList.get("x-e2e-auth-bypass");
    if (bypassHeader && secureCompare(bypassHeader, e2eBypassSecret)) {
      return getMockE2ESession();
    }
  }

  try {
    const session = await authInstance.api.getSession({
      headers: headersList as unknown as Headers,
    });
    return session || null;
  } catch (err) {
    logger.error(
      "Error fetching session from better-auth",
      err instanceof Error ? err : undefined,
      { route: "/api/auth" },
    );
    return null;
  }
};

// NextJS route handler bindings
export const handlers = {
  GET: authInstance.handler,
  POST: authInstance.handler,
};
