import { describe, it, expect } from 'vitest';
import { formatBytes } from '../format-bytes';

describe('formatBytes', () => {
  it('should format 0 bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('should format standard byte values correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1234567, 2)).toBe('1.18 MB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });

  it('should format bytes without decimals when specified', () => {
    expect(formatBytes(1234567, 0)).toBe('1 MB');
  });

  it('should handle negative values correctly', () => {
    expect(formatBytes(-1024)).toBe('-1 KB');
    expect(formatBytes(-1234567, 2)).toBe('-1.18 MB');
  });

  it('should handle extremely large values correctly', () => {
    const pb = 1024 ** 5;
    expect(formatBytes(pb)).toBe('1 PB');
  });

  it('should ignore negative decimals and treat them as 0', () => {
    expect(formatBytes(1234567, -2)).toBe('1 MB');
  });
});
