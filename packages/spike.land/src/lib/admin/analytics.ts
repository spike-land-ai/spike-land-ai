/**
 * Admin User Analytics Business Logic
 *
 * User registration, activity, retention analytics.
 */

export interface UserAnalytics {
  dailyRegistrations: Array<{ date: string; count: number }>;
  authProviders: Array<{ name: string; count: number }>;
  activeUsers: { last7Days: number; last30Days: number };
  totalUsers: number;
  growth: { last7Days: number; last30Days: number };
}

export async function getUserAnalytics(): Promise<UserAnalytics> {
  const prisma = (await import("@/lib/prisma")).default;

  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel with individual error resilience
  const [
    dailyRegistrations,
    activeUsers7d,
    activeUsers30d,
    totalUsers,
    usersLast7Days,
    usersLast30Days,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
      FROM users
      WHERE "createdAt" >= ${last30Days}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `.catch(() => [] as Array<{ date: Date; count: bigint }>),
    prisma.user.count({ where: { updatedAt: { gte: last7Days } } }).catch(() => 0),
    prisma.user.count({ where: { updatedAt: { gte: last30Days } } }).catch(() => 0),
    prisma.user.count().catch(() => 0),
    prisma.user.count({ where: { createdAt: { gte: last7Days } } }).catch(() => 0),
    prisma.user.count({ where: { createdAt: { gte: last30Days } } }).catch(() => 0),
  ]);

  const authProviders = [{ name: "credentials", count: 0 }];

  return {
    dailyRegistrations: Array.isArray(dailyRegistrations)
      ? dailyRegistrations.map((row) => ({
          date: row.date.toISOString().split("T")[0] ?? "",
          count: Number(row.count),
        }))
      : [],
    authProviders,
    activeUsers: { last7Days: activeUsers7d, last30Days: activeUsers30d },
    totalUsers,
    growth: { last7Days: usersLast7Days, last30Days: usersLast30Days },
  };
}
