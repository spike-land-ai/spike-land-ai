import { toast } from "sonner";
import { useState } from "react";
import { Sparkles, Wand2, ImagePlus } from "lucide-react";
import {
  Button,
  Input,
  TextArea,
  Select,
  CreditBadge,
  JobPoller,
  ImagePicker,
} from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { ENHANCEMENT_TIERS, ENHANCEMENT_COSTS, ASPECT_RATIOS } from "@/constants/enums";
import { storage } from "@/services/storage";

type Tab = "generate" | "advanced" | "modify";

export function Generate() {
  const [tab, setTab] = useState<Tab>("generate");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [tier, setTier] = useState("TIER_1K");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  // For modify tab
  const [modifyImageId, setModifyImageId] = useState("");

  const tabs: Array<{ id: Tab; label: string; icon: typeof Sparkles }> = [
    { id: "generate", label: "Generate", icon: Sparkles },
    { id: "advanced", label: "Advanced", icon: Wand2 },
    { id: "modify", label: "Modify", icon: ImagePlus },
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setJobId(null);
    setResultUrl(null);
    try {
      let toolName = "img_generate";
      const args: Record<string, unknown> = { prompt, tier };

      if (tab === "generate") {
        if (negativePrompt) args.negative_prompt = negativePrompt;
        if (aspectRatio !== "1:1") args.aspect_ratio = aspectRatio;
      } else if (tab === "advanced") {
        toolName = "img_generate";
        if (negativePrompt) args.negative_prompt = negativePrompt;
        if (aspectRatio !== "1:1") args.aspect_ratio = aspectRatio;
      } else if (tab === "modify") {
        toolName = "img_edit";
        args.image_id = modifyImageId;
      }

      const res = await callTool(toolName, args);
      const data = parseToolResult<{ jobId?: string; job_id?: string; error?: string }>(res);
      if (data.error) throw new Error(data.error);
      const id = data.jobId ?? data.job_id;
      if (!id) throw new Error("No job ID returned");
      setJobId(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Generate</h2>
        <p className="text-gray-400 mt-1">Create images with AI</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              tab === id
                ? "bg-accent-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <TextArea
          label="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to create..."
          rows={4}
        />

        {tab !== "modify" && (
          <TextArea
            label="Negative Prompt (optional)"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="What to avoid..."
            rows={2}
          />
        )}

        {tab === "modify" && (
          <ImagePicker
            label="Image to modify"
            value={modifyImageId}
            onChange={setModifyImageId}
            placeholder="Select image to modify"
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Quality Tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            options={ENHANCEMENT_TIERS.map((t) => ({
              value: t,
              label: `${t.replace("_", " ")} (${ENHANCEMENT_COSTS[t]} credits)`,
            }))}
          />
          {tab !== "modify" && (
            <Select
              label="Aspect Ratio"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
            />
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleGenerate} loading={loading} disabled={!prompt.trim()}>
            <Sparkles className="w-4 h-4" />
            Generate
          </Button>
          <CreditBadge cost={ENHANCEMENT_COSTS[tier as keyof typeof ENHANCEMENT_COSTS] ?? 2} />
        </div>
      </div>

      {/* Job polling */}
      {jobId && (
        <div className="space-y-4">
          <JobPoller
            jobId={jobId}
            toolName="img_job_status"
            onComplete={(data) => {
              const url = (data.outputUrl ?? data.outputImageUrl) as string | undefined;
              if (url) {
                fetch(url)
                  .then((r) => r.blob())
                  .then((blob) => {
                    storage
                      .saveImageToLocal(blob, {
                        name: prompt || "Generated Image",
                        width: 1024,
                        height: 1024,
                      })
                      .then((saved) => setResultUrl(saved.url));
                  })
                  .catch(() => setResultUrl(url)); // Fallback
              }
            }}
          />
          {resultUrl && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <img src={resultUrl} alt="Generated" className="w-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
