import { describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  merchOrder: {
    count: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  merchProduct: {
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

describe("getMerchMetrics", () => {
  it("returns correct shape with mocked data", async () => {
    mockPrisma.merchOrder.count
      .mockResolvedValueOnce(50) // totalOrders
      .mockResolvedValueOnce(5) // pendingOrders
      .mockResolvedValueOnce(10) // inProductionOrders
      .mockResolvedValueOnce(8) // shippedOrders
      .mockResolvedValueOnce(27); // deliveredOrders
    mockPrisma.merchProduct.count
      .mockResolvedValueOnce(20) // totalProducts
      .mockResolvedValueOnce(15); // activeProducts
    mockPrisma.merchOrder.aggregate.mockResolvedValueOnce({
      _sum: { totalAmount: 12500 },
    });
    mockPrisma.merchOrder.findMany.mockResolvedValueOnce([
      {
        id: "order-1",
        orderNumber: "ORD-001",
        status: "SHIPPED",
        totalAmount: 2500,
        currency: "GBP",
        user: { name: "Alice", email: "alice@example.com" },
        _count: { items: 3 },
        createdAt: new Date("2024-06-15T10:00:00Z"),
      },
    ]);

    const { getMerchMetrics } = await import("./merch");
    const metrics = await getMerchMetrics();

    expect(metrics).toEqual({
      totalOrders: 50,
      pendingOrders: 5,
      inProductionOrders: 10,
      shippedOrders: 8,
      deliveredOrders: 27,
      totalProducts: 20,
      activeProducts: 15,
      totalRevenue: 12500,
      recentOrders: [
        {
          id: "order-1",
          orderNumber: "ORD-001",
          status: "SHIPPED",
          totalAmount: 2500,
          currency: "GBP",
          customerName: "Alice",
          itemCount: 3,
          createdAt: "2024-06-15T10:00:00.000Z",
        },
      ],
    });
  });

  it("handles null totalAmount from aggregate", async () => {
    mockPrisma.merchOrder.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.merchProduct.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.merchOrder.aggregate.mockResolvedValueOnce({
      _sum: { totalAmount: null },
    });
    mockPrisma.merchOrder.findMany.mockResolvedValueOnce([]);

    const { getMerchMetrics } = await import("./merch");
    const metrics = await getMerchMetrics();

    expect(metrics.totalRevenue).toBe(0);
    expect(metrics.recentOrders).toEqual([]);
  });

  it("falls back to email when user.name is null", async () => {
    mockPrisma.merchOrder.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.merchProduct.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockPrisma.merchOrder.aggregate.mockResolvedValueOnce({
      _sum: { totalAmount: 500 },
    });
    mockPrisma.merchOrder.findMany.mockResolvedValueOnce([
      {
        id: "order-2",
        orderNumber: "ORD-002",
        status: "PENDING",
        totalAmount: 500,
        currency: "GBP",
        user: { name: null, email: "bob@example.com" },
        _count: { items: 1 },
        createdAt: new Date("2024-07-01T12:00:00Z"),
      },
    ]);

    const { getMerchMetrics } = await import("./merch");
    const metrics = await getMerchMetrics();

    expect(metrics.recentOrders[0]?.customerName).toBe("bob@example.com");
  });

  it("falls back to 'Unknown' when both name and email are null", async () => {
    mockPrisma.merchOrder.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.merchProduct.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockPrisma.merchOrder.aggregate.mockResolvedValueOnce({
      _sum: { totalAmount: 300 },
    });
    mockPrisma.merchOrder.findMany.mockResolvedValueOnce([
      {
        id: "order-3",
        orderNumber: "ORD-003",
        status: "DELIVERED",
        totalAmount: 300,
        currency: "GBP",
        user: { name: null, email: null },
        _count: { items: 2 },
        createdAt: new Date("2024-08-01T08:00:00Z"),
      },
    ]);

    const { getMerchMetrics } = await import("./merch");
    const metrics = await getMerchMetrics();

    expect(metrics.recentOrders[0]).toBeDefined();
    expect(metrics.recentOrders[0]!.customerName).toBe("Unknown");
  });
});
