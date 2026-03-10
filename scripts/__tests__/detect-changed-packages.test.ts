import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

function write(repoRoot: string, relativePath: string, contents: string): void {
  const target = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function git(repoRoot: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8" }).trim();
}

function createFixtureRepo(): string {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "detect-changed-packages-"));
  mkdirSync(path.join(repoRoot, "scripts"), { recursive: true });
  cpSync(
    path.join(process.cwd(), "scripts/detect-changed-packages.sh"),
    path.join(repoRoot, "scripts/detect-changed-packages.sh"),
  );

  git(repoRoot, "init", "-b", "main");
  git(repoRoot, "config", "user.name", "Codex");
  git(repoRoot, "config", "user.email", "codex@example.com");

  write(
    repoRoot,
    "package.json",
    JSON.stringify(
      {
        name: "fixture",
        private: true,
        scripts: {
          test: "vitest run",
        },
      },
      null,
      2,
    ),
  );
  write(repoRoot, ".tests/vitest.config.ts", "export default {};\n");
  write(repoRoot, "src/edge-api/main/api/routes/example.ts", "export const example = 1;\n");
  write(repoRoot, "src/frontend/platform-frontend/ui/routes/store.tsx", "export const store = 1;\n");

  git(repoRoot, "add", ".");
  git(repoRoot, "commit", "-m", "base");

  return repoRoot;
}

function detect(repoRoot: string, baseRef: string, headRef: string): string[] {
  const output = execFileSync(
    "bash",
    [path.join(repoRoot, "scripts/detect-changed-packages.sh"), "--base", baseRef, "--head", headRef],
    {
      cwd: repoRoot,
      encoding: "utf-8",
    },
  ).trim();

  return output.length === 0 ? [] : output.split("\n");
}

const reposToClean: string[] = [];

afterEach(() => {
  while (reposToClean.length > 0) {
    const repoRoot = reposToClean.pop();
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  }
});

describe("detect-changed-packages.sh", () => {
  it("returns NO_CHANGES when refs are identical", () => {
    const repoRoot = createFixtureRepo();
    reposToClean.push(repoRoot);

    expect(detect(repoRoot, "HEAD", "HEAD")).toEqual(["NO_CHANGES"]);
  });

  it("returns ALL for isolated vitest config changes", () => {
    const repoRoot = createFixtureRepo();
    reposToClean.push(repoRoot);

    write(repoRoot, ".tests/vitest.config.ts", "export default { changed: true };\n");
    git(repoRoot, "add", ".tests/vitest.config.ts");
    git(repoRoot, "commit", "-m", "change test config");

    expect(detect(repoRoot, "HEAD~1", "HEAD")).toEqual(["ALL"]);
  });

  it("scopes vitest config changes to the changed package when src changes are present", () => {
    const repoRoot = createFixtureRepo();
    reposToClean.push(repoRoot);

    write(repoRoot, ".tests/vitest.config.ts", "export default { changed: true };\n");
    write(repoRoot, "src/frontend/platform-frontend/ui/routes/store.tsx", "export const store = 2;\n");
    git(repoRoot, "add", ".tests/vitest.config.ts", "src/frontend/platform-frontend/ui/routes/store.tsx");
    git(repoRoot, "commit", "-m", "change test config and spike-app");

    expect(detect(repoRoot, "HEAD~1", "HEAD")).toEqual(["spike-app"]);
  });

  it("does not force ALL for script-only root package.json changes", () => {
    const repoRoot = createFixtureRepo();
    reposToClean.push(repoRoot);

    write(
      repoRoot,
      "package.json",
      JSON.stringify(
        {
          name: "fixture",
          private: true,
          scripts: {
            test: "vitest run",
            bazdmeg: "node --import tsx scripts/bazdmeg.ts",
          },
        },
        null,
        2,
      ),
    );
    write(repoRoot, "src/edge-api/main/api/routes/example.ts", "export const example = 2;\n");
    git(repoRoot, "add", "package.json", "src/edge-api/main/api/routes/example.ts");
    git(repoRoot, "commit", "-m", "change scripts and spike-edge");

    expect(detect(repoRoot, "HEAD~1", "HEAD")).toEqual(["spike-edge"]);
  });

  it("detects working-tree changes without forcing ALL for script-only package edits", () => {
    const repoRoot = createFixtureRepo();
    reposToClean.push(repoRoot);

    write(
      repoRoot,
      "package.json",
      JSON.stringify(
        {
          name: "fixture",
          private: true,
          scripts: {
            test: "vitest run",
            bazdmeg: "node --import tsx scripts/bazdmeg.ts",
          },
        },
        null,
        2,
      ),
    );
    write(repoRoot, "src/frontend/platform-frontend/ui/routes/store.tsx", "export const store = 2;\n");

    expect(detect(repoRoot, "HEAD", "WORKTREE")).toEqual(["spike-app"]);
  });

  it("still returns ALL for dependency changes in root package.json", () => {
    const repoRoot = createFixtureRepo();
    reposToClean.push(repoRoot);

    write(
      repoRoot,
      "package.json",
      JSON.stringify(
        {
          name: "fixture",
          private: true,
          scripts: {
            test: "vitest run",
          },
          devDependencies: {
            vitest: "^4.0.18",
          },
        },
        null,
        2,
      ),
    );
    git(repoRoot, "add", "package.json");
    git(repoRoot, "commit", "-m", "change dependencies");

    expect(detect(repoRoot, "HEAD~1", "HEAD")).toEqual(["ALL"]);
  });
});
