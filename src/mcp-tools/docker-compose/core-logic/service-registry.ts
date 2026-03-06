import http from "node:http";
import type { ServiceInfo } from "./types.js";

interface DockerContainer {
  Id: string;
  Names: string[];
  State: string;
  Labels: Record<string, string>;
  Ports: Array<{ PrivatePort: number; PublicPort?: number; Type: string }>;
}

export class ServiceRegistry {
  private readonly socketPath: string;

  constructor(socketPath?: string) {
    this.socketPath = socketPath ?? "/var/run/docker.sock";
  }

  private async dockerGet<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path,
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Docker API ${path}: ${res.statusCode} ${body}`));
              return;
            }
            try {
              resolve(JSON.parse(body) as T);
            } catch {
              reject(new Error(`Docker API ${path}: invalid JSON response`));
            }
          });
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  async listServices(): Promise<ServiceInfo[]> {
    const containers = await this.dockerGet<DockerContainer[]>(
      "/containers/json?all=true&filters=" + encodeURIComponent(JSON.stringify({ label: ["spike.service"] })),
    );

    return containers.map((c) => {
      const name = c.Labels["spike.service"] || c.Names[0]?.replace(/^\//, "") || "unknown";
      const subdomain = c.Labels["spike.subdomain"] || name;
      const portLabel = c.Labels["spike.port"];
      const port = portLabel ? parseInt(portLabel, 10) : (c.Ports[0]?.PrivatePort ?? 0);
      const type = (c.Labels["spike.type"] || "backend") as ServiceInfo["type"];

      const stateMap: Record<string, ServiceInfo["status"]> = {
        running: "running",
        exited: "exited",
        restarting: "restarting",
        created: "created",
      };
      const status = stateMap[c.State] ?? "stopped";

      return {
        name,
        subdomain,
        port,
        type,
        status,
        containerId: c.Id.slice(0, 12),
      };
    });
  }

  async execCompose(action: "up" | "stop" | "restart", service: string): Promise<string> {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const args = ["compose"];
    switch (action) {
      case "up":
        args.push("up", "-d", service);
        break;
      case "stop":
        args.push("stop", service);
        break;
      case "restart":
        args.push("restart", service);
        break;
    }

    const { stdout, stderr } = await execFileAsync("docker", args, {
      cwd: process.env.COMPOSE_PROJECT_DIR ?? "/app",
      timeout: 60_000,
    });

    return stdout || stderr;
  }

  async getLogs(service: string, tail = 100, since?: string): Promise<string> {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const args = ["compose", "logs", "--no-color", "--tail", String(tail)];
    if (since) {
      args.push("--since", since);
    }
    args.push(service);

    const { stdout } = await execFileAsync("docker", args, {
      cwd: process.env.COMPOSE_PROJECT_DIR ?? "/app",
      timeout: 30_000,
    });

    return stdout;
  }
}
