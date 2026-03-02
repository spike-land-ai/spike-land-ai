import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock tryCatch to pass through
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

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { prodigiProvider, validateImageForProduct } from "./client";
import type { PodOrderRequest, ShippingAddress } from "../types";

describe("prodigi/client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PRODIGI_API_KEY", "test-api-key");
    vi.stubEnv("PRODIGI_SANDBOX", "true");
  });

  describe("validateImageForProduct", () => {
    it("should return valid for images meeting requirements", () => {
      const result = validateImageForProduct(3000, 4000, 2000, 3000);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return error when width is too small", () => {
      const result = validateImageForProduct(500, 4000, 2000, 3000);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining("width"));
    });

    it("should return error when height is too small", () => {
      const result = validateImageForProduct(3000, 500, 2000, 3000);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining("height"));
    });

    it("should return error for low resolution images", () => {
      const result = validateImageForProduct(100, 100, 50, 50, 150);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining("resolution"));
    });

    it("should return multiple errors for very small images", () => {
      const result = validateImageForProduct(100, 100, 2000, 3000, 150);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("should default to 150 minDpi when not specified", () => {
      // 1500px / 10 = 150 estimated DPI, should pass
      const result = validateImageForProduct(1500, 1500, 100, 100);
      expect(result.valid).toBe(true);
    });
  });

  describe("prodigiProvider", () => {
    it("should have name PRODIGI", () => {
      expect(prodigiProvider.name).toBe("PRODIGI");
    });

    describe("createOrder", () => {
      const mockRequest: PodOrderRequest = {
        orderId: "order-123",
        shippingAddress: {
          name: "Test User",
          line1: "123 Test St",
          city: "London",
          postalCode: "EC1A 1BB",
          countryCode: "GB",
          email: "test@example.com",
        },
        items: [
          {
            sku: "GLOBAL-CAN-16x20",
            quantity: 1,
            imageUrl: "https://example.com/image.png",
          },
        ],
      };

      it("should return success when order is created", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "Created",
            order: {
              id: "prod-order-456",
              status: { stage: "InProgress" },
            },
          }),
        });

        const result = await prodigiProvider.createOrder(mockRequest);
        expect(result.success).toBe(true);
        expect(result.providerOrderId).toBe("prod-order-456");
        expect(result.status).toBe("InProgress");
      });

      it("should handle CreatedWithIssues outcome", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "CreatedWithIssues",
            order: {
              id: "prod-order-789",
              status: {
                stage: "InProgress",
                issues: [{ description: "Low resolution image" }],
              },
            },
          }),
        });

        const result = await prodigiProvider.createOrder(mockRequest);
        expect(result.success).toBe(true);
        expect(result.error).toContain("Low resolution image");
      });

      it("should return failure when API errors", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            statusCode: 400,
            errors: [{ property: "items[0].sku", description: "Invalid SKU" }],
          }),
        });

        const result = await prodigiProvider.createOrder(mockRequest);
        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid SKU");
      });

      it("should send correct headers including API key", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "Created",
            order: { id: "x", status: { stage: "InProgress" } },
          }),
        });

        await prodigiProvider.createOrder(mockRequest);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/orders"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "X-API-Key": "test-api-key",
              "Content-Type": "application/json",
            }),
          }),
        );
      });

      it("should use sandbox URL when PRODIGI_SANDBOX is true", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "Created",
            order: { id: "x", status: { stage: "InProgress" } },
          }),
        });

        await prodigiProvider.createOrder(mockRequest);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("sandbox.prodigi.com"),
          expect.anything(),
        );
      });

      it("should map order request fields correctly", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "Created",
            order: { id: "x", status: { stage: "InProgress" } },
          }),
        });

        await prodigiProvider.createOrder(mockRequest);

        const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
        expect(body.merchantReference).toBe("order-123");
        expect(body.recipient.name).toBe("Test User");
        expect(body.recipient.address.countryCode).toBe("GB");
        expect(body.items[0].sku).toBe("GLOBAL-CAN-16x20");
        expect(body.items[0].copies).toBe(1);
        expect(body.items[0].sizing).toBe("fillPrintArea");
      });

      it("should handle network errors gracefully", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const result = await prodigiProvider.createOrder(mockRequest);
        expect(result.success).toBe(false);
        expect(result.error).toContain("Network error");
      });
    });

    describe("getQuote", () => {
      const mockAddress: ShippingAddress = {
        name: "Test",
        line1: "123 St",
        city: "London",
        postalCode: "EC1A",
        countryCode: "GB",
      };

      it("should return parsed quote with items and shipping", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            quotes: [
              {
                shipmentMethod: "Standard",
                costSummary: {
                  items: { amount: "10.00", currency: "GBP" },
                  shipping: { amount: "5.00", currency: "GBP" },
                  totalCost: { amount: "15.00", currency: "GBP" },
                },
                items: [
                  {
                    sku: "GLOBAL-CAN-16x20",
                    copies: 2,
                    unitCost: { amount: "5.00", currency: "GBP" },
                    totalCost: { amount: "10.00", currency: "GBP" },
                  },
                ],
                shipments: [
                  {
                    carrier: { name: "DHL", service: "Standard" },
                    cost: { amount: "5.00", currency: "GBP" },
                    fulfillmentLocation: {
                      countryCode: "GB",
                      labCode: "LON",
                    },
                    items: [],
                  },
                ],
              },
            ],
          }),
        });

        const result = await prodigiProvider.getQuote(
          [{ sku: "GLOBAL-CAN-16x20", quantity: 2 }],
          mockAddress,
        );

        expect(result.currency).toBe("GBP");
        expect(result.items).toHaveLength(1);
        expect(result.items![0]!.unitCost).toBe(5);
        expect(result.items![0]!.totalCost).toBe(10);
        expect(result.shipping).toHaveLength(1);
        expect(result.shipping![0]!.cost).toBe(5);
      });

      it("should throw when no quotes are available", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ quotes: [] }),
        });

        await expect(
          prodigiProvider.getQuote([{ sku: "INVALID", quantity: 1 }], mockAddress),
        ).rejects.toThrow("No quote available");
      });
    });

    describe("getOrderStatus", () => {
      it("should return mapped status for in-progress order", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "Ok",
            order: {
              id: "prod-123",
              status: {
                stage: "InProgress",
                details: {
                  downloadAssets: "Complete",
                  printReadyAssetsPrepared: "Complete",
                  allocateProductionLocation: "Complete",
                  inProduction: "InProgress",
                  shipping: "NotStarted",
                },
              },
              shipments: [],
              items: [{ sku: "GLOBAL-CAN-16x20", status: "Ok" }],
            },
          }),
        });

        const result = await prodigiProvider.getOrderStatus("prod-123");
        expect(result.providerOrderId).toBe("prod-123");
        expect(result.status).toBe("in_production");
      });

      it("should return shipped status with tracking info", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "Ok",
            order: {
              id: "prod-123",
              status: {
                stage: "InProgress",
                details: {
                  downloadAssets: "Complete",
                  printReadyAssetsPrepared: "Complete",
                  allocateProductionLocation: "Complete",
                  inProduction: "Complete",
                  shipping: "InProgress",
                },
              },
              shipments: [
                {
                  status: "Shipped",
                  carrier: { name: "DHL" },
                  tracking: {
                    number: "TRACK123",
                    url: "https://track.example.com",
                  },
                  dispatchDate: "2026-02-28T10:00:00Z",
                  items: [],
                },
              ],
              items: [{ sku: "GLOBAL-CAN-16x20", status: "Ok" }],
            },
          }),
        });

        const result = await prodigiProvider.getOrderStatus("prod-123");
        expect(result.status).toBe("shipped");
        expect(result.trackingNumber).toBe("TRACK123");
        expect(result.carrier).toBe("DHL");
      });

      it("should throw when order is not found", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "NotFound",
          }),
        });

        await expect(prodigiProvider.getOrderStatus("nonexistent")).rejects.toThrow("not found");
      });
    });

    describe("cancelOrder", () => {
      it("should return success when order is cancelled", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "Cancelled",
            order: { id: "prod-123" },
          }),
        });

        const result = await prodigiProvider.cancelOrder!("prod-123");
        expect(result.success).toBe(true);
      });

      it("should return error when order is not cancellable", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "NotCancellable",
          }),
        });

        const result = await prodigiProvider.cancelOrder!("prod-123");
        expect(result.success).toBe(false);
        expect(result.error).toContain("cannot be cancelled");
      });

      it("should return error when order is not found", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            outcome: "NotFound",
          }),
        });

        const result = await prodigiProvider.cancelOrder!("prod-123");
        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });
    });

    describe("API key handling", () => {
      it("should throw when PRODIGI_API_KEY is not set", async () => {
        vi.stubEnv("PRODIGI_API_KEY", "");

        const result = await prodigiProvider.createOrder({
          orderId: "test",
          shippingAddress: {
            name: "Test",
            line1: "123",
            city: "London",
            postalCode: "EC1A",
            countryCode: "GB",
          },
          items: [{ sku: "test", quantity: 1, imageUrl: "https://example.com/img.png" }],
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("PRODIGI_API_KEY");
      });
    });
  });
});
