import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  merchOrder: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  merchOrderItem: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  merchOrderEvent: {
    create: vi.fn(),
  },
  merchProduct: {
    findMany: vi.fn(),
  },
  merchShipment: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockProdigiProvider = vi.hoisted(() => ({
  name: "PRODIGI" as const,
  createOrder: vi.fn(),
  getQuote: vi.fn(),
  getOrderStatus: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

vi.mock("./prodigi/client", () => ({
  prodigiProvider: mockProdigiProvider,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async <T>(promise: Promise<T>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

import { generateOrderNumber } from "./order-service";

describe("order-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateOrderNumber", () => {
    it("should return a string matching SL-YYYYMMDD-XXXX format", () => {
      const orderNumber = generateOrderNumber();
      expect(orderNumber).toMatch(/^SL-\d{8}-[A-Z2-9]{4}$/);
    });

    it("should include the current date", () => {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      const day = now.getDate().toString().padStart(2, "0");
      const expectedDate = `${year}${month}${day}`;

      const orderNumber = generateOrderNumber();
      expect(orderNumber).toContain(expectedDate);
    });

    it("should not include ambiguous characters (I, O, 0, 1)", () => {
      // Generate many to increase confidence
      for (let i = 0; i < 50; i++) {
        const orderNumber = generateOrderNumber();
        const suffix = orderNumber.split("-")[2];
        expect(suffix).not.toMatch(/[IO01]/);
      }
    });

    it("should generate unique order numbers", () => {
      const numbers = new Set<string>();
      for (let i = 0; i < 20; i++) {
        numbers.add(generateOrderNumber());
      }
      // With 4 chars from 30 possible, collision in 20 attempts is extremely unlikely
      expect(numbers.size).toBeGreaterThanOrEqual(15);
    });
  });

  describe("submitOrderToPod", () => {
    it("should return error when order is not found", async () => {
      mockPrisma.merchOrder.findUnique.mockResolvedValue(null);

      const { submitOrderToPod } = await import("./order-service");
      const result = await submitOrderToPod("nonexistent-order");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Order not found");
    });

    it("should return error when no Prodigi items exist", async () => {
      mockPrisma.merchOrder.findUnique.mockResolvedValue({
        id: "order-1",
        items: [
          {
            id: "item-1",
            product: { provider: "PRINTFUL", providerSku: "sku-1" },
            variant: null,
            quantity: 1,
            imageUrl: "https://example.com/image.png",
          },
        ],
        shippingAddress: {},
        customerEmail: "test@test.com",
      });

      const { submitOrderToPod } = await import("./order-service");
      const result = await submitOrderToPod("order-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No items for Prodigi provider");
    });

    it("should submit order to Prodigi and return success", async () => {
      mockPrisma.merchOrder.findUnique.mockResolvedValue({
        id: "order-1",
        orderNumber: "SL-20260228-AB12",
        customerEmail: "test@test.com",
        shippingAddress: {
          name: "Test User",
          line1: "123 Test St",
          city: "London",
          postalCode: "EC1A 1BB",
          countryCode: "GB",
        },
        items: [
          {
            id: "item-1",
            product: { provider: "PRODIGI", providerSku: "GLOBAL-CAN-16x20" },
            variant: null,
            quantity: 1,
            imageUrl: "https://example.com/image.png",
            customText: null,
          },
        ],
      });

      mockProdigiProvider.createOrder.mockResolvedValue({
        success: true,
        providerOrderId: "prod-order-123",
        status: "InProgress",
      });

      mockPrisma.$transaction.mockResolvedValue(undefined);

      const { submitOrderToPod } = await import("./order-service");
      const result = await submitOrderToPod("order-1");

      expect(result.success).toBe(true);
      expect(result.providerOrderId).toBe("prod-order-123");
      expect(mockProdigiProvider.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          shippingAddress: expect.objectContaining({
            name: "Test User",
            countryCode: "GB",
          }),
          items: [
            expect.objectContaining({
              sku: "GLOBAL-CAN-16x20",
              quantity: 1,
            }),
          ],
        }),
      );
    });

    it("should handle provider submission failure", async () => {
      mockPrisma.merchOrder.findUnique.mockResolvedValue({
        id: "order-1",
        orderNumber: "SL-20260228-AB12",
        customerEmail: "test@test.com",
        shippingAddress: {
          name: "Test",
          line1: "123 St",
          city: "London",
          postalCode: "EC1A",
          countryCode: "GB",
        },
        items: [
          {
            id: "item-1",
            product: { provider: "PRODIGI", providerSku: "sku-1" },
            variant: null,
            quantity: 1,
            imageUrl: "https://example.com/img.png",
            customText: null,
          },
        ],
      });

      mockProdigiProvider.createOrder.mockResolvedValue({
        success: false,
        error: "Invalid SKU",
      });

      mockPrisma.merchOrderEvent.create.mockResolvedValue({});

      const { submitOrderToPod } = await import("./order-service");
      const result = await submitOrderToPod("order-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid SKU");
    });
  });

  describe("updateOrderFromWebhook", () => {
    it("should log warning when no items found for provider order", async () => {
      mockPrisma.merchOrderItem.findMany.mockResolvedValue([]);

      const { updateOrderFromWebhook } = await import("./order-service");
      await updateOrderFromWebhook("unknown-id", "PRODIGI", "shipped");

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("No order items found"));
    });

    it("should update order status and create event for status update", async () => {
      mockPrisma.merchOrderItem.findMany.mockResolvedValue([
        {
          id: "item-1",
          podOrderId: "prod-123",
          order: { id: "order-1" },
        },
      ]);

      const txMock = {
        merchOrderItem: { update: vi.fn() },
        merchOrder: { update: vi.fn() },
        merchShipment: { findFirst: vi.fn(), create: vi.fn() },
        merchOrderEvent: { create: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) =>
        fn(txMock),
      );

      const { updateOrderFromWebhook } = await import("./order-service");
      await updateOrderFromWebhook("prod-123", "PRODIGI", "in_production");

      expect(txMock.merchOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { status: "IN_PRODUCTION" },
      });
      expect(txMock.merchOrderEvent.create).toHaveBeenCalled();
    });

    it("should create shipment when tracking info is provided", async () => {
      mockPrisma.merchOrderItem.findMany.mockResolvedValue([
        {
          id: "item-1",
          podOrderId: "prod-123",
          order: { id: "order-1" },
        },
      ]);

      const txMock = {
        merchOrderItem: { update: vi.fn() },
        merchOrder: { update: vi.fn() },
        merchShipment: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        merchOrderEvent: { create: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) =>
        fn(txMock),
      );

      const { updateOrderFromWebhook } = await import("./order-service");
      await updateOrderFromWebhook(
        "prod-123",
        "PRODIGI",
        "shipped",
        "TRACK123",
        "https://track.example.com/TRACK123",
        "DHL",
      );

      expect(txMock.merchShipment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: "order-1",
          trackingNumber: "TRACK123",
          carrier: "DHL",
          status: "SHIPPED",
        }),
      });
    });

    it("should map cancel status correctly", async () => {
      mockPrisma.merchOrderItem.findMany.mockResolvedValue([
        {
          id: "item-1",
          podOrderId: "prod-123",
          order: { id: "order-1" },
        },
      ]);

      const txMock = {
        merchOrderItem: { update: vi.fn() },
        merchOrder: { update: vi.fn() },
        merchOrderEvent: { create: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) =>
        fn(txMock),
      );

      const { updateOrderFromWebhook } = await import("./order-service");
      await updateOrderFromWebhook("prod-123", "PRODIGI", "cancelled");

      expect(txMock.merchOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { status: "CANCELLED" },
      });
    });
  });
});
