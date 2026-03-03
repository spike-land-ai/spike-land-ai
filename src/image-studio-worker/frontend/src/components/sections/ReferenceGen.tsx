import { toast } from "sonner";
import { useState } from "react";
import { ImagePlus, Blend, Sparkles } from "lucide-react";
import {
  Button,
  Input,
  Select,
  TextArea,
  CreditBadge,
  JobPoller,
  ImagePicker,
} from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { REFERENCE_ROLES, ENHANCEMENT_TIERS, ENHANCEMENT_COSTS } from "@/constants/enums";

type Tab = "references" | "style-blend";

interface RefImage {
  image_id: string;
  role: string;
}

export function ReferenceGen() {
  const [tab, setTab] = useState<Tab>("references");
  const [prompt, setPrompt] = useState("");
  const [tier, setTier] = useState("TIER_1K");
  const [refs, setRefs] = useState<RefImage[]>([{ image_id: "", role: "style" }]);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  // Style blend
  const [contentId, setContentId] = useState("");
  const [styleId, setStyleId] = useState("");

  const addRef = () => setRefs([...refs, { image_id: "", role: "style" }]);

  const updateRef = (i: number, field: keyof RefImage, value: string) => {
    const updated = [...refs];
    updated[i] = { ...updated[i], [field]: value };
    setRefs(updated);
  };

  const removeRef = (i: number) => setRefs(refs.filter((_, idx) => idx !== i));

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    const validRefs = refs.filter((r) => r.image_id.trim());
    if (validRefs.length === 0) {
      toast.error("Add at least one reference image");
      return;
    }
    setLoading(true);
    setJobId(null);
    try {
      const res = await callTool("img_generate", {
        prompt,
        tier,
        reference_images: validRefs,
      });
      const data = parseToolResult<{ jobId?: string; job_id?: string }>(res);
      setJobId(data.jobId ?? data.job_id ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStyleBlend = async () => {
    if (!contentId.trim() || !styleId.trim()) return;
    setLoading(true);
    setJobId(null);
    try {
      const res = await callTool("img_blend", {
        content_image_id: contentId,
        style_image_id: styleId,
        tier,
      });
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
        <h2 className="text-2xl font-bold text-gray-100">Reference Generate</h2>
        <p className="text-gray-400 mt-1">Generate using reference images</p>
      </div>
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
        <button
          onClick={() => setTab("references")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "references" ? "bg-accent-600 text-white" : "text-gray-400 hover:bg-gray-800"
          }`}
        >
          <ImagePlus className="w-4 h-4" /> References
        </button>
        <button
          onClick={() => setTab("style-blend")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "style-blend" ? "bg-accent-600 text-white" : "text-gray-400 hover:bg-gray-800"
          }`}
        >
          <Blend className="w-4 h-4" /> Style Blend
        </button>
      </div>

      {tab === "references" ? (
        <div className="space-y-4">
          <TextArea
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe desired output..."
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Reference Images</label>
            {refs.map((ref, i) => (
              <div key={i} className="flex gap-2">
                <div className="flex-1">
                  <ImagePicker
                    placeholder="Select Reference Image"
                    value={ref.image_id}
                    onChange={(val) => updateRef(i, "image_id", val)}
                  />
                </div>
                <Select
                  value={ref.role}
                  onChange={(e) => updateRef(i, "role", e.target.value)}
                  options={REFERENCE_ROLES.map((r) => ({ value: r, label: r }))}
                />
                {refs.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeRef(i)}>
                    x
                  </Button>
                )}
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addRef}>
              + Add Reference
            </Button>
          </div>
          <Select
            label="Tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            options={ENHANCEMENT_TIERS.map((t) => ({
              value: t,
              label: `${t} (${ENHANCEMENT_COSTS[t]})`,
            }))}
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} loading={loading} disabled={!prompt.trim()}>
              <Sparkles className="w-4 h-4" /> Generate
            </Button>
            <CreditBadge
              cost={
                (ENHANCEMENT_COSTS[tier as keyof typeof ENHANCEMENT_COSTS] ?? 2) +
                refs.filter((r) => r.image_id).length * 2
              }
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <ImagePicker
            label="Content Image"
            value={contentId}
            onChange={setContentId}
            placeholder="Select Source Image"
          />
          <ImagePicker
            label="Style Image"
            value={styleId}
            onChange={setStyleId}
            placeholder="Select Style Reference"
          />
          <Select
            label="Tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            options={ENHANCEMENT_TIERS.map((t) => ({
              value: t,
              label: `${t} (${ENHANCEMENT_COSTS[t]})`,
            }))}
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={handleStyleBlend}
              loading={loading}
              disabled={!contentId.trim() || !styleId.trim()}
            >
              <Blend className="w-4 h-4" /> Blend Styles
            </Button>
            <CreditBadge
              cost={(ENHANCEMENT_COSTS[tier as keyof typeof ENHANCEMENT_COSTS] ?? 2) + 4}
            />
          </div>
        </div>
      )}
      {jobId && <JobPoller jobId={jobId} toolName="img_job_status" />}
    </div>
  );
}
