import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { createAuthEndpoint } from "better-auth/api";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import * as schema from "../db/schema";

export interface Env {
  AUTH_DB: D1Database;
  STATUS_DB: D1Database;
  BETTER_AUTH_SECRET: string;
  MCP_INTERNAL_SECRET: string;
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
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
    baseURL: env.APP_URL || "https://auth-mcp.spike.land",
    trustedOrigins: [
      "https://spike.land",
      "https://image-studio-mcp.spike.land",
      "https://auth-mcp.spike.land",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    advanced: {
      trustProxy: true,
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
      crossSubDomainCookies: {
        enabled: true,
        domain: ".spike.land",
      },
      defaultCookieAttributes: {
        sameSite: "lax" as const,
      },
    },
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
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
        : {}),
      ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
        ? { apple: { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET } }
        : {}),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const appUrl = env.APP_URL ?? "https://spike.land";
            // SECURITY: Never forward raw email to the analytics pipeline —
            // userId alone is sufficient for funnel attribution.
            // Sending email would violate GDPR Art. 5(1)(c) data minimisation
            // and could expose PII if the analytics store is ever breached.
            fetch(`${appUrl}/analytics/ingest`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([
                {
                  source: "auth",
                  eventType: "signup_completed",
                  metadata: { userId: user.id },
                },
              ]),
            }).catch(() => {});
          },
        },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async () => {
          // This will be called from the Worker to send magic links
          // Send via external service...
        },
      }),
      {
        id: "qr-auth",
        endpoints: {
          signInQR: (
            createAuthEndpoint as unknown as (
              path: string,
              options: {
                method: string;
                body: ReturnType<typeof z.object>;
                use: never[];
              },
              handler: (ctx: QRAuthContext) => Promise<Response>,
            ) => ReturnType<typeof createAuthEndpoint>
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
              // QR sign-in is not yet implemented. Return 501 to prevent
              // the stub from creating sessions for a hardcoded user ID.
              return ctx.json({ error: "QR sign-in is not yet implemented" }, { status: 501 });
            },
          ),
        },
      },
    ],
  });
}
