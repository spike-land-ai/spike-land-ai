import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';

export function mapTestToSource(testPath: string): string {
  // Map .tests/PATH/TO/FILE.test.(ts|tsx) to src/PATH/TO/FILE.(ts|tsx)
  return testPath
    .replace(/^\.tests\//, 'src/')
    .replace(/\.test\.(tsx?)$/, '.$1');
}

export async function getFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

export interface CacheEntry {
  sourceHash: string;
  testHash: string;
  coverage: number;
  success: boolean;
}

export interface Cache {
  [testPath: string]: CacheEntry;
}

export async function loadCache(cachePath: string): Promise<Cache> {
  try {
    const data = await fs.readFile(cachePath, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export async function saveCache(cachePath: string, cache: Cache): Promise<void> {
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

export interface VitestResult {
  success: boolean;
  coverage: number;
  output: string;
  stderr: string;
}

export async function execPromise(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        const enhancedError = error as any;
        enhancedError.stdout = stdout;
        enhancedError.stderr = stderr;
        reject(enhancedError);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function runVitestWithCoverage(testPath: string, srcPath: string): Promise<VitestResult> {
  // Run vitest with coverage for a specific file
  const command = `npx vitest run ${testPath} --coverage --coverage.include ${srcPath} --coverage.reporter text`;
  
  try {
    const { stdout, stderr } = await execPromise(command);
    const coverage = parseCoverage(stdout);
    
    return {
      success: true,
      coverage,
      output: stdout,
      stderr
    };
  } catch (error: any) {
    const coverage = parseCoverage(error.stdout || '');
    return {
      success: false,
      coverage,
      output: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

function parseCoverage(stdout: string): number {
  // Basic parser for Vitest text coverage output
  const linesMatch = stdout.match(/Lines\s*:\s*(\d+(\.\d+)?)%/);
  if (linesMatch) {
    return parseFloat(linesMatch[1]);
  }
  return 0;
}
