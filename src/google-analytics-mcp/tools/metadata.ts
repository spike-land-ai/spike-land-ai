/**
 * ga4_metadata & ga4_list_properties — GA4 metadata and admin tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, errorResult, jsonResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import type { GoogleAuthClient } from "../auth/google-oauth.js";

export function registerMetadataTools(
  server: McpServer,
  auth: GoogleAuthClient,
  propertyId: string,
): void {
  createZodTool(server, {
    name: "ga4_metadata",
    description:
      "Get metadata (available dimensions, metrics, and their descriptions) for a GA4 property.",
    schema: {},
    handler: async () => {
      const headers = await auth.authHeaders();
      const url = `https://analyticsdata.googleapis.com/v1/properties/${propertyId}/metadata`;

      const result = await tryCatch(fetch(url, { method: "GET", headers }));
      if (!result.ok) {
        return errorResult("NETWORK_ERROR", result.error.message, true);
      }

      const res = result.data;
      if (!res.ok) {
        const errText = await res.text();
        return errorResult("GA4_API_ERROR", `GA4 API error (${res.status}): ${errText}`, false);
      }

      const data: unknown = await res.json();
      return jsonResult(data);
    },
  });

  createZodTool(server, {
    name: "ga4_list_properties",
    description:
      "List GA4 properties accessible to the authenticated user. Optionally filter by account.",
    schema: {
      filter: z
        .string()
        .optional()
        .describe('Optional filter string, e.g. "parent:accounts/123456"'),
    },
    handler: async (args) => {
      const { filter } = args as { filter?: string };
      const headers = await auth.authHeaders();

      const params = new URLSearchParams();
      if (filter) params.set("filter", filter);
      const qs = params.toString();
      const url = `https://analyticsadmin.googleapis.com/v1/properties${qs ? `?${qs}` : ""}`;

      const result = await tryCatch(fetch(url, { method: "GET", headers }));
      if (!result.ok) {
        return errorResult("NETWORK_ERROR", result.error.message, true);
      }

      const res = result.data;
      if (!res.ok) {
        const errText = await res.text();
        return errorResult(
          "GA4_ADMIN_API_ERROR",
          `GA4 Admin API error (${res.status}): ${errText}`,
          false,
        );
      }

      const data: unknown = await res.json();
      return jsonResult(data);
    },
  });
}
