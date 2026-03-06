import type { SubdomainMapping } from "./types.js";

interface CaddyRoute {
  match?: Array<{ host?: string[] }>;
  handle?: Array<{ handler: string; upstreams?: Array<{ dial: string }>; [key: string]: unknown }>;
  [key: string]: unknown;
}

export class CaddyAdminClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.CADDY_ADMIN_URL ?? "http://caddy:2019";
  }

  async getConfig(): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/config/`);
    if (!res.ok) {
      throw new Error(`Caddy admin API error: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  async addRoute(subdomain: string, upstream: string, port: number): Promise<void> {
    const route: CaddyRoute = {
      match: [{ host: [`${subdomain}.spike.local`] }],
      handle: [
        {
          handler: "reverse_proxy",
          upstreams: [{ dial: `${upstream}:${port}` }],
        },
      ],
    };

    const res = await fetch(
      `${this.baseUrl}/config/apps/http/servers/srv0/routes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(route),
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to add Caddy route: ${res.status} ${await res.text()}`);
    }
  }

  async listRoutes(): Promise<SubdomainMapping[]> {
    const res = await fetch(
      `${this.baseUrl}/config/apps/http/servers/srv0/routes`,
    );

    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Failed to list Caddy routes: ${res.status} ${await res.text()}`);
    }

    const routes = (await res.json()) as CaddyRoute[];
    const mappings: SubdomainMapping[] = [];

    for (const route of routes) {
      const host = route.match?.[0]?.host?.[0];
      const dial = route.handle?.[0]?.upstreams?.[0]?.dial;

      if (!host || !dial) continue;

      const subdomain = host.replace(".spike.local", "");
      const [upstream, portStr] = dial.split(":");
      const port = parseInt(portStr, 10);

      if (upstream && !isNaN(port)) {
        mappings.push({ subdomain, upstream, port });
      }
    }

    return mappings;
  }
}
