import { NextResponse } from "next/server";

// Mock admin verification
const requireAdminByUserId = async () => ({ isAdmin: true });

export async function GET() {
  const { isAdmin } = await requireAdminByUserId();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    totalCalls: 1000,
    errorRate: "0.5%",
    topErrors: [{ skillName: "test_tool", errorCount: 5 }],
    latencyStats: [
      { toolName: "test_tool", avgLatency: 120, calls: 500 },
    ]
  });
}
