import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapTestToSource, getFileHash, loadCache, saveCache, runVitestWithCoverage } from '../../src/incremental-test-mcp/logic.js';
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
        callback(null, 'All tests passed\nLines : 100% (10/10)', '');
      });

      const result = await runVitestWithCoverage(testPath, srcPath);
      expect(result.success).toBe(true);
      expect(result.coverage).toBe(100);
      expect(child_process.exec).toHaveBeenCalled();
    });
  });
});
