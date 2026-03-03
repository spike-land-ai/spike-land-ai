import { toast } from "sonner";
import { useState } from "react";
import { Wand2, Layers } from "lucide-react";
import { Button, Input, Select, CreditBadge, JobPoller, Badge, ImagePicker } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { ENHANCEMENT_TIERS, ENHANCEMENT_COSTS } from "@/constants/enums";

type Tab = "single" | "batch";

export function Enhance() {
  const [tab, setTab] = useState<Tab>("single");
  // Single enhance
  const [imageId, setImageId] = useState("");
  const [tier, setTier] = useState("TIER_1K");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  // Batch enhance
  const [imageIds, setImageIds] = useState("");
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<Record<string, unknown> | null>(null);

  const handleEnhance = async () => {
    if (!imageId.trim()) return;
    setLoading(true);
    setJobId(null);
    try {
      const res = await callTool("img_enhance", { image_id: imageId, tier });
      const data = parseToolResult<{ jobId?: string; job_id?: string; cost?: number }>(res);
      setJobId(data.jobId ?? data.job_id ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enhancement failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchEnhance = async () => {
    const ids = imageIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return;
    setLoading(true);
    setBatchJobId(null);
    setBatchStatus(null);
    try {
      const results: Record<string, unknown> = {};
      for (const id of ids) {
        const res = await callTool("img_enhance", { image_id: id, tier });
        const data = parseToolResult<{ jobId?: string; job_id?: string }>(res);
        results[id] = data.jobId ?? data.job_id ?? null;
      }
      // Store first job id for status polling, full results in batchStatus
      const firstJobId = Object.values(results)[0] as string | null;
      setBatchJobId(firstJobId);
      setBatchStatus(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch enhancement failed");
    } finally {
      setLoading(false);
    }
  };

  const checkBatchStatus = async () => {
    if (!batchJobId) return;
    try {
      const res = await callTool("img_job_status", { job_id: batchJobId });
      const data = parseToolResult<Record<string, unknown>>(res);
      setBatchStatus(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check status");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Enhance</h2>
        <p className="text-gray-400 mt-1">Upscale and improve your images</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
        <button
          onClick={() => setTab("single")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "single"
              ? "bg-accent-600 text-white"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
          }`}
        >
          <Wand2 className="w-4 h-4" /> Single
        </button>
        <button
          onClick={() => setTab("batch")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "batch"
              ? "bg-accent-600 text-white"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
          }`}
        >
          <Layers className="w-4 h-4" /> Batch
        </button>
      </div>

      <div className="space-y-4">
        <Select
          label="Enhancement Tier"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          options={ENHANCEMENT_TIERS.map((t) => ({
            value: t,
            label: `${t.replace("_", " ")} (${ENHANCEMENT_COSTS[t]} credits)`,
          }))}
        />

        {tab === "single" ? (
          <>
            <ImagePicker
              label="Image"
              value={imageId}
              onChange={setImageId}
              placeholder="Select image to enhance"
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleEnhance} loading={loading} disabled={!imageId.trim()}>
                <Wand2 className="w-4 h-4" /> Enhance
              </Button>
              <CreditBadge cost={ENHANCEMENT_COSTS[tier as keyof typeof ENHANCEMENT_COSTS] ?? 2} />
            </div>
            {jobId && <JobPoller jobId={jobId} toolName="img_job_status" />}
          </>
        ) : (
          <>
            <Input
              label="Image IDs (comma-separated)"
              value={imageIds}
              onChange={(e) => setImageIds(e.target.value)}
              placeholder="id1, id2, id3..."
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleBatchEnhance} loading={loading} disabled={!imageIds.trim()}>
                <Layers className="w-4 h-4" /> Batch Enhance
              </Button>
              {batchJobId && (
                <Button variant="secondary" onClick={checkBatchStatus}>
                  Check Status
                </Button>
              )}
            </div>
            {batchStatus && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <pre className="text-sm text-gray-300 overflow-auto">
                  {JSON.stringify(batchStatus, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
