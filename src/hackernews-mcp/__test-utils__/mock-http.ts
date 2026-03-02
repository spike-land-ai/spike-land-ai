/**
 * Mock fetch factory for testing HTTP calls.
 */

import { vi } from "vitest";
import type { FetchFn } from "../types.js";

export interface MockRoute {
  url: string | RegExp;
  method?: string;
  response: {
    status?: number;
    body?: string | Record<string, unknown>;
    headers?: Record<string, string>;
  };
}

export function createMockFetch(routes: MockRoute[]): FetchFn {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";

    for (const route of routes) {
      const urlMatch =
        typeof route.url === "string"
          ? url === route.url || url.startsWith(route.url + "?") || url.startsWith(route.url + "/")
          : route.url.test(url);
      const methodMatch = !route.method || route.method.toUpperCase() === method.toUpperCase();

      if (urlMatch && methodMatch) {
        const body =
          typeof route.response.body === "string"
            ? route.response.body
            : JSON.stringify(route.response.body === undefined ? {} : route.response.body);

        return new Response(body, {
          status: route.response.status ?? 200,
          headers: {
            "content-type":
              typeof route.response.body === "string" ? "text/html" : "application/json",
            ...route.response.headers,
          },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }) as unknown as FetchFn;
}

export function createFailingFetch(error: string): FetchFn {
  return vi.fn(async () => {
    throw new Error(error);
  }) as unknown as FetchFn;
}
