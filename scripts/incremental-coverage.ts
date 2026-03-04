import * as fs from 'node:fs/promises';
import { glob } from 'glob';
import { 
  mapTestToSource, 
  getFileHash, 
  loadCache, 
  saveCache, 
  runVitestWithCoverage 
} from '../src/incremental-test-mcp/logic.js';

const CACHE_PATH = "incremental-coverage.json";
const REPORT_PATH = "docs/INCREMENTAL_COVERAGE_STATUS.md";

async function main() {
  const testFiles = await glob('.tests/**/*.test.ts');
  const cache = await loadCache(CACHE_PATH);
  const results = [];

  console.log(`Checking ${testFiles.length} test files...`);

  for (const testFilePath of testFiles) {
    const srcFilePath = mapTestToSource(testFilePath);
    
    // Check if source exists
    try {
      await fs.access(srcFilePath);
    } catch {
      continue; // Skip if source file doesn't exist
    }

    const [testHash, srcHash] = await Promise.all([
      getFileHash(testFilePath),
      getFileHash(srcFilePath),
    ]);

    const existing = cache[testFilePath];
    let coverage = 0;
    let success = false;

    if (existing && existing.testHash === testHash && existing.sourceHash === srcHash && existing.success) {
      coverage = existing.coverage;
      success = existing.success;
      console.log(`[CACHED] ${testFilePath}: ${coverage}%`);
    } else {
      console.log(`[RUNNING] ${testFilePath}...`);
      const result = await runVitestWithCoverage(testFilePath, srcFilePath);
      coverage = result.coverage;
      success = result.success;
      
      cache[testFilePath] = {
        testHash,
        sourceHash: srcHash,
        coverage,
        success,
      };
      await saveCache(CACHE_PATH, cache);
      console.log(`[RESULT] ${testFilePath}: ${coverage}% ${success ? "PASSED" : "FAILED"}`);
    }

    results.push({ testFilePath, srcFilePath, coverage, success });
  }

  // Generate report
  const fullyCovered = results.filter(r => r.coverage === 100 && r.success);
  const others = results.filter(r => r.coverage < 100 || !r.success);

  let report = `# Incremental Coverage Report\n\n`;
  report += `## 100% Coverage ✅ (${fullyCovered.length})\n\n`;
  fullyCovered.forEach(r => {
    report += `- [ ] ${r.srcFilePath} (via ${r.testFilePath})\n`;
  });

  report += `\n## Progressing 🚧 (${others.length})\n\n`;
  others.sort((a, b) => b.coverage - a.coverage).forEach(r => {
    report += `- [ ] ${r.srcFilePath}: ${r.coverage}% (via ${r.testFilePath})${!r.success ? " ❌" : ""}\n`;
  });

  await fs.writeFile(REPORT_PATH, report);
  console.log(`\nReport updated: ${REPORT_PATH}`);
}

main().catch(console.error);
