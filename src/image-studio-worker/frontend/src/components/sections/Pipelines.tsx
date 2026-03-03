import { toast } from "sonner";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Workflow, Plus, Trash2, Copy, Settings } from "lucide-react";
import { Button, Input, Select, TextArea, Badge, Modal } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { ENHANCEMENT_TIERS, PIPELINE_VISIBILITY } from "@/constants/enums";

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  visibility: string;
  tier?: string;
  usageCount?: number;
}

const pipelineSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  visibility: z.string(),
  tier: z.string(),
});
type PipelineFormData = z.infer<typeof pipelineSchema>;

export function Pipelines() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Pipeline | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Pipeline | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PipelineFormData>({
    resolver: zodResolver(pipelineSchema),
    defaultValues: {
      name: "",
      description: "",
      visibility: "PRIVATE",
      tier: "TIER_1K",
    },
  });

  const { data: pipelinesData, isLoading: loading } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const res = await callTool("img_pipeline_list", {});
      const data = parseToolResult<{ pipelines: Pipeline[] }>(res);
      return data.pipelines ?? [];
    },
  });
  const pipelines = pipelinesData ?? [];

  const handleCreate = async (data: PipelineFormData) => {
    try {
      await callTool("img_pipeline_save", {
        name: data.name,
        description: data.description || undefined,
        visibility: data.visibility,
        tier: data.tier,
      });
      setShowCreate(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Pipeline created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await callTool("img_pipeline_delete", { pipeline_id: deleteTarget.id });
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
        setDetail(null);
      }
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Pipeline deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleFork = async (pipeline: Pipeline) => {
    try {
      await callTool("img_pipeline_save", { pipeline_id: pipeline.id });
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Pipeline forked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fork failed");
    }
  };

  const viewDetail = async (pipeline: Pipeline) => {
    setSelected(pipeline);
    try {
      const res = await callTool("img_pipeline", { pipeline_id: pipeline.id });
      setDetail(parseToolResult<Record<string, unknown>>(res));
    } catch {
      setDetail(null);
    }
  };

  const visibilityOptions = PIPELINE_VISIBILITY.map((v) => ({ value: v, label: v }));
  const tierOptions = ENHANCEMENT_TIERS.map((t) => ({ value: t, label: t }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Pipelines</h2>
          <p className="text-gray-400 mt-1">Reusable enhancement workflows</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Pipeline
        </Button>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-72 shrink-0 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
            ))
          ) : pipelines.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No pipelines</p>
          ) : (
            pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => viewDetail(p)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected?.id === p.id
                    ? "bg-accent-600/10 border-accent-500/30"
                    : "bg-gray-900 border-gray-800 hover:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-200 truncate">{p.name}</span>
                  <Badge variant={p.visibility === "PUBLIC" ? "success" : "default"}>
                    {p.visibility}
                  </Badge>
                </div>
                {p.usageCount !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">{p.usageCount} uses</p>
                )}
              </button>
            ))
          )}
        </div>
        <div className="flex-1">
          {selected && detail ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">{selected.name}</h3>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleFork(selected)}>
                    <Copy className="w-4 h-4" /> Fork
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(selected)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {selected.description && (
                <p className="text-sm text-gray-400">{selected.description}</p>
              )}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <pre className="text-xs text-gray-400 overflow-auto max-h-96">
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Select a pipeline to view details
            </div>
          )}
        </div>
      </div>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Pipeline">
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <div>
            <Input label="Name" placeholder="Pipeline name" {...register("name")} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <TextArea label="Description" rows={2} {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select
                label="Visibility"
                options={visibilityOptions}
                value={watch("visibility")}
                onChange={(e) => setValue("visibility", e.target.value)}
              />
            </div>
            <div>
              <Select
                label="Tier"
                options={tierOptions}
                value={watch("tier")}
                onChange={(e) => setValue("tier", e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Pipeline">
        <p className="text-gray-300">
          Delete <strong>{deleteTarget?.name}</strong>?
        </p>
        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
