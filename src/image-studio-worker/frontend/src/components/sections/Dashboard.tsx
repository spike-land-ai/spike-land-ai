import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Zap, TrendingUp, Image, FolderOpen } from "lucide-react";
import { Button, Badge, CreditBadge } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { ENHANCEMENT_COSTS, ENHANCEMENT_TIERS, ADVANCED_FEATURE_COSTS } from "@/constants/enums";

interface Stats {
  imageCount: number;
  remaining: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [balRes, libRes] = await Promise.all([
          callTool("img_credits"),
          callTool("img_list", { limit: 1 }),
        ]);
        const bal = parseToolResult<{ remaining: number }>(balRes);
        const lib = parseToolResult<{ count: number; images: unknown[] }>(libRes);
        setStats({ remaining: bal.remaining, imageCount: lib.count });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-800 rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Dashboard</h2>
        <p className="text-gray-400 mt-1">Welcome to Pixel Studio</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent-600/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent-400" />
            </div>
            <span className="text-sm text-gray-400">Credits</span>
          </div>
          <p className="text-3xl font-bold text-gray-100">
            {(stats?.remaining ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">100 credits/week</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Image className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm text-gray-400">Images</span>
          </div>
          <p className="text-3xl font-bold text-gray-100">{stats?.imageCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">in your library</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-sm text-gray-400">Mode</span>
          </div>
          <p className="text-xl font-bold text-amber-400">100 credits/week</p>
          <p className="text-xs text-gray-500 mt-1">free tier allowance</p>
        </div>
      </div>

      {/* Cost reference */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Credit Costs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Enhancement Tiers</h4>
            <div className="space-y-2">
              {ENHANCEMENT_TIERS.map((tier) => (
                <div
                  key={tier}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-800/50"
                >
                  <span className="text-sm text-gray-300">{tier.replace("_", " ")}</span>
                  <CreditBadge cost={ENHANCEMENT_COSTS[tier]} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Advanced Features</h4>
            <div className="space-y-2">
              {Object.entries(ADVANCED_FEATURE_COSTS).map(([name, cost]) => (
                <div
                  key={name}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-800/50"
                >
                  <span className="text-sm text-gray-300 capitalize">
                    {name.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <CreditBadge cost={cost} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
