/**
 * Admin Shared Formatting Utilities
 *
 * Common formatting functions used across admin pages, routes, and MCP tools.
 */

export { formatBytes } from "@/lib/utils";

/**
 * Format a number as GBP currency string (e.g. "£12.50").
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(price);
}

/**
 * Map a status string to Tailwind color classes for badges/pills.
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "text-yellow-400 bg-yellow-900/20",
    PAYMENT_PENDING: "text-yellow-400 bg-yellow-900/20",
    PAID: "text-green-400 bg-green-900/20",
    SUBMITTED: "text-blue-400 bg-blue-900/20",
    IN_PRODUCTION: "text-blue-400 bg-blue-900/20",
    PROCESSING: "text-blue-400 bg-blue-900/20",
    SHIPPED: "text-purple-400 bg-purple-900/20",
    DELIVERED: "text-green-400 bg-green-900/20",
    COMPLETED: "text-green-400 bg-green-900/20",
    CANCELLED: "text-red-400 bg-red-900/20",
    REFUNDED: "text-gray-400 bg-gray-900/20",
    FAILED: "text-red-400 bg-red-900/20",
  };
  return colors[status] || "text-gray-400 bg-gray-900/20";
}

/**
 * Map a status string to shadcn Badge variant.
 */
export function getStatusBadgeVariant(
  status?: string,
): "default" | "secondary" | "destructive" {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "PROCESSING":
    case "PENDING":
      return "secondary";
    case "FAILED":
      return "destructive";
    default:
      return "secondary";
  }
}
