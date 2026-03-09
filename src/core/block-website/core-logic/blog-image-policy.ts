const ALLOWED_IMAGE_HOSTS = new Set([
  "avatars.githubusercontent.com",
  "image-studio-mcp.spike.land",
  "spike.land",
  "www.spike.land",
  "local.spike.land",
  "ipfs.spike.land",
  "localhost",
  "127.0.0.1",
]);

const ALLOWED_IMAGE_HOST_SUFFIXES = [
  ".r2.dev",
  ".r2.cloudflarestorage.com",
  ".googleusercontent.com",
  ".basemaps.cartocdn.com",
];

export function isAllowedBlogImageSrc(src?: string | null): boolean {
  if (!src) return false;

  const trimmed = src.trim();
  if (!trimmed) return false;

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;

    return (
      ALLOWED_IMAGE_HOSTS.has(url.hostname) ||
      ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

export function sanitizeBlogImageSrc(src?: string | null): string | null {
  return isAllowedBlogImageSrc(src) ? src!.trim() : null;
}
