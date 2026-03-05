import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapTestToSource, getFileHash, loadCache, saveCache, runVitestWithCoverage, execPromise } from '../../src/incremental-test-mcp/logic.js';
import * as fs from 'node:fs/promises';
import * as child_process from 'node:child_process';

vi.mock('node:fs/promises');
vi.mock('node:child_process');

describe('Incremental Test Logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('mapTestToSource', () => {
    it('should map .tests/PATH/TO/FILE.test.ts to src/PATH/TO/FILE.ts', () => {
      const testPath = '.tests/mcp-server-base/index.test.ts';
      const expectedSourcePath = 'src/mcp-server-base/index.ts';
      expect(mapTestToSource(testPath)).toBe(expectedSourcePath);
    });

    it('should map .tests/PATH/TO/FILE.test.tsx to src/PATH/TO/FILE.tsx', () => {
      const testPath = '.tests/spike-app/App.test.tsx';
      const expectedSourcePath = 'src/spike-app/App.tsx';
      expect(mapTestToSource(testPath)).toBe(expectedSourcePath);
    });
    
    it('should handle nested paths correctly', () => {
      const testPath = '.tests/shared/utils/date.test.ts';
      const expectedSourcePath = 'src/shared/utils/date.ts';
      expect(mapTestToSource(testPath)).toBe(expectedSourcePath);
    });
  });

  describe('getFileHash', () => {
    it('should return the SHA256 hash of a file content', async () => {
      const content = 'hello world';
      (fs.readFile as any).mockResolvedValue(Buffer.from(content));
      const hash = await getFileHash('dummy-path');
      // sha256 of 'hello world' is b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });
  });

  describe('execPromise', () => {
    it('should reject if exec returns an error', async () => {
      const error = new Error('command failed');
      (error as any).stdout = 'partial output';
      (error as any).stderr = 'error details';
      
      (child_process.exec as any).mockImplementation((cmd, callback) => {
        callback(error, 'partial output', 'error details');
      });

      try {
        await execPromise('some command');
        expect.fail('should have rejected');
      } catch (err: any) {
        expect(err.message).toBe('command failed');
        expect(err.stdout).toBe('partial output');
        expect(err.stderr).toBe('error details');
      }
    });
  });

  describe('cache management', () => {
    const cachePath = 'incremental-coverage.json';
    it('should load cache from file', async () => {
      const cacheData = { 'test.ts': { sourceHash: 'h1', testHash: 'h2', coverage: 100 } };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(cacheData));
      const loaded = await loadCache(cachePath);
      expect(loaded).toEqual(cacheData);
    });

    it('should return empty object if cache file does not exist', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      const loaded = await loadCache(cachePath);
      expect(loaded).toEqual({});
    });

    it('should throw other errors from loadCache', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('other error'));
      await expect(loadCache(cachePath)).rejects.toThrow('other error');
    });

    it('should save cache to file', async () => {
      const cacheData = { 'test.ts': { sourceHash: 'h1', testHash: 'h2', coverage: 100, success: true } };
      await saveCache(cachePath, cacheData);
      expect(fs.writeFile).toHaveBeenCalledWith(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
    });
  });

  describe('runVitestWithCoverage', () => {
    it('should run vitest with coverage for a specific file and parse output', async () => {
      const testPath = '.tests/mcp-server-base/index.test.ts';
      const srcPath = 'src/mcp-server-base/index.ts';
      
      (child_process.exec as any).mockImplementation((cmd, callback) => {
        // Mock success with output containing coverage info
        const table = `
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------|---------|----------|---------|---------|-------------------
All files |   71.87 |       25 |     100 |   71.87 |                   
 logic.ts |   71.87 |       25 |     100 |     100 | 
----------|---------|----------|---------|---------|-------------------`;
        callback(null, table, '');
      });

      const result = await runVitestWithCoverage(testPath, srcPath);
      expect(result.success).toBe(true);
      expect(result.coverage).toBe(100);
      expect(child_process.exec).toHaveBeenCalled();
    });

    it('should handle vitest execution failure and parse coverage from stdout', async () => {
      const testPath = '.tests/mcp-server-base/index.test.ts';
      const srcPath = 'src/mcp-server-base/index.ts';
      
      const error = new Error('vitest failed');
      (error as any).stdout = `
----------|---------|----------|---------|---------|-------------------
 logic.ts |   50.00 |       25 |     100 |   50.00 | 
----------|---------|----------|---------|---------|-------------------`;
      (error as any).stderr = 'some error message';

      (child_process.exec as any).mockImplementation((cmd, callback) => {
        callback(error, (error as any).stdout, (error as any).stderr);
      });

      const result = await runVitestWithCoverage(testPath, srcPath);
      expect(result.success).toBe(false);
      expect(result.coverage).toBe(50);
      expect(result.stderr).toBe('some error message');
    });

    it('should handle vitest failure without stdout or stderr', async () => {
      const testPath = '.tests/mcp-server-base/index.test.ts';
      const srcPath = 'src/mcp-server-base/index.ts';
      
      const error = new Error('minimal failure');

      (child_process.exec as any).mockImplementation((cmd, callback) => {
        callback(error, undefined, undefined);
      });

      const result = await runVitestWithCoverage(testPath, srcPath);
      expect(result.success).toBe(false);
      expect(result.coverage).toBe(0);
      expect(result.stderr).toBe('minimal failure');
    });

    it('should return 0 coverage if stdout does not contain coverage table', async () => {
      const testPath = '.tests/mcp-server-base/index.test.ts';
      const srcPath = 'src/mcp-server-base/index.ts';
      
      (child_process.exec as any).mockImplementation((cmd, callback) => {
        callback(null, 'no coverage table here', '');
      });

      const result = await runVitestWithCoverage(testPath, srcPath);
      expect(result.success).toBe(true);
      expect(result.coverage).toBe(0);
    });

    it('should return 0 coverage if coverage table is malformed', async () => {
      const testPath = '.tests/mcp-server-base/index.test.ts';
      const srcPath = 'src/mcp-server-base/index.ts';
      
      (child_process.exec as any).mockImplementation((cmd, callback) => {
        const table = `
----------|---------|----------|---------|---------|-------------------
 logic.ts |   71.87
----------|---------|----------|---------|---------|-------------------`;
        callback(null, table, '');
      });

      const result = await runVitestWithCoverage(testPath, srcPath);
      expect(result.coverage).toBe(0);
    });
  });
});
