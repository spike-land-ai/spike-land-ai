import { toast } from "sonner";
import { useState, useCallback } from "react";
import { Blend, History, GripVertical, Trash2, Plus } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Button,
  Input,
  Select,
  TextArea,
  CreditBadge,
  JobPoller,
  Badge,
  ImagePicker,
} from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { BLEND_MODES, ENHANCEMENT_TIERS, ENHANCEMENT_COSTS } from "@/constants/enums";

export function PhotoMix() {
  const [layers, setLayers] = useState<{ id: string; value: string }[]>([
    { id: `layer-${Date.now()}-1`, value: "" },
    { id: `layer-${Date.now()}-2`, value: "" },
  ]);

  const [prompt, setPrompt] = useState("");
  const [blendMode, setBlendMode] = useState("overlay");
  const [strength, setStrength] = useState("50");
  const [tier, setTier] = useState("TIER_1K");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleCreate = async () => {
    const ids = layers.map((l) => l.value).filter(Boolean);
    if (ids.length < 2) {
      toast.error("Need at least 2 image IDs");
      return;
    }
    setLoading(true);
    setJobId(null);
    try {
      const res = await callTool("img_blend", {
        image_ids: ids,
        prompt: prompt || undefined,
        blend_mode: blendMode,
        strength: Number(strength),
        tier,
      });
      const data = parseToolResult<{ jobId?: string; job_id?: string }>(res);
      setJobId(data.jobId ?? data.job_id ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mix failed");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = useCallback(async () => {
    try {
      const res = await callTool("img_list", {});
      const data = parseToolResult<{
        mixes: Array<Record<string, unknown>>;
      }>(res);
      setHistory(data.mixes ?? []);
      setShowHistory(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load history");
    }
  }, []);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newLayers = Array.from(layers);
    const [reorderedItem] = newLayers.splice(result.source.index, 1);
    newLayers.splice(result.destination.index, 0, reorderedItem);
    setLayers(newLayers);
  };

  const addLayer = () => {
    setLayers([...layers, { id: `layer-${Date.now()}-${Math.random()}`, value: "" }]);
  };

  const removeLayer = (id: string) => {
    setLayers(layers.filter((l) => l.id !== id));
  };

  const updateLayerValue = (id: string, val: string) => {
    setLayers(layers.map((l) => (l.id === id ? { ...l, value: val } : l)));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Photo Mix</h2>
          <p className="text-gray-400 mt-1">Blend multiple images together</p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadHistory}>
          <History className="w-4 h-4" /> History
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Images to Blend (Layers, Top to Bottom)
          </label>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="mix-layers">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {layers.map((layer, index) => (
                    <Draggable key={layer.id} draggableId={layer.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex items-center gap-3 bg-gray-900 border border-gray-800 p-3 rounded-xl"
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-move text-gray-600 hover:text-gray-400 transition-colors p-1"
                          >
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <ImagePicker
                              value={layer.value}
                              onChange={(val) => updateLayerValue(layer.id, val)}
                              placeholder={`Select Layer ${index + 1}`}
                            />
                          </div>
                          {layers.length > 2 && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => removeLayer(layer.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <div className="pt-2">
            <Button variant="secondary" size="sm" onClick={addLayer}>
              <Plus className="w-4 h-4" /> Add Layer
            </Button>
          </div>
        </div>
        <TextArea
          label="Prompt (optional)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="Describe the blend result"
        />
        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Blend Mode"
            value={blendMode}
            onChange={(e) => setBlendMode(e.target.value)}
            options={BLEND_MODES.map((m) => ({ value: m, label: m }))}
          />
          <Input
            label="Strength"
            type="number"
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
          />
          <Select
            label="Tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            options={ENHANCEMENT_TIERS.map((t) => ({
              value: t,
              label: `${t} (${ENHANCEMENT_COSTS[t as keyof typeof ENHANCEMENT_COSTS]})`,
            }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleCreate} loading={loading}>
            <Blend className="w-4 h-4" /> Create Mix
          </Button>
          <CreditBadge cost={ENHANCEMENT_COSTS[tier as keyof typeof ENHANCEMENT_COSTS] ?? 2} />
        </div>
      </div>

      {jobId && <JobPoller jobId={jobId} toolName="img_job_status" />}

      {showHistory && history.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Mix History</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((mix, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg text-sm"
              >
                <span className="text-gray-300 truncate">
                  {(mix.prompt as string) ?? `Mix #${i + 1}`}
                </span>
                <Badge variant={(mix.status as string) === "COMPLETED" ? "success" : "warning"}>
                  {mix.status as string}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
