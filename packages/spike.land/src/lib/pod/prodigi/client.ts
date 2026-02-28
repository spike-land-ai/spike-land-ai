/**
 * Prodigi API Client
 *
 * Environment Variables:
 * - PRODIGI_API_KEY: API key for authentication
 * - PRODIGI_SANDBOX: Set to "true" for sandbox environment
 *
 * API Documentation: https://www.prodigi.com/print-api/docs/
 */

import { tryCatch } from "@/lib/try-catch";
import type {
  PodOrderRequest,
  PodOrderResult,
  PodOrderStatus,
  PodProvider,
  PodQuote,
  PodQuoteItem,
  ShippingAddress,
} from "../types";
import type {
  ProdigiCancelResponse,
  ProdigiErrorResponse,
  ProdigiOrderRequest,
  ProdigiOrderResponse,
  ProdigiOrderStatusResponse,
  ProdigiQuoteRequest,
  ProdigiQuoteResponse,
} from "./types";

const SANDBOX_BASE_URL = "https://api.sandbox.prodigi.com/v4.0";
const PRODUCTION_BASE_URL = "https://api.prodigi.com/v4.0";

function getBaseUrl(): string {
  const isSandbox = process.env.PRODIGI_SANDBOX === "true";
  return isSandbox ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
}

function getApiKey(): string {
  const key = process.env.PRODIGI_API_KEY;
  if (!key) {
    throw new Error("PRODIGI_API_KEY environment variable is not set");
  }
  return key;
}

async function prodigiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;
  const apiKey = getApiKey();

  const response = await fetch(url, {
    ...options,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ProdigiErrorResponse;
    const errorMessage = error.errors?.map(e => `${e.property}: ${e.description}`).join(", ")
      || `Prodigi API error: ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

/**
 * Convert our internal order format to Prodigi format
 */
function mapOrderRequest(request: PodOrderRequest): ProdigiOrderRequest {
  return {
    merchantReference: request.orderId,
    shippingMethod: request.shippingMethod || "Standard",
    recipient: {
      name: request.shippingAddress.name,
      ...(request.shippingAddress.email !== undefined ? { email: request.shippingAddress.email } : {}),
      ...(request.shippingAddress.phone !== undefined ? { phoneNumber: request.shippingAddress.phone } : {}),
      address: {
        line1: request.shippingAddress.line1,
        ...(request.shippingAddress.line2 !== undefined ? { line2: request.shippingAddress.line2 } : {}),
        townOrCity: request.shippingAddress.city,
        postalOrZipCode: request.shippingAddress.postalCode,
        countryCode: request.shippingAddress.countryCode,
      },
    },
    items: request.items.map(item => ({
      sku: item.sku,
      copies: item.quantity,
      sizing: item.sizing || "fillPrintArea",
      assets: [
        {
          printArea: "default",
          url: item.imageUrl,
        },
      ],
    })),
    ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
  };
}

/**
 * Map Prodigi status to our internal status format
 */
function mapOrderStatus(
  order: ProdigiOrderStatusResponse["order"],
): PodOrderStatus | null {
  if (!order) return null;

  // Find the first shipment with tracking info
  const shipment = order.shipments.find(
    s => s.tracking?.number || s.status === "Shipped",
  );

  // Map Prodigi status stages to a simpler status string
  let status = "pending";
  const stage = order.status.stage;
  const details = order.status.details;

  if (stage === "Complete") {
    status = "delivered";
  } else if (stage === "Cancelled") {
    status = "cancelled";
  } else if (details.shipping === "InProgress") {
    status = "shipped";
  } else if (details.inProduction === "InProgress") {
    status = "in_production";
  } else if (details.allocateProductionLocation === "InProgress") {
    status = "processing";
  } else if (details.downloadAssets === "InProgress") {
    status = "processing";
  }

  const prodigiShippedAt = shipment?.dispatchDate ? new Date(shipment.dispatchDate) : undefined;
  return {
    providerOrderId: order.id,
    status,
    statusDetail: stage,
    ...(shipment?.tracking?.number !== undefined ? { trackingNumber: shipment.tracking.number } : {}),
    ...(shipment?.tracking?.url !== undefined ? { trackingUrl: shipment.tracking.url } : {}),
    ...(shipment?.carrier?.name !== undefined ? { carrier: shipment.carrier.name } : {}),
    ...(prodigiShippedAt !== undefined ? { shippedAt: prodigiShippedAt } : {}),
    items: order.items.map(item => ({
      sku: item.sku,
      status: item.status,
    })),
  };
}

/**
 * Prodigi POD Provider implementation
 */
export const prodigiProvider: PodProvider = {
  name: "PRODIGI",

  async createOrder(request: PodOrderRequest): Promise<PodOrderResult> {
    const prodigiRequest_ = mapOrderRequest(request);

    const { data, error } = await tryCatch(
      prodigiRequest<ProdigiOrderResponse>("/orders", {
        method: "POST",
        body: JSON.stringify(prodigiRequest_),
      }),
    );

    if (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    const prodigiError = data.outcome === "CreatedWithIssues"
      ? data.order.status.issues?.map(i => i.description).join(", ")
      : undefined;
    return {
      success: data.outcome === "Created"
        || data.outcome === "CreatedWithIssues",
      providerOrderId: data.order.id,
      status: data.order.status.stage,
      ...(prodigiError !== undefined ? { error: prodigiError } : {}),
    };
  },

  async getQuote(
    items: PodQuoteItem[],
    address: ShippingAddress,
  ): Promise<PodQuote> {
    const quoteRequest: ProdigiQuoteRequest = {
      shippingMethod: "Standard",
      destinationCountryCode: address.countryCode,
      currencyCode: "GBP",
      items: items.map(item => ({
        sku: item.sku,
        copies: item.quantity,
      })),
    };

    const response = await prodigiRequest<ProdigiQuoteResponse>("/quotes", {
      method: "POST",
      body: JSON.stringify(quoteRequest),
    });

    // Get the first quote (Standard shipping)
    const quote = response.quotes[0];
    if (!quote) {
      throw new Error("No quote available for the requested items");
    }

    return {
      currency: quote.costSummary.totalCost.currency,
      items: quote.items.map(item => ({
        sku: item.sku,
        quantity: item.copies,
        unitCost: parseFloat(item.unitCost.amount),
        totalCost: parseFloat(item.totalCost.amount),
      })),
      shipping: quote.shipments.map(shipment => ({
        method: shipment.carrier.service || shipment.carrier.name,
        cost: parseFloat(shipment.cost.amount),
        currency: shipment.cost.currency,
      })),
    };
  },

  async getOrderStatus(providerOrderId: string): Promise<PodOrderStatus> {
    const response = await prodigiRequest<ProdigiOrderStatusResponse>(
      `/orders/${providerOrderId}`,
    );

    if (response.outcome === "NotFound" || !response.order) {
      throw new Error(`Order ${providerOrderId} not found`);
    }

    const status = mapOrderStatus(response.order);
    if (!status) {
      throw new Error(`Failed to map order status for ${providerOrderId}`);
    }

    return status;
  },

  async cancelOrder(
    providerOrderId: string,
  ): Promise<{ success: boolean; error?: string; }> {
    const { data, error } = await tryCatch(
      prodigiRequest<ProdigiCancelResponse>(
        `/orders/${providerOrderId}/actions/cancel`,
        { method: "POST" },
      ),
    );

    if (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    if (data.outcome === "NotCancellable") {
      return {
        success: false,
        error: "Order cannot be cancelled at this stage",
      };
    }

    if (data.outcome === "NotFound") {
      return {
        success: false,
        error: "Order not found",
      };
    }

    return { success: true };
  },
};

/**
 * Validate that an image meets Prodigi's requirements.
 */
export function validateImageForProduct(
  imageWidth: number,
  imageHeight: number,
  minWidth: number,
  minHeight: number,
  minDpi: number = 150,
): { valid: boolean; errors: string[]; } {
  const errors: string[] = [];

  if (imageWidth < minWidth) {
    errors.push(
      `Image width (${imageWidth}px) is less than required (${minWidth}px)`,
    );
  }

  if (imageHeight < minHeight) {
    errors.push(
      `Image height (${imageHeight}px) is less than required (${minHeight}px)`,
    );
  }

  // Rough DPI estimation based on typical print sizes
  // This is a simplified check - actual DPI depends on physical print size
  const estimatedDpi = Math.min(imageWidth, imageHeight) / 10; // Rough estimate
  if (estimatedDpi < minDpi) {
    errors.push(`Image resolution may be too low for quality printing`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
