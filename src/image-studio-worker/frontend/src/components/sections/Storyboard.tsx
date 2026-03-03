import { toast } from "sonner";
import { useState } from "react";
import { Film, Play, Download } from "lucide-react";
import { Button, Input, TextArea, Select, CreditBadge, JobPoller } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { ENHANCEMENT_TIERS, ENHANCEMENT_COSTS } from "@/constants/enums";

export function Storyboard() {
  const [prompt, setPrompt] = useState("");
  const [frameCount, setFrameCount] = useState("4");
  const [tier, setTier] = useState("TIER_1K");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setJobId(null);
    setFrames([]);
    try {
      const res = await callTool("img_generate", {
        prompt,
        frame_count: Number(frameCount),
        tier,
      });
      const data = parseToolResult<{ jobId?: string; job_id?: string }>(res);
      setJobId(data.jobId ?? data.job_id ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create storyboard");
    } finally {
      setLoading(false);
    }
  };

  const handleAssemble = async () => {
    if (!jobId) return;
    setAssembling(true);
    try {
      const res = await callTool("img_blend", { storyboard_id: jobId });
      const data = parseToolResult<{ url?: string }>(res);
      setAssembledUrl(data.url ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assembly failed");
    } finally {
      setAssembling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Storyboard</h2>
        <p className="text-gray-400 mt-1">Generate multi-frame visual narratives</p>
      </div>
      <div className="space-y-4">
        <TextArea
          label="Story Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Describe the story you want to visualize..."
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Frame Count"
            type="number"
            value={frameCount}
            onChange={(e) => setFrameCount(e.target.value)}
          />
          <Select
            label="Tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            options={ENHANCEMENT_TIERS.map((t) => ({
              value: t,
              label: `${t} (${ENHANCEMENT_COSTS[t]} credits)`,
            }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleCreate} loading={loading} disabled={!prompt.trim()}>
            <Film className="w-4 h-4" /> Create Storyboard
          </Button>
          <CreditBadge
            cost={
              (ENHANCEMENT_COSTS[tier as keyof typeof ENHANCEMENT_COSTS] ?? 2) * Number(frameCount)
            }
          />
        </div>
      </div>
      {jobId && (
        <div className="space-y-4">
          <JobPoller
            jobId={jobId}
            toolName="img_job_status"
            onComplete={(data) => {
              const f = data.frames as string[] | undefined;
              if (f) setFrames(f);
            }}
          />
          {frames.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {frames.map((url, i) => (
                  <div
                    key={i}
                    className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                  >
                    <img
                      src={url}
                      alt={`Frame ${i + 1}`}
                      className="w-full aspect-square object-cover"
                    />
                    <p className="text-xs text-gray-500 text-center py-1">Frame {i + 1}</p>
                  </div>
                ))}
              </div>
              <Button variant="secondary" onClick={handleAssemble} loading={assembling}>
                <Download className="w-4 h-4" /> Assemble Storyboard
              </Button>
            </>
          )}
          {assembledUrl && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <img src={assembledUrl} alt="Assembled storyboard" className="w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
