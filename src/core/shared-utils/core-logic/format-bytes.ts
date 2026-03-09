/**
 * Formats a number of bytes into a human-readable string (e.g., KB, MB, GB, TB).
 *
 * @param bytes - The number of bytes to format.
 * @param decimals - The number of decimal places to include (default: 2 for positive decimals, 0 if it would be .00).
 * @returns A human-readable string representation of the bytes.
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const isNegative = bytes < 0;
  const absBytes = Math.abs(bytes);

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(absBytes) / Math.log(k));

  const val = parseFloat((absBytes / Math.pow(k, i)).toFixed(dm));

  return `${isNegative ? '-' : ''}${val} ${sizes[i]}`;
}
