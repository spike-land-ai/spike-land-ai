import * as Sentry from "@sentry/cloudflare";
import type { CloudflareOptions, SeverityLevel } from "@sentry/cloudflare";

const DEFAULT_TRACES_SAMPLE_RATE = 0.1;
const REDACTED = "[REDACTED]";

export interface WorkerSentryEnv {
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  APP_ENV?: string;
  ENVIRONMENT?: string;
}

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

type RequestLike = Pick<Request, "method" | "url">;

export type D1BindingName<E extends WorkerSentryEnv> = {
  [K in keyof E]: E[K] extends D1Database ? K : never;
}[keyof E];

export interface WorkerSentryCaptureContext {
  request?: RequestLike;
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
  level?: SeverityLevel;
}

function parseTracesSampleRate(value?: string): number {
  if (!value) {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }

  return DEFAULT_TRACES_SAMPLE_RATE;
}

function resolveEnvironment(env: WorkerSentryEnv): string {
  return env.APP_ENV ?? env.ENVIRONMENT ?? "production";
}

function redactSensitiveHeaders(headers: Record<string, unknown>): void {
  for (const key of ["authorization", "cookie", "x-forwarded-for", "cf-connecting-ip"]) {
    if (key in headers) {
      headers[key] = REDACTED;
    }

    const titleCaseKey = key
      .split("-")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join("-");
    if (titleCaseKey in headers) {
      headers[titleCaseKey] = REDACTED;
    }
  }
}

function isD1Database(value: unknown): value is D1Database {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { prepare?: unknown };
  return typeof candidate.prepare === "function";
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Non-Error exception");
}

export function createWorkerSentryOptions(
  serviceName: string,
  env: WorkerSentryEnv,
): CloudflareOptions | undefined {
  if (!env.SENTRY_DSN) {
    return undefined;
  }

  return {
    dsn: env.SENTRY_DSN,
    sendDefaultPii: false,
    environment: resolveEnvironment(env),
    tracesSampleRate: parseTracesSampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
    initialScope: {
      tags: {
        runtime: "cloudflare-worker",
        service: serviceName,
      },
    },
    beforeSend(event) {
      const request = event.request;
      if (request && typeof request === "object") {
        const requestRecord = request as Record<string, unknown>;
        const headers = requestRecord["headers"];
        if (headers && typeof headers === "object" && !Array.isArray(headers)) {
          redactSensitiveHeaders(headers as Record<string, unknown>);
        }

        delete requestRecord["cookies"];
        delete requestRecord["data"];
      }

      return event;
    },
  };
}

export function instrumentD1Bindings<E extends WorkerSentryEnv>(
  env: E,
  bindings: Array<D1BindingName<E>>,
): E {
  if (!env.SENTRY_DSN || bindings.length === 0) {
    return env;
  }

  let instrumentedEnv: Mutable<E> | null = null;
  for (const binding of bindings) {
    const currentValue = env[binding];
    if (!isD1Database(currentValue)) {
      continue;
    }

    if (!instrumentedEnv) {
      instrumentedEnv = { ...env };
    }

    instrumentedEnv[binding] = Sentry.instrumentD1WithSentry(currentValue) as E[typeof binding];
  }

  return instrumentedEnv ?? env;
}

export function captureWorkerException(
  serviceName: string,
  error: unknown,
  context: WorkerSentryCaptureContext = {},
): void {
  Sentry.withScope((scope) => {
    scope.setTag("service", serviceName);

    if (context.level) {
      scope.setLevel(context.level);
    }

    if (context.request) {
      const url = new URL(context.request.url);
      scope.setTag("request_method", context.request.method);
      scope.setTag("request_path", url.pathname);
      scope.setContext("request", {
        method: context.request.method,
        path: url.pathname,
      });
    }

    if (context.tags) {
      scope.setTags(context.tags);
    }

    if (context.extras) {
      scope.setExtras(context.extras);
    }

    scope.captureException(normalizeError(error));
  });
}
