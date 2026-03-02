import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, createAuthEndpoint, type AuthEndpoint } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import * as schema from "./db/schema";

export interface Env {
  AUTH_DB: D1Database;
  BETTER_AUTH_SECRET: string;
  APP_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
}

/** Context type for the QR auth endpoint handler, replacing untyped `any`. */
interface QRAuthContext {
  body: { qrHash: string; qrOneTimeCode: string };
  request: Request;
  json: (data: unknown, options?: { status: number }) => Response;
  context: {
    internalAdapter: {
      createSession: (userId: string, request: Request) => Promise<unknown>;
    };
  };
}

export function createAuth(env: Env) {
  const db = drizzle(env.AUTH_DB, { schema });

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL || "http://localhost:3000",
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    user: {
      additionalFields: {
        role: { type: "string" }, // store role
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60,
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "",
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID || "",
        clientSecret: env.GITHUB_CLIENT_SECRET || "",
      },
      apple: {
        clientId: env.APPLE_CLIENT_ID || "",
        clientSecret: env.APPLE_CLIENT_SECRET || "",
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          // This will be called from the Worker to send magic links
          console.log(`Sending magic link to ${email}: ${url}`);
          // Send via external service...
        },
      }),
      {
        id: "qr-auth",
        endpoints: {
          signInQR: (
            createAuthEndpoint as unknown as (
              path: string,
              options: { method: string; body: ReturnType<typeof z.object>; use: never[] },
              handler: (ctx: QRAuthContext) => Promise<Response>,
            ) => AuthEndpoint
          )(
            "/sign-in/qr",
            {
              method: "POST",
              body: z.object({
                qrHash: z.string(),
                qrOneTimeCode: z.string(),
              }),
              use: [],
            },
            async (ctx) => {
              const { qrHash, qrOneTimeCode } = ctx.body;
              if (!qrHash || !qrOneTimeCode) {
                return ctx.json({ error: "Missing required fields" }, { status: 400 });
              }

              // In reality, you'd lookup the QR state from KV/D1 here
              // For now, we stub it out until we migrate qr-auth-service
              const userId = "stub-user-id";
              if (!userId) {
                return ctx.json({ error: "Invalid QR code" }, { status: 401 });
              }

              // Lookup the user in D1
              const user = await db.query.user.findFirst({
                where: (u, { eq }) => eq(u.id, userId),
              });

              if (!user) {
                return ctx.json({ error: "User not found" }, { status: 401 });
              }

              const session = await ctx.context.internalAdapter.createSession(user.id, ctx.request);

              // Using dummy cookies since it's an API, setCookie is handled by better-auth internals
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
          ),
        },
      },
    ],
  });
}
