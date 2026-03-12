import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(scriptDir);
const targets = ["dist/cli.js", "dist/cli.cjs"].map((target) => join(packageDir, target));
const shebang = "#!/usr/bin/env node";

for (const target of targets) {
  const [content, metadata] = await Promise.all([readFile(target, "utf-8"), stat(target)]);

  if (!content.startsWith(shebang)) {
    throw new Error(`${target} is missing the Node shebang`);
  }

  if ((metadata.mode & 0o111) === 0) {
    throw new Error(`${target} is not executable`);
  }
}
