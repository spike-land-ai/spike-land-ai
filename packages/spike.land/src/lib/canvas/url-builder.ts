import { DEFAULT_INTERVAL, DEFAULT_ORDER, DEFAULT_ROTATION } from "./constants";
import type { CanvasSettings } from "./types";

export function buildCanvasUrl(
  albumId: string,
  shareToken: string | null,
  settings: Partial<CanvasSettings>,
  baseUrl?: string,
): string {
  const base =
    baseUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const url = new URL(`/canvas/${albumId}`, base);

  if (shareToken) {
    url.searchParams.set("token", shareToken);
  }

  if (settings.rotation !== undefined && settings.rotation !== DEFAULT_ROTATION) {
    url.searchParams.set("rotation", settings.rotation.toString());
  }

  if (settings.order !== undefined && settings.order !== DEFAULT_ORDER) {
    url.searchParams.set("order", settings.order);
  }

  if (settings.interval !== undefined && settings.interval !== DEFAULT_INTERVAL) {
    url.searchParams.set("interval", settings.interval.toString());
  }

  return url.toString();
}
