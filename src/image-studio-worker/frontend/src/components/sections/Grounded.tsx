import { toast } from "sonner";
import { useState } from "react";
import { Globe, Newspaper, Sparkles } from "lucide-react";
import { Button, Select, TextArea, CreditBadge, JobPoller } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { ENHANCEMENT_TIERS, ENHANCEMENT_COSTS, CURRENT_EVENT_STYLES } from "@/constants/enums";

type Tab = "grounded" | "current-event";

export function Grounded() {
  const [tab, setTab] = useState<Tab>("grounded");
  const [prompt, setPrompt] = useState("");
  const [tier, setTier] = useState("TIER_1K");
  const [eventStyle, setEventStyle] = useState("editorial");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setJobId(null);
    try {
      const toolName = "img_generate";
      const args: Record<string, unknown> = { prompt, tier, google_search_grounding: true };
      if (tab === "current-event") args.style = eventStyle;
      const res = await callTool(toolName, args);
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
        <h2 className="text-2xl font-bold text-gray-100">Grounded Generation</h2>
        <p className="text-gray-400 mt-1">Generate images with web search grounding</p>
      </div>
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
        <button
          onClick={() => setTab("grounded")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "grounded" ? "bg-accent-600 text-white" : "text-gray-400 hover:bg-gray-800"
          }`}
        >
          <Globe className="w-4 h-4" /> Grounded
        </button>
        <button
          onClick={() => setTab("current-event")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "current-event" ? "bg-accent-600 text-white" : "text-gray-400 hover:bg-gray-800"
          }`}
        >
          <Newspaper className="w-4 h-4" /> Current Event
        </button>
      </div>
      <div className="space-y-4">
        <TextArea
          label="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={
            tab === "grounded"
              ? "Describe an image grounded in real-world knowledge..."
              : "Describe a current event scene..."
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            options={ENHANCEMENT_TIERS.map((t) => ({
              value: t,
              label: `${t} (${ENHANCEMENT_COSTS[t]})`,
            }))}
          />
          {tab === "current-event" && (
            <Select
              label="Style"
              value={eventStyle}
              onChange={(e) => setEventStyle(e.target.value)}
              options={CURRENT_EVENT_STYLES.map((s) => ({ value: s, label: s }))}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleGenerate} loading={loading} disabled={!prompt.trim()}>
            <Sparkles className="w-4 h-4" /> Generate
          </Button>
          <CreditBadge
            cost={(ENHANCEMENT_COSTS[tier as keyof typeof ENHANCEMENT_COSTS] ?? 2) + 2}
          />
        </div>
      </div>
      {jobId && <JobPoller jobId={jobId} toolName="img_job_status" />}
    </div>
  );
}
