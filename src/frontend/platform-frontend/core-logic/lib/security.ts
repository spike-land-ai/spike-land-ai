/**
 * Safely sanitizes a URL to prevent XSS (e.g., javascript: links).
 * Allows http, https, mailto, tel, and relative paths.
 */
export function sanitizeUrl(url: string): string {
  if (!url) return "about:blank";

  const trimmedUrl = url.trim();

  // Allow relative paths (but not starting with // which is protocol-relative and can be misused)
  if (
    (trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) ||
    trimmedUrl.startsWith("./") ||
    trimmedUrl.startsWith("../")
  ) {
    return trimmedUrl;
  }

  // Check for allowed protocols
  const isSafe = /^(https?|mailto|tel):/i.test(trimmedUrl);
  return isSafe ? trimmedUrl : "about:blank";
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
