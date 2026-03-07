import fs from "fs";
import path from "path";

async function main() {
  const testDir = "test_reads";
  fs.mkdirSync(testDir, { recursive: true });
  const files = [];
  for (let i = 0; i < 100; i++) {
    const filePath = path.join(testDir, `file${i}.js`);
    fs.writeFileSync(filePath, 'console.log("hello world");\n'.repeat(1000));
    files.push(filePath);
  }

  const startSync = performance.now();
  const hashesSync = files.map((file) => {
    const content = fs.readFileSync(file);
    return content.length;
  });
  const endSync = performance.now();
  console.log(`Sync Read: ${endSync - startSync}ms`);

  const startAsync = performance.now();
  const hashesAsync = await Promise.all(
    files.map(async (file) => {
      const content = await fs.promises.readFile(file);
      return content.length;
    }),
  );
  const endAsync = performance.now();
  console.log(`Async Read: ${endAsync - startAsync}ms`);

  fs.rmSync(testDir, { recursive: true, force: true });
}

main();
