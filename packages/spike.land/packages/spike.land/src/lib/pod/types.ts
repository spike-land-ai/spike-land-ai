/**
 * Shared types for Print-on-Demand (POD) provider integrations.
 * Abstraction layer to support multiple providers (Prodigi, Printful, etc.)
 */

type PodProviderName = "PRODIGI" | "PRINTFUL";

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  countryCode: string; // ISO 3166-1 alpha-2 (e.g., "GB", "DE", "FR")
  phone?: string;
  email?: string;
}

interface PodOrderItem {
  sku: string;
  quantity: number;
  imageUrl: string;
  sizing?: "fillPrintArea" | "fitPrintArea" | "stretchToPrintArea";
  customText?: string;
}

export interface PodOrderRequest {
  orderId: string; // Our internal order ID for reference
  items: PodOrderItem[];
  shippingAddress: ShippingAddress;
  shippingMethod?: "Budget" | "Standard" | "Express";
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface PodOrderResult {
  success: boolean;
  providerOrderId?: string;
  status?: string;
  error?: string;
  errorCode?: string;
}

export interface PodQuoteItem {
  sku: string;
  quantity: number;
}

export interface PodQuote {
  items: PodQuoteLineItem[];
  shipping: PodShippingOption[];
  currency: string;
}

interface PodQuoteLineItem {
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface PodShippingOption {
  method: string;
  cost: number;
  currency: string;
  estimatedDeliveryDays?: {
    min: number;
    max: number;
  };
}

export interface PodOrderStatus {
  providerOrderId: string;
  status: string;
  statusDetail?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  items?: PodOrderItemStatus[];
}

interface PodOrderItemStatus {
  sku: string;
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

/**
 * Abstract interface for POD providers.
 * Each provider (Prodigi, Printful) implements this interface.
 */
export interface PodProvider {
  readonly name: PodProviderName;

  /**
   * Create an order with the provider.
   */
  createOrder(request: PodOrderRequest): Promise<PodOrderResult>;

  /**
   * Get a quote for items and shipping.
   */
  getQuote(
    items: PodQuoteItem[],
    address: ShippingAddress,
  ): Promise<PodQuote>;

  /**
   * Get the current status of an order.
   */
  getOrderStatus(providerOrderId: string): Promise<PodOrderStatus>;

  /**
   * Cancel an order if still possible.
   */
  cancelOrder?(
    providerOrderId: string,
  ): Promise<{ success: boolean; error?: string; }>;
}
