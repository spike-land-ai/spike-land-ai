import { writeFile } from "node:fs/promises";
import { join } from "node:path";

interface SentryTeam {
  id: string;
  slug: string;
  name: string;
}

interface SentryProject {
  id: string;
  slug: string;
  name: string;
}

interface SentryKey {
  id: string;
  isActive: boolean;
  dsn: {
    public: string;
  };
}

interface ProjectConfig {
  name: string;
  slug: string;
  platform: string;
}

const SENTRY_API_BASE_URL = (process.env.SENTRY_URL ?? "https://sentry.io").replace(/\/$/, "");
const SHOULD_WRITE_SPIKE_WEB_BUILD_ENV = process.argv.includes("--write-spike-web-build-env");

const PROJECTS: ProjectConfig[] = [
  { name: "Spike Web", slug: "spike-web", platform: "javascript" },
  { name: "Spike Edge", slug: "spike-edge", platform: "javascript" },
  { name: "Spike Land Backend", slug: "spike-land-backend", platform: "javascript" },
  { name: "MCP Auth", slug: "mcp-auth", platform: "javascript" },
  { name: "Spike Land MCP", slug: "spike-land-mcp", platform: "javascript" },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOrgSlug(): string {
  return process.env.SENTRY_ORG_SLUG ?? process.env.SENTRY_ORG ?? "";
}

async function sentryRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = requireEnv("SENTRY_AUTH_TOKEN");
  const response = await fetch(`${SENTRY_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sentry API ${response.status} ${response.statusText} for ${path}: ${body}`);
  }

  return (await response.json()) as T;
}

async function listTeams(orgSlug: string): Promise<SentryTeam[]> {
  return sentryRequest<SentryTeam[]>(`/api/0/organizations/${orgSlug}/teams/?detailed=0`);
}

async function listProjects(orgSlug: string): Promise<SentryProject[]> {
  return sentryRequest<SentryProject[]>(`/api/0/organizations/${orgSlug}/projects/`);
}

async function listProjectKeys(orgSlug: string, projectSlug: string): Promise<SentryKey[]> {
  return sentryRequest<SentryKey[]>(
    `/api/0/projects/${orgSlug}/${projectSlug}/keys/?status=active`,
  );
}

async function createProject(
  orgSlug: string,
  teamSlug: string,
  config: ProjectConfig,
): Promise<SentryProject> {
  return sentryRequest<SentryProject>(`/api/0/teams/${orgSlug}/${teamSlug}/projects/`, {
    method: "POST",
    body: JSON.stringify({
      name: config.name,
      slug: config.slug,
      platform: config.platform,
      default_rules: false,
    }),
  });
}

async function createClientKey(orgSlug: string, projectSlug: string): Promise<SentryKey> {
  return sentryRequest<SentryKey>(`/api/0/projects/${orgSlug}/${projectSlug}/keys/`, {
    method: "POST",
    body: JSON.stringify({ name: "Codex Provisioned DSN" }),
  });
}

function chooseTeam(teams: SentryTeam[]): SentryTeam {
  const requestedTeamSlug = process.env.SENTRY_TEAM_SLUG;
  if (requestedTeamSlug) {
    const requestedTeam = teams.find((team) => team.slug === requestedTeamSlug);
    if (!requestedTeam) {
      throw new Error(
        `SENTRY_TEAM_SLUG=${requestedTeamSlug} was not found. Available teams: ${teams
          .map((team) => team.slug)
          .join(", ")}`,
      );
    }

    return requestedTeam;
  }

  if (teams.length === 1) {
    return teams[0];
  }

  throw new Error(
    `Multiple Sentry teams found. Set SENTRY_TEAM_SLUG explicitly. Available teams: ${teams
      .map((team) => team.slug)
      .join(", ")}`,
  );
}

async function writeSpikeWebBuildEnv(orgSlug: string): Promise<void> {
  const buildEnvPath = join(process.cwd(), "packages/spike-web/.env.sentry-build-plugin");
  const contents = [
    `SENTRY_AUTH_TOKEN=${requireEnv("SENTRY_AUTH_TOKEN")}`,
    `SENTRY_ORG=${orgSlug}`,
    "SENTRY_PROJECT=spike-web",
    "",
  ].join("\n");

  await writeFile(buildEnvPath, contents, "utf8");
}

async function main(): Promise<void> {
  const orgSlug = getOrgSlug();
  if (!orgSlug) {
    throw new Error("Set SENTRY_ORG_SLUG (or SENTRY_ORG) before running this script.");
  }

  const teams = await listTeams(orgSlug);
  const team = chooseTeam(teams);
  const existingProjects = await listProjects(orgSlug);

  const results: Array<{
    config: ProjectConfig;
    project: SentryProject;
    dsn: string;
    created: boolean;
  }> = [];

  for (const config of PROJECTS) {
    const existingProject = existingProjects.find((project) => project.slug === config.slug);
    const project = existingProject ?? (await createProject(orgSlug, team.slug, config));

    const keys = await listProjectKeys(orgSlug, project.slug);
    const activeKey =
      keys.find((key) => key.isActive) ?? (await createClientKey(orgSlug, project.slug));

    results.push({
      config,
      project,
      dsn: activeKey.dsn.public,
      created: !existingProject,
    });
  }

  if (SHOULD_WRITE_SPIKE_WEB_BUILD_ENV) {
    await writeSpikeWebBuildEnv(orgSlug);
  }

  const workerPackages = new Map<string, string>([
    ["spike-edge", "packages/spike-edge"],
    ["spike-land-backend", "packages/spike-land-backend"],
    ["mcp-auth", "packages/mcp-auth"],
    ["spike-land-mcp", "packages/spike-land-mcp"],
  ]);

  console.log(`Sentry organization: ${orgSlug}`);
  console.log(`Sentry team: ${team.slug}`);
  console.log("");
  console.log("Provisioned projects:");
  for (const result of results) {
    const status = result.created ? "created" : "existing";
    console.log(`- ${result.config.slug}: ${status}`);
    console.log(`  DSN: ${result.dsn}`);
  }

  console.log("");
  console.log("Wrangler secret commands:");
  for (const result of results) {
    const pkg = workerPackages.get(result.config.slug);
    if (!pkg) {
      continue;
    }

    console.log(`- cd ${pkg} && printf '%s' '${result.dsn}' | npx wrangler secret put SENTRY_DSN`);
  }

  const spikeWebDsn = results.find((result) => result.config.slug === "spike-web")?.dsn;
  if (spikeWebDsn) {
    console.log("");
    console.log("Spike Web env:");
    console.log(`- packages/spike-web/.env`);
    console.log(`  PUBLIC_SENTRY_DSN=${spikeWebDsn}`);
    console.log("  PUBLIC_SENTRY_ENVIRONMENT=production");
  }

  if (SHOULD_WRITE_SPIKE_WEB_BUILD_ENV) {
    console.log("");
    console.log("Wrote packages/spike-web/.env.sentry-build-plugin");
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
