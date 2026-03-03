/**
 * Admin Merch Business Logic
 *
 * Merchandise metrics and order data.
 */

export interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  customerName: string;
  itemCount: number;
  createdAt: string;
}

export interface MerchMetrics {
  totalOrders: number;
  pendingOrders: number;
  inProductionOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  totalProducts: number;
  activeProducts: number;
  totalRevenue: number;
  recentOrders: RecentOrder[];
}

export async function getMerchMetrics(): Promise<MerchMetrics> {
  const prisma = (await import("@/lib/prisma")).default;

  const [
    totalOrders,
    pendingOrders,
    inProductionOrders,
    shippedOrders,
    deliveredOrders,
    totalProducts,
    activeProducts,
    totalRevenue,
    recentOrders,
  ] = await Promise.all([
    prisma.merchOrder.count(),
    prisma.merchOrder.count({ where: { status: "PENDING" } }),
    prisma.merchOrder.count({ where: { status: "IN_PRODUCTION" } }),
    prisma.merchOrder.count({ where: { status: "SHIPPED" } }),
    prisma.merchOrder.count({ where: { status: "DELIVERED" } }),
    prisma.merchProduct.count(),
    prisma.merchProduct.count({ where: { isActive: true } }),
    prisma.merchOrder.aggregate({
      where: {
        status: {
          in: ["PAID", "SUBMITTED", "IN_PRODUCTION", "SHIPPED", "DELIVERED"],
        },
      },
      _sum: { totalAmount: true },
    }),
    prisma.merchOrder.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    totalOrders,
    pendingOrders,
    inProductionOrders,
    shippedOrders,
    deliveredOrders,
    totalProducts,
    activeProducts,
    totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
    recentOrders: recentOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      customerName: order.user.name || order.user.email || "Unknown",
      itemCount: order._count.items,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}
