import type { EnvironmentInfo, EnvironmentName } from "@/lib/admin/swarm/types";

interface EnvironmentRegistryEntry {
  name: EnvironmentName;
  url: string;
  healthEndpoint: string;
}

const VERCEL_PROJECT_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ?? "spike.land";

const ENVIRONMENT_REGISTRY: readonly EnvironmentRegistryEntry[] = [
  {
    name: "dev",
    url: "http://localhost:3000",
    healthEndpoint: "http://localhost:3000/api/health",
  },
  {
    name: "preview",
    url: `https://preview.${VERCEL_PROJECT_URL}`,
    healthEndpoint: `https://preview.${VERCEL_PROJECT_URL}/api/health`,
  },
  {
    name: "prod",
    url: `https://${VERCEL_PROJECT_URL}`,
    healthEndpoint: `https://${VERCEL_PROJECT_URL}/api/health`,
  },
] as const;

/** Get the registry entry for a single environment */
export function getEnvironmentConfig(
  name: EnvironmentName,
): EnvironmentRegistryEntry | undefined {
  return ENVIRONMENT_REGISTRY.find(e => e.name === name);
}

/** Get all environment registry entries */
export function getAllEnvironmentConfigs(): readonly EnvironmentRegistryEntry[] {
  return ENVIRONMENT_REGISTRY;
}

/** Check health of an environment by fetching its health endpoint */
export async function checkEnvironmentHealth(
  entry: EnvironmentRegistryEntry,
  timeoutMs = 5_000,
): Promise<EnvironmentInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const start = Date.now();
    const res = await fetch(entry.healthEndpoint, {
      signal: controller.signal,
    });
    const latency = Date.now() - start;

    if (!res.ok) {
      return {
        ...entry,
        status: "degraded",
        lastDeployedAt: null,
        commitSha: null,
        version: null,
      };
    }

    const body = (await res.json().catch(() => null)) as {
      commitSha?: string;
      version?: string;
      deployedAt?: string;
    } | null;

    return {
      ...entry,
      status: latency > 3_000 ? "degraded" : "healthy",
      lastDeployedAt: body?.deployedAt ? new Date(body.deployedAt) : null,
      commitSha: body?.commitSha ?? null,
      version: body?.version ?? null,
    };
  } catch {
    return {
      ...entry,
      status: "down",
      lastDeployedAt: null,
      commitSha: null,
      version: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Check health of all registered environments in parallel */
export async function checkAllEnvironments(): Promise<EnvironmentInfo[]> {
  return Promise.all(
    ENVIRONMENT_REGISTRY.map(entry => checkEnvironmentHealth(entry)),
  );
}
