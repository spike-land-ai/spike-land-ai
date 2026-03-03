import { toast } from "sonner";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Input, TextArea, Select, CreditBadge, JobPoller } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { BRAND_ASSETS, ENHANCEMENT_TIERS, ENHANCEMENT_COSTS } from "@/constants/enums";

export function BrandKit() {
  const [brandName, setBrandName] = useState("");
  const [colors, setColors] = useState("");
  const [tagline, setTagline] = useState("");
  const [assets, setAssets] = useState<string[]>(["logo"]);
  const [tier, setTier] = useState("TIER_1K");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultData, setResultData] = useState<Record<string, unknown> | null>(null);

  const toggleAsset = (asset: string) => {
    setAssets((prev) =>
      prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset],
    );
  };

  const handleGenerate = async () => {
    if (!brandName.trim()) return;
    setLoading(true);
    setJobId(null);
    setResultData(null);
    try {
      const args: Record<string, unknown> = { brand_name: brandName, assets, tier };
      if (colors)
        args.colors = colors
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
      if (tagline) args.tagline = tagline;
      const res = await callTool("img_generate", args);
      const data = parseToolResult<{ jobId?: string; job_id?: string }>(res);
      setJobId(data.jobId ?? data.job_id ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Brand Kit</h2>
        <p className="text-gray-400 mt-1">Generate brand assets with AI</p>
      </div>
      <div className="space-y-4">
        <Input
          label="Brand Name"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Your Brand"
        />
        <Input
          label="Brand Colors (hex, comma-separated)"
          value={colors}
          onChange={(e) => setColors(e.target.value)}
          placeholder="#7c3aed, #1e1b4b"
        />
        <Input
          label="Tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Optional tagline"
        />
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Asset Types</label>
          <div className="flex flex-wrap gap-2">
            {BRAND_ASSETS.map((asset) => (
              <button
                key={asset}
                onClick={() => toggleAsset(asset)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  assets.includes(asset)
                    ? "bg-accent-600/20 border-accent-500/30 text-accent-400"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                {asset.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <Select
          label="Tier"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          options={ENHANCEMENT_TIERS.map((t) => ({
            value: t,
            label: `${t} (${ENHANCEMENT_COSTS[t]} credits)`,
          }))}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleGenerate} loading={loading} disabled={!brandName.trim()}>
            <Sparkles className="w-4 h-4" /> Generate Brand Kit
          </Button>
          <CreditBadge cost={ENHANCEMENT_COSTS[tier as keyof typeof ENHANCEMENT_COSTS] ?? 2} />
        </div>
      </div>
      {jobId && (
        <JobPoller
          jobId={jobId}
          toolName="img_job_status"
          onComplete={(data) => setResultData(data)}
        />
      )}
      {resultData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <pre className="text-xs text-gray-400 overflow-auto">
            {JSON.stringify(resultData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
