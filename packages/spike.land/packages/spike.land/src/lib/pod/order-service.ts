/**
 * POD Order Service
 *
 * Business logic for managing orders with POD providers.
 * Handles order submission, status tracking, and error handling.
 */

import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import type { Prisma } from "@prisma/client";
import { prodigiProvider } from "./prodigi/client";
import type {
  PodOrderRequest,
  PodOrderResult,
  PodProvider,
  ShippingAddress,
} from "./types";
import { logger } from "@/lib/logger";

/**
 * Get the appropriate POD provider for a given provider name.
 */
function getProvider(providerName: "PRODIGI" | "PRINTFUL"): PodProvider {
  switch (providerName) {
    case "PRODIGI":
      return prodigiProvider;
    case "PRINTFUL":
      throw new Error("Printful integration not yet implemented");
    default:
      throw new Error(`Unknown POD provider: ${providerName}`);
  }
}

interface SubmitOrderResult {
  success: boolean;
  providerOrderId?: string;
  error?: string;
}

/**
 * Submit an order to the POD provider.
 * This should be called after payment is authorized.
 */
export async function submitOrderToPod(
  orderId: string,
): Promise<SubmitOrderResult> {
  // Fetch the order with all items
  const { data: order, error: fetchError } = await tryCatch(
    prisma.merchOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    }),
  );

  if (fetchError || !order) {
    return {
      success: false,
      error: fetchError?.message || "Order not found",
    };
  }

  // Group items by provider (for future multi-provider support)
  const itemsByProvider = new Map<"PRODIGI" | "PRINTFUL", typeof order.items>();
  for (const item of order.items) {
    const provider = item.product.provider;
    const existing = itemsByProvider.get(provider) || [];
    existing.push(item);
    itemsByProvider.set(provider, existing);
  }

  // For MVP, we only support Prodigi
  const prodigiItems = itemsByProvider.get("PRODIGI");
  if (!prodigiItems || prodigiItems.length === 0) {
    return {
      success: false,
      error: "No items for Prodigi provider",
    };
  }

  // Parse shipping address
  const shippingAddress = order.shippingAddress as unknown as ShippingAddress;

  const podRequest: PodOrderRequest = {
    orderId: order.id,
    shippingAddress: {
      name: shippingAddress.name,
      line1: shippingAddress.line1,
      line2: shippingAddress.line2,
      city: shippingAddress.city,
      postalCode: shippingAddress.postalCode,
      countryCode: shippingAddress.countryCode,
      phone: shippingAddress.phone,
      email: order.customerEmail,
    },
    shippingMethod: "Standard",
    items: prodigiItems.map(item => ({
      sku: item.variant?.providerSku || item.product.providerSku,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
      customText: item.customText ?? undefined,
    })),
    metadata: {
      orderNumber: order.orderNumber,
      internalOrderId: order.id,
    },
  };

  // Submit to Prodigi
  const provider = getProvider("PRODIGI");
  const { data: result, error: submitError } = await tryCatch<PodOrderResult>(
    provider.createOrder(podRequest),
  );

  if (submitError || !result) {
    // Log the error and record event
    await recordOrderEvent(orderId, "POD_SUBMISSION_FAILED", {
      error: submitError?.message || "Unknown error",
      provider: "PRODIGI",
    });

    return {
      success: false,
      error: submitError?.message || "Failed to submit order to provider",
    };
  }

  if (!result.success) {
    await recordOrderEvent(orderId, "POD_SUBMISSION_FAILED", {
      error: result.error,
      provider: "PRODIGI",
    });

    return {
      success: false,
      error: result.error,
    };
  }

  // Update order items with POD order ID
  const { error: updateError } = await tryCatch(
    prisma.$transaction(async tx => {
      // Update all items with the provider order ID
      for (const item of prodigiItems) {
        await tx.merchOrderItem.update({
          where: { id: item.id },
          data: {
            podOrderId: result.providerOrderId,
            podStatus: result.status,
          },
        });
      }

      // Update order status
      await tx.merchOrder.update({
        where: { id: orderId },
        data: { status: "SUBMITTED" },
      });

      // Record success event
      await tx.merchOrderEvent.create({
        data: {
          orderId,
          type: "SUBMITTED_TO_POD",
          data: {
            provider: "PRODIGI",
            providerOrderId: result.providerOrderId,
          },
        },
      });
    }),
  );

  if (updateError) {
    // Order was submitted but we failed to record it - this is bad
    logger.error("Failed to record POD submission:", updateError);
    return {
      success: true,
      providerOrderId: result.providerOrderId,
      error: "Order submitted but failed to record in database",
    };
  }

  return {
    success: true,
    providerOrderId: result.providerOrderId,
  };
}

/**
 * Update order status from POD provider webhook.
 */
export async function updateOrderFromWebhook(
  providerOrderId: string,
  provider: "PRODIGI" | "PRINTFUL",
  status: string,
  trackingNumber?: string,
  trackingUrl?: string,
  carrier?: string,
): Promise<void> {
  // Find order items with this POD order ID
  const items = await prisma.merchOrderItem.findMany({
    where: { podOrderId: providerOrderId },
    include: { order: true },
  });

  const firstItem = items[0];
  if (!firstItem) {
    logger.warn(
      `No order items found for provider order ID: ${providerOrderId}`,
    );
    return;
  }

  const orderId = firstItem.order.id;

  // Map provider status to our status
  const orderStatus = mapProviderStatusToOrderStatus(status);

  await prisma.$transaction(async tx => {
    // Update items
    for (const item of items) {
      await tx.merchOrderItem.update({
        where: { id: item.id },
        data: { podStatus: status },
      });
    }

    // Update order status
    await tx.merchOrder.update({
      where: { id: orderId },
      data: { status: orderStatus },
    });

    // Create/update shipment if we have tracking info
    if (
      trackingNumber
      && (orderStatus === "SHIPPED" || orderStatus === "DELIVERED")
    ) {
      const existingShipment = await tx.merchShipment.findFirst({
        where: { orderId, provider },
      });

      if (existingShipment) {
        await tx.merchShipment.update({
          where: { id: existingShipment.id },
          data: {
            trackingNumber,
            trackingUrl,
            carrier,
            status: orderStatus === "SHIPPED" ? "SHIPPED" : "DELIVERED",
            shippedAt: orderStatus === "SHIPPED"
              ? new Date()
              : existingShipment.shippedAt,
            deliveredAt: orderStatus === "DELIVERED" ? new Date() : undefined,
          },
        });
      } else {
        await tx.merchShipment.create({
          data: {
            orderId,
            provider,
            providerShipId: providerOrderId,
            trackingNumber,
            trackingUrl,
            carrier,
            status: "SHIPPED",
            shippedAt: new Date(),
          },
        });
      }
    }

    // Record event
    await tx.merchOrderEvent.create({
      data: {
        orderId,
        type: `POD_STATUS_${status.toUpperCase()}`,
        data: {
          provider,
          providerOrderId,
          status,
          trackingNumber,
          trackingUrl,
          carrier,
        },
      },
    });
  });
}

/**
 * Map provider-specific status to our order status.
 */
function mapProviderStatusToOrderStatus(
  providerStatus: string,
): "SUBMITTED" | "IN_PRODUCTION" | "SHIPPED" | "DELIVERED" | "CANCELLED" {
  const statusLower = providerStatus.toLowerCase();

  if (statusLower.includes("cancel")) return "CANCELLED";
  if (statusLower.includes("deliver") || statusLower === "complete") {
    return "DELIVERED";
  }
  if (statusLower.includes("ship") || statusLower.includes("transit")) {
    return "SHIPPED";
  }
  if (statusLower.includes("production") || statusLower.includes("print")) {
    return "IN_PRODUCTION";
  }

  return "SUBMITTED";
}

/**
 * Get a shipping quote for cart items.
 */
export async function getShippingQuote(
  items: { productId: string; variantId?: string; quantity: number; }[],
  address: ShippingAddress,
): Promise<{
  itemsCost: number;
  shippingCost: number;
  totalCost: number;
  currency: string;
}> {
  // Fetch products to get SKUs
  const products = await prisma.merchProduct.findMany({
    where: {
      id: { in: items.map(i => i.productId) },
    },
    include: { variants: true },
  });

  const productMap = new Map(products.map(p => [p.id, p]));

  // Build quote items
  const quoteItems = items.map(item => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product not found: ${item.productId}`);

    const variant = item.variantId
      ? product.variants.find(v => v.id === item.variantId)
      : null;

    return {
      sku: variant?.providerSku || product.providerSku,
      quantity: item.quantity,
    };
  });

  // Get quote from provider
  const provider = getProvider("PRODIGI");
  const quote = await provider.getQuote(quoteItems, address);

  const itemsCost = quote.items.reduce((sum, item) => sum + item.totalCost, 0);
  const shippingCost = quote.shipping.reduce((sum, s) => sum + s.cost, 0);

  return {
    itemsCost,
    shippingCost,
    totalCost: itemsCost + shippingCost,
    currency: quote.currency,
  };
}

/**
 * Record an order event.
 */
async function recordOrderEvent(
  orderId: string,
  type: string,
  data?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.merchOrderEvent.create({
    data: {
      orderId,
      type,
      data: data ?? undefined,
    },
  });
}

/**
 * Generate a unique order number.
 * Format: SL-YYYYMMDD-XXXX (e.g., SL-20241220-A3B7)
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.getFullYear().toString()
    + (date.getMonth() + 1).toString().padStart(2, "0")
    + date.getDate().toString().padStart(2, "0");

  // Generate 4 character alphanumeric suffix
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluded I, O, 0, 1 for clarity
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `SL-${dateStr}-${suffix}`;
}
