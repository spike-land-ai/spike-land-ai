import { execSync, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function main() {
  const tasks = Array.from({ length: 10 }, (_, i) => i);

  const startSync = performance.now();
  for (const t of tasks) {
    execSync("sleep 0.1");
  }
  console.log(`Sync exec: ${performance.now() - startSync}ms`);

  const startAsync = performance.now();
  await Promise.all(tasks.map(() => execAsync("sleep 0.1")));
  console.log(`Async exec: ${performance.now() - startAsync}ms`);
}

main();
