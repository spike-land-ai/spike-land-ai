import { createApp } from "../api/app";
import * as Sentry from "@sentry/cloudflare";
import type { Env } from "./env";
import {
  recordServiceRequestMetric,
  shouldTrackServiceMetricRequest,
} from "../../common/core-logic/service-metrics";
import { createWorkerSentryOptions, instrumentD1Bindings } from "../../common/core-logic/sentry";

const app = createApp();

export default Sentry.withSentry((env: Env) => createWorkerSentryOptions("spike-land-mcp", env), {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const instrumentedEnv = instrumentD1Bindings(env, ["DB", "STATUS_DB"]);
    const startedAt = Date.now();

    try {
      return await app.fetch(request, instrumentedEnv, ctx);
    } finally {
      if (shouldTrackServiceMetricRequest(request)) {
        try {
          ctx?.waitUntil(
            recordServiceRequestMetric(
              instrumentedEnv.STATUS_DB,
              "MCP Registry",
              Date.now() - startedAt,
            ).catch((error) => {
              console.error("[service-metrics] failed to record mcp registry request", error);
            }),
          );
        } catch {
          /* no ExecutionContext outside Workers runtime */
        }
      }
    }
  },
} satisfies ExportedHandler<Env>);
