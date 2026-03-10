import { createApp } from "../api/app";
import type { Env } from "./env";
import {
  recordServiceRequestMetric,
  shouldTrackServiceMetricRequest,
} from "../../common/core-logic/service-metrics";

const app = createApp();

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const startedAt = Date.now();

    try {
      return await app.fetch(request, env, ctx);
    } finally {
      if (shouldTrackServiceMetricRequest(request)) {
        try {
          ctx?.waitUntil(
            recordServiceRequestMetric(env.STATUS_DB, "MCP Registry", Date.now() - startedAt).catch(
              (error) => {
                console.error("[service-metrics] failed to record mcp registry request", error);
              },
            ),
          );
        } catch {
          /* no ExecutionContext outside Workers runtime */
        }
      }
    }
  },
} satisfies ExportedHandler<Env>;
