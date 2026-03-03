import { toast } from "sonner";
import { useState } from "react";
import { Eraser, Crop, Paintbrush, Eye, Palette, Stamp, Type } from "lucide-react";
import { Button, Input, Select, TextArea, CreditBadge, ImagePicker } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import {
  STYLE_NAMES,
  SMART_CROP_PRESETS,
  WATERMARK_POSITIONS,
  DETAIL_LEVELS,
  BG_OUTPUT_FORMATS,
} from "@/constants/enums";

type AITab =
  | "bg-remove"
  | "smart-crop"
  | "style-transfer"
  | "describe"
  | "palette"
  | "watermark"
  | "text-render";

const AI_TABS: Array<{ id: AITab; label: string; icon: typeof Eraser; cost: number }> = [
  { id: "bg-remove", label: "BG Remove", icon: Eraser, cost: 2 },
  { id: "smart-crop", label: "Smart Crop", icon: Crop, cost: 1 },
  { id: "style-transfer", label: "Style Transfer", icon: Paintbrush, cost: 2 },
  { id: "describe", label: "Describe", icon: Eye, cost: 1 },
  { id: "palette", label: "Palette", icon: Palette, cost: 0 },
  { id: "watermark", label: "Watermark", icon: Stamp, cost: 1 },
  { id: "text-render", label: "Text Render", icon: Type, cost: 1 },
];

export function AITools() {
  const [tab, setTab] = useState<AITab>("bg-remove");
  const [imageId, setImageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  // Tool-specific params
  const [bgFormat, setBgFormat] = useState("png");
  const [cropPreset, setCropPreset] = useState("instagram_square");
  const [styleName, setStyleName] = useState("oil_painting");
  const [styleStrength, setStyleStrength] = useState("75");
  const [detailLevel, setDetailLevel] = useState("brief");
  const [watermarkText, setWatermarkText] = useState("©");
  const [watermarkPos, setWatermarkPos] = useState("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState("50");
  const [textContent, setTextContent] = useState("");
  const [textPrompt, setTextPrompt] = useState("");

  const runTool = async () => {
    if (!imageId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      let toolName = "";
      const args: Record<string, unknown> = { image_id: imageId };
      switch (tab) {
        case "bg-remove":
          toolName = "img_remove_bg";
          args.output_format = bgFormat;
          break;
        case "smart-crop":
          toolName = "img_crop";
          args.preset = cropPreset;
          break;
        case "style-transfer":
          toolName = "img_blend";
          args.style = styleName;
          args.strength = Number(styleStrength);
          break;
        case "describe":
          toolName = "img_analyze";
          args.detail_level = detailLevel;
          break;
        case "palette":
          toolName = "img_analyze";
          args.include_palette = true;
          break;
        case "watermark":
          toolName = "img_watermark";
          args.text = watermarkText;
          args.position = watermarkPos;
          args.opacity = Number(watermarkOpacity);
          break;
        case "text-render":
          toolName = "img_generate";
          args.text_to_render = textContent;
          if (textPrompt) args.prompt = textPrompt;
          break;
      }
      const res = await callTool(toolName, args);
      const data = parseToolResult<Record<string, unknown>>(res);
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const currentTab = AI_TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">AI Tools</h2>
        <p className="text-gray-400 mt-1">Intelligent image processing</p>
      </div>

      {/* Sub-tab nav */}
      <div className="flex flex-wrap gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
        {AI_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === id
                ? "bg-accent-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <ImagePicker
          label="Image"
          value={imageId}
          onChange={setImageId}
          placeholder="Select an image from your library"
        />

        {/* Tab-specific params */}
        {tab === "bg-remove" && (
          <Select
            label="Output Format"
            value={bgFormat}
            onChange={(e) => setBgFormat(e.target.value)}
            options={BG_OUTPUT_FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
          />
        )}
        {tab === "smart-crop" && (
          <Select
            label="Preset"
            value={cropPreset}
            onChange={(e) => setCropPreset(e.target.value)}
            options={SMART_CROP_PRESETS.map((p) => ({ value: p, label: p.replace(/_/g, " ") }))}
          />
        )}
        {tab === "style-transfer" && (
          <>
            <Select
              label="Style"
              value={styleName}
              onChange={(e) => setStyleName(e.target.value)}
              options={STYLE_NAMES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
            />
            <Input
              label="Strength (0-100)"
              type="number"
              value={styleStrength}
              onChange={(e) => setStyleStrength(e.target.value)}
            />
          </>
        )}
        {tab === "describe" && (
          <Select
            label="Detail Level"
            value={detailLevel}
            onChange={(e) => setDetailLevel(e.target.value)}
            options={DETAIL_LEVELS.map((d) => ({ value: d, label: d }))}
          />
        )}
        {tab === "watermark" && (
          <>
            <Input
              label="Watermark Text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
            />
            <Select
              label="Position"
              value={watermarkPos}
              onChange={(e) => setWatermarkPos(e.target.value)}
              options={WATERMARK_POSITIONS.map((p) => ({ value: p, label: p.replace(/-/g, " ") }))}
            />
            <Input
              label="Opacity (0-100)"
              type="number"
              value={watermarkOpacity}
              onChange={(e) => setWatermarkOpacity(e.target.value)}
            />
          </>
        )}
        {tab === "text-render" && (
          <>
            <Input
              label="Text to Render"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Your text here"
            />
            <TextArea
              label="Prompt (optional)"
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder="Style instructions"
              rows={2}
            />
          </>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={runTool} loading={loading} disabled={!imageId.trim()}>
            Run {currentTab.label}
          </Button>
          <CreditBadge cost={currentTab.cost} />
        </div>
      </div>

      {/* Result display */}
      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">Result</h3>
          {"url" in result && (
            <img src={String(result.url)} alt="Result" className="max-w-full rounded-lg" />
          )}
          {"description" in result && (
            <p className="text-sm text-gray-300">{String(result.description)}</p>
          )}
          {"palette" in result && (
            <div className="flex gap-2">
              {(result.palette as string[]).map((color, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 h-10 rounded-lg border border-gray-700"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-400">{color}</span>
                </div>
              ))}
            </div>
          )}
          {Array.isArray(result.tags) && (
            <div className="flex flex-wrap gap-1">
              {(result.tags as string[]).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {!result.url && !result.description && !result.palette && (
            <pre className="text-xs text-gray-400 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
